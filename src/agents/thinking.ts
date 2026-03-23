/**
 * Thinking Agent — 角色内心思考（「俺寻思」）
 *
 * 玩家在预置剧本播放中输入问题，本 Agent 以 POV 角色的内心声音回应。
 * 基于角色记忆库检索相关记忆，生成角色视角的内心独白。
 * 如果记忆中没有相关信息，角色会诚实地表达"不知道/记不清"。
 */

import { generateText } from 'ai';
import { z } from 'zod';
import { getChatModel } from './deepseek';
import { extractJSON } from './utils';
import { SceneOutputSchema } from '../memory/schemas';
import type { CorePersona, EpisodicMemory, SceneOutput } from '../memory/schemas';

export interface ThinkingInput {
  characterPersona: CorePersona;
  playerQuestion: string;
  recalledMemories: EpisodicMemory[];
  recentScenesSummary: string;
}

export interface ThinkingResult {
  scenes: SceneOutput[];
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

const ThinkingScenesSchema = z.object({
  scenes: z.array(SceneOutputSchema),
});

/**
 * 以角色内心声音回应玩家的思考/疑问。
 */
export async function runThinking(input: ThinkingInput): Promise<ThinkingResult> {
  const startTime = Date.now();

  const memoriesContext = input.recalledMemories.length > 0
    ? input.recalledMemories
        .map((m, i) => `  ${i + 1}. [${m.type}] ${m.content}`)
        .join('\n')
    : '（没有找到相关记忆）';

  const system = `你是"${input.characterPersona.name}"的内心声音。玩家正在以这个角色的视角阅读故事，现在想确认或回忆一些事情。

角色信息：
- 名字：${input.characterPersona.name}
- 性格：${input.characterPersona.personality.map((p) => `${p.trait}(${p.intensity})`).join('、')}
- 说话风格：${input.characterPersona.speechStyle}
- 背景：${input.characterPersona.background}${input.characterPersona.dialogueExamples?.length ? '\n\n内心独白风格参考（注意：这些是对话示例，内心独白应更私密、更真实）：\n' + input.characterPersona.dialogueExamples.map((ex) => `  「${ex}」`).join('\n') : ''}

当前场景摘要：
${input.recentScenesSummary || '（无）'}

角色记忆中与问题相关的内容：
${memoriesContext}

规则：
1. 以角色的第一人称内心独白形式回应，不是对话，是内心的思考
2. 语气和措辞要符合角色性格
3. 只能基于上面列出的记忆内容回答。如果记忆中没有相关信息，角色应该表达困惑或"想不起来"
4. 绝对不能编造角色不知道的信息
5. 回应要简洁，1-2段即可`;

  const { text, usage } = await generateText({
    model: getChatModel(),
    system,
    prompt: `玩家想要思考的问题："${input.playerQuestion}"

请以角色内心独白的形式回应。严格输出以下JSON格式（不要添加任何其他内容）：
{
  "scenes": [
    {
      "speaker": "${input.characterPersona.id}",
      "dialogue": "内心独白文本",
      "type": "thought",
      "emotion": "neutral/happy/sad/angry/surprised/fearful/determined/suspicious"
    }
  ]
}

要求：
1. 输出1-2个scene，每个都是 type="thought" 的内心独白
2. speaker 始终为 "${input.characterPersona.id}"
3. 不要包含 narration 字段
4. 用中文创作，仅输出JSON`,
  });

  const durationMs = Date.now() - startTime;

  const rawJson = extractJSON(text);
  const parsed = JSON.parse(rawJson);
  const result = ThinkingScenesSchema.parse(parsed);

  // 确保所有 scene 都标记为 thought 类型
  const scenes: SceneOutput[] = result.scenes.map((s) => ({
    ...s,
    type: 'thought' as const,
    speaker: input.characterPersona.id,
  }));

  return {
    scenes,
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    durationMs,
  };
}
