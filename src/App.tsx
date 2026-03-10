/**
 * App - Main application component.
 * Initializes game systems and renders the game + debug drawer + player chat layout.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { GameRenderer } from './engine/game-renderer';
import { DebugDrawer } from './debug/DebugDrawer';
import { ChatInput } from './player/ChatInput';
import { CoreLoop } from './engine/core-loop';
import { NovelContextEngine } from './memory/context-engine';
import { useCharacterStore } from './memory/character-store';
import { useDebugStore } from './debug/debug-store';
import { usePlayerStore } from './player/player-store';
import { Timeline } from './timeline/timeline';
import type { SceneOutput, CharacterState, WorldEvent, GOAPAction } from './memory/schemas';

// Import data
import liyaData from './data/characters/liya.json';
import chapter1Data from './data/world-events/chapter1.json';
import goapActionsData from './data/goap-actions.json';

export function App() {
  const [scenes, setScenes] = useState<SceneOutput[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [gameLog, setGameLog] = useState<string[]>([]);
  const coreLoopRef = useRef<CoreLoop | null>(null);
  const timelineRef = useRef<Timeline | null>(null);
  const contextEngineRef = useRef<NovelContextEngine | null>(null);

  const initCharacter = useCharacterStore((s) => s.initCharacter);
  const debug = useDebugStore();
  const playerMode = usePlayerStore((s) => s.mode);

  // Initialize game on mount
  useEffect(() => {
    initCharacter('liya', liyaData as CharacterState);
  }, [initCharacter]);

  const handleStart = useCallback(() => {
    if (isRunning) return;

    const timeline = new Timeline(
      480, // 08:00
      chapter1Data.events as WorldEvent[],
      chapter1Data.locations,
    );
    timelineRef.current = timeline;

    const contextEngine = new NovelContextEngine(() =>
      timeline.buildWorldState(
        'home',
        ['guard-captain'],
        timeline.getActiveEvents().length > 0
          ? timeline.getActiveEvents().map((e) => e.description).join('；')
          : `${timeline.formatTime()}，边境小镇的清晨，一切平静。`,
      ),
    );
    contextEngineRef.current = contextEngine;

    const loop = new CoreLoop({
      characterId: 'liya',
      contextEngine,
      timeline,
      goapActions: goapActionsData as unknown as GOAPAction[],
      onScenesReady: (newScenes) => {
        setScenes(newScenes);
        setGameLog((log) => [
          ...log,
          ...newScenes.map((s) =>
            s.speaker
              ? `${s.speaker}：${s.dialogue}`
              : s.dialogue,
          ),
        ]);
      },
      onLoopComplete: () => {
        // Loop completed one cycle
      },
      onError: (error) => {
        setGameLog((log) => [...log, `[错误] ${error.message}`]);
      },
    });

    coreLoopRef.current = loop;
    setIsRunning(true);
    debug.reset();

    // Start in background
    loop.start().catch((err) => {
      console.error('Core loop crashed:', err);
      setIsRunning(false);
    });
  }, [isRunning, debug]);

  const handleStop = useCallback(() => {
    coreLoopRef.current?.stop();
    setIsRunning(false);
  }, []);

  const handlePauseResume = useCallback(() => {
    const loop = coreLoopRef.current;
    if (!loop) return;
    if (loop.isPaused()) {
      loop.resume();
    } else {
      loop.pause();
    }
  }, []);

  /**
   * Handle player chat message.
   * Ingests into context engine and signals the core loop to process it.
   */
  const handlePlayerMessage = useCallback((message: string) => {
    const loop = coreLoopRef.current;
    if (!loop) return;

    // PlayerStore.sendMessage already sets pendingMessage
    // The core loop will pick it up on the next cycle via consumePendingMessage()

    // If loop is paused (manual pause), resume it so the message gets processed
    if (loop.isPaused()) {
      loop.resume();
    }
  }, []);

  return (
    <div style={styles.layout}>
      {/* Game area */}
      <div style={styles.gameArea}>
        {!isRunning ? (
          <div style={styles.startScreen}>
            <h1 style={styles.title}>AI互动视觉小说引擎</h1>
            <p style={styles.subtitle}>Agent记忆系统验证 MVP</p>
            <div style={styles.charInfo}>
              <p style={styles.charName}>莉娅·艾文斯</p>
              <p style={styles.charDesc}>
                没落贵族的末裔，在边境小镇追寻家族覆灭的真相
              </p>
            </div>
            <button style={styles.startBtn} onClick={handleStart}>
              开始游戏
            </button>
            <p style={styles.hint}>
              底部输入框可切换"自主运行"和"介入模式"
            </p>
          </div>
        ) : (
          <div style={styles.gameContent}>
            {/* Control bar */}
            <div style={styles.controlBar}>
              <button style={styles.controlBtn} onClick={handlePauseResume}>
                {coreLoopRef.current?.isPaused() ? '▶ 继续' : '⏸ 暂停'}
              </button>
              <button style={styles.controlBtn} onClick={handleStop}>
                ⏹ 停止
              </button>
              <span style={styles.modeIndicator}>
                {playerMode === 'autonomous' ? '🔄 自主' : '✋ 介入'}
              </span>
            </div>

            {/* Game renderer */}
            <div style={styles.rendererWrap}>
              <GameRenderer
                scenes={scenes}
                characterName="莉娅·艾文斯"
                currentTime={debug.timeline.currentTime || '08:00'}
                currentLocation={
                  timelineRef.current?.getLocationName(
                    debug.currentGoal?.where ?? 'home',
                  ) ?? '赫尔曼的小屋'
                }
              />
            </div>

            {/* Player chat input */}
            <ChatInput
              onSendMessage={(msg) => {
                usePlayerStore.getState().sendMessage(msg);
                handlePlayerMessage(msg);
              }}
              isRunning={isRunning}
            />
          </div>
        )}
      </div>

      {/* Debug drawer */}
      <DebugDrawer />
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  layout: {
    display: 'flex',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    background: '#0f0f1a',
  },
  gameArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  startScreen: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    gap: '16px',
  },
  title: {
    color: '#e6c3a1',
    fontSize: '28px',
    fontFamily: '"Noto Serif SC", serif',
    margin: 0,
  },
  subtitle: {
    color: '#7ec8e3',
    fontSize: '14px',
    margin: 0,
  },
  charInfo: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '16px 24px',
    textAlign: 'center',
    marginTop: '16px',
  },
  charName: {
    color: '#e6c3a1',
    fontSize: '18px',
    fontWeight: 'bold',
    margin: '0 0 8px 0',
  },
  charDesc: {
    color: '#aaa',
    fontSize: '13px',
    margin: 0,
  },
  startBtn: {
    marginTop: '24px',
    padding: '12px 48px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '24px',
    fontSize: '16px',
    cursor: 'pointer',
    fontFamily: '"Noto Serif SC", serif',
  },
  hint: {
    color: '#555',
    fontSize: '12px',
    marginTop: '16px',
  },
  gameContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  controlBar: {
    display: 'flex',
    gap: '8px',
    padding: '6px 12px',
    background: '#181825',
    borderBottom: '1px solid #333',
    alignItems: 'center',
  },
  controlBtn: {
    padding: '4px 12px',
    background: '#2a2a3a',
    color: '#ccc',
    border: '1px solid #444',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  modeIndicator: {
    marginLeft: 'auto',
    color: '#888',
    fontSize: '12px',
  },
  rendererWrap: {
    flex: 1,
    overflow: 'hidden',
  },
};
