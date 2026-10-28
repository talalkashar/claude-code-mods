import { expect, mock, test } from 'claude-code/testing'

const run = (args: string) => ({ command: 'handoff', args }) as never

test('hands the last answer to the one other session, and skips stale ones', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on, {
    peers: {
      peer9999: { cwd: '/w/builder', label: 'builder#peer', seen: 1_000_000 },
      old00000: { cwd: '/w/old', label: 'old#old0', seen: 1 },
    },
  })
  const sent: { to: string; text: string }[] = []
  on('session.id', () => ({ value: 'self1234' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('command.run', () => ({ text: 'engine' }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('session.send', (_, e) => {
    sent.push({ to: e.to, text: e.text })
    return { isDelivered: true }
  })

  await $.session.start({ cwd: '/w/planner', surface: 'terminal', isInteractive: true })
  await $.turn.complete({ answer: 'PLAN: step 1, step 2', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' } as never)

  const peers = await $.command.run({ command: 'bridge', args: '' } as never)
  expect(peers.text).toBe('1. builder#peer  /w/builder')

  const out = await $.command.run(run(''))
  expect(out.text).toBe('Handed off to builder#peer.')
  expect(sent).toHaveLength(1)
  expect(sent[0]?.text).toMatch(/Handoff from session planner#self/)
  expect(sent[0]?.text).toMatch(/PLAN: step 1, step 2/)

  // Past the stale window with no beat from the builder, it drops out.
  await clock.advance(4 * 60_000)
  expect((await $.command.run({ command: 'bridge', args: '' } as never)).text).toMatch(/No other sessions/)
})

test('with several peers it asks for a number, and a numbered message goes there', async ($, on) => {
  mock.clock(on, { now: 5000 })
  mock.store(on, {
    peers: { a: { cwd: '/a', label: 'a#a', seen: 5000 }, b: { cwd: '/b', label: 'b#b', seen: 5000 } },
  })
  const sent: string[] = []
  on('session.id', () => ({ value: 'me' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('command.run', () => ({ text: 'engine' }))
  on('session.send', (_, e) => (sent.push(e.to), { isDelivered: true }))

  await $.session.start({ cwd: '/me', surface: 'terminal', isInteractive: true })

  expect((await $.command.run(run('ship it'))).text).toMatch(/name one by number/)
  expect((await $.command.run(run('2 tests are green'))).text).toBe('Handed off to b#b.')
  expect(sent).toHaveLength(1)
})
