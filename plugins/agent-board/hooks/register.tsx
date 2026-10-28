import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { AgentRow } from '../types'

const PANE = 'agent-board'
// Change the tag when AgentRow's fields change.
const agents = atom({ plugin: 'agent-board', key: 'agents' } as const, [], {
  shape: 'agents-1',
})

const seconds = (from: number, to: number) => `${Math.max(0, Math.round((to - from) / 1000))}s`

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'agent-board',
      description: 'Show the agent board: what each subagent is working on',
    })

    return next(e)
  })

  on('command.run', { command: 'agent-board' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Agents' })

    return { text: 'Agent board opened.' }
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.deny || !started.agentId) {
      return started
    }
    const row: AgentRow = {
      id: started.agentId,
      description: e.description,
      type: e.subagentType,
      model: started.model,
      status: 'running',
      lastTool: '',
      tools: 0,
      startedAt: await $.clock.now(),
      endedAt: 0,
    }
    await update($, agents, list => [...list.filter(a => a.id !== row.id), row].slice(-50))
    // Opens itself the first time agents are in play.
    void $.ui.open({ id: PANE, title: 'Agents' })

    return started
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId) {
      const id = e.agentId
      await update($, agents, list =>
        list.map(a => (a.id === id ? { ...a, lastTool: e.tool, tools: a.tools + 1 } : a)),
      )
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId) {
      const id = e.agentId
      const now = await $.clock.now()
      const status = e.isAborted ? 'failed' : 'done'
      await update($, agents, list =>
        list.map(a => (a.id === id ? { ...a, status, endedAt: now } : a)),
      )
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, agents)
    const now = await $.clock.now()
    const running = list.filter(a => a.status === 'running')
    const room = Math.max(1, Math.floor(((e.viewport?.rows ?? 24) - 4) / 2))

    return (
      <Box flexDirection="column">
        <Text bold>
          {running.length} running, {list.length - running.length} finished
        </Text>
        {list.length === 0 && <Text dimColor>No agents yet.</Text>}
        {list.slice(-room).reverse().map(a => (
          <Box flexDirection="column">
            <Text color={a.status === 'running' ? 'green' : a.status === 'failed' ? 'red' : undefined} dimColor={a.status === 'done'}>
              {a.status === 'running' ? '● ' : a.status === 'failed' ? '✗ ' : '✓ '}
              {a.description}
            </Text>
            <Text dimColor>
              {'  '}
              {a.type} · {a.model} · {a.tools} tools
              {a.lastTool && a.status === 'running' ? ` · now ${a.lastTool}` : ''} ·{' '}
              {seconds(a.startedAt, a.endedAt || now)}
            </Text>
          </Box>
        ))}
        {list.length > running.length && (
          <Button
            key="clear"
            label="Clear finished"
            onPress={() => update($, agents, l => l.filter(a => a.status === 'running'))}
          />
        )}
      </Box>
    )
  })
}
