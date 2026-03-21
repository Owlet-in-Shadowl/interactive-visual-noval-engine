/**
 * Debug Store - Centralized state for the Debug Drawer.
 * Aggregates data from workflow steps, agent traces, and game state.
 */

import { create } from 'zustand';
import type { Goal5W1H, GOAPAction, EpisodicMemory, WorldEvent, SceneOutput } from '../memory/schemas';

export type GamePhase =
  | 'idle'
  | 'assemble'
  | 'cognition'
  | 'goap'
  | 'goap_gen'
  | 'timeline'
  | 'director'
  | 'render'
  | 'preset'
  | 'reflection'
  | 'waiting_input'
  | 'error';

export interface AgentTrace {
  agent: string;
  duration: number;
  inputTokens: number;
  outputTokens: number;
  timestamp: number;
  /** Optional summary of what went in (truncated for display) */
  inputSummary?: string;
  /** Optional summary of what came out (truncated for display) */
  outputSummary?: string;
}

export interface MemoryLog {
  method: string;
  timestamp: number;
  durationMs: number;
  input: unknown;
  output: unknown;
  error?: string;
}

export interface DebugState {
  // Core loop phase
  phase: GamePhase;
  prevPhase: GamePhase;
  phaseStartedAt: number;
  phaseDurations: Partial<Record<GamePhase, number>>; // ms elapsed per phase in current cycle
  loopCount: number;

  // 5W1H result
  currentGoal: Goal5W1H | null;
  goalRawJson: string;

  // GOAP queue
  goapQueue: Array<{
    action: GOAPAction;
    status: 'pending' | 'running' | 'done' | 'interrupted';
  }>;
  goapTotalTime: number;

  // Memory context
  memoryContext: {
    recalledCount: number;
    totalTokens: number;
    personaShiftCount: number;
    recalledItems: EpisodicMemory[];
  };

  // Timeline
  timeline: {
    currentTime: string;
    goalEndTime: string;
    upcomingEvents: Array<{ time: string; event: string; conflict: boolean }>;
  };

  // Agent traces
  traces: AgentTrace[];

  // Current scenes being rendered
  currentScenes: SceneOutput[];

  // Error log
  errors: Array<{ message: string; timestamp: number }>;

  // Memory module logs (ContextEngine observability)
  memoryLogs: MemoryLog[];

  // Actions
  setPhase: (phase: GamePhase) => void;
  setCurrentGoal: (goal: Goal5W1H, rawJson: string) => void;
  setGoapQueue: (actions: GOAPAction[], totalTime: number) => void;
  updateGoapStatus: (index: number, status: 'pending' | 'running' | 'done' | 'interrupted') => void;
  setMemoryContext: (ctx: DebugState['memoryContext']) => void;
  setTimeline: (tl: DebugState['timeline']) => void;
  pushTrace: (trace: AgentTrace) => void;
  setScenes: (scenes: SceneOutput[]) => void;
  pushError: (message: string) => void;
  pushMemoryLog: (log: MemoryLog) => void;
  incrementLoop: () => void;
  reset: () => void;
}

export const useDebugStore = create<DebugState>()((set) => ({
  phase: 'idle',
  prevPhase: 'idle',
  phaseStartedAt: 0,
  phaseDurations: {},
  loopCount: 0,
  currentGoal: null,
  goalRawJson: '',
  goapQueue: [],
  goapTotalTime: 0,
  memoryContext: { recalledCount: 0, totalTokens: 0, personaShiftCount: 0, recalledItems: [] },
  timeline: { currentTime: '08:00', goalEndTime: '', upcomingEvents: [] },
  traces: [],
  currentScenes: [],
  errors: [],
  memoryLogs: [],

  setPhase: (phase) =>
    set((s) => {
      const now = Date.now();
      const durations = { ...s.phaseDurations };
      if (s.phase !== phase && s.phaseStartedAt > 0) {
        durations[s.phase] = now - s.phaseStartedAt;
      }
      return { prevPhase: s.phase, phase, phaseStartedAt: now, phaseDurations: durations };
    }),

  setCurrentGoal: (goal, rawJson) =>
    set({ currentGoal: goal, goalRawJson: rawJson }),

  setGoapQueue: (actions, totalTime) =>
    set({
      goapQueue: actions.map((a) => ({ action: a, status: 'pending' as const })),
      goapTotalTime: totalTime,
    }),

  updateGoapStatus: (index, status) =>
    set((s) => {
      const queue = [...s.goapQueue];
      if (queue[index]) queue[index] = { ...queue[index], status };
      return { goapQueue: queue };
    }),

  setMemoryContext: (ctx) => set({ memoryContext: ctx }),

  setTimeline: (tl) => set({ timeline: tl }),

  pushTrace: (trace) =>
    set((s) => ({ traces: [...s.traces.slice(-19), trace] })),

  setScenes: (scenes) => set({ currentScenes: scenes }),

  pushError: (message) =>
    set((s) => ({
      errors: [...s.errors.slice(-9), { message, timestamp: Date.now() }],
      phase: 'error' as GamePhase,
    })),

  pushMemoryLog: (log) =>
    set((s) => ({ memoryLogs: [...s.memoryLogs.slice(-49), log] })),

  incrementLoop: () =>
    set((s) => ({ loopCount: s.loopCount + 1, phaseDurations: {} })),

  reset: () =>
    set({
      phase: 'idle',
      prevPhase: 'idle',
      phaseStartedAt: 0,
      phaseDurations: {},
      loopCount: 0,
      currentGoal: null,
      goalRawJson: '',
      goapQueue: [],
      goapTotalTime: 0,
      memoryContext: { recalledCount: 0, totalTokens: 0, personaShiftCount: 0, recalledItems: [] },
      traces: [],
      currentScenes: [],
      errors: [],
      memoryLogs: [],
    }),
}));
