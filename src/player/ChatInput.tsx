/**
 * ChatInput - LLM-style chat input component for player interaction.
 *
 * Features:
 * - Text input + Send button (Enter to submit)
 * - Mode toggle: autonomous / intervention
 * - Auto-pause checkbox: pause after GOAP task completion
 * - Scrollable chat history showing player, narrator, character messages
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePlayerStore } from './player-store';
import type { ChatMessage } from './player-store';
import { T } from '../theme';
import { RefreshCw, Hand } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isRunning: boolean;
}

export function ChatInput({ onSendMessage, isRunning }: ChatInputProps) {
  const [inputValue, setInputValue] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const mode = usePlayerStore((s) => s.mode);
  const autoPause = usePlayerStore((s) => s.autoPauseOnTaskDone);
  const dynamicGoap = usePlayerStore((s) => s.dynamicGoapEnabled);
  const chatHistory = usePlayerStore((s) => s.chatHistory);
  const setMode = usePlayerStore((s) => s.setMode);
  const toggleAutoPause = usePlayerStore((s) => s.toggleAutoPause);
  const toggleDynamicGoap = usePlayerStore((s) => s.toggleDynamicGoap);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory.length]);

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInputValue('');
  }, [inputValue, onSendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div style={styles.container}>
      {/* Chat history */}
      {chatHistory.length > 0 && (
        <div style={styles.chatHistory}>
          {chatHistory.slice(-30).map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
          <div ref={chatEndRef} />
        </div>
      )}

      {/* Input area */}
      <div style={styles.inputRow}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            !isRunning
              ? '点击"开始游戏"后可以输入...'
              : mode === 'intervention'
                ? '输入指令或对话，影响角色决策...'
                : '切换到介入模式后可输入（当前自主运行中）'
          }
          disabled={!isRunning}
          style={{
            ...styles.input,
            opacity: isRunning ? 1 : 0.5,
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!isRunning || !inputValue.trim()}
          style={{
            ...styles.sendBtn,
            opacity: isRunning && inputValue.trim() ? 1 : 0.4,
          }}
        >
          发送
        </button>
      </div>

      {/* Controls row */}
      {isRunning && (
        <div style={styles.controlsRow}>
          <div style={styles.modeGroup}>
            <button
              style={{
                ...styles.modeBtn,
                ...(mode === 'autonomous' ? styles.modeBtnActive : {}),
              }}
              onClick={() => setMode('autonomous')}
            >
              <RefreshCw size={11} strokeWidth={1.5} /> 自主运行
            </button>
            <button
              style={{
                ...styles.modeBtn,
                ...(mode === 'intervention' ? styles.modeBtnIntervention : {}),
              }}
              onClick={() => setMode('intervention')}
            >
              <Hand size={11} strokeWidth={1.5} /> 介入模式
            </button>
          </div>

          <ToggleSwitch
            checked={autoPause}
            onChange={toggleAutoPause}
            label="世界事件结束后等待介入"
          />
          <ToggleSwitch
            checked={dynamicGoap}
            onChange={toggleDynamicGoap}
            label="允许根据角色行动习得新动作"
          />
        </div>
      )}
    </div>
  );
}

// ─── ToggleSwitch sub-component ─────────────────────────

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <div style={toggleStyles.container} onClick={onChange}>
      <span style={toggleStyles.label}>{label}</span>
      <div
        style={{
          ...toggleStyles.track,
          background: checked ? T.accent : T.bgElevated,
        }}
      >
        <div
          style={{
            ...toggleStyles.thumb,
            transform: checked ? 'translateX(14px)' : 'translateX(0)',
          }}
        />
      </div>
    </div>
  );
}

const toggleStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
  },
  label: {
    color: T.textTertiary,
    fontSize: '11px',
    fontFamily: T.fontSans,
  },
  track: {
    width: '30px',
    height: '16px',
    borderRadius: '8px',
    padding: '2px',
    transition: 'background 0.2s',
    flexShrink: 0,
  },
  thumb: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: 'white',
    transition: 'transform 0.2s',
  },
};

// ─── ChatBubble sub-component ──────────────────────────

function ChatBubble({ message }: { message: ChatMessage }) {
  const roleStyles: Record<string, React.CSSProperties> = {
    player: { color: T.accent, fontWeight: 500 },
    narrator: { color: T.narration, fontStyle: 'italic' },
    character: { color: T.gold },
    system: { color: T.textMuted, fontSize: '11px' },
  };

  const roleLabels: Record<string, string> = {
    player: '你',
    narrator: '',
    character: '',
    system: '',
  };

  const label = roleLabels[message.role];

  return (
    <div style={styles.bubble}>
      {label && <span style={roleStyles[message.role]}>{label}：</span>}
      <span style={roleStyles[message.role] || {}}>
        {message.content}
      </span>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    background: T.bg,
    borderTop: `1px solid ${T.border}`,
    padding: '0',
  },
  chatHistory: {
    maxHeight: '120px',
    overflowY: 'auto',
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  bubble: {
    fontSize: '12px',
    lineHeight: '1.5',
    wordBreak: 'break-word' as const,
  },
  inputRow: {
    display: 'flex',
    gap: '6px',
    padding: '8px 12px',
  },
  input: {
    flex: 1,
    padding: '8px 14px',
    background: T.bgSurface,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: T.border,
    borderRadius: T.radiusLg,
    color: T.textPrimary,
    fontSize: '13px',
    outline: 'none',
    fontFamily: T.fontSans,
  },
  sendBtn: {
    padding: '8px 16px',
    background: T.accent,
    borderWidth: '0',
    borderStyle: 'none',
    borderRadius: T.radius,
    color: 'white',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: T.fontSans,
    whiteSpace: 'nowrap' as const,
  },
  controlsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 12px 8px',
    gap: '8px',
  },
  modeGroup: {
    display: 'flex',
    gap: '4px',
  },
  modeBtn: {
    padding: '3px 10px',
    background: T.bgSurface,
    border: 'none',
    borderRadius: T.radius,
    color: T.textPrimary,
    fontSize: '11px',
    cursor: 'pointer',
    fontFamily: T.fontSans,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  modeBtnActive: {
    background: T.bgActive,
  },
  modeBtnIntervention: {
    background: T.bgActive,
  },
};
