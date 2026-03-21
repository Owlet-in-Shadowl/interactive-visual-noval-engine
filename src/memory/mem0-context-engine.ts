/**
 * Mem0ContextEngine — ContextEngine adapter backed by Mem0 Cloud API.
 *
 * Uses Mem0's semantic memory (add + search) as the memory layer,
 * while keeping the same IFullContextEngine interface as the builtin engine.
 *
 * API: https://api.mem0.ai/v1/memories/ (add), /v2/memories/search/ (search)
 * Auth: Token-based (Authorization: Token <api-key>)
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
import type { EpisodicMemory, WorldState } from './schemas';
import { useCharacterStore } from './character-store';

const MEM0_BASE = 'https://api.mem0.ai';

interface Mem0Memory {
  id: string;
  memory: string;
  user_id?: string;
  created_at?: string;
  score?: number;
}

function makeMemory(id: string, characterId: string, content: string, type: EpisodicMemory['type'], importance: number = 0.5): EpisodicMemory {
  return { id, characterId, content, type, importance, timestamp: Date.now() };
}

export class Mem0ContextEngine implements IFullContextEngine {
  private apiKey: string;
  private userId: string;
  private characterId: string = '';
  private getWorldState: () => WorldState;
  private recentMemories: EpisodicMemory[] = [];
  private lastSearchResults: EpisodicMemory[] = [];

  readonly info: ContextEngineInfo = {
    id: 'mem0-cloud',
    name: 'Mem0 Cloud',
    ownsCompaction: true,
  };

  constructor(apiKey: string, userId: string, getWorldState: () => WorldState) {
    this.apiKey = apiKey;
    this.userId = userId;
    this.getWorldState = getWorldState;
  }

  private async mem0Fetch(path: string, body: unknown): Promise<unknown> {
    const res = await fetch(`${MEM0_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Mem0 API error ${res.status}: ${text}`);
    }
    return res.json();
  }

  async bootstrap(params: { sessionId: string; sessionFile: string }): Promise<BootstrapResult> {
    this.characterId = params.sessionId.replace('novel:', '');
    try {
      await this.mem0Fetch('/v2/memories/search/', {
        query: 'session start',
        user_id: this.userId,
        limit: 1,
      });
      return { ok: true, restoredMessageCount: 0 };
    } catch (err) {
      console.warn('[Mem0] Bootstrap failed:', err);
      return { ok: false };
    }
  }

  async ingest(params: {
    sessionId: string;
    message: AgentMessage;
    isHeartbeat?: boolean;
    pfMetadata?: { pfId: string; participationRole: string; knownPeers: string[]; involvedCharacters: string[] };
  }): Promise<IngestResult> {
    if (params.isHeartbeat) return { ingested: false };
    const content = params.message.content;
    if (!content || content.length < 5) return { ingested: false };

    const charId = this.characterId || params.sessionId.replace('novel:', '');
    this.recentMemories.push(
      makeMemory(`mem0-${Date.now()}`, charId, content, params.message.role === 'user' ? 'observation' : 'action'),
    );
    if (this.recentMemories.length > 100) this.recentMemories = this.recentMemories.slice(-50);

    // Fire-and-forget to Mem0 Cloud
    this.mem0Fetch('/v1/memories/', {
      messages: [{ role: params.message.role, content }],
      user_id: this.userId,
      run_id: params.sessionId,
    }).catch((err) => console.warn('[Mem0] Ingest failed:', err));

    return { ingested: true };
  }

  async ingestBatch(params: {
    sessionId: string;
    messages: AgentMessage[];
    isHeartbeat?: boolean;
  }): Promise<IngestBatchResult> {
    if (params.isHeartbeat) return { ingested: false, count: 0 };
    const messages = params.messages.filter((m) => m.content && m.content.length >= 5);
    if (messages.length === 0) return { ingested: false, count: 0 };

    const charId = this.characterId || params.sessionId.replace('novel:', '');
    for (const msg of messages) {
      this.recentMemories.push(
        makeMemory(`mem0-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, charId, msg.content, msg.role === 'user' ? 'observation' : 'action'),
      );
    }

    this.mem0Fetch('/v1/memories/', {
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      user_id: this.userId,
      run_id: params.sessionId,
    }).catch((err) => console.warn('[Mem0] IngestBatch failed:', err));

    return { ingested: true, count: messages.length };
  }

  async assemble(params: {
    sessionId: string;
    messages: AgentMessage[];
    tokenBudget?: number;
  }): Promise<AssembleResult> {
    const charId = this.characterId || params.sessionId.replace('novel:', '');
    const charStore = useCharacterStore.getState();
    const persona = charStore.getPersona(charId);
    const goals = charStore.getGoals(charId);
    const worldState = this.getWorldState();

    // Semantic search via Mem0
    const query = params.messages.slice(-3).map((m) => m.content).join(' ').slice(0, 200);
    let recalled: EpisodicMemory[] = [];
    try {
      const result = await this.mem0Fetch('/v2/memories/search/', {
        query: query || 'recent events',
        user_id: this.userId,
        limit: 10,
      }) as { results?: Mem0Memory[] };

      recalled = (result.results ?? []).map((m) =>
        makeMemory(m.id, charId, m.memory, 'observation', m.score ?? 0.5),
      );
    } catch (err) {
      console.warn('[Mem0] Search failed, using local buffer:', err);
      recalled = this.recentMemories.slice(-10);
    }

    this.lastSearchResults = recalled;

    // Build system prompt
    const parts: string[] = [];
    if (persona) {
      parts.push(`## 角色身份\n你是${persona.name}。${persona.background}\n说话风格：${persona.speechStyle}`);
    }
    if (goals) {
      const longTermStr = goals.longTerm.map((g) => `- [P${g.priority}] ${g.description}`).join('\n');
      if (longTermStr) parts.push(`## 长期目标\n${longTermStr}`);
      const shortTermStr = goals.shortTerm
        .filter((g) => g.status === 'active')
        .map((g) => `- ${g.goal.what}（${g.goal.why}）`)
        .join('\n');
      if (shortTermStr) parts.push(`## 当前任务\n${shortTermStr}`);
    }

    parts.push(`## 当前世界状态\n${worldState.currentSituation}\n地点：${worldState.currentLocation}\n在场角色：${worldState.availableNPCs.join('、')}`);

    if (recalled.length > 0) {
      parts.push(`## 相关记忆回顾（Mem0 Cloud 语义检索）\n${recalled.map((m) => `- ${m.content}`).join('\n')}`);
    }

    const systemContent = parts.join('\n\n');
    return {
      messages: [{ role: 'system', content: systemContent }, ...params.messages],
      estimatedTokens: Math.ceil(systemContent.length / 3),
      metadata: { recalledMemories: recalled },
    };
  }

  async compact(params: {
    sessionId: string;
    sessionFile: string;
    tokenBudget?: number;
    force?: boolean;
    currentTokenCount?: number;
    compactionTarget?: 'budget' | 'threshold';
    customInstructions?: string;
    runtimeContext?: ContextEngineRuntimeContext;
  }): Promise<CompactResult> {
    if (this.recentMemories.length > 50) this.recentMemories = this.recentMemories.slice(-25);
    return { ok: true, compacted: false };
  }

  async afterTurn(params: {
    sessionId: string;
    sessionFile: string;
    messages: AgentMessage[];
    prePromptMessageCount: number;
    autoCompactionSummary?: string;
    isHeartbeat?: boolean;
    tokenBudget?: number;
    runtimeContext?: ContextEngineRuntimeContext;
  }): Promise<void> {
    // No-op: Mem0 handles persistence
  }

  recallMemories(sessionId: string, query: string, topK: number = 10): EpisodicMemory[] {
    if (this.lastSearchResults.length > 0) return this.lastSearchResults.slice(0, topK);
    const lowerQuery = query.toLowerCase();
    return this.recentMemories
      .filter((m) => m.content.toLowerCase().includes(lowerQuery))
      .slice(-topK);
  }

  getRecentMemories(sessionId: string, count: number): EpisodicMemory[] {
    return this.recentMemories.slice(-count);
  }

  async prepareSubagentSpawn(params: { parentSessionKey: string; childSessionKey: string; ttlMs?: number }): Promise<SubagentSpawnPreparation | undefined> {
    return undefined;
  }

  async onSubagentEnded(params: { childSessionKey: string; reason: SubagentEndReason }): Promise<void> {}

  async dispose(): Promise<void> {
    this.recentMemories = [];
    this.lastSearchResults = [];
  }
}
