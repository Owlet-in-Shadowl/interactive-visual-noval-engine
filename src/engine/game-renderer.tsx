/**
 * Game Renderer - React-based visual novel UI.
 *
 * Scene queue: each scene is shown one-at-a-time with typewriter effect.
 * Supports three scene types:
 *   - dialogue: normal character speech or narration
 *   - narration: pure narrative description
 *   - thought: inner monologue (「俺寻思」system)
 *
 * Features:
 *   - Click to advance / skip typewriter
 *   - AUTO mode: auto-advance after typewriter completes
 *   - Thinking flow: player input triggers memory recall + inner monologue
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { SceneOutput } from '../memory/schemas';
import type { IFullContextEngine } from '../memory/context-engine';
import { usePlayerStore } from '../player/player-store';
import { useCharacterStore } from '../memory/character-store';
import { runThinking } from '../agents/thinking';
import { runBranchDescriber } from '../agents/branch-describer';
import { T } from '../theme';
import {
  Smile, Frown, Angry,
  AlertCircle, Eye, Flame, Brain, MessageCircle,
  GitBranch, Loader2,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';

interface GameRendererProps {
  scenes: SceneOutput[];
  characterName: string;
  characterId: string;
  currentTime: string;
  currentLocation: string;
  contextEngine: IFullContextEngine;
  sessionId: string;
}

function useTypewriter(text: string, speed: number = 40) {
  const [displayed, setDisplayed] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setDisplayed('');
    setIsComplete(false);
    if (!text) return;

    let index = 0;
    timerRef.current = setInterval(() => {
      index++;
      setDisplayed(text.slice(0, index));
      if (index >= text.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setIsComplete(true);
      }
    }, speed);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [text, speed]);

  const skipToEnd = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setDisplayed(text);
    setIsComplete(true);
  }, [text]);

  return { displayed, isComplete, skipToEnd };
}

export function GameRenderer({
  scenes,
  characterName,
  characterId,
  currentTime,
  currentLocation,
  contextEngine,
  sessionId,
}: GameRendererProps) {
  const [history, setHistory] = useState<SceneOutput[]>([]);
  const [queue, setQueue] = useState<SceneOutput[]>([]);
  const [currentScene, setCurrentScene] = useState<SceneOutput | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const lastScenesRef = useRef<SceneOutput[]>([]);

  const autoAdvance = usePlayerStore((s) => s.autoAdvance);
  const thinking = usePlayerStore((s) => s.thinking);
  const activeDivergence = usePlayerStore((s) => s.activeDivergence);
  const branchDescriptions = usePlayerStore((s) => s.branchDescriptions);

  // When new scenes arrive from core-loop, enqueue them
  useEffect(() => {
    if (scenes.length === 0 || scenes === lastScenesRef.current) return;
    lastScenesRef.current = scenes;
    setQueue((q) => [...q, ...scenes]);
  }, [scenes]);

  // Dequeue: when no scene is currently displayed, take the next from queue
  useEffect(() => {
    if (currentScene || queue.length === 0) return;
    const [next, ...rest] = queue;
    setCurrentScene(next);
    setQueue(rest);
  }, [currentScene, queue]);

  // Sync povSpeaking: true when current scene's speaker is the POV character
  // This controls whether the player can trigger thinking in ChatInput
  useEffect(() => {
    const isPov = currentScene?.speaker === characterId
      || currentScene?.type === 'thought'
      || currentScene?.type === 'player-input'
      || (currentScene?.speaker === null && !currentScene?.type);  // narration counts as POV context
    usePlayerStore.getState().setPovSpeaking(!!isPov);
  }, [currentScene, characterId]);

  // Get display text for typewriter
  const displayText = currentScene
    ? (currentScene.dialogue || currentScene.narration || '')
    : '';
  const isThought = currentScene?.type === 'thought';
  const isPlayerInput = currentScene?.type === 'player-input';
  const typewriterSpeed = isPlayerInput ? 20 : isThought ? 30 : 40;
  const { displayed, isComplete, skipToEnd } = useTypewriter(displayText, typewriterSpeed);

  // AUTO mode auto-advance
  // - player-input during thinking: stay put (thinking completion handles transition)
  // - player-input after thinking: auto-advance quickly (player knows what they typed)
  // - all other scenes (including thought): follow AUTO toggle
  useEffect(() => {
    if (!isComplete || !currentScene) return;

    // During thinking, player-input stays put
    if (isPlayerInput && thinking) return;

    // Player input (thinking done): auto-advance quickly
    if (isPlayerInput) {
      const timer = setTimeout(() => advanceScene(), 400);
      return () => clearTimeout(timer);
    }

    // All other scenes (dialogue, narration, thought): follow AUTO toggle
    if (autoAdvance && !thinking) {
      const delay = isThought ? 1500 : 2000;
      const timer = setTimeout(() => advanceScene(), delay);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAdvance, isComplete, currentScene, thinking, isPlayerInput, isThought]);

  // Advance to next scene
  const advanceScene = useCallback(() => {
    if (!currentScene) return;

    // Move current scene to history
    setHistory((h) => [...h, currentScene]);
    setCurrentScene(null);

    // If this was the last scene and preset is active, resolve the promise
    if (queue.length === 0 && usePlayerStore.getState().presetScenesActive) {
      usePlayerStore.getState().endPresetSequence();
    }
  }, [currentScene, queue]);

  // Click handler: skip typewriter → advance to next scene
  // Blocked during thinking to prevent race conditions with the thinking flow
  const handleAdvance = useCallback(() => {
    if (!currentScene || thinking) return;

    // If typewriter still running, skip to end first
    if (!isComplete) {
      skipToEnd();
      return;
    }

    advanceScene();
  }, [currentScene, thinking, isComplete, skipToEnd, advanceScene]);

  // ─── Thinking flow ───────────────────────────────────────
  // Listen for pendingMessage and trigger thinking
  const pendingMessage = usePlayerStore((s) => s.pendingMessage);

  useEffect(() => {
    if (!pendingMessage || thinking) return;

    const doThinking = async () => {
      const playerStore = usePlayerStore.getState();
      const question = playerStore.consumePendingMessage();
      if (!question) return;

      // 1. Immediately show player's input as a scene
      const playerInputScene: SceneOutput = {
        speaker: null,
        dialogue: question,
        type: 'player-input',
        emotion: undefined,
      };

      // If there's a current scene showing, move it to history and replace with player input
      if (currentScene) {
        setHistory((h) => [...h, currentScene]);
      }
      setCurrentScene(playerInputScene);
      // Any remaining queue items go after the thinking results
      const savedQueue = [...queue];
      setQueue([]);

      playerStore.setThinking(true);

      try {
        // Get character persona
        const charStore = useCharacterStore.getState();
        const persona = charStore.getPersona(characterId);
        if (!persona) {
          playerStore.setThinking(false);
          setQueue(savedQueue);
          return;
        }

        // Recall relevant memories
        const recalledMemories = contextEngine.recallMemories(sessionId, question, 10);

        // Build recent context summary from last few history entries
        const recentScenesSummary = history
          .slice(-5)
          .map((s) => {
            const text = s.dialogue || s.narration || '';
            return s.speaker ? `${s.speaker}：${text}` : text;
          })
          .join('\n');

        // Run thinking agent
        const result = await runThinking({
          characterPersona: persona,
          playerQuestion: question,
          recalledMemories,
          recentScenesSummary,
        });

        // 2. Move player input to history, insert thought scenes + remaining queue
        setHistory((h) => [...h, playerInputScene]);
        if (result.scenes.length > 0) {
          setCurrentScene(result.scenes[0]);
          setQueue([...result.scenes.slice(1), ...savedQueue]);
        } else {
          setCurrentScene(null);
          setQueue(savedQueue);
        }

        // 3. Write thinking results back to episodic memory (层次1)
        // The character "remembers" what they thought about
        for (const scene of result.scenes) {
          const thoughtContent = `[内心思考] 关于"${question}"：${scene.dialogue || ''}`;
          await contextEngine.ingest({
            sessionId,
            message: { role: 'assistant', content: thoughtContent },
          });
        }
        // Also ingest the player's question as observation
        await contextEngine.ingest({
          sessionId,
          message: { role: 'user', content: `[玩家思考] ${question}` },
        });
      } catch (err) {
        console.error('[Thinking] Failed:', err);
        // Insert a fallback thought scene
        const fallbackScene: SceneOutput = {
          speaker: characterId,
          dialogue: '……一时间什么也想不起来。',
          type: 'thought',
          emotion: 'neutral',
        };
        setHistory((h) => [...h, playerInputScene]);
        setCurrentScene(fallbackScene);
        setQueue(savedQueue);
      } finally {
        playerStore.setThinking(false);
      }
    };

    doThinking();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMessage]);

  // Auto-scroll history
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [history, displayed]);

  // ─── Divergence choice: trigger LLM description generation ───
  useEffect(() => {
    if (!activeDivergence) return;
    const recentSummary = history
      .slice(-8)
      .map((s) => {
        const text = s.dialogue || s.narration || '';
        return s.speaker ? `${s.speaker}：${text}` : text;
      })
      .join('\n');

    runBranchDescriber({
      branches: activeDivergence.branches.map((b) => ({
        label: b.label,
        gravityDescription: b.gravityDescription,
      })),
      recentScenesSummary: recentSummary,
      characterName,
    })
      .then((descriptions) => {
        usePlayerStore.getState().setBranchDescriptions(descriptions);
      })
      .catch((err) => {
        console.error('[BranchDescriber] Failed:', err);
        // Fallback: use gravityDescription directly
        const fallback = activeDivergence.branches.map((b) => b.gravityDescription);
        usePlayerStore.getState().setBranchDescriptions(fallback);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDivergence]);

  const handleBranchChoice = useCallback((targetChapterId: string) => {
    usePlayerStore.getState().resolveDivergenceChoice(targetChapterId);
  }, []);

  const emotionIcons: Record<string, ComponentType<LucideProps> | null> = {
    neutral: null,
    happy: Smile,
    sad: Frown,
    angry: Angry,
    surprised: AlertCircle,
    fearful: Eye,
    determined: Flame,
    suspicious: Eye,
  };

  return (
    <div style={styles.container}>
      {/* Header bar */}
      <div style={styles.header}>
        <span style={styles.headerTime}>{currentTime}</span>
        <span style={styles.headerLocation}>{currentLocation}</span>
        <span style={styles.headerChar}>{characterName}</span>
      </div>

      {/* Scene background area */}
      <div style={styles.sceneArea}>
        {/* History scroll */}
        <div ref={historyRef} style={styles.history}>
          {history.map((h, i) => (
            <HistoryEntry key={i} scene={h} />
          ))}
        </div>
      </div>

      {/* Dialogue box — current scene with typewriter, click to advance */}
      {currentScene && (
        <div
          style={{
            ...styles.dialogueBox,
            ...(isThought ? styles.thoughtBox : {}),
            ...(isPlayerInput ? styles.playerInputBox : {}),
          }}
          onClick={handleAdvance}
        >
          {currentScene.narration && currentScene.dialogue && !isThought && !isPlayerInput && (
            <p style={styles.narration}>{currentScene.narration}</p>
          )}
          <div style={styles.dialogueContent}>
            {isPlayerInput ? (
              <div style={styles.speakerTag}>
                <MessageCircle size={14} style={{ color: T.gold, flexShrink: 0 }} />
                <span style={styles.playerInputLabel}>玩家</span>
              </div>
            ) : currentScene.speaker ? (
              <div style={styles.speakerTag}>
                {isThought && (
                  <Brain size={14} style={{ color: T.info, flexShrink: 0 }} />
                )}
                <span style={isThought ? styles.thoughtSpeakerName : styles.speakerName}>
                  {currentScene.speaker}
                  {isThought && <span style={styles.thoughtLabel}>(内心)</span>}
                </span>
                {currentScene.emotion && !isThought && (
                  <span style={styles.emotionBadge}>
                    {(() => {
                      const Icon = emotionIcons[currentScene.emotion!];
                      return Icon ? <Icon size={12} style={{ verticalAlign: 'middle', marginRight: 3 }} /> : null;
                    })()}
                    {currentScene.emotion}
                  </span>
                )}
              </div>
            ) : null}
            <p style={isPlayerInput ? styles.playerInputText : isThought ? styles.thoughtText : styles.dialogueText}>
              {displayed}
              {!isComplete && <span style={styles.cursor}>▊</span>}
            </p>
          </div>
          {/* Advance indicator or queue count */}
          <div style={styles.advanceArea}>
            {isComplete && (
              <span style={styles.advanceHint}>▼</span>
            )}
            {queue.length > 0 && (
              <span style={styles.queueHint}>
                还有 {queue.length} 段
              </span>
            )}
          </div>
        </div>
      )}

      {/* ─── Divergence choice panel ─── */}
      {activeDivergence && (
        <div style={styles.choicePanel}>
          <div style={styles.choiceHeader}>
            <GitBranch size={16} style={{ color: T.accent }} />
            <span style={styles.choiceTitle}>命运的岔路</span>
          </div>
          <div style={styles.choiceList}>
            {activeDivergence.branches.map((branch, i) => (
              <button
                key={branch.targetChapterId}
                style={styles.choiceButton}
                onClick={() => handleBranchChoice(branch.targetChapterId)}
                onMouseEnter={(e) => {
                  Object.assign(e.currentTarget.style, styles.choiceButtonHover);
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = T.accent;
                  e.currentTarget.style.background = T.bgSurface;
                }}
              >
                <span style={styles.choiceLabel}>{branch.label}</span>
                {branchDescriptions?.[i] ? (
                  <span style={styles.choiceDesc}>{branchDescriptions[i]}</span>
                ) : (
                  <span style={styles.choiceDescLoading}>
                    <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                    正在构思...
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state when no scene and no queue */}
      {!currentScene && !activeDivergence && queue.length === 0 && history.length === 0 && (
        <div style={styles.dialogueBox}>
          <p style={styles.emptyHint}>等待叙事生成...</p>
        </div>
      )}
    </div>
  );
}

// ─── History entry sub-component ────────────────────────────

function HistoryEntry({ scene }: { scene: SceneOutput }) {
  const text = scene.dialogue || scene.narration || '';
  const isThought = scene.type === 'thought';
  const isPlayerInput = scene.type === 'player-input';

  if (isPlayerInput) {
    return (
      <div style={styles.historyPlayerInput}>
        <MessageCircle size={11} style={{ color: T.gold, flexShrink: 0, marginTop: 3 }} />
        <p style={styles.historyPlayerInputText}>{text}</p>
      </div>
    );
  }

  if (isThought) {
    return (
      <div style={styles.historyThought}>
        <Brain size={11} style={{ color: T.info, flexShrink: 0, marginTop: 3 }} />
        <p style={styles.historyThoughtText}>
          {scene.speaker && (
            <span style={styles.historyThoughtSpeaker}>{scene.speaker}(内心)：</span>
          )}
          {text}
        </p>
      </div>
    );
  }

  return (
    <div style={styles.historyEntry}>
      {scene.narration && scene.dialogue && (
        <p style={styles.historyNarration}>{scene.narration}</p>
      )}
      {scene.speaker ? (
        <p style={styles.historyDialogue}>
          <span style={styles.speakerName}>{scene.speaker}</span>
          ：{text}
        </p>
      ) : (
        <p style={styles.historyNarration}>{text}</p>
      )}
    </div>
  );
}

// ─── Inline styles ───────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: T.bg,
    color: T.textPrimary,
    fontFamily: T.fontSerif,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 16px',
    background: T.bgSurface,
    fontSize: '13px',
    color: T.textSecondary,
    flexShrink: 0,
    fontFamily: T.fontSans,
    borderBottom: `1px solid ${T.border}`,
  },
  headerTime: { color: T.info },
  headerLocation: { color: T.gold },
  headerChar: { color: T.accent },
  sceneArea: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  history: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 24px',
    maskImage: 'linear-gradient(transparent 0%, black 15%)',
    WebkitMaskImage: 'linear-gradient(transparent 0%, black 15%)',
  },
  historyEntry: {
    marginBottom: '12px',
    opacity: 0.55,
    fontSize: '14px',
    lineHeight: '1.8',
  },
  historyNarration: {
    fontStyle: 'italic',
    color: T.narration,
    margin: '4px 0',
  },
  historyDialogue: {
    margin: '4px 0',
    color: T.textSecondary,
  },
  // ─── Thought history style ──────────────
  historyThought: {
    display: 'flex',
    gap: '6px',
    marginBottom: '12px',
    opacity: 0.55,
    fontSize: '14px',
    lineHeight: '1.8',
    borderLeft: `2px solid ${T.info}`,
    paddingLeft: '10px',
  },
  historyThoughtText: {
    fontStyle: 'italic',
    color: T.info,
    margin: 0,
  },
  historyThoughtSpeaker: {
    fontWeight: 500,
    marginRight: '2px',
  },
  // ─── Player input history style ───────
  historyPlayerInput: {
    display: 'flex',
    gap: '6px',
    marginBottom: '12px',
    opacity: 0.55,
    fontSize: '14px',
    lineHeight: '1.8',
    borderLeft: `2px solid ${T.gold}`,
    paddingLeft: '10px',
  },
  historyPlayerInputText: {
    color: T.gold,
    margin: 0,
  },
  // ─── Dialogue box ──────────────────────
  dialogueBox: {
    background: T.bgSurface,
    borderRadius: `${T.radiusXl} ${T.radiusXl} 0 0`,
    padding: '20px 24px',
    minHeight: '140px',
    flexShrink: 0,
    boxShadow: T.shadowCard,
    cursor: 'pointer',
    userSelect: 'none',
  },
  // ─── Thought box override ──────────────
  thoughtBox: {
    borderLeft: `3px solid ${T.info}`,
    background: `color-mix(in srgb, ${T.bgSurface} 90%, ${T.info} 10%)`,
  },
  // ─── Player input box override ────────
  playerInputBox: {
    borderLeft: `3px solid ${T.gold}`,
    background: `color-mix(in srgb, ${T.bgSurface} 90%, ${T.gold} 10%)`,
    minHeight: '80px',
  },
  narration: {
    fontStyle: 'italic',
    color: T.narration,
    fontSize: '13px',
    margin: '0 0 8px 0',
    lineHeight: '1.6',
  },
  dialogueContent: {},
  speakerTag: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
  },
  speakerName: {
    color: T.speaker,
    fontWeight: 500,
    fontSize: '15px',
  },
  thoughtSpeakerName: {
    color: T.info,
    fontWeight: 500,
    fontSize: '15px',
  },
  thoughtLabel: {
    fontSize: '12px',
    color: T.info,
    opacity: 0.7,
    marginLeft: '4px',
    fontFamily: T.fontSans,
  },
  playerInputLabel: {
    color: T.gold,
    fontWeight: 500,
    fontSize: '14px',
    fontFamily: T.fontSans,
  },
  playerInputText: {
    fontSize: '16px',
    lineHeight: '1.8',
    margin: 0,
    color: T.gold,
    minHeight: '30px',
  },
  emotionBadge: {
    fontSize: '12px',
    background: T.accentMuted,
    padding: '2px 8px',
    borderRadius: T.radiusPill,
    color: T.textSecondary,
    fontFamily: T.fontSans,
  },
  dialogueText: {
    fontSize: '16px',
    lineHeight: '1.8',
    margin: 0,
    color: T.textPrimary,
    minHeight: '50px',
  },
  thoughtText: {
    fontSize: '16px',
    lineHeight: '1.8',
    margin: 0,
    color: T.info,
    fontStyle: 'italic',
    minHeight: '50px',
  },
  cursor: {
    animation: 'blink 1s infinite',
    color: T.accent,
  },
  advanceArea: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '8px',
    minHeight: '18px',
  },
  advanceHint: {
    color: T.accent,
    fontSize: '14px',
    animation: 'blink 1.2s infinite',
  },
  queueHint: {
    color: T.textMuted,
    fontSize: '11px',
    fontFamily: T.fontSans,
    marginLeft: 'auto',
  },
  emptyHint: {
    color: T.textMuted,
    fontStyle: 'italic',
    fontSize: '14px',
    margin: 0,
  },
  // ─── Choice panel styles ─────────────
  choicePanel: {
    background: T.bgSurface,
    borderRadius: `${T.radiusXl} ${T.radiusXl} 0 0`,
    padding: '20px 24px',
    flexShrink: 0,
    boxShadow: T.shadowCard,
  },
  choiceHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
  },
  choiceTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: T.accent,
    fontFamily: T.fontSerif,
  },
  choiceList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  choiceButton: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    padding: '14px 18px',
    background: T.bgSurface,
    border: `1px solid ${T.accent}`,
    borderRadius: T.radius,
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'all 0.2s ease',
    outline: 'none',
  },
  choiceButtonHover: {
    borderColor: T.gold,
    background: `color-mix(in srgb, ${T.bgSurface} 85%, ${T.accent} 15%)`,
  },
  choiceLabel: {
    fontSize: '15px',
    fontWeight: 600,
    color: T.textPrimary,
    fontFamily: T.fontSerif,
  },
  choiceDesc: {
    fontSize: '13px',
    color: T.textSecondary,
    lineHeight: '1.6',
    fontFamily: T.fontSerif,
  },
  choiceDescLoading: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: T.textMuted,
    fontFamily: T.fontSans,
  },
};
