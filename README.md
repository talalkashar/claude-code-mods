# Claude Code mods

Three small Claude Code mods for working with several agents at once. None of them call a model, open the network, or touch your files: they are local hooks, so they add no token usage.

| Mod | What it does | Commands |
| --- | --- | --- |
| **agent-board** | A live side pane: each subagent's task, type, model, tool count, the tool it is running now, and elapsed time. Opens itself when the first subagent starts. | `/agent-board` |
| **model-router** | Picks a model per subagent type so the expensive model is used where it matters: `Explore`, `claude-code-guide`, `statusline-setup` → Haiku; everything else → Opus. A model the caller names explicitly is kept, except Fable, which is routed to Opus. Forks keep the parent's model. Edit `ROUTES` in `hooks/register.ts` to change it. | `/routes` |
| **session-bridge** | Hand a plan from one of your open sessions (say, a planner) to another (a builder), and send updates back. Sessions on the same machine with the mod find each other. | `/bridge` lists them, `/handoff [#] [message]` sends (no message: your last answer) |

## Install

At the prompt of a terminal session:

```
/plugin install agent-board --marketplace talalkashar/claude-code-mods
/plugin install model-router --marketplace talalkashar/claude-code-mods
/plugin install session-bridge --marketplace talalkashar/claude-code-mods
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every session).

From a shell:

```
claude plugin install agent-board --marketplace talalkashar/claude-code-mods
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `talalkashar/claude-code-mods`, then Add plugin.

## Notes

- session-bridge only delivers to your own running sessions on this machine. A handoff arrives in the other session as a message from a peer session; read it like any other input before acting on it. The list of open sessions is kept in the mod's own store and entries drop out three minutes after a session stops.
- Each mod has tests: `claude plugin test plugins/<mod>`.

## License

MIT
