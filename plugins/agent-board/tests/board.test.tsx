import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'agent-board',
  component: 'Pane',
  requestId: 'agent-board',
  props: {
    title: 'Agents',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

test('a subagent shows running with its tool, then done', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'a1' }))
  on('tool.call', () => ({ result: {} }))
  on('turn.complete', (_, e) => ({ text: e.answer }))

  await $.agent.spawn({ prompt: 'find the router', description: 'Find router code', subagentType: 'Explore' } as never)
  await clock.advance(3000)
  await $.tool.call({ tool: 'Bash', command: 'grep -r router .', agentId: 'a1' })

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /Find router code/ }))?.text).toBe('● Find router code')
    expect((await ui.find({ type: 'Text', text: /Explore/ }))?.text).toMatch(/Explore · claude-haiku-5-5 · 1 tools · now Bash · 3s/)
    await ui.unmount()
  }

  await $.turn.complete({ answer: 'found it', durationMs: 5, isAborted: false, turnId: 't1', agentId: 'a1', reason: 'answer' } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /Find router code/ }))?.text).toBe('✓ Find router code')
  expect((await ui.find({ type: 'Text', text: /running/ }))?.text).toBe('0 running, 1 finished')
  await ui.press({ key: 'clear' })
  expect((await ui.find({ type: 'Text', text: /No agents yet/ }))?.text).toBe('No agents yet.')
  await ui.unmount()
})

test('main-loop tool calls are ignored', async ($, on) => {
  mock.clock(on)
  on('tool.call', () => ({ result: {} }))
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /No agents/ }))?.text).toBe('No agents yet.')
  await ui.unmount()
})
