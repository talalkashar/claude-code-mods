export type AgentRow = {
  id: string
  description: string
  type: string
  model: string
  status: 'running' | 'done' | 'failed'
  lastTool: string
  tools: number
  startedAt: number
  endedAt: number
}

declare module 'claude-code' {
  interface PluginState {
    'agent-board': { agents: Shaped<AgentRow[]> }
  }
}
