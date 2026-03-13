import { z } from 'zod';
import { ParticipationFrameSchema, ParticipationRoleSchema } from '../../pf/schema';

// ─── 角色人格 Schema ─────────────────────────────────────

export const PersonaTraitSchema = z.object({
  trait: z.string(),
  intensity: z.number().min(0).max(1),
});

export const CorePersonaSchema = z.object({
  id: z.string(),
  name: z.string(),
  background: z.string(),
  personality: z.array(PersonaTraitSchema),
  values: z.array(z.string()),
  speechStyle: z.string(),
  appearance: z.string().optional(),
});

export const PersonaShiftSchema = z.object({
  id: z.string(),
  trigger: z.string(),
  description: z.string(),
  createdAt: z.number(),
});

// ─── 目标 Schema ─────────────────────────────────────────

export const LongTermGoalSchema = z.object({
  id: z.string(),
  description: z.string(),
  priority: z.number().min(1).max(10),
});

export const Goal5W1HSchema = z.object({
  who: z.array(z.string()).describe('本次行动涉及的角色ID列表'),
  what: z.string().describe('具体要执行的短期目标，动作导向'),
  where: z.string().describe('行动发生的地点ID'),
  when: z.string().optional().default('立即执行').describe('执行时机或前置条件'),
  why: z.string().describe('为什么这个目标有助于长期夙愿，或如何响应当前事件'),
  how: z.array(z.string()).describe('达成目标的原子步骤列表'),
});

export const ShortTermGoalSchema = z.object({
  goal: Goal5W1HSchema,
  status: z.enum(['active', 'completed', 'failed', 'interrupted']),
  createdAt: z.number(),
});

// ─── 世界事件 Schema ─────────────────────────────────────

export const WorldEventSchema = z.object({
  id: z.string(),
  time: z.number().describe('事件发生的游戏时间（分钟）'),
  name: z.string(),
  description: z.string(),
  location: z.string(),
  affectedCharacters: z.array(z.string()).optional(),
  severity: z.enum(['minor', 'major', 'critical']),
  // ─── P0：参与框架（PF 为唯一信源） ───
  frames: z.array(ParticipationFrameSchema).optional()
    .describe('参与框架序列。有 → 预置模式（渲染和记忆从 frames 投影），无 → AI 模式'),
  anchorLevel: z.enum(['fixed', 'strong', 'soft']).optional()
    .describe('锚点强度。fixed=不可改变, strong=AI须收敛, soft=可跳过'),
});

export const WorldStateSchema = z.object({
  currentTime: z.number(),
  currentLocation: z.string(),
  activeEvents: z.array(WorldEventSchema),
  availableLocations: z.array(z.string()),
  availableNPCs: z.array(z.string()),
  currentSituation: z.string(),
});

// ─── GOAP Schema ─────────────────────────────────────────

export const GOAPWorldStateSchema = z.record(z.string(), z.union([z.boolean(), z.number(), z.string()]));

export const GOAPActionSchema = z.object({
  id: z.string(),
  name: z.string(),
  preconditions: GOAPWorldStateSchema,
  effects: GOAPWorldStateSchema,
  cost: z.number(),
  timeCost: z.number().describe('执行耗时（分钟）'),
  description: z.string(),
});

// ─── 叙事输出 Schema ─────────────────────────────────────

export const SceneTypeSchema = z.enum(['dialogue', 'narration', 'thought', 'player-input']).default('dialogue')
  .describe('场景类型：dialogue=对话/旁白, narration=纯叙事, thought=内心独白, player-input=玩家输入');

export const SceneOutputSchema = z.object({
  speaker: z.string().nullable().describe('说话角色ID，null表示旁白'),
  dialogue: z.string().nullable().default('').transform((v) => v ?? '').describe('对话或旁白文本'),
  emotion: z.string().optional().describe('角色情绪标签'),
  narration: z.string().optional().describe('环境描写/动作描述'),
  bgEffect: z.string().optional().describe('背景特效指令'),
  type: SceneTypeSchema,
});

// ─── 情节记忆 Schema ─────────────────────────────────────

export const EpisodicMemorySchema = z.object({
  id: z.string(),
  characterId: z.string(),
  content: z.string(),
  timestamp: z.number(),
  importance: z.number().min(0).max(1),
  type: z.enum(['action', 'dialogue', 'observation', 'world_event', 'reflection']),
  // ─── P0：参与框架元数据（可溯源、可重算） ───
  pfId: z.string().optional().describe('引用回源参与框架 ID'),
  participationRole: ParticipationRoleSchema.optional().describe('该角色在 PF 中的参与身份'),
  knownPeers: z.array(z.string()).optional().describe('该角色认为还有谁也知道此事'),
  involvedCharacters: z.array(z.string()).optional().describe('核心角色（speaker + addressee）'),
});

// ─── 角色完整状态 Schema ─────────────────────────────────

export const CharacterStateSchema = z.object({
  core: CorePersonaSchema,
  longTermGoals: z.array(LongTermGoalSchema),
  shortTermGoals: z.array(ShortTermGoalSchema),
  personaShifts: z.array(PersonaShiftSchema),
});

// ─── Type exports ────────────────────────────────────────

export type PersonaTrait = z.infer<typeof PersonaTraitSchema>;
export type CorePersona = z.infer<typeof CorePersonaSchema>;
export type PersonaShift = z.infer<typeof PersonaShiftSchema>;
export type LongTermGoal = z.infer<typeof LongTermGoalSchema>;
export type Goal5W1H = z.infer<typeof Goal5W1HSchema>;
export type ShortTermGoal = z.infer<typeof ShortTermGoalSchema>;
export type WorldEvent = z.infer<typeof WorldEventSchema>;
export type WorldState = z.infer<typeof WorldStateSchema>;
export type GOAPWorldState = z.infer<typeof GOAPWorldStateSchema>;
export type GOAPAction = z.infer<typeof GOAPActionSchema>;
export type SceneOutput = z.infer<typeof SceneOutputSchema>;
export type EpisodicMemory = z.infer<typeof EpisodicMemorySchema>;
export type CharacterState = z.infer<typeof CharacterStateSchema>;
