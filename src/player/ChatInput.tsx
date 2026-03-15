/**
 * ChatInput — 游戏底栏输入组件
 *
 * 新交互模型：
 * - AUTO 按钮：开启/关闭自动推进
 * - 输入框：玩家输入触发角色内心思考（「俺寻思」）
 * - 发送按钮：提交思考请求
 */

import { useState, useCallback } from 'react';
import { usePlayerStore } from './player-store';
import { Play, Pause, Send, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isRunning: boolean;
}

export function ChatInput({ onSendMessage, isRunning }: ChatInputProps) {
  const [inputValue, setInputValue] = useState('');

  const autoAdvance = usePlayerStore((s) => s.autoAdvance);
  const thinking = usePlayerStore((s) => s.thinking);
  const povSpeaking = usePlayerStore((s) => s.povSpeaking);
  const toggleAutoAdvance = usePlayerStore((s) => s.toggleAutoAdvance);

  // Can think only when running, not already thinking, and POV character is active
  const canThink = isRunning && !thinking && povSpeaking;

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || !canThink) return;
    onSendMessage(trimmed);
    setInputValue('');
  }, [inputValue, onSendMessage, canThink]);

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
    <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-background">
      {/* AUTO toggle */}
      <button
        onClick={toggleAutoAdvance}
        disabled={!isRunning}
        className={`
          flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium
          transition-colors shrink-0
          ${autoAdvance
            ? 'bg-primary/20 text-primary border border-primary/30'
            : 'bg-muted text-muted-foreground border border-transparent hover:bg-muted/80'
          }
          ${!isRunning ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        {autoAdvance
          ? <><Pause size={12} strokeWidth={2} /> AUTO</>
          : <><Play size={12} strokeWidth={2} /> AUTO</>
        }
      </button>

      {/* Input field */}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          thinking
            ? '思考中…'
            : !isRunning
              ? '等待游戏开始…'
              : !povSpeaking
                ? '等待角色发言…'
                : '想确认什么？可以在这里思考…'
        }
        disabled={!canThink}
        className={`
          flex-1 px-3 py-1.5 rounded-md text-sm
          bg-muted border border-border
          text-foreground placeholder:text-muted-foreground
          outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20
          transition-colors
          ${!canThink ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      />

      {/* Send / Loading button */}
      <button
        onClick={handleSubmit}
        disabled={!canThink || !inputValue.trim()}
        className={`
          flex items-center justify-center w-8 h-8 rounded-md shrink-0
          transition-colors
          ${thinking
            ? 'bg-muted text-muted-foreground cursor-not-allowed'
            : canThink && inputValue.trim()
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer'
              : 'bg-muted text-muted-foreground/40 cursor-not-allowed'
          }
        `}
      >
        {thinking
          ? <Loader2 size={14} className="animate-spin" />
          : <Send size={14} />
        }
      </button>
    </div>
  );
}
