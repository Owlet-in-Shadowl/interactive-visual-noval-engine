# AI Interactive Visual Novel Engine - Agent Harness Guide

> This file is the single source of truth for AI agents working on this project.
> Based on principles from Anthropic's "Effective Harnesses for Long-Running Agents"
> and OpenAI's "Harness Engineering" methodology.

## Project Overview

An AI-driven interactive visual novel engine where characters have autonomous
multi-dimensional memory, 5W1H decision-making, GOAP action planning, and
dynamic personality evolution. The core purpose is to **validate and iterate
an Agent memory system** with full observability.

## Architecture Map

```
src/
  agents/          → LLM agent wrappers (DeepSeek chat calls)
    deepseek.ts    → Provider config (@ai-sdk/openai-compatible)
    cognition.ts   → 5W1H reasoning agent (generateObject)
    director.ts    → Narrative generation agent (generateObject)
  memory/          → Core memory system (OpenClaw ContextEngine compatible)
    schemas/       → Zod schemas: all data types
    context-engine.ts → IFullContextEngine implementation
    character-store.ts → Zustand store for character state
  engine/          → Game orchestration
    core-loop.ts   → Main game loop (assemble→cognition→GOAP→director→render)
    game-renderer.tsx → React-based VN UI
  timeline/        → Discrete event simulation
    timeline.ts    → World time, events, location management
  goap/            → Goal-Oriented Action Planning
    planner.ts     → BFS action planner
  debug/           → Debug observability
    debug-store.ts → Zustand store for debug state
    DebugDrawer.tsx → Right-side debug panel
  data/            → Static game data (JSON)
    characters/    → Character definitions (liya.json, guard-captain.json)
    world-events/  → Chapter event timelines (chapter1.json)
    goap-actions.json → Available GOAP actions
  App.tsx          → Main React component
  main.tsx         → Entry point
```

## Core Loop (10 Steps)

```
① assemble (ContextEngine) → Multi-dimensional memory assembly
② cognition (5W1H Agent) → Structured goal generation
③ GOAP planning → Goal→Action queue mapping
④ timeline check → Conflict detection with world events
⑤ director (Narrative Agent) → Action→Literary scene conversion
⑥ render → TypeWriter display in game UI
⑦ ingest → Store new episodic memories
⑧ timeline advance → Move game clock forward
⑨ afterTurn → Auto-compaction check
⑩ loop → Return to ① or handle interrupt
```

## Key Conventions

- **Language**: All code in TypeScript strict mode. Game content in Chinese.
- **State Management**: Zustand stores (character-store, debug-store)
- **LLM Provider**: DeepSeek via `@ai-sdk/openai-compatible` → `ai` SDK v6
- **Schema Validation**: Zod schemas for all data structures
- **Memory Protocol**: OpenClaw ContextEngine compatible (IFullContextEngine)
- **Styling**: Inline React.CSSProperties (no CSS framework in MVP)

## Development Commands

```bash
pnpm dev          # Start dev server (port 3000)
pnpm build        # Production build
npx tsc --noEmit  # Type check (MUST pass before commit)
```

## Testing Protocol

Before marking any feature complete:
1. Run `npx tsc --noEmit` - must produce zero errors
2. Run `pnpm dev` - app must load without console errors
3. Visual verify: start screen renders, debug drawer visible
4. If LLM-dependent: verify DeepSeek API calls succeed (check Network tab)

## Session Startup Checklist

1. `pwd` - verify working directory
2. `git log --oneline -5` - review recent changes
3. Read `claude-progress.txt` - understand current state
4. `npx tsc --noEmit` - baseline health check
5. Select next task from progress file
6. Implement incrementally, commit after each feature

## Golden Rules

1. **One feature at a time** - Don't attempt multiple features simultaneously
2. **Type-check before commit** - `npx tsc --noEmit` must pass
3. **Don't delete tests** - Tests are guardrails, not obstacles
4. **JSON for structured data** - Character data, GOAP actions, events are all JSON
5. **Clean state on commit** - Code must be merge-ready after each commit
6. **Progress logging** - Update claude-progress.txt after significant work
7. **Observe, don't assume** - Use debug drawer to verify agent behavior
8. **Repository is truth** - No tribal knowledge; document decisions in code/comments
