/**
 * Participation Framework Schema
 *
 * PF 是叙事内容的唯一信源。渲染（SceneOutput[]）和记忆（EpisodicMemory）
 * 都是 PF 经过投影计算后的派生结果。
 *
 * 基于 Goffman (1981) Forms of Talk 的参与框架理论。
 * PF 描述的是「某个事件」与「参与者之间的知情关系」，
 * 事件不限于言语行为——动作、环境、心理活动均可建模。
 */

import { z } from 'zod';

// ─── Frame 内容类型 ──────────────────────────────────────

export const FrameTypeSchema = z.enum([
  'line',       // 台词：speaker 说话，addressee 接收
  'prose',      // 叙述/动作/环境描写：speaker = null（全知叙述者）
  'thought',    // 心理独白：speaker = 思考者，仅 ratified 给自己
  'intertext',  // 互文段落：超叙事层（如弗洛伊德↔莎乐美的学术对话）
]);

// ─── Frame 内容（信源） ──────────────────────────────────

export const FrameContentSchema = z.object({
  text: z.string().describe('原文正文（唯一文本字段，一字不改）'),
  type: FrameTypeSchema.describe('内容类型，决定渲染方式'),
  stage: z.string().optional().describe('舞台指示（简短场景标签，非正文）'),
  emotion: z.string().optional().describe('情绪标签'),
});

// ─── 参与角色 ────────────────────────────────────────────

export const ParticipationRoleSchema = z.enum([
  'speaker',       // 发话者 / 行为主体
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
  speaker: z.string().nullable().describe('事件行为主体：台词=说话者, 动作=执行者, 心理=思考者, 叙述=null'),
  addressee: z.string().optional().describe('受话者角色 ID'),
  content: FrameContentSchema,

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

export type FrameType = z.infer<typeof FrameTypeSchema>;
export type FrameContent = z.infer<typeof FrameContentSchema>;
export type ParticipationRole = z.infer<typeof ParticipationRoleSchema>;
export type ParticipationFrame = z.infer<typeof ParticipationFrameSchema>;
export type PFMemoryProjection = z.infer<typeof PFMemoryProjectionSchema>;

// ─── Backwards compat aliases ────────────────────────────
/** @deprecated use FrameContentSchema */
export const PFContentSchema = FrameContentSchema;
/** @deprecated use FrameContent */
export type PFContent = FrameContent;
