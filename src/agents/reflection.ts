/**
 * Reflection Agent - Analyzes recent memories to detect personality evolution.
 * Triggered conditionally after significant events or memory accumulation.
 * Outputs PersonaShift patches that modify character behavior over time.
 */

import { z } from 'zod';
import { generateText } from 'ai';
import { getChatModel } from './deepseek';
import { extractJSON } from './utils';
import type { CorePersona, EpisodicMemory, PersonaShift, Goal5W1H } from '../memory/schemas';

const ReflectionOutputSchema = z.object({
  hasShift: z.boolean().describe('是否检测到人格变化'),
  trigger: z.string().describe('触发人格变化的关键事件或经历'),
  description: z.string().describe('人格变化的具体描述'),
});

export interface ReflectionInput {
  persona: CorePersona;
  recentMemories: EpisodicMemory[];
  existingShifts: PersonaShift[];
  currentGoals: Goal5W1H[];
}

export interface ReflectionResult {
  shift: PersonaShift | null;
  rawResponse: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

export async function runReflection(input: ReflectionInput): Promise<ReflectionResult> {
  const startTime = Date.now();

  const memorySummary = input.recentMemories
    .map((m) => `- [${m.type}] ${m.content}`)
    .join('\n');

  const shiftsSummary = input.existingShifts.length > 0
    ? input.existingShifts.map((s) => `- [${s.trigger}] ${s.description}`).join('\n')
    : '（暂无人格变化记录）';

  const goalsSummary = input.currentGoals
    .map((g) => `- ${g.what}（原因：${g.why}）`)
    .join('\n');

  const system = `你是一个角色心理分析系统。你的任务是分析角色"${input.persona.name}"的近期经历，判断这些经历是否导致了人格上的微妙变化。

## 角色基础人格
- 背景：${input.persona.background}
- 性格：${input.persona.personality.map((p) => `${p.trait}（${p.intensity}）`).join('、')}
- 价值观：${input.persona.values.join('、')}
- 说话风格：${input.persona.speechStyle}

## 已有的人格变化记录
${shiftsSummary}

## 当前目标
${goalsSummary}

## 近期经历（记忆）
${memorySummary}

分析要求：
1. 仔细审视近期经历中的重大事件、冲突、情感冲击
2. 判断这些经历是否足以引发人格层面的微妙变化（不是行为变化，而是性格/价值观/态度的深层转变）
3. 人格变化应该是渐进的、合理的，不应剧烈突变
4. 如果近期经历平淡无奇，则不应产生人格变化（hasShift: false）
5. 避免重复已有的人格变化记录`;

  const { text, usage } = await generateText({
    model: getChatModel(),
    system,
    prompt: `基于以上角色信息和近期经历，分析是否产生了新的人格变化。

你必须严格输出以下JSON格式（不要添加任何其他内容）：
{
  "hasShift": true或false,
  "trigger": "触发变化的关键事件（如果hasShift为false，写'无显著变化'）",
  "description": "人格变化的具体描述（如果hasShift为false，写'近期经历未引发人格层面的变化'）"
}

请用中文回答，仅输出JSON。`,
  });

  const durationMs = Date.now() - startTime;

  const rawJson = extractJSON(text);
  const parsed = JSON.parse(rawJson);
  const output = ReflectionOutputSchema.parse(parsed);

  let shift: PersonaShift | null = null;
  if (output.hasShift) {
    shift = {
      id: `shift-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      trigger: output.trigger,
      description: output.description,
      createdAt: Date.now(),
    };
  }

  return {
    shift,
    rawResponse: text,
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    durationMs,
  };
}
