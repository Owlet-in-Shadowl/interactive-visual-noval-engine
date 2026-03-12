/**
 * PF Plugins — 投影计算插件体系
 *
 * 每个插件定义两个能力：
 *   isVisibleTo: 该角色能否感知到此 frame？
 *   projectMemory: 给定 PF + 角色 → 记忆投影
 *
 * builtin 插件：零标注覆盖 90% 场景。
 *   - ratified/overhearers → 完整内容, knownPeers 不含 eavesdroppers
 *   - eavesdroppers → 完整内容, knownPeers 不含其他 eavesdroppers
 */

import type { ParticipationFrame, ParticipationRole, PFMemoryProjection } from './schema';

// ─── 插件接口 ────────────────────────────────────────────

export interface PFPlugin {
  name: string;
  /** 该角色能否感知此 frame？ */
  isVisibleTo(frame: ParticipationFrame, characterId: string): boolean;
  /** 计算该角色的记忆投影 */
  projectMemory(
    frame: ParticipationFrame,
    characterId: string,
    role: ParticipationRole,
  ): PFMemoryProjection;
}

// ─── 辅助：获取角色在 PF 中的参与身份 ────────────────────

export function getRole(
  frame: ParticipationFrame,
  characterId: string,
): ParticipationRole | null {
  if (frame.speaker === characterId) return 'speaker';
  if (frame.addressee === characterId) return 'addressee';
  if (frame.ratified.includes(characterId)) return 'unaddressed';
  if (frame.overhearers?.includes(characterId)) return 'overhearer';
  if (frame.eavesdroppers?.includes(characterId)) return 'eavesdropper';
  return null;
}

// ─── 辅助：构建 filteredContent 文本 ─────────────────────

function buildContentText(frame: ParticipationFrame): string {
  const parts: string[] = [];
  if (frame.content.stage) {
    parts.push(frame.content.stage);
  }
  if (frame.speaker && frame.content.type === 'line') {
    parts.push(`${frame.speaker}："${frame.content.text}"`);
  } else {
    parts.push(frame.content.text);
  }
  return parts.join(' ');
}

// ─── 辅助：构建 involvedCharacters ───────────────────────

function buildInvolved(frame: ParticipationFrame): string[] {
  const involved: string[] = [];
  if (frame.speaker) involved.push(frame.speaker);
  if (frame.addressee) involved.push(frame.addressee);
  return involved;
}

// ─── builtin 插件 ────────────────────────────────────────

export const builtinPlugin: PFPlugin = {
  name: 'builtin',

  isVisibleTo(frame, characterId) {
    return getRole(frame, characterId) !== null;
  },

  projectMemory(frame, characterId, role) {
    // knownPeers = ratified ∪ overhearers（不含 eavesdroppers）
    // 但如果自己是 eavesdropper，也不含其他 eavesdroppers
    const basePeers = [
      ...frame.ratified,
      ...(frame.overhearers ?? []),
    ];

    // 所有角色的 knownPeers 都不含 eavesdroppers
    // eavesdropper 自己也只知道 ratified + overhearers，不知道其他 eavesdroppers
    const knownPeers = basePeers.filter((id) => id !== characterId);

    return {
      pfId: frame.id,
      characterId,
      participationRole: role,
      filteredContent: buildContentText(frame),
      knownPeers,
      involvedCharacters: buildInvolved(frame),
    };
  },
};

// ─── 插件注册表 ──────────────────────────────────────────

const pluginRegistry = new Map<string, PFPlugin>();
pluginRegistry.set('builtin', builtinPlugin);

export function registerPlugin(plugin: PFPlugin): void {
  pluginRegistry.set(plugin.name, plugin);
}

export function getPlugin(name: string): PFPlugin | undefined {
  return pluginRegistry.get(name);
}

/**
 * 解析 frame 应使用的插件。
 * 如果 perceptionMods 中有插件 key，优先使用对应插件；否则用 builtin。
 */
export function resolvePlugin(frame: ParticipationFrame): PFPlugin {
  if (frame.perceptionMods) {
    for (const key of Object.keys(frame.perceptionMods)) {
      const plugin = pluginRegistry.get(key);
      if (plugin) return plugin;
    }
  }
  return builtinPlugin;
}
