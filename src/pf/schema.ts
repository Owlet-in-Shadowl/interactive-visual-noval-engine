/**
 * Participation Framework Schema
 *
 * PF 是叙事内容的唯一信源。渲染（SceneOutput[]）和记忆（EpisodicMemory）
 * 都是 PF 经过投影计算后的派生结果。
 *
 * 基于 Goffman (1981) Forms of Talk 的参与框架理论。
 */

import { z } from 'zod';

// ─── PF 内容（信源） ─────────────────────────────────────

export const PFContentSchema = z.object({
  dialogue: z.string().describe('台词或旁白文本'),
  narration: z.string().optional().describe('环境描写/动作描述'),
  emotion: z.string().optional().describe('情绪标签'),
  style: z
    .enum(['normal', 'italic', 'intertext'])
    .optional()
    .default('normal')
    .describe('文本样式：normal=默认, italic=斜体, intertext=互文段落'),
});

// ─── 参与角色 ────────────────────────────────────────────

export const ParticipationRoleSchema = z.enum([
  'speaker',       // 发话者
  'addressee',     // 受话者
  'unaddressed',   // 未被直接点名的在场参与者
  'overhearer',    // 有意旁听者（说话者知道他们在）
  'eavesdropper',  // 偷听者（说话者不知道他们在）
]);

// ─── 参与框架（信源） ────────────────────────────────────

export const ParticipationFrameSchema = z.object({
  id: z.string().describe('全局唯一 ID'),
  eventId: z.string().describe('所属事件 ID'),

  // 内容（唯一信源）
  speaker: z.string().nullable().describe('发话者角色 ID，null = 旁白'),
  addressee: z.string().optional().describe('受话者角色 ID'),
  content: PFContentSchema,

  // 参与者清单
  ratified: z.array(z.string()).describe('被认可的参与者（含 speaker + addressee）'),
  overhearers: z.array(z.string()).optional().describe('有意旁听者'),
  eavesdroppers: z.array(z.string()).optional().describe('偷听者'),

  // 投影计算参数（插件化，Record<pluginName, unknown>）
  perceptionMods: z.record(z.string(), z.unknown()).optional().describe('投影计算插件参数'),
});

// ─── 记忆投影结果 ────────────────────────────────────────

export const PFMemoryProjectionSchema = z.object({
  pfId: z.string().describe('引用回源参与框架 ID'),
  characterId: z.string().describe('这条投影属于谁'),
  participationRole: ParticipationRoleSchema.describe('该角色在 PF 中的参与身份'),
  filteredContent: z.string().describe('该角色感知到的文本（投影后）'),
  knownPeers: z.array(z.string()).describe('该角色认为还有谁也知道此事'),
  involvedCharacters: z.array(z.string()).describe('核心角色（speaker + addressee）'),
});

// ─── Type exports ────────────────────────────────────────

export type PFContent = z.infer<typeof PFContentSchema>;
export type ParticipationRole = z.infer<typeof ParticipationRoleSchema>;
export type ParticipationFrame = z.infer<typeof ParticipationFrameSchema>;
export type PFMemoryProjection = z.infer<typeof PFMemoryProjectionSchema>;
