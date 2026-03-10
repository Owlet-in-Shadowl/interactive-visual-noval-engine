/**
 * NovelContextEngine - IFullContextEngine implementation
 *
 * Manages multi-dimensional character memory using in-memory stores
 * and vector-free semantic matching (keyword-based for MVP).
 * Fully compatible with OpenClaw ContextEngine plugin protocol.
 */

import { useCharacterStore } from './character-store';
import type {
  CharacterState,
  WorldState,
  PersonaShift,
  Goal5W1H,
  EpisodicMemory,
} from './schemas';

// ─── OpenClaw-compatible types ───────────────────────────

export interface ContextEngineInfo {
  id: string;
  name: string;
  ownsCompaction: boolean;
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  [key: string]: unknown;
}

export interface BootstrapResult {
  ok: boolean;
  restoredMessageCount?: number;
}

export interface IngestResult {
  ingested: boolean;
}

export interface IngestBatchResult {
  ingested: boolean;
  count: number;
}

export interface AssembleResult {
  messages: AgentMessage[];
  estimatedTokens: number;
  metadata?: {
    recalledMemories?: EpisodicMemory[];
    activeGoals?: Goal5W1H[];
    personaShifts?: PersonaShift[];
  };
}

export interface CompactResult {
  ok: boolean;
  compacted: boolean;
  summary?: string;
  personaShift?: PersonaShift;
}

export interface SubagentSpawnPreparation {
  rollback?(): Promise<void>;
}

export type SubagentEndReason = 'completed' | 'aborted' | 'error' | 'timeout';

export interface ContextEngineRuntimeContext {
  [key: string]: unknown;
}

export interface NovelRuntimeContext extends ContextEngineRuntimeContext {
  characterId: string;
  worldState: WorldState;
  currentGoals: Goal5W1H[];
  personaShifts: PersonaShift[];
}

// ─── IContextEngine (OpenClaw compatible, optional methods) ──

export interface IContextEngine {
  readonly info: ContextEngineInfo;
  bootstrap?(params: { sessionId: string; sessionFile: string }): Promise<BootstrapResult>;
  ingest(params: { sessionId: string; message: AgentMessage; isHeartbeat?: boolean }): Promise<IngestResult>;
  ingestBatch?(params: { sessionId: string; messages: AgentMessage[]; isHeartbeat?: boolean }): Promise<IngestBatchResult>;
  assemble(params: { sessionId: string; messages: AgentMessage[]; tokenBudget?: number }): Promise<AssembleResult>;
  compact(params: { sessionId: string; sessionFile: string; tokenBudget?: number; force?: boolean; currentTokenCount?: number; compactionTarget?: 'budget' | 'threshold'; customInstructions?: string; runtimeContext?: ContextEngineRuntimeContext }): Promise<CompactResult>;
  afterTurn?(params: { sessionId: string; sessionFile: string; messages: AgentMessage[]; prePromptMessageCount: number; autoCompactionSummary?: string; isHeartbeat?: boolean; tokenBudget?: number; runtimeContext?: ContextEngineRuntimeContext }): Promise<void>;
  prepareSubagentSpawn?(params: { parentSessionKey: string; childSessionKey: string; ttlMs?: number }): Promise<SubagentSpawnPreparation | undefined>;
  onSubagentEnded?(params: { childSessionKey: string; reason: SubagentEndReason }): Promise<void>;
  dispose?(): Promise<void>;
}

// ─── IFullContextEngine (all methods required) ───────────

export type IFullContextEngine = Required<IContextEngine>;

// ─── In-memory episodic store (MVP: no vector DB) ────────

class EpisodicStore {
  private memories: Map<string, EpisodicMemory[]> = new Map();

  add(sessionId: string, memory: EpisodicMemory) {
    const list = this.memories.get(sessionId) ?? [];
    list.push(memory);
    this.memories.set(sessionId, list);
  }

  addBatch(sessionId: string, memories: EpisodicMemory[]) {
    const list = this.memories.get(sessionId) ?? [];
    list.push(...memories);
    this.memories.set(sessionId, list);
  }

  /** MVP: keyword-based relevance scoring instead of vector search */
  recall(sessionId: string, query: string, topK: number = 5): EpisodicMemory[] {
    const list = this.memories.get(sessionId) ?? [];
    if (list.length === 0) return [];

    const queryTerms = query.toLowerCase().split(/\s+/);
    const scored = list.map((m) => {
      const content = m.content.toLowerCase();
      const relevance = queryTerms.reduce((score, term) => {
        return score + (content.includes(term) ? 1 : 0);
      }, 0) / queryTerms.length;
      const recency = 1 / (1 + (Date.now() - m.timestamp) / 60000);
      const finalScore = relevance * 0.6 + m.importance * 0.25 + recency * 0.15;
      return { memory: m, score: finalScore };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((s) => s.memory);
  }

  getAll(sessionId: string): EpisodicMemory[] {
    return this.memories.get(sessionId) ?? [];
  }

  getLatest(sessionId: string): EpisodicMemory | undefined {
    const list = this.memories.get(sessionId) ?? [];
    return list[list.length - 1];
  }

  clear(sessionId: string) {
    this.memories.delete(sessionId);
  }
}

// ─── NovelContextEngine implementation ───────────────────

export class NovelContextEngine implements IFullContextEngine {
  readonly info: ContextEngineInfo = {
    id: 'novel-engine',
    name: 'AI Novel Memory Engine',
    ownsCompaction: true,
  };

  private episodicStore = new EpisodicStore();
  private getWorldState: () => WorldState;

  constructor(worldStateGetter: () => WorldState) {
    this.getWorldState = worldStateGetter;
  }

  // ─── bootstrap ─────────────────────────────────────────

  async bootstrap(params: { sessionId: string; sessionFile: string }): Promise<BootstrapResult> {
    const characterId = this.parseCharacterId(params.sessionId);
    const store = useCharacterStore.getState();
    const existing = store.characters[characterId];
    if (!existing) {
      console.warn(`[ContextEngine] No character data for ${characterId}, skipping bootstrap`);
    }
    return { ok: true, restoredMessageCount: 0 };
  }

  // ─── ingest ────────────────────────────────────────────

  async ingest(params: {
    sessionId: string;
    message: AgentMessage;
    isHeartbeat?: boolean;
  }): Promise<IngestResult> {
    if (params.isHeartbeat) return { ingested: false };

    const characterId = this.parseCharacterId(params.sessionId);
    const memory: EpisodicMemory = {
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      characterId,
      content: params.message.content,
      timestamp: Date.now(),
      importance: this.estimateImportance(params.message.content),
      type: this.classifyMessageType(params.message),
    };

    this.episodicStore.add(params.sessionId, memory);
    return { ingested: true };
  }

  // ─── ingestBatch ───────────────────────────────────────

  async ingestBatch(params: {
    sessionId: string;
    messages: AgentMessage[];
    isHeartbeat?: boolean;
  }): Promise<IngestBatchResult> {
    if (params.isHeartbeat) return { ingested: false, count: 0 };

    const characterId = this.parseCharacterId(params.sessionId);
    const memories: EpisodicMemory[] = params.messages.map((msg) => ({
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      characterId,
      content: msg.content,
      timestamp: Date.now(),
      importance: this.estimateImportance(msg.content),
      type: this.classifyMessageType(msg),
    }));

    this.episodicStore.addBatch(params.sessionId, memories);
    return { ingested: true, count: memories.length };
  }

  // ─── assemble (核心循环步骤①) ──────────────────────────

  async assemble(params: {
    sessionId: string;
    messages: AgentMessage[];
    tokenBudget?: number;
  }): Promise<AssembleResult> {
    const characterId = this.parseCharacterId(params.sessionId);
    const store = useCharacterStore.getState();
    const persona = store.getPersona(characterId);
    const goals = store.getGoals(characterId);
    const shifts = store.getPersonaShifts(characterId);
    const worldState = this.getWorldState();

    // Recall relevant episodic memories
    const recalled = this.episodicStore.recall(
      params.sessionId,
      worldState.currentSituation,
      5,
    );

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(
      persona,
      goals,
      shifts,
      recalled,
      worldState,
    );

    const assembled: AgentMessage[] = [
      { role: 'system', content: systemPrompt },
      ...params.messages,
    ];

    const estimatedTokens = Math.ceil(systemPrompt.length / 3);

    return {
      messages: assembled,
      estimatedTokens,
      metadata: {
        recalledMemories: recalled,
        activeGoals: goals.shortTerm.filter((g) => g.status === 'active').map((g) => g.goal),
        personaShifts: shifts,
      },
    };
  }

  // ─── compact (Reflection入口) ──────────────────────────

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
    const memories = this.episodicStore.getAll(params.sessionId);
    if (memories.length < 10 && !params.force) {
      return { ok: true, compacted: false };
    }

    // MVP: simple compaction by keeping only important memories
    const important = memories.filter((m) => m.importance > 0.5);
    this.episodicStore.clear(params.sessionId);
    this.episodicStore.addBatch(params.sessionId, important);

    const summary = `Compacted ${memories.length} → ${important.length} memories`;
    return { ok: true, compacted: true, summary };
  }

  // ─── afterTurn (核心循环步骤⑨) ─────────────────────────

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
    if (params.isHeartbeat) return;

    // Auto-compact if too many memories
    const memories = this.episodicStore.getAll(params.sessionId);
    if (memories.length > 50) {
      await this.compact({
        sessionId: params.sessionId,
        sessionFile: params.sessionFile,
        force: true,
      });
    }
  }

  // ─── prepareSubagentSpawn ──────────────────────────────

  async prepareSubagentSpawn(params: {
    parentSessionKey: string;
    childSessionKey: string;
    ttlMs?: number;
  }): Promise<SubagentSpawnPreparation | undefined> {
    // Copy relevant memories to child session
    const parentMemories = this.episodicStore.getAll(params.parentSessionKey);
    const recent = parentMemories.slice(-20);
    this.episodicStore.addBatch(params.childSessionKey, recent);

    return {
      rollback: async () => {
        this.episodicStore.clear(params.childSessionKey);
      },
    };
  }

  // ─── onSubagentEnded ───────────────────────────────────

  async onSubagentEnded(params: {
    childSessionKey: string;
    reason: SubagentEndReason;
  }): Promise<void> {
    if (params.reason === 'completed') {
      const latest = this.episodicStore.getLatest(params.childSessionKey);
      if (latest) {
        const parentKey = params.childSessionKey.split(':').slice(0, 2).join(':');
        this.episodicStore.add(parentKey, latest);
      }
    }
    this.episodicStore.clear(params.childSessionKey);
  }

  // ─── dispose ───────────────────────────────────────────

  async dispose(): Promise<void> {
    // Nothing to clean up in MVP in-memory store
  }

  // ─── Public helpers ────────────────────────────────────

  getEpisodicStore() {
    return this.episodicStore;
  }

  // ─── Private helpers ───────────────────────────────────

  private parseCharacterId(sessionId: string): string {
    return sessionId.replace('novel:', '').split(':')[0];
  }

  private buildSystemPrompt(
    persona: CharacterState['core'] | undefined,
    goals: { longTerm: CharacterState['longTermGoals']; shortTerm: CharacterState['shortTermGoals'] },
    shifts: PersonaShift[],
    recalled: EpisodicMemory[],
    worldState: WorldState,
  ): string {
    const parts: string[] = [];

    if (persona) {
      parts.push(`## 角色身份\n你是"${persona.name}"。\n${persona.background}`);
      parts.push(`## 性格特征\n${persona.personality.map((p: { trait: string; intensity: number }) => `- ${p.trait}（强度：${p.intensity}）`).join('\n')}`);
      parts.push(`## 核心价值观\n${persona.values.map((v: string) => `- ${v}`).join('\n')}`);
      parts.push(`## 说话风格\n${persona.speechStyle}`);
    }

    if (shifts.length > 0) {
      parts.push(`## 人格变化\n${shifts.map((s) => `- [${s.trigger}] ${s.description}`).join('\n')}`);
    }

    if (goals.longTerm.length > 0) {
      parts.push(`## 长期目标（夙愿）\n${goals.longTerm.map((g: { priority: number; description: string }) => `- [优先级${g.priority}] ${g.description}`).join('\n')}`);
    }

    const activeShortTerm = goals.shortTerm.filter((g: { status: string }) => g.status === 'active');
    if (activeShortTerm.length > 0) {
      parts.push(`## 当前短期目标\n${activeShortTerm.map((g: { goal: { what: string; why: string } }) => `- ${g.goal.what}（原因：${g.goal.why}）`).join('\n')}`);
    }

    if (recalled.length > 0) {
      parts.push(`## 相关记忆回顾\n${recalled.map((m) => `- [${m.type}] ${m.content}`).join('\n')}`);
    }

    parts.push(`## 当前世界状态\n- 时间：${this.formatTime(worldState.currentTime)}\n- 地点：${worldState.currentLocation}\n- 情况：${worldState.currentSituation}\n- 可用地点：${worldState.availableLocations.join(', ')}\n- 附近的人：${worldState.availableNPCs.join(', ')}`);

    if (worldState.activeEvents.length > 0) {
      parts.push(`## 正在发生的事件\n${worldState.activeEvents.map((e) => `- ⚠ ${e.name}：${e.description}（地点：${e.location}）`).join('\n')}`);
    }

    return parts.join('\n\n');
  }

  private formatTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  private estimateImportance(content: string): number {
    const highImportanceKeywords = ['死', '火', '袭击', '发现', '秘密', '背叛', '危险', '逃', '真相', '家族'];
    const matches = highImportanceKeywords.filter((k) => content.includes(k)).length;
    return Math.min(0.3 + matches * 0.15, 1.0);
  }

  private classifyMessageType(msg: AgentMessage): EpisodicMemory['type'] {
    if (msg.role === 'system') return 'world_event';
    if (msg.role === 'tool') return 'observation';
    const content = msg.content.toLowerCase();
    if (content.includes('说') || content.includes('对话') || content.includes('"')) return 'dialogue';
    return 'action';
  }
}
