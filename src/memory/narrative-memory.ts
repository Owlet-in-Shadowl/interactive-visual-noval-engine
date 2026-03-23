/**
 * NarrativeMemory — Director 的叙事上下文记忆
 *
 * 和 ContextEngine（角色记忆）平行的另一条记忆线：
 * - 角色记忆回答"角色知道什么"，服务 cognition agent
 * - 叙事记忆回答"读者看到了什么"，服务 director agent
 *
 * 两层结构：
 *   层1：最近 N 轮完整场景文本（滑动窗口，保证相邻段落不重复）
 *   层2：历史场景摘要（全量存储，关键词检索，保证远距离回调）
 *
 * 当层1的场景被移出窗口时，自动压缩为摘要存入层2。
 */

import type { SceneOutput } from './schemas';

/** 层2：场景摘要条目 */
export interface SceneSummary {
  id: string;
  chapter: string;
  action: string;         // 触发这段叙事的行动名
  summary: string;        // 1-2句话的摘要
  characters: string[];   // 出场角色 ID
  keywords: string[];     // 用于检索的关键词
  timestamp: number;
}

/** Director 接收的叙事上下文 */
export interface NarrativeContext {
  /** 最近几轮的完整场景文本（层1窗口） */
  recentScenesText: string;
  /** 从层2检索到的相关历史摘要 */
  recalledSummaries: SceneSummary[];
}

/** 配置 */
interface NarrativeMemoryConfig {
  /** 层1窗口大小（保留最近多少轮的 SceneOutput） */
  windowSize: number;
  /** 层2检索返回的最大条目数 */
  recallTopK: number;
}

const DEFAULT_CONFIG: NarrativeMemoryConfig = {
  windowSize: 3,   // 最近 3 轮 Director 输出
  recallTopK: 5,   // 检索最多 5 条历史摘要
};

/**
 * 从场景文本中提取关键词（简单实现：提取角色名 + 地点 + 重要名词）
 */
function extractKeywords(scenes: SceneOutput[]): string[] {
  const keywords = new Set<string>();
  for (const scene of scenes) {
    if (scene.speaker) keywords.add(scene.speaker);
    // 从对话和旁白中提取中文词（简单的 2-4 字词提取）
    const text = [scene.dialogue, scene.narration].filter(Boolean).join(' ');
    // 提取引号内的内容（通常是重要名词）
    const quoted = text.match(/[「『"](.*?)[」』"]/g);
    if (quoted) {
      for (const q of quoted) {
        const inner = q.slice(1, -1).trim();
        if (inner.length >= 2 && inner.length <= 10) keywords.add(inner);
      }
    }
  }
  return [...keywords];
}

/**
 * 将 SceneOutput[] 格式化为可读的叙事文本
 */
function scenesToText(scenes: SceneOutput[]): string {
  return scenes
    .map((s) => {
      const parts: string[] = [];
      if (s.narration) parts.push(s.narration);
      if (s.speaker && s.dialogue) {
        parts.push(`${s.speaker}：${s.dialogue}`);
      } else if (s.dialogue) {
        parts.push(s.dialogue);
      }
      return parts.join('\n');
    })
    .join('\n\n');
}

/**
 * 将一轮 Director 输出压缩为摘要（纯本地，不调 LLM）
 * 取每个场景的前 30 字 + 出场角色
 */
function compressToSummary(
  scenes: SceneOutput[],
  chapter: string,
  action: string,
): SceneSummary {
  const summaryParts = scenes.map((s) => {
    const text = s.dialogue || s.narration || '';
    const prefix = s.speaker ? `${s.speaker}：` : '';
    return prefix + (text.length > 30 ? text.slice(0, 30) + '…' : text);
  });

  return {
    id: `ns-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    chapter,
    action,
    summary: summaryParts.join('；'),
    characters: [...new Set(scenes.map((s) => s.speaker).filter(Boolean) as string[])],
    keywords: extractKeywords(scenes),
    timestamp: Date.now(),
  };
}

export class NarrativeMemory {
  private config: NarrativeMemoryConfig;

  /** 层1：最近 N 轮的完整 SceneOutput（滑动窗口） */
  private window: { scenes: SceneOutput[]; action: string; chapter: string }[] = [];

  /** 层2：所有历史场景摘要 */
  private summaries: SceneSummary[] = [];

  /** 当前章节名 */
  private currentChapter: string = '';

  constructor(config?: Partial<NarrativeMemoryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setChapter(chapter: string) {
    this.currentChapter = chapter;
  }

  /**
   * Director 输出后调用：将本轮场景写入层1窗口
   * 如果窗口溢出，最旧的一轮压缩为摘要移入层2
   * Deduplication: skips if the last window entry has the same action + similar text
   */
  ingest(scenes: SceneOutput[], action: string) {
    // Dedup: check if last window entry is essentially the same content
    if (this.window.length > 0) {
      const last = this.window[this.window.length - 1];
      if (last.action === action && last.chapter === this.currentChapter) {
        // Same action in same chapter — check text similarity
        const lastText = scenesToText(last.scenes).slice(0, 100);
        const newText = scenesToText(scenes).slice(0, 100);
        if (lastText === newText) {
          return; // Skip duplicate
        }
      }
    }

    this.window.push({ scenes, action, chapter: this.currentChapter });

    // 窗口溢出 → 最旧的压缩为摘要
    while (this.window.length > this.config.windowSize) {
      const oldest = this.window.shift()!;
      const summary = compressToSummary(oldest.scenes, oldest.chapter, oldest.action);
      // Dedup summaries: skip if an identical summary already exists
      const isDuplicate = this.summaries.some(
        (s) => s.action === summary.action && s.chapter === summary.chapter && s.summary === summary.summary,
      );
      if (!isDuplicate) {
        this.summaries.push(summary);
      }
    }
  }

  /**
   * Director 调用前：组装叙事上下文
   * @param query 当前行动描述（用于层2检索）
   */
  assemble(query: string): NarrativeContext {
    // 层1：最近 N 轮的完整文本
    const recentScenesText = this.window
      .map((w) => scenesToText(w.scenes))
      .join('\n---\n');

    // 层2：关键词检索历史摘要
    const recalledSummaries = this.recall(query);

    return { recentScenesText, recalledSummaries };
  }

  /**
   * 层2检索：用 query 的关键词匹配历史摘要
   */
  private recall(query: string): SceneSummary[] {
    if (this.summaries.length === 0) return [];

    const queryLower = query.toLowerCase();
    const queryChars = [...queryLower];

    // 为每条摘要打分
    const scored = this.summaries.map((s) => {
      let score = 0;
      // 关键词匹配
      for (const kw of s.keywords) {
        if (queryLower.includes(kw.toLowerCase())) {
          score += 3;
        }
      }
      // 角色名匹配
      for (const char of s.characters) {
        if (queryLower.includes(char.toLowerCase())) {
          score += 2;
        }
      }
      // 摘要文本中包含 query 的字
      const summaryLower = s.summary.toLowerCase();
      for (const ch of queryChars) {
        if (summaryLower.includes(ch)) {
          score += 0.1;
        }
      }
      return { summary: s, score };
    });

    // 按分数排序，取 topK
    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.recallTopK)
      .map((s) => s.summary);
  }

  /** 重置（新游戏时调用） */
  reset() {
    this.window = [];
    this.summaries = [];
    this.currentChapter = '';
  }

  /** 获取统计信息（用于 debug） */
  getStats() {
    return {
      windowSize: this.window.length,
      summaryCount: this.summaries.length,
      currentChapter: this.currentChapter,
    };
  }
}
