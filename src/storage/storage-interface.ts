/**
 * Storage Layer Interface — abstract contract for persisting script bundles.
 * A "script" (剧本) bundles all assets needed to run a game session.
 */

import { z } from 'zod';
import {
  CharacterStateSchema,
  WorldEventSchema,
  GOAPActionSchema,
} from '../memory/schemas';

// ─── Script Metadata Schema ────────────────────────────

export const ScriptMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional().default(''),
  author: z.string().optional().default(''),
  createdAt: z.number(),
  updatedAt: z.number(),
  version: z.number().default(1),
  source: z.enum(['builtin', 'uploaded', 'generated']),
});

// ─── Chapter Data Schema ───────────────────────────────

export const LocationSchema = z.object({
  id: z.string(),
  name: z.string(),
});

// ─── Branching / Gravity Schemas ──────────────────────

export const BranchOptionSchema = z.object({
  targetChapterId: z.string().describe('目标章节 ID'),
  label: z.string().describe('编辑器可见标签，如"信任路线"'),
  gravityKeywords: z.array(z.string()).describe('关键词引力：玩家文本命中这些词时加分'),
  gravityDescription: z.string().describe('给 LLM 判定用的分支描述'),
  weight: z.number().default(1.0).describe('初始权重/编剧偏好'),
});

export const DivergencePointSchema = z.object({
  branches: z.array(BranchOptionSchema).min(2).describe('至少两个分支'),
  maxFreeActions: z.number().default(5).describe('最多自由行动次数，超过则强制收束'),
  defaultBranch: z.string().describe('超时或无法判定时的默认分支 chapter ID'),
});

export const ChapterDataSchema = z.object({
  id: z.string().optional().describe('章节唯一 ID，缺省时由 normalizeChapters 自动分配'),
  chapter: z.string(),
  events: z.array(WorldEventSchema),
  locations: z.array(LocationSchema),
  next: z.union([z.string(), DivergencePointSchema]).optional()
    .describe('后继章节：string=线性跳转，DivergencePoint=分歧点，undefined=按数组顺序'),
});

// ─── Lorebook (World Book) Schema ─────────────────────

export const LorebookEntrySchema = z.object({
  id: z.string().describe('条目唯一 ID'),
  keys: z.array(z.string()).describe('主关键词：场景文本命中任一关键词即触发'),
  secondaryKeys: z.array(z.string()).optional()
    .describe('辅助关键词：启用 selective 时，需同时命中主+辅关键词'),
  selective: z.boolean().optional().default(false)
    .describe('是否要求同时命中主关键词和辅助关键词'),
  content: z.string().describe('触发后注入 LLM 上下文的文本'),
  constant: z.boolean().optional().default(false)
    .describe('始终激活（不需要关键词触发）'),
  enabled: z.boolean().optional().default(true),
  priority: z.number().optional().default(0)
    .describe('优先级（数字越大越优先，超出 token 预算时低优先级被裁剪）'),
  position: z.enum(['before_persona', 'after_persona', 'before_scene']).optional().default('after_persona')
    .describe('注入位置'),
});

// ─── Full Script Bundle Schema ─────────────────────────

export const ScriptBundleSchema = z.object({
  metadata: ScriptMetadataSchema,
  characters: z.array(CharacterStateSchema).min(1),
  chapters: z.array(ChapterDataSchema).min(1),
  goapActions: z.array(GOAPActionSchema).min(1),
  lorebook: z.array(LorebookEntrySchema).optional().default([])
    .describe('世界书条目：关键词触发的上下文知识注入'),
});

// ─── Type Exports ──────────────────────────────────────

export type ScriptMetadata = z.infer<typeof ScriptMetadataSchema>;
export type ChapterData = z.infer<typeof ChapterDataSchema>;
export type ScriptBundle = z.infer<typeof ScriptBundleSchema>;
export type BranchOption = z.infer<typeof BranchOptionSchema>;
export type DivergencePoint = z.infer<typeof DivergencePointSchema>;
export type LorebookEntry = z.infer<typeof LorebookEntrySchema>;

// ─── Chapter Normalization ────────────────────────────

/**
 * 规格化章节数组：为缺少 id 的章节自动分配唯一 ID。
 * 纯函数，不修改原数组。
 */
export function normalizeChapters(chapters: ChapterData[]): ChapterData[] {
  const usedIds = new Set<string>();

  // First pass: collect existing IDs
  for (const ch of chapters) {
    if (ch.id) usedIds.add(ch.id);
  }

  // Second pass: assign missing IDs
  return chapters.map((ch, i) => {
    if (ch.id) return ch;
    let candidate = `chapter-${i}`;
    while (usedIds.has(candidate)) {
      candidate = `chapter-${i}-${Math.random().toString(36).slice(2, 6)}`;
    }
    usedIds.add(candidate);
    return { ...ch, id: candidate };
  });
}

// ─── Abstract Storage Interface ────────────────────────

export interface IScriptStorage {
  /** Initialize storage (open DB, create tables, etc.) */
  init(): Promise<void>;

  /** Get all script metadata (lightweight, no full bundles) */
  listScripts(): Promise<ScriptMetadata[]>;

  /** Get a full script bundle by ID */
  getScript(id: string): Promise<ScriptBundle | null>;

  /** Save a new script or overwrite an existing one */
  saveScript(script: ScriptBundle): Promise<void>;

  /** Delete a script by ID */
  deleteScript(id: string): Promise<void>;

  /** Check if a script exists */
  hasScript(id: string): Promise<boolean>;
}
