/**
 * Seed data — wraps existing static JSON assets into a ScriptBundle
 * for the built-in default script.
 */

import type { ScriptBundle, ChapterData } from './storage-interface';
import type { CharacterState, GOAPAction, WorldEvent } from '../memory/schemas';

// Static imports (same data that was previously hardcoded in App.tsx)
import liyaData from '../data/characters/liya.json';
import guardCaptainData from '../data/characters/guard-captain.json';
import chapter1Data from '../data/world-events/chapter1.json';
import goapActionsData from '../data/goap-actions.json';

export const BUILTIN_SCRIPT_ID = 'builtin-chapter1';

// ─── 章节拆分 ─────────────────────────────────────────
// 原始 chapter1.json 有 5 个事件，拆为：
//   ch1 (风起): market-open, stranger-arrives, guard-patrol
//   ch2 (火起): library-fire → 分歧点
//   ch3a (灰烬之下): 调查线
//   ch3b (夜行): 保护线

const allEvents = chapter1Data.events as WorldEvent[];
const allLocations = chapter1Data.locations;

const ch1Events = allEvents.filter((e) =>
  ['market-open', 'stranger-arrives', 'guard-patrol'].includes(e.id),
);
const ch2Events = allEvents.filter((e) => e.id === 'library-fire');

// 分支章节事件（AI 模式，无帧）
const ch3aEvents: WorldEvent[] = [
  {
    id: 'investigate-ruins',
    time: 900,
    name: '废墟调查',
    description: '图书馆的火已被扑灭，残垣断壁中弥漫着焦糊气味。莉娅独自返回废墟，在坍塌的书架下发现了一道通往地下室的暗门——被人刻意用石砖封堵过，火灾反而烧穿了伪装。',
    location: 'library',
    affectedCharacters: ['liya'],
    severity: 'critical',
  },
  {
    id: 'hidden-passage',
    time: 960,
    name: '密道与家族秘档',
    description: '暗门后是一条狭窄的石阶密道，墙壁上刻着艾文斯家族的徽记。密道尽头是一间密室，架上摆满了被蜡封保存的古老文献——这些是当年家族覆灭时被人秘密转移到此处的。莉娅颤抖着翻开第一页。',
    location: 'library',
    affectedCharacters: ['liya'],
    severity: 'critical',
  },
];

const ch3bEvents: WorldEvent[] = [
  {
    id: 'escort-herman',
    time: 900,
    name: '宵禁突围',
    description: '莉娅搀扶着年迈的赫尔曼穿过宵禁后寂静的街道。远处传来卫兵巡逻的脚步声和火把的光芒，她必须带导师避开所有巡逻路线，从城镇北门悄悄离开。',
    location: 'town-square',
    affectedCharacters: ['liya'],
    severity: 'major',
  },
  {
    id: 'forest-ambush',
    time: 960,
    name: '林中伏击',
    description: '刚踏入城外的松林，树影中突然闪出几道黑影。有人早已在此设伏——显然，图书馆的火只是诱饵，他们真正的目标是赫尔曼。老学者紧握莉娅的手，低声说出了一个莉娅从未听过的名字。',
    location: 'town-gate',
    affectedCharacters: ['liya'],
    severity: 'critical',
  },
];

const builtinChapters: ChapterData[] = [
  {
    id: 'builtin-ch1',
    chapter: '第一章：风起',
    events: ch1Events,
    locations: allLocations,
    next: 'builtin-ch2',
  },
  {
    id: 'builtin-ch2',
    chapter: '第二章：火起',
    events: ch2Events,
    locations: allLocations,
    next: {
      branches: [
        {
          targetChapterId: 'builtin-ch3a',
          label: '调查真相',
          gravityDescription: '莉娅决定留下调查图书馆失火的真相，追查纵火者的线索',
          gravityKeywords: ['调查', '线索', '真相', '纵火', '图书馆', '废墟', '证据'],
          weight: 1.0,
        },
        {
          targetChapterId: 'builtin-ch3b',
          label: '保护导师',
          gravityDescription: '莉娅选择护送赫尔曼离开危险的小镇，保护导师的安全',
          gravityKeywords: ['保护', '赫尔曼', '离开', '安全', '导师', '逃走', '护送'],
          weight: 1.0,
        },
      ],
      maxFreeActions: 0,
      defaultBranch: 'builtin-ch3a',
    },
  },
  {
    id: 'builtin-ch3a',
    chapter: '第三章：灰烬之下',
    events: ch3aEvents,
    locations: allLocations,
  },
  {
    id: 'builtin-ch3b',
    chapter: '第三章：夜行',
    events: ch3bEvents,
    locations: allLocations,
  },
];

export function createBuiltinScript(): ScriptBundle {
  return {
    metadata: {
      id: BUILTIN_SCRIPT_ID,
      name: '风起（内置示例）',
      description: '莉娅·艾文斯 — 没落贵族的末裔，在边境小镇追寻家族覆灭的真相',
      author: '内置剧本',
      createdAt: 0,
      updatedAt: 0,
      version: 1,
      source: 'builtin',
    },
    characters: [
      liyaData as CharacterState,
      guardCaptainData as CharacterState,
    ],
    chapters: builtinChapters,
    goapActions: goapActionsData as unknown as GOAPAction[],
  };
}
