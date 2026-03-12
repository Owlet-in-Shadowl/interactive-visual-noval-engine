/**
 * Participation Framework — 统一导出
 *
 * PF 是叙事内容的唯一信源。
 * 渲染（SceneOutput[]）和记忆（EpisodicMemory）都是 PF 的投影。
 */

// Schema & Types
export {
  PFContentSchema,
  ParticipationRoleSchema,
  ParticipationFrameSchema,
  PFMemoryProjectionSchema,
} from './schema';

export type {
  PFContent,
  ParticipationRole,
  ParticipationFrame,
  PFMemoryProjection,
} from './schema';

// Engine (projection functions)
export {
  framesToScenes,
  projectMemory,
  projectAllMemories,
  deriveVisibleTo,
  getRole,
} from './engine';

// Plugins
export { builtinPlugin, registerPlugin, getPlugin, resolvePlugin } from './plugins';
export type { PFPlugin } from './plugins';
