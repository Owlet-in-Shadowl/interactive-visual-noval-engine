/**
 * Core Game Loop - Orchestrates the full cognition -> action -> narrative cycle.
 *
 * Steps:
 * ① Context assembly (ContextEngine.assemble)
 * ② 5W1H cognitive reasoning (Cognition Agent)
 * ③ GOAP action planning
 * ④ Timeline conflict detection
 * ⑤ Narrative generation (Director Agent)
 * ⑥ Render scenes
 * ⑦ Player input injection (if intervention mode)
 * ⑧ Post-processing (ContextEngine.afterTurn)
 * ⑨ Auto-pause check (if autoPauseOnTaskDone)
 * ⑩ Reflection (conditional: significant event or memory threshold)
 */

import type { IFullContextEngine, AssembleResult, AgentMessage } from '../memory/context-engine';
import { useCharacterStore } from '../memory/character-store';
import { runCognition } from '../agents/cognition';
import { SinglePovDirector } from '../agents/director';
import type { IDirector } from '../agents/director';
import { runReflection } from '../agents/reflection';
import { generateGoapAction } from '../agents/goap-generator';
import { planActions, mapGoalToGOAPState } from '../goap/planner';
import { Timeline } from '../timeline/timeline';
import { useDebugStore } from '../debug/debug-store';
import { usePlayerStore } from '../player/player-store';
import type { GOAPAction, SceneOutput, WorldEvent, Goal5W1H, EpisodicMemory } from '../memory/schemas';
import type { ChapterData, DivergencePoint, LorebookEntry } from '../storage/storage-interface';
import { scoreText, accumulateScores, resolveGravity, initScores } from './gravity';
import { framesToScenes, projectAllMemories } from '../pf';
import { NarrativeMemory } from '../memory/narrative-memory';

export interface CoreLoopConfig {
  characterId: string;
  contextEngine: IFullContextEngine;
  timeline: Timeline;
  goapActions: GOAPAction[];
  chapters: ChapterData[];
  initialChapterIndex?: number;
  director?: IDirector;
  lorebookEntries?: LorebookEntry[];
  onScenesReady: (scenes: SceneOutput[]) => void;
  onChapterTransition?: (fromChapter: ChapterData, toChapter: ChapterData) => void;
  onLoopComplete: () => void;
  onError: (error: Error) => void;
}

export class CoreLoop {
  private config: CoreLoopConfig;
  private running = false;
  private paused = false;
  private sessionId: string;
  private currentChapterIndex: number;
  private chapterExhausted = false;
  private director: IDirector;
  private narrativeMemory: NarrativeMemory;
  /** Persistent GOAP world state — accumulates action effects across cycles */
  private goapWorldState: Record<string, boolean | number | string> = {};
  /** History of completed actions (for cognition dedup) */
  private completedActions: { actionId: string; actionName: string; goalWhat: string; timestamp: number }[] = [];
  /** Last Director output text — fallback for recentSceneText when narrativeContext not available */
  private lastDirectorSceneText: string = '';
  private divergence: {
    point: DivergencePoint;
    scores: Map<string, number>;
    actionsRemaining: number;
  } | null = null;

  constructor(config: CoreLoopConfig) {
    this.config = config;
    this.sessionId = `novel:${config.characterId}`;
    this.currentChapterIndex = config.initialChapterIndex ?? 0;
    this.director = config.director ?? new SinglePovDirector();
    this.narrativeMemory = new NarrativeMemory();
    // Set initial chapter name
    const initialChapter = config.chapters[this.currentChapterIndex];
    if (initialChapter) this.narrativeMemory.setChapter(initialChapter.chapter);
  }

  async start() {
    this.running = true;
    const debug = useDebugStore.getState();

    // Bootstrap
    await this.config.contextEngine.bootstrap({
      sessionId: this.sessionId,
      sessionFile: `memory/${this.config.characterId}.session.json`,
    });

    // Run loop
    while (this.running) {
      if (this.paused) {
        await this.sleep(100);
        continue;
      }

      // ⑦ Check intervention mode: wait for player input
      const playerState = usePlayerStore.getState();
      if (playerState.mode === 'intervention' && !playerState.pendingMessage) {
        debug.setPhase('waiting_input');
        await this.sleep(200);
        continue;
      }

      try {
        await this.runOneCycle();
        debug.incrementLoop();
        this.config.onLoopComplete();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        debug.pushError(err.message);
        this.config.onError(err);
        // Wait before retrying
        await this.sleep(3000);
      }
    }
  }

  stop() {
    this.running = false;
    // 防止 beginPresetSequence 的 Promise 永远挂起
    usePlayerStore.getState().endPresetSequence();
  }

  pause() {
    this.paused = true;
    useDebugStore.getState().setPhase('idle');
  }

  resume() {
    this.paused = false;
  }

  isPaused() {
    return this.paused;
  }

  private async runOneCycle(): Promise<void> {
    const { contextEngine, timeline, goapActions, characterId } = this.config;
    const debug = useDebugStore.getState();

    // ─── 章节切换检测 ───
    if (!this.chapterExhausted && timeline.allEventsConsumed()) {
      this.chapterExhausted = true;
      const transitioned = await this.resolveNextChapter();
      if (transitioned) return; // 切换成功，下一轮会从新章节开始

      // 最后一章结束，没有后续章节 → 停止循环
      if (!transitioned && this.isLastChapter()) {
        debug.pushError('[核心循环] 所有章节已结束，停止循环');
        this.stop();
        return;
      }
    }

    // ─── 快速路径：预置场景（PF 信源） ───
    const nextEvent = timeline.peekNextEvent();
    if (nextEvent && timeline.hasFrames(nextEvent)) {
      await this.playPresetEvent(nextEvent);
      return;
    }

    // ─── 现有 AI 管线 ───
    const charStore = useCharacterStore.getState();
    const persona = charStore.getPersona(characterId);
    if (!persona) throw new Error(`Character ${characterId} not found`);

    // Consume pending player message (if any)
    const playerStore = usePlayerStore.getState();
    const playerMessage = playerStore.consumePendingMessage();
    const injectMessages: AgentMessage[] = [];

    if (playerMessage) {
      // Ingest player message as episodic memory
      await contextEngine.ingest({
        sessionId: this.sessionId,
        message: { role: 'user', content: playerMessage },
      });
      // Include in this cycle's context assembly
      injectMessages.push({ role: 'user', content: playerMessage });
      // Add to chat as system acknowledgement
      playerStore.addSystemMessage(`[已注入] "${playerMessage}"`);
    }

    // ① Context assembly
    debug.setPhase('assemble');
    const worldState = timeline.buildWorldState(
      'town-square',
      ['guard-captain'],
      this.describeSituation(timeline),
    );

    const assembled: AssembleResult = await contextEngine.assemble({
      sessionId: this.sessionId,
      messages: injectMessages,
      tokenBudget: 8000,
    });

    debug.setMemoryContext({
      recalledCount: assembled.metadata?.recalledMemories?.length ?? 0,
      totalTokens: assembled.estimatedTokens,
      personaShiftCount: assembled.metadata?.personaShifts?.length ?? 0,
      recalledItems: assembled.metadata?.recalledMemories ?? [],
    });

    // Inject completed actions into cognition context to prevent goal repetition
    if (this.completedActions.length > 0) {
      const recentCompleted = this.completedActions.slice(-5);
      const completedBlock = `\n\n## 已完成的行动（不要重复规划这些行动，推进到新的目标）：\n${recentCompleted.map((a) => `- ✅ ${a.actionName}：${a.goalWhat}`).join('\n')}`;
      const sysMsg = assembled.messages.find((m) => m.role === 'system');
      if (sysMsg) sysMsg.content += completedBlock;
    }

    // ② Cognition Agent: 5W1H reasoning
    debug.setPhase('cognition');
    const cognitionResult = await runCognition(assembled);
    const goal: Goal5W1H = cognitionResult.goal;

    debug.setCurrentGoal(goal, cognitionResult.rawResponse);
    debug.pushTrace({
      agent: 'cognition',
      duration: cognitionResult.durationMs,
      inputTokens: cognitionResult.inputTokens,
      outputTokens: cognitionResult.outputTokens,
      timestamp: Date.now(),
      inputSummary: `记忆${assembled.metadata?.recalledMemories?.length ?? 0}条, ${assembled.estimatedTokens}tok`,
      outputSummary: `${goal.what.slice(0, 40)}`,
    });

    // Store the goal
    charStore.addShortTermGoal(characterId, goal);

    // Ingest the goal decision as a memory
    await contextEngine.ingest({
      sessionId: this.sessionId,
      message: {
        role: 'assistant',
        content: `[决策] ${goal.what}。原因：${goal.why}。地点：${goal.where}`,
      },
    });

    // ②½ Dynamic GOAP generation (if enabled and player message exists)
    if (playerMessage && playerStore.dynamicGoapEnabled) {
      debug.setPhase('goap_gen');
      try {
        const goapGenResult = await generateGoapAction(
          playerMessage,
          goapActions,
          goal,
        );
        if (goapGenResult.action) {
          goapActions.push(goapGenResult.action);
          playerStore.addSystemMessage(
            `[动态动作] 已生成新动作：${goapGenResult.action.name}`,
          );
        }
        debug.pushTrace({
          agent: 'goap-gen',
          duration: goapGenResult.durationMs,
          inputTokens: 0,
          outputTokens: 0,
          timestamp: Date.now(),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        debug.pushError(`动态GOAP生成失败: ${msg}`);
      }
    }

    // ③ GOAP planning
    debug.setPhase('goap');
    const goalState = mapGoalToGOAPState(goal.what, goal.where);
    const recentlyCompletedIds = this.completedActions.slice(-10).map((a) => a.actionId);
    const plan = planActions(this.goapWorldState, goalState, goapActions, 5, recentlyCompletedIds);

    if (!plan || plan.actions.length === 0) {
      // Fallback: create a simple "go and do" plan
      const fallbackAction: GOAPAction = {
        id: 'custom-action',
        name: goal.what,
        preconditions: {},
        effects: goalState,
        cost: 2,
        timeCost: 30,
        description: goal.how[0] ?? goal.what,
      };
      debug.setGoapQueue([fallbackAction], 30);
      await this.executeAction(fallbackAction, goal, persona, undefined, false, playerMessage);

      // ⑨ Auto-pause after task
      this.checkAutoPause();
    } else {
      debug.setGoapQueue(plan.actions, plan.totalTime);

      // ④ Timeline conflict detection
      debug.setPhase('timeline');
      const conflict = timeline.checkConflict(plan.totalTime);

      // Update timeline debug
      const upcoming = timeline.getUpcoming();
      debug.setTimeline({
        currentTime: timeline.formatTime(),
        goalEndTime: timeline.formatTime(timeline.getCurrentTime() + plan.totalTime),
        upcomingEvents: upcoming.map((e) => ({
          time: timeline.formatTime(e.time),
          event: e.name,
          conflict: e.time <= timeline.getCurrentTime() + plan.totalTime,
        })),
      });

      if (conflict) {
        // Interrupted! Advance to event, then handle
        await this.handleInterrupt(plan.actions, goal, persona, conflict, playerMessage);
      } else {
        // Execute all actions sequentially
        for (let i = 0; i < plan.actions.length; i++) {
          debug.updateGoapStatus(i, 'running');
          await this.executeAction(plan.actions[i], goal, persona, undefined, false, i === 0 ? playerMessage : undefined);
          debug.updateGoapStatus(i, 'done');

          // ⑨ Auto-pause after each GOAP task
          this.checkAutoPause();

          // If paused during execution, wait
          while (this.paused && this.running) {
            await this.sleep(100);
          }
        }
        // Advance time
        timeline.advance(plan.totalTime);
      }
    }

    // ─── 引力评分（分歧点活跃时） ───
    if (this.divergence) {
      await this.tickDivergence(debug);
    }

    // ⑧ Post-processing (memory compaction)
    await contextEngine.afterTurn({
      sessionId: this.sessionId,
      sessionFile: `memory/${characterId}.session.json`,
      messages: [],
      prePromptMessageCount: 0,
    });

    // ⑩ Reflection (conditional: significant event or memory threshold)
    await this.maybeReflect(characterId, persona, debug);

    // Update timeline display
    debug.setTimeline({
      currentTime: timeline.formatTime(),
      goalEndTime: '',
      upcomingEvents: timeline.getUpcoming().map((e) => ({
        time: timeline.formatTime(e.time),
        event: e.name,
        conflict: false,
      })),
    });

    // Small delay between cycles
    await this.sleep(500);
  }

  /**
   * 预置场景播放：PF frames → 渲染投影 + 记忆投影
   * 跳过整个 AI 管线（cognition/GOAP/director），直接从编剧数据渲染。
   */
  private async playPresetEvent(event: WorldEvent): Promise<void> {
    const { contextEngine, timeline, characterId } = this.config;
    const debug = useDebugStore.getState();

    // 1. 时间推进到事件
    timeline.advanceToEvent(event.id);

    // 2. Debug phase
    debug.setPhase('preset');

    // 3. 渲染投影：frames → SceneOutput[]（只包含 POV 角色能看到的）
    const scenes = framesToScenes(event.frames!, characterId);

    // 4. 发送到渲染器 + 记录到 debug
    debug.setScenes(scenes);
    this.config.onScenesReady(scenes);

    // 5. 等待玩家点击完所有场景
    await usePlayerStore.getState().beginPresetSequence();

    // 6. 记忆投影入库（带 PF 元数据）
    const projections = projectAllMemories(event.frames!, characterId);
    for (const proj of projections) {
      await contextEngine.ingest({
        sessionId: this.sessionId,
        message: {
          role: proj.participationRole === 'speaker' ? 'assistant' : 'user',
          content: proj.filteredContent,
        },
        pfMetadata: {
          pfId: proj.pfId,
          participationRole: proj.participationRole,
          knownPeers: proj.knownPeers,
          involvedCharacters: proj.involvedCharacters,
        },
      });
    }

    // 7. 事件本身作为世界事件入库
    await contextEngine.ingest({
      sessionId: this.sessionId,
      message: {
        role: 'system',
        content: `[世界事件] ${event.name}：${event.description}`,
      },
    });

    // 7.5 Apply event-triggered goal changes
    this.applyEventGoalChanges(event);

    // 8. 后处理
    await contextEngine.afterTurn({
      sessionId: this.sessionId,
      sessionFile: `memory/${characterId}.session.json`,
      messages: [],
      prePromptMessageCount: 0,
    });

    debug.setPhase('idle');
  }

  /**
   * Check if we should auto-pause after a GOAP task completes.
   * This switches the player to intervention mode.
   */
  private checkAutoPause() {
    const playerState = usePlayerStore.getState();
    if (playerState.autoPauseOnTaskDone) {
      playerState.setMode('intervention');
      useDebugStore.getState().setPhase('waiting_input');
    }
  }

  private async handleInterrupt(
    actions: GOAPAction[],
    goal: Goal5W1H,
    persona: NonNullable<ReturnType<typeof useCharacterStore.getState.prototype.getPersona>>,
    event: WorldEvent,
    playerMessage?: string | null,
  ) {
    const debug = useDebugStore.getState();
    const { contextEngine, timeline, characterId } = this.config;

    // Mark remaining actions as interrupted
    for (let i = 0; i < actions.length; i++) {
      debug.updateGoapStatus(i, 'interrupted');
    }

    // Advance time to event
    timeline.advance(event.time - timeline.getCurrentTime());

    // Ingest the world event as a memory
    await contextEngine.ingest({
      sessionId: this.sessionId,
      message: {
        role: 'system',
        content: `[世界事件] ${event.name}：${event.description}（地点：${event.location}）`,
      },
    });

    // Apply event-triggered goal changes
    this.applyEventGoalChanges(event);

    // Mark current goal as interrupted
    const charStore = useCharacterStore.getState();
    const goals = charStore.getGoals(characterId);
    const activeIndex = goals.shortTerm.findIndex((g) => g.status === 'active');
    if (activeIndex >= 0) {
      charStore.updateShortTermGoalStatus(characterId, activeIndex, 'interrupted');
    }

    // Gather NPC personas for director
    const npcPersonas = this.gatherNpcPersonas();

    // Generate narrative for the interruption
    const interruptAction = {
      id: 'interrupted',
      name: '被突发事件打断',
      preconditions: {},
      effects: {},
      cost: 0,
      timeCost: 0,
      description: `${event.name}：${event.description}`,
    };
    const narrativeContext = this.narrativeMemory.assemble(interruptAction.description);
    debug.pushMemoryLog({
      method: 'narrative.assemble',
      timestamp: Date.now(),
      durationMs: 0,
      input: { query: interruptAction.description.slice(0, 80) },
      output: { windowSize: this.narrativeMemory.getStats().windowSize, recalledSummaries: narrativeContext.recalledSummaries.length },
    });

    debug.setPhase('director');
    const directorResult = await this.director.generateScenes({
      characterPersona: persona,
      npcPersonas,
      currentGoal: goal,
      action: interruptAction,
      worldEvent: event,
      interrupted: true,
      playerMessage: playerMessage ?? undefined,
      lorebookEntries: this.config.lorebookEntries,
      recentSceneText: this.getRecentSceneText(),
      narrativeContext,
    });

    debug.pushTrace({
      agent: 'director',
      duration: directorResult.durationMs,
      inputTokens: directorResult.inputTokens,
      outputTokens: directorResult.outputTokens,
      timestamp: Date.now(),
      inputSummary: `中断: ${event.name}`,
      outputSummary: `${directorResult.scenes.length}场景`,
    });

    // Ingest into narrative memory
    this.narrativeMemory.ingest(directorResult.scenes, interruptAction.name);
    debug.pushMemoryLog({
      method: 'narrative.ingest',
      timestamp: Date.now(),
      durationMs: 0,
      input: { action: interruptAction.name, sceneCount: directorResult.scenes.length },
      output: this.narrativeMemory.getStats(),
    });

    // Cache scene text for fallback
    this.lastDirectorSceneText = directorResult.scenes
      .map((s) => [s.narration, s.speaker ? `${s.speaker}：${s.dialogue}` : s.dialogue].filter(Boolean).join(' '))
      .join('\n');

    debug.setScenes(directorResult.scenes);
    this.config.onScenesReady(directorResult.scenes);

    // Ingest narrative as memory
    for (const scene of directorResult.scenes) {
      await contextEngine.ingest({
        sessionId: this.sessionId,
        message: {
          role: 'assistant',
          content: scene.narration
            ? `${scene.narration} ${scene.speaker ? `${scene.speaker}："${scene.dialogue}"` : scene.dialogue}`
            : scene.dialogue,
        },
      });
    }

    await this.sleep(3000);
  }

  private async executeAction(
    action: GOAPAction,
    goal: Goal5W1H,
    persona: NonNullable<ReturnType<typeof useCharacterStore.getState.prototype.getPersona>>,
    worldEvent: WorldEvent | undefined,
    interrupted: boolean,
    playerMessage?: string | null,
  ) {
    const debug = useDebugStore.getState();
    const { contextEngine } = this.config;

    // Gather NPC personas and narrative context for director
    const npcPersonas = this.gatherNpcPersonas();
    const narrativeContext = this.narrativeMemory.assemble(action.description);
    const nmStats = this.narrativeMemory.getStats();
    debug.pushMemoryLog({
      method: 'narrative.assemble',
      timestamp: Date.now(),
      durationMs: 0,
      input: { query: action.description.slice(0, 80) },
      output: { windowSize: nmStats.windowSize, summaryCount: nmStats.summaryCount, recalledSummaries: narrativeContext.recalledSummaries.length, recentChars: narrativeContext.recentScenesText.length },
    });

    // ⑤ Director Agent: narrative generation
    debug.setPhase('director');
    const directorResult = await this.director.generateScenes({
      characterPersona: persona,
      npcPersonas,
      currentGoal: goal,
      action,
      worldEvent,
      interrupted,
      playerMessage: playerMessage ?? undefined,
      lorebookEntries: this.config.lorebookEntries,
      recentSceneText: this.getRecentSceneText(),
      narrativeContext,
    });

    debug.pushTrace({
      agent: 'director',
      duration: directorResult.durationMs,
      inputTokens: directorResult.inputTokens,
      outputTokens: directorResult.outputTokens,
      timestamp: Date.now(),
      inputSummary: `${action.name}: ${goal.what.slice(0, 30)}`,
      outputSummary: `${directorResult.scenes.length}场景, ${directorResult.scenes.map((s) => s.speaker || '旁白').join('/')}`,
    });

    // Store Director prompt for inline debug display
    if (directorResult.systemPrompt) {
      debug.setLastDirectorPrompt(directorResult.systemPrompt);
    }

    // Ingest into narrative memory (layer 1 window + auto-compress to layer 2)
    this.narrativeMemory.ingest(directorResult.scenes, action.name);
    debug.pushMemoryLog({
      method: 'narrative.ingest',
      timestamp: Date.now(),
      durationMs: 0,
      input: { action: action.name, sceneCount: directorResult.scenes.length },
      output: this.narrativeMemory.getStats(),
    });

    // Cache scene text for fallback
    this.lastDirectorSceneText = directorResult.scenes
      .map((s) => [s.narration, s.speaker ? `${s.speaker}：${s.dialogue}` : s.dialogue].filter(Boolean).join(' '))
      .join('\n');

    // ⑥ Render
    debug.setPhase('render');
    debug.setScenes(directorResult.scenes);
    this.config.onScenesReady(directorResult.scenes);

    // Ingest narrative as memory
    for (const scene of directorResult.scenes) {
      await contextEngine.ingest({
        sessionId: this.sessionId,
        message: {
          role: 'assistant',
          content: scene.narration
            ? `${scene.narration} ${scene.speaker ? `${scene.speaker}："${scene.dialogue}"` : scene.dialogue}`
            : scene.dialogue,
        },
      });
    }

    // Apply GOAP effects to persistent world state
    for (const [key, value] of Object.entries(action.effects)) {
      this.goapWorldState[key] = value;
    }
    // Track completed action for cognition dedup
    this.completedActions.push({
      actionId: action.id,
      actionName: action.name,
      goalWhat: goal.what,
      timestamp: Date.now(),
    });

    // Wait for player to advance through all scenes before continuing
    if (directorResult.scenes.length > 0) {
      await usePlayerStore.getState().beginPresetSequence();
    }
  }

  /**
   * ⑩ Conditionally run Reflection Agent.
   * Triggered when recent memories contain significant events (importance > 0.7).
   * Produces PersonaShift that evolves character personality over time.
   */
  private async maybeReflect(
    characterId: string,
    persona: NonNullable<ReturnType<typeof useCharacterStore.getState.prototype.getPersona>>,
    debug: ReturnType<typeof useDebugStore.getState>,
  ): Promise<void> {
    const { contextEngine } = this.config;

    // Check trigger: any recent memory with high importance
    const recentMemories = contextEngine.getRecentMemories(this.sessionId, 20);
    const hasSignificant = recentMemories.slice(-5).some((m) => m.importance > 0.7);
    if (!hasSignificant) return;

    debug.setPhase('reflection');

    try {
      const charStore = useCharacterStore.getState();
      const existingShifts = charStore.getPersonaShifts(characterId);
      const activeGoals = charStore.getGoals(characterId).shortTerm
        .filter((g) => g.status === 'active')
        .map((g) => g.goal);

      const result = await runReflection({
        persona,
        recentMemories,
        existingShifts,
        currentGoals: activeGoals,
      });

      debug.pushTrace({
        agent: 'reflection',
        duration: result.durationMs,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        timestamp: Date.now(),
      });

      if (result.shift) {
        charStore.applyPersonaShift(characterId, result.shift);

        // Record the reflection as a memory
        await contextEngine.ingest({
          sessionId: this.sessionId,
          message: {
            role: 'assistant',
            content: `[反思] ${result.shift.trigger} → ${result.shift.description}`,
          },
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debug.pushError(`Reflection Agent 失败: ${msg}`);
    }

    debug.setPhase('idle');
  }

  /**
   * Build recent scene text for lorebook matching.
   */
  private getRecentSceneText(): string {
    return this.lastDirectorSceneText;
  }

  /**
   * Check if the current chapter is the last one (no `next` field).
   */
  private isLastChapter(): boolean {
    const current = this.config.chapters[this.currentChapterIndex];
    return !current?.next;
  }

  /**
   * Apply event-triggered goal changes to characters.
   */
  private applyEventGoalChanges(event: WorldEvent) {
    if (!event.goalChanges?.length) return;
    const charStore = useCharacterStore.getState();
    const debug = useDebugStore.getState();
    for (const change of event.goalChanges) {
      charStore.applyGoalChanges(change.characterId, change.addGoals, change.removeGoalIds);
      const added = change.addGoals?.map((g) => g.description).join(', ') ?? '';
      const removed = change.removeGoalIds?.join(', ') ?? '';
      debug.pushError(
        `[目标变更] ${change.characterId}: ${added ? `+${added}` : ''}${removed ? ` -${removed}` : ''} (触发: ${event.name})`,
      );
    }
  }

  /**
   * Gather NPC personas from CharacterStore (all characters except POV).
   */
  private gatherNpcPersonas() {
    const { characterId } = this.config;
    const charStore = useCharacterStore.getState();
    const allCharIds = Object.keys(charStore.characters);
    return allCharIds
      .filter((id) => id !== characterId)
      .map((id) => charStore.getPersona(id))
      .filter((p): p is NonNullable<typeof p> => p !== null);
  }

  private describeSituation(timeline: Timeline): string {
    const active = timeline.getActiveEvents();
    if (active.length > 0) {
      return active.map((e) => e.description).join('；');
    }
    return `${timeline.formatTime()}，一切如常。`;
  }

  // ─── 章节切换 ───────────────────────────────────────

  /**
   * 检查当前章节的 next 字段，决定下一步：
   * - undefined：按数组顺序找下一个章节
   * - string：跳转到指定章节 ID
   * - DivergencePoint：进入分歧模式（Phase 3）
   * 返回 true 表示成功切换，false 表示无后续章节（进入纯 AI 模式）
   */
  private async resolveNextChapter(): Promise<boolean> {
    const { chapters } = this.config;
    const current = chapters[this.currentChapterIndex];
    const next = current?.next;

    if (next === undefined) {
      // 按数组顺序找下一个
      const nextIndex = this.currentChapterIndex + 1;
      if (nextIndex < chapters.length) {
        return this.transitionToChapter(chapters[nextIndex], nextIndex);
      }
      // 没有后续章节 → 纯 AI 模式
      return false;
    }

    if (typeof next === 'string') {
      // 线性跳转到指定 ID
      const targetIndex = chapters.findIndex((ch) => ch.id === next);
      if (targetIndex >= 0) {
        return this.transitionToChapter(chapters[targetIndex], targetIndex);
      }
      // ID 找不到 → fallback 到数组顺序
      const fallbackIndex = this.currentChapterIndex + 1;
      if (fallbackIndex < chapters.length) {
        return this.transitionToChapter(chapters[fallbackIndex], fallbackIndex);
      }
      return false;
    }

    // DivergencePoint — 分歧模式
    const divergence = next as DivergencePoint;
    const debug = useDebugStore.getState();
    const branchLabels = divergence.branches.map((b) => b.label).join(' / ');

    // maxFreeActions === 0 → 立即暂停，等待玩家选择（传统选项模式）
    if (divergence.maxFreeActions === 0) {
      debug.pushError(`[分歧点] 等待玩家选择：${branchLabels}`);

      const playerStore = usePlayerStore.getState();
      const chosenChapterId = await playerStore.beginDivergenceChoice(divergence);

      debug.pushError(`[分歧点] 玩家选择：${chosenChapterId}`);

      const targetIndex = chapters.findIndex((ch) => ch.id === chosenChapterId);
      if (targetIndex >= 0) {
        return this.transitionToChapter(chapters[targetIndex], targetIndex);
      }
      return false;
    }

    // maxFreeActions > 0 → 引力评分模式（自由行动期）
    this.divergence = {
      point: divergence,
      scores: initScores(divergence.branches),
      actionsRemaining: divergence.maxFreeActions,
    };
    usePlayerStore.getState().setDivergenceActive(true);

    debug.pushError(`[分歧点] 进入自由行动期（${divergence.maxFreeActions} 轮），分支：${branchLabels}`);

    // 不切换章节，继续 AI 管线；引力评分在 tickDivergence 中进行
    return false;
  }

  /**
   * 每轮 AI 管线结束后，如果分歧点活跃，执行一次引力评分。
   * 评分来源：最近一轮生成的场景文本。
   * 达到上限或 decisive 时，收束到目标分支。
   */
  private async tickDivergence(
    debug: ReturnType<typeof useDebugStore.getState>,
  ): Promise<void> {
    if (!this.divergence) return;

    const { point, scores } = this.divergence;

    // 从最近的场景中提取文本用于评分
    const recentScenes = debug.currentScenes ?? [];
    const textToScore = recentScenes
      .map((s: SceneOutput) => [s.dialogue, s.narration].filter(Boolean).join(' '))
      .join(' ');

    if (textToScore) {
      const roundScores = scoreText(textToScore, point.branches);
      accumulateScores(scores, roundScores);
    }

    this.divergence.actionsRemaining--;

    // 检查是否应该收束
    const result = resolveGravity(scores, point.branches, point.defaultBranch);
    const shouldResolve = this.divergence.actionsRemaining <= 0 || result.decisive;

    if (shouldResolve) {
      const { chapters } = this.config;
      const targetIndex = chapters.findIndex((ch) => ch.id === result.chapterId);
      const targetLabel = point.branches.find(
        (b) => b.targetChapterId === result.chapterId,
      )?.label ?? result.chapterId;

      debug.pushError(
        `[引力收束] → ${targetLabel}（剩余${this.divergence.actionsRemaining}轮，decisive=${result.decisive}）`,
      );

      // 清理分歧状态
      this.divergence = null;
      usePlayerStore.getState().setDivergenceActive(false);

      if (targetIndex >= 0) {
        this.transitionToChapter(chapters[targetIndex], targetIndex);
      }
    } else {
      // 输出当前分数到 debug
      const scoreStr = point.branches
        .map((b) => `${b.label}:${(scores.get(b.targetChapterId) ?? 0).toFixed(1)}`)
        .join(' | ');
      debug.pushError(
        `[引力] 剩余${this.divergence.actionsRemaining}轮 — ${scoreStr}`,
      );
    }
  }

  /**
   * 切换到目标章节：替换 Timeline 事件，重置状态
   */
  private transitionToChapter(target: ChapterData, targetIndex: number): boolean {
    const { timeline } = this.config;
    const current = this.config.chapters[this.currentChapterIndex];

    // 替换 Timeline 的事件和地点
    timeline.replaceEvents(target.events, target.locations);

    // 更新状态
    this.currentChapterIndex = targetIndex;
    this.chapterExhausted = false;
    this.narrativeMemory.setChapter(target.chapter);

    // Emit a chapter transition scene for the renderer (shows in history + export)
    const transitionScene: SceneOutput = {
      speaker: null,
      dialogue: '',
      narration: target.chapter,
      type: 'chapter-transition' as SceneOutput['type'],
    };
    this.config.onScenesReady([transitionScene]);

    // 通知外部
    this.config.onChapterTransition?.(current, target);

    // 记录到 debug
    const debug = useDebugStore.getState();
    debug.pushError(`[章节切换] ${current.chapter} → ${target.chapter}`);

    return true;
  }

  /** 获取当前章节索引（供外部查询） */
  getCurrentChapterIndex(): number {
    return this.currentChapterIndex;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
