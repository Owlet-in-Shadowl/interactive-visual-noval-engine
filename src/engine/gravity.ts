/**
 * Gravity Scorer — 引力评分系统
 *
 * 在分歧点（DivergencePoint）期间，对玩家/AI 生成的文本进行关键词匹配，
 * 累积各分支的引力分数，最终收束到得分最高的分支。
 *
 * 设计参照 Ink/ChoiceScript 的变量累积模型：
 * 传统引擎是 `trust += 1`，这里是关键词命中 → 分支加分。
 */

import type { BranchOption } from '../storage/storage-interface';

export interface GravityScore {
  chapterId: string;
  label: string;
  score: number;
  matchedKeywords: string[];
}

/**
 * 对一段文本评分：检测各分支关键词的命中情况。
 * 每命中一个关键词 +1 分，乘以分支 weight。
 */
export function scoreText(text: string, branches: BranchOption[]): GravityScore[] {
  const lowerText = text.toLowerCase();

  return branches.map((branch) => {
    const matchedKeywords: string[] = [];

    for (const kw of branch.gravityKeywords) {
      if (lowerText.includes(kw.toLowerCase())) {
        matchedKeywords.push(kw);
      }
    }

    return {
      chapterId: branch.targetChapterId,
      label: branch.label,
      score: matchedKeywords.length * branch.weight,
      matchedKeywords,
    };
  });
}

/**
 * 将单次评分累加到总分表。
 */
export function accumulateScores(
  accumulated: Map<string, number>,
  scores: GravityScore[],
): void {
  for (const s of scores) {
    accumulated.set(s.chapterId, (accumulated.get(s.chapterId) ?? 0) + s.score);
  }
}

/**
 * 根据累计分数选出目标分支。
 * - 取最高分分支（score > 0）
 * - 如果所有分支分数都为 0，返回 defaultBranch
 */
export function resolveGravity(
  accumulated: Map<string, number>,
  branches: BranchOption[],
  defaultBranch: string,
): { chapterId: string; decisive: boolean } {
  let bestId = defaultBranch;
  let bestScore = 0;
  let secondScore = 0;

  for (const branch of branches) {
    const score = accumulated.get(branch.targetChapterId) ?? 0;
    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      bestId = branch.targetChapterId;
    } else if (score > secondScore) {
      secondScore = score;
    }
  }

  // decisive = 最高分远超第二名（至少 2 倍差距且 > 0）
  const decisive = bestScore > 0 && bestScore >= secondScore * 2;

  return { chapterId: bestId, decisive };
}

/**
 * 初始化累计分数表：以各分支的 weight 为初始值。
 */
export function initScores(branches: BranchOption[]): Map<string, number> {
  const scores = new Map<string, number>();
  for (const branch of branches) {
    scores.set(branch.targetChapterId, branch.weight);
  }
  return scores;
}
