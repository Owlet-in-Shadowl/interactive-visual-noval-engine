/**
 * ObservableContextEngine — Decorator that wraps any IFullContextEngine
 * and logs all method calls (input/output/duration) to debug-store.
 *
 * Zero-overhead when debug panel is closed (logs still accumulate in store
 * but rendering is lazy). Does not modify the inner engine's behavior.
 */

import type {
  IFullContextEngine,
  BootstrapResult,
  IngestResult,
  IngestBatchResult,
  AssembleResult,
  CompactResult,
  SubagentSpawnPreparation,
  SubagentEndReason,
  ContextEngineInfo,
  ContextEngineRuntimeContext,
  AgentMessage,
} from './context-engine';
import type { EpisodicMemory } from './schemas';
import { useDebugStore } from '../debug/debug-store';

/** Truncate long strings for display in debug panel */
function truncate(s: string, maxLen: number = 120): string {
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
}

/** Summarize input params for logging (avoid storing huge objects) */
function summarizeInput(method: string, params: unknown): unknown {
  if (!params || typeof params !== 'object') return params;
  const p = params as Record<string, unknown>;

  switch (method) {
    case 'ingest':
      return {
        sessionId: p.sessionId,
        role: (p.message as AgentMessage)?.role,
        content: truncate(String((p.message as AgentMessage)?.content ?? ''), 200),
        isHeartbeat: p.isHeartbeat,
        hasPfMetadata: !!p.pfMetadata,
      };
    case 'ingestBatch':
      return {
        sessionId: p.sessionId,
        count: Array.isArray(p.messages) ? p.messages.length : 0,
        isHeartbeat: p.isHeartbeat,
      };
    case 'assemble':
      return {
        sessionId: p.sessionId,
        messageCount: Array.isArray(p.messages) ? p.messages.length : 0,
        tokenBudget: p.tokenBudget,
      };
    case 'compact':
      return {
        sessionId: p.sessionId,
        force: p.force,
        compactionTarget: p.compactionTarget,
      };
    case 'afterTurn':
      return {
        sessionId: p.sessionId,
        messageCount: Array.isArray(p.messages) ? p.messages.length : 0,
      };
    case 'recall':
    case 'recallMemories':
      return { query: truncate(String(p.query ?? p[1] ?? ''), 100), topK: p.topK ?? p[2] };
    default:
      return { sessionId: p.sessionId };
  }
}

/** Summarize output for logging */
function summarizeOutput(method: string, result: unknown): unknown {
  if (!result || typeof result !== 'object') return result;

  switch (method) {
    case 'assemble': {
      const r = result as AssembleResult;
      return {
        messageCount: r.messages.length,
        estimatedTokens: r.estimatedTokens,
        recalledCount: r.metadata?.recalledMemories?.length ?? 0,
        recalledItems: r.metadata?.recalledMemories?.map((m) => truncate(m.content, 80)),
      };
    }
    case 'compact': {
      const r = result as CompactResult;
      return { compacted: r.compacted, summary: r.summary ? truncate(r.summary, 100) : undefined };
    }
    case 'recall':
    case 'recallMemories': {
      const memories = result as EpisodicMemory[];
      return {
        count: memories.length,
        items: memories.map((m) => ({ type: m.type, content: truncate(m.content, 80), importance: m.importance })),
      };
    }
    default:
      return result;
  }
}

export class ObservableContextEngine implements IFullContextEngine {
  private inner: IFullContextEngine;

  constructor(inner: IFullContextEngine) {
    this.inner = inner;
  }

  get info(): ContextEngineInfo {
    return this.inner.info;
  }

  private log(method: string, input: unknown, output: unknown, durationMs: number, error?: string) {
    useDebugStore.getState().pushMemoryLog({
      method,
      timestamp: Date.now(),
      durationMs,
      input: summarizeInput(method, input),
      output: error ? undefined : summarizeOutput(method, output),
      error,
    });
  }

  async bootstrap(params: { sessionId: string; sessionFile: string }): Promise<BootstrapResult> {
    const start = Date.now();
    try {
      const result = await this.inner.bootstrap!(params);
      this.log('bootstrap', params, result, Date.now() - start);
      return result;
    } catch (err) {
      this.log('bootstrap', params, null, Date.now() - start, String(err));
      throw err;
    }
  }

  async ingest(params: { sessionId: string; message: AgentMessage; isHeartbeat?: boolean; pfMetadata?: { pfId: string; participationRole: string; knownPeers: string[]; involvedCharacters: string[] } }): Promise<IngestResult> {
    const start = Date.now();
    try {
      const result = await this.inner.ingest(params);
      this.log('ingest', params, result, Date.now() - start);
      return result;
    } catch (err) {
      this.log('ingest', params, null, Date.now() - start, String(err));
      throw err;
    }
  }

  async ingestBatch(params: { sessionId: string; messages: AgentMessage[]; isHeartbeat?: boolean }): Promise<IngestBatchResult> {
    const start = Date.now();
    try {
      const result = await this.inner.ingestBatch!(params);
      this.log('ingestBatch', params, result, Date.now() - start);
      return result;
    } catch (err) {
      this.log('ingestBatch', params, null, Date.now() - start, String(err));
      throw err;
    }
  }

  async assemble(params: { sessionId: string; messages: AgentMessage[]; tokenBudget?: number }): Promise<AssembleResult> {
    const start = Date.now();
    try {
      const result = await this.inner.assemble(params);
      this.log('assemble', params, result, Date.now() - start);
      return result;
    } catch (err) {
      this.log('assemble', params, null, Date.now() - start, String(err));
      throw err;
    }
  }

  async compact(params: { sessionId: string; sessionFile: string; tokenBudget?: number; force?: boolean; currentTokenCount?: number; compactionTarget?: 'budget' | 'threshold'; customInstructions?: string; runtimeContext?: ContextEngineRuntimeContext }): Promise<CompactResult> {
    const start = Date.now();
    try {
      const result = await this.inner.compact(params);
      this.log('compact', params, result, Date.now() - start);
      return result;
    } catch (err) {
      this.log('compact', params, null, Date.now() - start, String(err));
      throw err;
    }
  }

  async afterTurn(params: { sessionId: string; sessionFile: string; messages: AgentMessage[]; prePromptMessageCount: number; autoCompactionSummary?: string; isHeartbeat?: boolean; tokenBudget?: number; runtimeContext?: ContextEngineRuntimeContext }): Promise<void> {
    const start = Date.now();
    try {
      await this.inner.afterTurn!(params);
      this.log('afterTurn', params, { ok: true }, Date.now() - start);
    } catch (err) {
      this.log('afterTurn', params, null, Date.now() - start, String(err));
      throw err;
    }
  }

  recallMemories(sessionId: string, query: string, topK: number = 10): EpisodicMemory[] {
    const start = Date.now();
    try {
      const result = this.inner.recallMemories!(sessionId, query, topK);
      this.log('recallMemories', { sessionId, query, topK }, result, Date.now() - start);
      return result;
    } catch (err) {
      this.log('recallMemories', { sessionId, query, topK }, null, Date.now() - start, String(err));
      throw err;
    }
  }

  getRecentMemories(sessionId: string, count: number): EpisodicMemory[] {
    const result = this.inner.getRecentMemories!(sessionId, count);
    return result;
  }

  async prepareSubagentSpawn(params: { parentSessionKey: string; childSessionKey: string; ttlMs?: number }): Promise<SubagentSpawnPreparation | undefined> {
    const start = Date.now();
    const result = await this.inner.prepareSubagentSpawn!(params);
    this.log('prepareSubagentSpawn', params, { hasRollback: !!result?.rollback }, Date.now() - start);
    return result;
  }

  async onSubagentEnded(params: { childSessionKey: string; reason: SubagentEndReason }): Promise<void> {
    const start = Date.now();
    await this.inner.onSubagentEnded!(params);
    this.log('onSubagentEnded', params, { ok: true }, Date.now() - start);
  }

  async dispose(): Promise<void> {
    await this.inner.dispose?.();
  }
}
