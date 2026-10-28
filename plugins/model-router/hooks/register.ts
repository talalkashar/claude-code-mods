import type { Register } from 'claude-code'

// Search/locate jobs need no judgment and go to a cheap model; real work
// gets Opus. Fable is never used.
const ROUTES: Record<string, string> = {
  Explore: 'haiku',
  'claude-code-guide': 'haiku',
  'statusline-setup': 'haiku',
  Plan: 'opus',
}
const DEFAULT = 'opus'
const BLOCKED = /fable/i

export const routeFor = (type: string, asked?: string) => {
  if (asked && !BLOCKED.test(asked)) {
    return asked
  }

  return ROUTES[type] ?? DEFAULT
}

export const register: Register = on => {
  const counts: Record<string, number> = {}

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'routes',
      description: 'Show which model each subagent type is routed to',
    })

    return next(e)
  })

  on('command.run', { command: 'routes' }, async () => {
    const table = Object.entries(ROUTES)
      .map(([type, model]) => `  ${type} → ${model}`)
      .join('\n')
    const used = Object.entries(counts)
      .map(([model, n]) => `${model} ×${n}`)
      .join(', ')

    return {
      text: `Subagent routes:\n${table}\n  everything else → ${DEFAULT}\n  Fable is never used.\nThis session: ${used || 'no subagents yet'}`,
    }
  })

  on('agent.spawn', async ($, e, next) => {
    // A fork runs on the parent's model by design; leave it alone.
    if (e.fork) {
      return next(e)
    }
    const model = routeFor(e.subagentType, e.model)
    counts[model] = (counts[model] ?? 0) + 1
    if (model !== e.model) {
      $.ui.status(`model-router: ${e.subagentType} → ${model}`)
    }

    return next({ ...e, model })
  })
}
