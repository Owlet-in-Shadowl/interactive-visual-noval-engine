/**
 * Seed data — wraps existing static JSON assets into a ScriptBundle
 * for the built-in default script.
 */

import type { ScriptBundle, ChapterData, LorebookEntry } from './storage-interface';
import type { CharacterState, GOAPAction, WorldEvent } from '../memory/schemas';

// Static imports (same data that was previously hardcoded in App.tsx)
import liyaData from '../data/characters/liya.json';
import guardCaptainData from '../data/characters/guard-captain.json';
import hermanData from '../data/characters/herman.json';
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

// 第四章：合流（两条分支都通向这里）
const ch4Events: WorldEvent[] = [
  {
    id: 'tavern-clue',
    time: 1020,
    name: '酒馆的线索',
    description: '莉娅来到旅人酒馆打听"克洛维斯·莫兰"这个名字。酒馆老板犹豫了一下，说此人三天前刚经过小镇，住了一晚就走了，留下了一封没有署名的信——信封上印着王城大法官的火漆。',
    location: 'tavern',
    affectedCharacters: ['liya'],
    severity: 'major',
  },
  {
    id: 'night-decision',
    time: 1080,
    name: '抉择之夜',
    description: '宵禁的钟声敲响。莉娅站在酒馆门口，手中攥着那封信。信中提到了一个日期——三天后，王城将举行一场秘密听证会，与艾文斯家族案件有关。留在小镇意味着安全但可能永远错过真相；追踪莫兰意味着踏上危险的旅途。',
    location: 'tavern',
    affectedCharacters: ['liya', 'guard-captain'],
    severity: 'critical',
  },
];

const ch3bEvents: WorldEvent[] = [
  {
    id: 'escort-herman',
    time: 900,
    name: '宵禁突围',
    description: '莉娅搀扶着年迈的赫尔曼穿过宵禁后寂静的街道。月光映在灰石墙面上，远处传来卫兵巡逻的脚步声和火把劈啪作响的声音。赫尔曼背着一个旧书包，里面装着他从壁炉暗格中取出的最后几本手稿。他们必须避开马库斯在城门设置的所有哨卡。赫尔曼低声告诉莉娅：北门的排水渠在夜间无人看守，那是他年轻时发现的秘密通道。',
    location: 'town-square',
    affectedCharacters: ['liya', 'herman'],
    severity: 'major',
  },
  {
    id: 'forest-ambush',
    time: 960,
    name: '林中伏击',
    description: '刚踏入城外的松林，树影中突然闪出几道黑影。三个穿黑衣的人堵住了去路，他们不是卫兵——没有盔甲，没有火把，但每人腰间都挂着匕首。领头的人用沙哑的声音说："老先生，您的那些文件，莫兰大人需要收回。"赫尔曼紧握莉娅的手，他的掌心冰凉却没有发抖。他低声说出了一个名字——"克洛维斯·莫兰。他就是当年指控你父亲的人。"',
    location: 'town-gate',
    affectedCharacters: ['liya', 'herman'],
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
    next: 'builtin-ch4',
  },
  {
    id: 'builtin-ch3b',
    chapter: '第三章：夜行',
    events: ch3bEvents,
    locations: allLocations,
    next: 'builtin-ch4',
  },
  {
    id: 'builtin-ch4',
    chapter: '第四章：追踪',
    events: ch4Events,
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
      hermanData as CharacterState,
    ],
    chapters: builtinChapters,
    goapActions: goapActionsData as unknown as GOAPAction[],
    lorebook: builtinLorebook,
  };
}

// ─── Lorebook 世界书条目 ──────────────────────────────

const builtinLorebook: LorebookEntry[] = [
  {
    id: 'lore-library',
    keys: ['图书馆', '书架', '古籍'],
    content: '小镇图书馆始建于三百年前，由第一任镇长捐赠。馆藏以边境历史文献为主。据传地下室有一间密室，入口在五十年前的翻修中被封死。图书馆管理员是赫尔曼的老友。',
    priority: 5,
    position: 'after_persona',
    enabled: true,
    constant: false,
    selective: false,
  },
  {
    id: 'lore-evans-family',
    keys: ['艾文斯', '家族', '徽记', '徽章'],
    content: '艾文斯家族曾是王国六大贵族之一，掌管边境三郡的税收和军务。十五年前因"通敌叛国"罪名被抄没，但民间普遍认为这是一场冤案。家族徽记是一只衔着月桂枝的银鹰。',
    priority: 8,
    position: 'after_persona',
    enabled: true,
    constant: false,
    selective: false,
  },
  {
    id: 'lore-herman',
    keys: ['赫尔曼', '老学者', '导师', '养父'],
    content: '赫尔曼·格雷是前王立学院的历史学教授，因拒绝在艾文斯家族案件的调查报告上签字而被解职。此后隐居边境小镇，以教书和抄写古籍为生。他收养了年幼的莉娅，从未向她透露家族覆灭的全部真相。',
    priority: 7,
    position: 'after_persona',
    enabled: true,
    constant: false,
    selective: false,
  },
  {
    id: 'lore-border-town',
    keys: ['小镇', '边境'],
    secondaryKeys: ['历史', '建筑', '街道'],
    selective: true,
    content: '灰石镇位于王国东部边境，是连接王城与蛮荒领的唯一驿道枢纽。镇上建筑以灰色石材为主，街道狭窄曲折。常住居民约八百人，大多靠边境贸易和驿站服务维生。',
    priority: 3,
    position: 'before_scene',
    enabled: true,
    constant: false,
  },
  {
    id: 'lore-clovis-moran',
    keys: ['克洛维斯', '莫兰', 'Clovis'],
    content: '克洛维斯·莫兰是王城大法官的首席顾问，十五年前主导了对艾文斯家族的调查。民间传言他伪造了关键证据。近年来他频繁出现在各地边境小镇，行踪诡秘，似乎在销毁某些旧档案。',
    priority: 9,
    position: 'after_persona',
    enabled: true,
    constant: false,
    selective: false,
  },
  {
    id: 'lore-guard-patrol',
    keys: ['巡逻', '卫兵', '搜捕'],
    content: '王城卫兵队近年来频繁向边境小镇派遣巡逻队，表面上是维持治安，实际上似乎在搜寻某样东西——或某个人。马库斯队长是这批卫兵中军衔最高的，但他似乎对上级的命令也心存疑虑。',
    priority: 6,
    position: 'after_persona',
    enabled: true,
    constant: false,
    selective: false,
  },
];
