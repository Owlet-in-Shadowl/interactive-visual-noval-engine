# Interactive Visual Novel Engine

## Session Startup Ritual

Every session MUST begin with these steps, in order:

1. **Verify environment**: `pwd` to confirm working directory
2. **Read progress**: `cat claude-progress.md` to load project state and feature tracker
3. **Read git log**: `git log --oneline -10` to understand recent changes
4. **Start dev server**: Use `preview_start` (name: "dev") or verify it's running
5. **Run type check**: `npx tsc --noEmit` to confirm codebase health
6. **Identify next task**: Based on progress file + user request, pick ONE feature to work on

## Session Closing Ritual

Before ending a session or when context is getting long:

1. **Update `claude-progress.md`**: Record what was done, decisions made, and any blockers
2. **Commit clean code**: Ensure all changes are committed with descriptive messages
3. **Run `npx tsc --noEmit`**: Verify zero errors before leaving
4. **Note next steps**: Write what should be done next in the progress file

## Progress Tracking

The file `claude-progress.md` is the persistent memory across sessions. It contains:

- **Feature List**: Every planned feature with status (pending / in-progress / done)
- **Architecture Decisions**: Key decisions and their rationale
- **Known Issues**: Bugs or technical debt to address
- **Session Log**: Chronological record of what was done each session

### Rules for updating `claude-progress.md`:

- Update IMMEDIATELY after completing a feature, not in batches
- When a decision changes the plan, record WHY the plan changed
- When a feature is marked "done", it MUST have been verified with preview + tsc
- Keep the feature list as the source of truth — never declare "project complete" without checking every item
- New features discovered during work should be added to the list right away

## Architecture Overview

```
src/
  agents/         # AI agent definitions (cognition, director, goap-generator, script-generator)
  debug/          # Debug panel (DebugDrawer, StateMachineDiagram, core-loop-graph)
  engine/         # Core game loop + renderer (core-loop.ts, game-renderer.tsx)
  goap/           # Goal-Oriented Action Planning (planner.ts)
  memory/         # Context engine + character memory (context-engine.ts, character-store.ts)
  player/         # Player UI (ChatInput, CharacterPanel, player-store)
  settings/       # Settings UI (SettingsScreen, ScriptGenerator, ScriptUpload, ScriptList, ModelConfig)
  storage/        # IndexedDB persistence (idb-storage.ts, storage-interface.ts, seed.ts)
  timeline/       # Event timeline system (timeline.ts)
  data/           # Static data (characters JSON, world-events JSON, goap-actions JSON, scripts/)
  theme.ts        # Design tokens (T.xxx)
  App.tsx         # Root component
  main.tsx        # Entry point
```

## Tech Stack & Conventions

- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Inline styles only (`React.CSSProperties`), using theme tokens from `src/theme.ts` (e.g. `T.bg`, `T.accent`, `T.bgElevated`)
- **State**: Zustand stores (debug-store, player-store, settings-store, character-store, model-config-store)
- **Icons**: Lucide React (tree-shakeable, ~1KB/icon) — NO emoji or character art in UI
- **Storage**: IndexedDB via `IDBScriptStorage` (storage-interface.ts defines `ScriptBundle` type)
- **AI**: Multi-agent architecture (cognition → goap → director → render), supports DeepSeek / OpenAI-compatible APIs
- **No CSS files**: No Tailwind, no CSS modules, no styled-components. Everything is inline styles.
- **No shadcn/ui**: Pure CSS for all UI components (toggle switches, buttons, etc.)

## Build & Test

```bash
npm run dev          # Start dev server (port 3000)
npx tsc --noEmit     # Type check (MUST pass before commit)
npm run build        # Production build (tsc + vite build)
```

## Git Conventions

- Branch naming: `claude/<worktree-name>` for worktree branches
- Commit messages in Chinese, format: `feat:` / `fix:` / `refine:` / `chore:` + concise description
- Always include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
- Commit frequently — one logical change per commit, not giant batches

## Verification Workflow

After ANY code change:

1. `npx tsc --noEmit` — must be zero errors
2. Preview screenshot or snapshot — verify visual correctness
3. Console logs check — no new errors from changes
4. If modifying state/logic: test the interaction flow end-to-end

**Never mark a feature "done" based on code review alone.** Always verify with running app.

## Quality Rules

- Prefer editing existing files over creating new ones
- Keep solutions simple — don't add features beyond what was asked
- Don't add error handling for scenarios that can't happen
- Don't create abstractions for one-time operations
- Delete unused code completely — no backwards-compat hacks
- All IDs use kebab-case lowercase
