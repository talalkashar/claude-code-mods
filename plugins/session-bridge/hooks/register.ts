import type { EngineInterface, Register } from 'claude-code'

type Peer = { cwd: string; label: string; seen: number }
type Peers = Record<string, Peer>

const BEAT = 60_000
const STALE = 3 * BEAT

const label = (cwd: string, id: string) => `${cwd.split('/').filter(Boolean).pop() ?? cwd}#${id.slice(0, 4)}`

// The store is a file on disk: take only well-formed rows from it.
const load = async ($: EngineInterface): Promise<Peers> => {
  const raw = await $.store.get('peers')
  const peers: Peers = Object.create(null)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return peers
  for (const [id, p] of Object.entries(raw as Record<string, unknown>)) {
    const row = p as Partial<Peer> | null
    if (row && typeof row.cwd === 'string' && typeof row.label === 'string' && typeof row.seen === 'number') {
      peers[id] = { cwd: row.cwd, label: row.label, seen: row.seen }
    }
  }
  return peers
}

// Every session writes its own row; rows that stop beating fall out.
const beat = async ($: EngineInterface, id: string, cwd: string) => {
  const now = await $.clock.now()
  const peers = await load($)
  peers[id] = { cwd, label: label(cwd, id), seen: now }
  for (const [key, peer] of Object.entries(peers)) {
    if (now - peer.seen > STALE) delete peers[key]
  }
  await $.store.set('peers', peers)
}

const others = async ($: EngineInterface, self: string) => {
  const now = await $.clock.now()
  return Object.entries(await load($)).filter(([id, p]) => id !== self && now - p.seen <= STALE)
}

export const register: Register = on => {
  let self = ''
  let lastAnswer = ''
  let here = ''

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    self = await $.session.id()
    here = e.cwd
    await beat($, self, e.cwd)
    $.clock.every(BEAT, () => void beat($, self, e.cwd))
    await $.command.register({ name: 'bridge', description: 'List your other open Claude Code sessions' })
    await $.command.register({
      name: 'handoff',
      description: 'Send a plan or update to another session (default: the last answer)',
      argumentHint: '[peer #] [message]',
    })

    return started
  })

  on('session.end', async ($, e, next) => {
    const peers = await load($)
    delete peers[e.sessionId]
    await $.store.set('peers', peers)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId && !e.isAborted && e.answer) lastAnswer = e.answer

    return next(e)
  })

  on('command.run', { command: 'bridge' }, async $ => {
    const list = await others($, self)
    if (list.length === 0) return { text: 'No other sessions running with session-bridge.' }

    return { text: list.map(([, p], i) => `${i + 1}. ${p.label}  ${p.cwd}`).join('\n') }
  })

  on('command.run', { command: 'handoff' }, async ($, e) => {
    const list = await others($, self)
    const [first = '', ...rest] = e.args.trim().split(/\s+/)
    const pick = /^\d+$/.test(first) ? Number(first) : 0
    const message = (pick ? rest.join(' ') : e.args.trim()) || lastAnswer
    if (list.length === 0) return { text: 'No other session to hand off to. Open one and try /bridge.' }
    if (!pick && list.length > 1) return { text: `Several sessions are open; name one by number:\n${list.map(([, p], i) => `${i + 1}. ${p.label}`).join('\n')}` }
    const target = list[(pick || 1) - 1]
    if (!target) return { text: `No peer #${pick}. See /bridge.` }
    if (!message) return { text: 'Nothing to send yet: add a message, or run it after a turn.' }

    const from = label(here, self)
    const sent = await $.session.send({
      to: { sessionId: target[0] },
      text: `Handoff from session ${from}. Reply with /handoff from your side, or SendMessage, when you have an update.\n\n${message}`,
    })

    return { text: sent.isDelivered ? `Handed off to ${target[1].label}.` : `Not delivered: ${sent.reason}` }
  })
}
