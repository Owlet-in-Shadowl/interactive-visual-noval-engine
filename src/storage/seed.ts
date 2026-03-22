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
    description: '傍晚时分，图书馆的魔法火焰终于被扑灭。空气中残留着魔力燃烧后的臭氧味，卫兵们设了警戒线不让人靠近。莉娅趁马库斯带队去别处巡逻的间隙，从后墙的缺口潜入废墟。她感知到地板下有微弱的魔力波动——赫尔曼的封印术还在运作。在坍塌的书架下，她发现了一道被封印保护的暗门，封印上刻着赫尔曼独有的魔法纹路。赫尔曼之前提到的"去图书馆地下室找"，说的就是这里。',
    location: 'library',
    affectedCharacters: ['liya'],
    severity: 'critical',
  },
  {
    id: 'hidden-passage',
    time: 960,
    name: '密道与家族秘档',
    description: '暗门后是一条狭窄的石阶密道，墙壁上的魔法符文在莉娅靠近时微微发光——它们认出了艾文斯家族血脉的魔力特征。密道尽头是一间被强力封印保护的密室，架上摆满了魔法水晶瓶封存的文献和几件散发微光的魔法器具。莉娅翻开最上面的一份文献，是十五年前的一封检举信，落款人是"克洛维斯·莫兰，王城大法官首席顾问"。信中详细列出了伪造的"通敌"证据清单，还提到了一项关键指控：艾文斯家族私自研究被禁制的高阶魔法。莉娅的手颤抖着——这就是家族蒙冤的铁证。她必须找到莫兰。',
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
    id: 'curfew-escape',
    time: 1080,
    name: '宵禁降临',
    description: '日落时分，镇长宣布宵禁。卫兵在各个路口设置了附有感知魔法的火把哨卡。赫尔曼把莉娅叫到小屋内室，从壁炉暗格中取出最后几本魔法研究手稿和一瓶封印溶液塞进旧书包，声音压得很低："莉娅，我们今晚必须离开。那些人放的是魔法火——只有学院级别的施法者才会使用。他们不是来毁书的，是在逼我现身。"他告诉莉娅北门的排水渠有他年轻时设下的隐匿结界，卫兵的感知魔法探测不到那里。',
    location: 'home',
    affectedCharacters: ['liya', 'herman'],
    severity: 'major',
  },
  {
    id: 'escort-herman',
    time: 1140,
    name: '夜行突围',
    description: '月光映在灰石墙面上，莉娅搀扶着赫尔曼穿过宵禁后寂静的街道。远处传来卫兵巡逻的脚步声和火把劈啪作响的声音。他们沿着赫尔曼记忆中的路线避开哨卡，从北门的排水渠匍匐穿过。赫尔曼的呼吸越来越重，但他拒绝停下。',
    location: 'town-square',
    affectedCharacters: ['liya', 'herman'],
    severity: 'major',
  },
  {
    id: 'forest-ambush',
    time: 1200,
    name: '林中伏击',
    description: '刚踏入城外的松林，树影中突然闪出几道黑影。三个穿黑衣的人堵住了去路，他们不是卫兵——没有盔甲，没有火把，但每人腰间都挂着匕首。领头的人用沙哑的声音说："老先生，您的那些文件，莫兰大人需要收回。"赫尔曼紧握莉娅的手，他的掌心冰凉却没有发抖。他低声对莉娅说——"克洛维斯·莫兰。他就是当年指控你父亲的人。这些手稿里有证据。"',
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
    content: '小镇图书馆始建于三百年前，由第一任镇长捐赠。馆藏以边境魔法文献和草药典籍为主，二楼特藏室存有一些从王立学院流出的魔法研究手稿。据传地下室有一间被封印保护的密室，入口在五十年前的翻修中被石砖封堵。图书馆管理员老约翰是赫尔曼在学院时期的老友。',
    priority: 5,
    position: 'after_persona',
    enabled: true,
    constant: false,
    selective: false,
  },
  {
    id: 'lore-evans-family',
    keys: ['艾文斯', '家族', '徽记', '徽章'],
    content: '艾文斯家族曾是王国六大贵族之一，以精湛的魔法血脉闻名，家族世代守护着一套被称为"银鹰秘典"的高阶魔法体系。十五年前因"私研禁制魔法、通敌叛国"的双重罪名被抄没，但民间普遍认为这是一场冤案。家族徽记是一只衔着月桂枝的银鹰。莉娅继承了家族的魔法天赋，但尚未觉醒全部潜力。',
    priority: 8,
    position: 'after_persona',
    enabled: true,
    constant: false,
    selective: false,
  },
  {
    id: 'lore-herman',
    keys: ['赫尔曼', '老学者', '导师', '养父'],
    content: '赫尔曼·格雷是前王立学院魔法药理学教授，精通草药炼制与基础元素魔法。因拒绝用魔法鉴定术为伪造的证据背书而被逐出学院。此后隐居边境小镇，以教授草药学和为镇民制药为生。他收养了年幼的莉娅，将毕生的草药学和基础魔法知识传授给她，但从未透露家族覆灭的全部真相。',
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
    content: '克洛维斯·莫兰是王城大法官的首席顾问，同时也是王立学院魔法审查委员会的成员。十五年前主导了对艾文斯家族"私研禁制魔法"的调查，民间传言他伪造了魔法鉴定报告。近年来他频繁出现在各地边境小镇，行踪诡秘，似乎在销毁某些与魔法研究相关的旧档案。据说他本人也精通高阶魔法，但极力掩饰这一点。',
    priority: 9,
    position: 'after_persona',
    enabled: true,
    constant: false,
    selective: false,
  },
  {
    id: 'lore-guard-patrol',
    keys: ['巡逻', '卫兵', '搜捕'],
    content: '王城卫兵队近年来频繁向边境小镇派遣巡逻队，配备了魔法感知装置，表面上是"魔法安全巡查"，实际上似乎在搜寻某样魔法遗物——或某个拥有特定魔法血脉的人。马库斯队长是这批卫兵中军衔最高的，但他似乎对上级的命令也心存疑虑，尤其是当命令涉及"未经审判就扣押魔法使用者"时。',
    priority: 6,
    position: 'after_persona',
    enabled: true,
    constant: false,
    selective: false,
  },
];
