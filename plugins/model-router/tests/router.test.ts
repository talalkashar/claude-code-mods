import { expect, test } from 'claude-code/testing'

const spawn = (subagentType: string, model?: string) =>
  ({ prompt: 'p', description: 'd', subagentType, model }) as never

test('search agents go to haiku, workers to opus, fable never', async ($, on) => {
  const seen: (string | undefined)[] = []
  on('agent.spawn', (_, e) => {
    seen.push(e.model)
    return { model: e.model ?? 'parent', agentId: `a${seen.length}` }
  })
  on('ui.status', () => ({ value: undefined }))

  await $.agent.spawn(spawn('Explore'))
  await $.agent.spawn(spawn('general-purpose'))
  await $.agent.spawn(spawn('general-purpose', 'claude-fable-5-1'))
  await $.agent.spawn(spawn('general-purpose', 'sonnet'))
  await $.agent.spawn(spawn('Plan'))

  expect(seen).toEqual(['haiku', 'opus', 'opus', 'sonnet', 'opus'])
})

test('/routes lists the table and what was used', async ($, on) => {
  on('agent.spawn', (_, e) => ({ model: e.model ?? 'x', agentId: 'a1' }))
  on('ui.status', () => ({ value: undefined }))
  on('command.run', () => ({ text: 'engine' }))
  await $.agent.spawn(spawn('Explore'))

  const out = await $.command.run({ command: 'routes', args: '' } as never)
  expect(out.text).toMatch(/Explore → haiku/)
  expect(out.text).toMatch(/haiku ×1/)
})
