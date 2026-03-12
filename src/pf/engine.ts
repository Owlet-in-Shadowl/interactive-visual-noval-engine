/**
 * PF Engine — 投影计算引擎
 *
 * 两条投影路径，都从 ParticipationFrame[] 出发：
 *   1. 渲染投影: framesToScenes(frames, povId) → SceneOutput[]
 *   2. 记忆投影: projectAllMemories(frames, characterId) → PFMemoryProjection[]
 */

import type { SceneOutput } from '../memory/schemas';
import type { ParticipationFrame, PFMemoryProjection, ParticipationRole } from './schema';
import { getRole, resolvePlugin } from './plugins';

// ─── 渲染投影 ────────────────────────────────────────────

/**
 * 给定 frames + POV 角色 → 该角色能看到的 SceneOutput[]
 * 只包含 isVisibleTo(frame, povId) === true 的 frame
 */
export function framesToScenes(
  frames: ParticipationFrame[],
  povId: string,
): SceneOutput[] {
  return frames
    .filter((f) => {
      const plugin = resolvePlugin(f);
      return plugin.isVisibleTo(f, povId);
    })
    .map((f) => ({
      speaker: f.speaker,
      dialogue: f.content.text,
      narration: f.content.stage,
      emotion: f.content.emotion,
    }));
}

// ─── 记忆投影 ────────────────────────────────────────────

/**
 * 给定 frame + 角色 → 该角色的记忆投影（或 null 如果不可见）
 */
export function projectMemory(
  frame: ParticipationFrame,
  characterId: string,
): PFMemoryProjection | null {
  const role = getRole(frame, characterId);
  if (!role) return null;

  const plugin = resolvePlugin(frame);
  return plugin.projectMemory(frame, characterId, role);
}

/**
 * 给定 frames + 角色 → 该角色的所有记忆投影
 */
export function projectAllMemories(
  frames: ParticipationFrame[],
  characterId: string,
): PFMemoryProjection[] {
  const projections: PFMemoryProjection[] = [];
  for (const frame of frames) {
    const proj = projectMemory(frame, characterId);
    if (proj) projections.push(proj);
  }
  return projections;
}

// ─── 辅助函数 ────────────────────────────────────────────

/**
 * 从 frames 推导 visibleTo（AD-10：不单独存储，由 PF 推导）
 */
export function deriveVisibleTo(frames: ParticipationFrame[]): string[] {
  const allIds = new Set<string>();
  for (const frame of frames) {
    for (const id of frame.ratified) allIds.add(id);
    if (frame.overhearers) {
      for (const id of frame.overhearers) allIds.add(id);
    }
    if (frame.eavesdroppers) {
      for (const id of frame.eavesdroppers) allIds.add(id);
    }
  }
  return [...allIds];
}

// Re-export getRole for convenience
export { getRole } from './plugins';
export type { ParticipationRole };
