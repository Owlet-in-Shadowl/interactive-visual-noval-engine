/**
 * Branch Describer Agent — LLM 动态生成分歧选项描述
 *
 * 在分歧点触发时，根据当前剧情上下文为每个分支生成
 * 一句有画面感的描述，替代静态的 label 文本。
 */

import { generateText } from 'ai';
import { z } from 'zod';
import { getChatModel } from './deepseek';
import { extractJSON } from './utils';

export interface BranchDescribeInput {
  branches: { label: string; gravityDescription: string }[];
  recentScenesSummary: string;
  characterName: string;
}

const BranchDescriptionsSchema = z.object({
  descriptions: z.array(z.string()),
});

/**
 * 为分歧点的每个分支生成情境化描述。
 * 返回与 branches 一一对应的描述字符串数组。
 */
export async function runBranchDescriber(
  input: BranchDescribeInput,
): Promise<string[]> {
  const branchList = input.branches
    .map((b, i) => `  ${i + 1}. 选项名称："${b.label}"，含义：${b.gravityDescription}`)
    .join('\n');

  const system = `你是一个互动小说的叙事引擎。当前视角角色是"${input.characterName}"。

故事刚刚发展到一个关键的分歧点，玩家需要做出选择。你的任务是为每个选项生成一句简短的、有画面感的情境描述，帮助玩家理解每个选择意味着什么。

最近的剧情：
${input.recentScenesSummary || '（无）'}

要求：
1. 每个描述 15-30 个中文字
2. 用第三人称描述角色的动作或心理
3. 要有画面感和情感张力
4. 暗示选择可能带来的后果，但不剧透
5. 语言风格与故事氛围一致`;

  const { text } = await generateText({
    model: getChatModel(),
    system,
    prompt: `当前有 ${input.branches.length} 个分支选项：
${branchList}

请为每个选项生成一句描述。严格输出以下JSON格式（不要添加任何其他内容）：
{
  "descriptions": ["选项1的描述", "选项2的描述"]
}

仅输出JSON。`,
  });

  const rawJson = extractJSON(text);
  const parsed = JSON.parse(rawJson);
  const result = BranchDescriptionsSchema.parse(parsed);

  // 确保数量匹配，不够则用 gravityDescription 补齐
  const descriptions = input.branches.map(
    (b, i) => result.descriptions[i] || b.gravityDescription,
  );

  return descriptions;
}
