# Project Progress — Interactive Visual Novel Engine

> 此文件是跨 session 的持久记忆。每次 session 结束前必须更新。

## Feature List

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | MVP 核心循环（assemble→cognition→goap→timeline→director→render） | done | commit 6e63e22 |
| 2 | 玩家交互系统（自主/介入混合模式） | done | commit 6e63e22 |
| 3 | 存储层（IndexedDB + ScriptBundle） | done | commit 308d700 |
| 4 | 设置界面（剧本管理 + 模型配置） | done | commit 308d700 |
| 5 | 动态 GOAP 动作生成 | done | commit 308d700 |
| 6 | 角色面板 + 模型配置 UI | done | commit 40e0f40 |
| 7 | 场景历史累积 + dialogue null 容错 | done | commit 3ce7f53 |
| 8 | 移动端适配（滚动条 + Debug 面板） | done | commit 8c8fa81 |
| 9 | 玩家介入消息注入 cognition/director | done | commit 6ca8114 |
| 10 | 场景队列机制（逐一打字展示） | done | commit 2221595 |
| 11 | Anthropic 风格主题系统 | done | commit d5c286c |
| 12 | Claude.ai 风格细节对齐 | done | commit d7b1557 |
| 13 | Debug 面板状态机可视化（SVG 流程图） | done | commit b3f63b0, inline CE 节点 |
| 14 | Lucide 图标迁移（替换全部 emoji/字符画） | done | commit b3f63b0, 51 处替换 |
| 15 | ChatInput toggle switch（替换 checkbox） | done | commit b3f63b0, CSS-only 实现 |
| 16 | 剧本 JSON 下载功能 | done | commit b3f63b0 |
| 17 | 血色多瑙河剧本转换 | done | 6 角色 / 3 章 / 15 事件 / 12 GOAP |
| 18 | CLAUDE.md + 进度追踪体系 | done | commit 0a30f17 |
| 19 | Reflection Agent（核心循环步骤⑩） | done | commit 22733e4 |
| 20 | ContextEngine 接口解耦 | done | commit b86d469 |
| 21 | 代码质量审计（dialog.md 框架） | done | code-quality-audit.md |
| 22 | 参与框架（PF）模块 — 信源数据模型 | done | src/pf/ (schema+plugins+engine), commit 7d7882a |
| 23 | Schema 扩展（WorldEvent frames + EpisodicMemory PF 字段） | done | commit 9264bd7 |
| 24 | Timeline + PlayerStore 预置场景支持 | done | commit 84bebd3 |
| 25 | Core Loop PF 快速路径 | done | commit e521ed1 |
| 26 | 渲染器点击推进（替代自动推进） | done | commit 27b618b |
| 27 | Debug 面板 preset 节点 | done | commit e521ed1 |
| 28 | scarlet-danube 预置场景数据（3事件 PF frames） | done | commit dc1c5fb |
| 29 | shadcn/ui + Tailwind CSS v4 引入 | done | 编辑器作为首个 shadcn 组件 |
| 30 | 剧本编辑器（VS Code 风格大纲树 + 侧面板） | done | 全功能 CRUD |
| 31 | SceneOutput type 字段（dialogue/narration/thought） | done | 向后兼容 |
| 32 | 「俺寻思」系统 — 思考 Agent + 内心独白渲染 | done | agents/thinking.ts |
| 33 | 底栏重写（AUTO + 输入框，替代自主/介入模式） | done | ChatInput Tailwind 重写 |
| 34 | GameRenderer AUTO 模式 + thought 样式 | done | 蓝灰斜体 + 左边框 |
| 35 | 思考系统优化（POV判定+thinking禁止点击+AUTO细化） | done | commit 45ab388 |
| 36 | 章节级分支系统（引力机制+编辑器支持） | done | commit 9621d60 |
| 37 | 分支 Demo 端到端（选项UI+LLM描述+4章节拆分） | done | commit 2470237 |
| 38 | Director 接口抽象（IDirector+SinglePovDirector+NPC注入） | done | commit 2470237 |
| — | **以下为待做功能** | — | — |
| 39 | CorePersona 加 dialogueExamples（fewshot 控制说话频率） | done | commit 83075ea |
| 40 | 角色面板显示所有角色（POV + NPC） | done | commit 18cade4 |
| 41 | 编辑器点击章节自动展开（修复分歧详情可见性） | done | commit 0c26af7 |
| 42 | Lorebook 世界书系统 | done | commit d50dd9c |
| 43 | 「俺寻思」Phase 2：分歧决策点 + 主动提示 | pending | anchorLevel soft 事件 |
| 44 | 引力评分模式验证（maxFreeActions>0） | pending | |
| 45 | P0 修复：EDR 全局 Store 解耦 | pending | code-quality-audit.md |
| 46 | P1 修复：runOneCycle 拆分 + ESE + OA | pending | code-quality-audit.md |
| 47 | 剧本导入验证（上传时 schema 校验 + 错误提示） | pending | |
| 41 | 存档/读档功能 | pending | |
| 42 | 角色立绘/头像系统 | pending | |
| 43 | 背景图/场景图系统 | pending | |
| 44 | 音效/BGM 系统 | pending | |
| 45 | 移动端全面优化 | pending | |
| 46 | PWA 离线支持 | pending | |
| 47 | 多语言支持 | pending | |

## Architecture Decisions

### AD-1: 纯内联样式，不用 CSS 框架
- **决定**: 不引入 Tailwind/shadcn，全部使用 `React.CSSProperties` + `T.xxx` 主题 token
- **原因**: 项目规模不大，内联样式足够；引入 CSS 框架会增加构建复杂度
- **影响**: Toggle switch 等组件用纯 CSS 实现

### AD-2: Lucide React 作为唯一图标库
- **决定**: 使用 lucide-react 替换所有 emoji 和字符画
- **原因**: 树摇优化（~1KB/icon），风格统一，支持 strokeWidth 自定义
- **影响**: SVG 状态机图中通过 `<foreignObject>` 嵌入 Lucide 图标

### AD-3: 状态机 CE 节点内联布局
- **决定**: ContextEngine 协议节点不再作为侧翼卫星，改为内联在主流程脊柱中
- **原因**: 更准确反映真实执行流程（idle→ce_idle→assemble→ce_assemble→...）
- **影响**: StateMachineDiagram 的 edgePath/isEdgeActive 逻辑全部重写

### AD-4: 多 AI 后端支持
- **决定**: agents 层支持 DeepSeek / OpenAI 兼容 API，不绑定特定供应商
- **原因**: 用户可能使用不同的 API 服务
- **影响**: model-config-store 管理 API key + endpoint + model name

### AD-5: Reflection 属于编排层，不属于数据层
- **决定**: Reflection Agent 由 core-loop.ts 的 `maybeReflect()` 调用，不放在 context-engine.ts 的 compact() 内
- **原因**: context-engine 是数据层（OpenClaw 协议），不应依赖 agents 或 debug store
- **影响**: context-engine.ts 零 agent 依赖，可独立替换

### AD-6: 暂不切换 Mastra
- **决定**: 保留当前轻量自定义 agent 实现，不迁移到 Mastra 框架
- **原因**: 当前 agent 模式统一（generateText + Zod），Mastra 引入额外抽象层但 MVP 阶段收益不明确。接口已预留切换空间
- **影响**: IFullContextEngine 接口保持 OpenClaw 兼容，未来可切换

### AD-7: 有序 SceneOutput[] 格式
- **决定**: 预置场景使用与 AI 生成相同的 SceneOutput[] 有序列表格式
- **原因**: 分析传统 VN 引擎（Ren'Py, ink, Monogatari）后发现，有序指令序列是最自然的叙事格式
- **影响**: 渲染器无需区分预置/AI 场景

### AD-8: PF 是唯一信源
- **决定**: ParticipationFrame 是叙事内容的唯一信源，SceneOutput（渲染）和 EpisodicMemory（记忆）都是投影计算的派生结果
- **原因**: 消除数据冗余，确保渲染和记忆从同一信源出发
- **影响**: WorldEvent 上只有 frames 字段，没有 presetScenes

### AD-9: 插件化投影计算
- **决定**: perceptionMods: Record<string, unknown> 支持插件扩展，builtin 插件零标注覆盖 90% 场景
- **原因**: 平衡灵活性与编剧工作负担
- **影响**: 复杂信息不对称场景可自定义插件

### AD-10: visibleTo 从 PF 派生
- **决定**: 不设 visibleTo 字段，从 frames 的参与者列表中自动派生
- **原因**: 避免 visibleTo 与 frames 参与者不一致的数据冗余
- **影响**: deriveVisibleTo(frames) 函数可随时计算

### AD-11: 「俺寻思」在 GameRenderer 层完成，不改 CoreLoop
- **决定**: 思考流程（记忆检索 + LLM 内心独白）在 GameRenderer 组件层直接调用，不走 CoreLoop 状态机
- **原因**: 思考和剧本推进正交；CoreLoop 管理 AI 管线和预置场景流，思考是独立的"旁路"操作
- **影响**: CoreLoop 零改动，思考结果作为 thought 类型 SceneOutput 插入渲染队列

### AD-12: AUTO 模式替代自主/介入模式
- **决定**: 底栏从"自主运行/介入模式"改为传统 VN 的 AUTO toggle + 输入框
- **原因**: 预置剧本优先模型下，"自主/介入"是 AI 沙盒概念，不再适用。AUTO 更符合 VN 玩家心智模型
- **影响**: ChatInput 用 Tailwind 重写，旧的 mode/autoPause/dynamicGoap 状态保留但不暴露到 UI

### AD-13: 章节级分支（不在事件级）
- **决定**: 分歧点在章节边界发生，不在事件中间
- **原因**: 参照 Ink/ChoiceScript 的经典模型，章节是天然叙事单元，编剧心智模型清晰
- **影响**: ChapterData.next 可以是 string（线性）或 DivergencePoint（分歧）

### AD-14: Director 层接口抽象
- **决定**: runDirector 裸函数 → IDirector 接口 + SinglePovDirector 实现类
- **原因**: 支持未来多 POV 扩展（MultiPovDirector），同时在单 POV 中注入 NPC 信息
- **影响**: CoreLoop 通过 this.director.generateScenes() 调用，可依赖注入替换实现

### AD-15: 选项模式 vs 引力模式
- **决定**: maxFreeActions=0 → 传统 Galgame 选项按钮（暂停等选择）；>0 → 引力评分自由行动期
- **原因**: 两种模式适用不同场景，选项模式快速验证，引力模式留给行动模式
- **影响**: CoreLoop.resolveNextChapter 分两条路径

## Known Issues

- **AI API 调用偶发失败**: cognition agent 有时返回 `AI_APICallError: Failed to process successful response`，属于上游 API 问题，非本项目 bug
- **大剧本加载性能**: 血色多瑙河有 6 角色 + 15 事件，需关注 cognition 阶段耗时

## Session Log

### Session 1-2 (commits a3dab11 → 6e63e22)
- 搭建 MVP：PRD → 核心循环 → 玩家交互系统

### Session 3 (commits 308d700 → 40e0f40)
- 存储层 + 设置界面 + 角色面板 + 动态 GOAP

### Session 4 (commits 3ce7f53 → 8c8fa81)
- Bug 修复：场景历史、dialogue null、滚动条、移动端适配

### Session 5 (commits 6ca8114 → 2221595)
- 玩家介入注入 + 场景队列打字展示

### Session 6 (commits d5c286c → d7b1557)
- Anthropic/Claude.ai 风格主题系统

### Session 7 (commit b3f63b0)
- 状态机可视化 SVG（inline CE 节点）
- Lucide 图标全面迁移（8 个组件，51 处）
- Toggle switch 替换 checkbox
- 剧本 JSON 下载功能

### Session 8 (commit 0a30f17)
- 血色多瑙河剧本转换（人物档案 + 小说文本 → ScriptBundle JSON）
- CLAUDE.md 工作流 + claude-progress.md 进度追踪体系建立

### Session 9 (commits 22733e4 → b86d469)
- PRD 核心循环差距分析：Reflection Agent 为最大缺口
- 实现 Reflection Agent（`src/agents/reflection.ts`），闭合核心循环第⑩步
- 讨论 Mastra 迁移利弊，发现 ContextEngine 接口未完全解耦
- 解耦 ContextEngine 接口：CoreLoopConfig 改用 IFullContextEngine，Reflection 提为 core-loop 独立步骤
- 基于 dialog.md 信息论框架完成代码质量审计，输出 code-quality-audit.md
- 架构决策：AD-5（Reflection 属于编排层非数据层）、AD-6（Mastra 暂不切换）

### Session 10
- 延续 Session 9，将诊断结果写入 code-quality-audit.md
- 更新 claude-progress.md

### Session 11-12 (commits 7d7882a → dc1c5fb)
- 分析修正方案.md（编剧协作者反馈），研究传统 VN 引擎数据结构
- 深入讨论 Goffman 参与框架理论，确立 AD-7~AD-10 架构决策
- 实现 PF 模块（src/pf/）：schema + builtin 插件 + 渲染投影 + 记忆投影
- Schema 扩展：WorldEvent.frames + EpisodicMemory PF 字段
- Timeline + PlayerStore 预置场景支持
- Core Loop 集成：peekNextEvent → hasFrames → playPresetEvent 快速路径
- 渲染器改造：点击推进替代 1.5s 自动推进
- Debug 面板：preset phase + 状态图节点
- scarlet-danube 3个关键事件添加 PF frames 数据
- 所有步骤 tsc --noEmit 零错误

### Session 13 (commit 631ac4c)
- 状态机图重构：单列 → 双列布局，AI 管线（左 x=75）+ 预置管线（右 x=265）并排展示
- core-loop-graph.ts 全面重写：新增 preset_render/preset_wait/preset_mem/ce_preset/ce_preset_at 节点
- StateMachineDiagram.tsx 更新：新增 BookOpen/Hand/Layers 图标，重写 edgePath() 处理双列边路径
- 共享 idle 节点居中（x=170），侧分支（waiting_input, goap_gen, error, reflection）居中
- SVG 尺寸 340×420，tsc 零错误

### Session 14-15
- shadcn/ui + Tailwind CSS v4 引入（app.css、components.json、resizable 组件）
- 剧本编辑器（VS Code 风格大纲树 + 侧面板 CRUD）
- scarlet-danube.json 修复（缺失字段 + 旧格式迁移）
- 文字颜色修复（Tailwind preflight 黑色文字 → text-foreground）

### Session 16
- 讨论「俺寻思」系统设计（极乐迪斯科式内心思考）
- SceneOutput 扩展 type 字段（dialogue/narration/thought）
- PF engine framesToScenes 映射 thought type
- ContextEngine 暴露 recallMemories 方法
- 新建思考 Agent（src/agents/thinking.ts）— 记忆检索 + 角色内心独白生成
- PlayerStore 新增 autoAdvance/thinking 状态
- ChatInput 底栏重写（Tailwind）：AUTO toggle + 输入框，替代自主/介入模式
- GameRenderer 改造：thought 样式（蓝灰斜体 + 左边框）+ AUTO 自动推进 + 思考流程集成
- 架构决策：AD-11（思考在 GameRenderer 层）、AD-12（AUTO 替代自主/介入）
- 修复换脚本 debug panel 显示旧脚本状态（CoreLoop.stop + resetAll）
- 首页剧本选择器 + "切换剧本"标签
- 内置剧本重命名为「风起（内置示例）」
- initStorage 改为每次启动更新内置种子数据
- tsc 零错误 + 预览验证通过

### Session 17

**思考系统优化：**
- GameRenderer: POV 判定（povSpeaking），仅 POV 角色说话时允许思考
- GameRenderer: thinking 期间禁止 handleAdvance 防止竞态
- AUTO 模式细化：player-input/thought/dialogue 分别处理延迟
- ChatInput: canThink 逻辑，非 POV 发言时显示"等待角色发言"

**章节级分支系统：**
- Schema: ChapterData 新增 id/next 字段，BranchOption/DivergencePoint 类型
- CoreLoop: 章节跟踪、线性切换、分歧状态管理、引力评分集成
- gravity.ts: 关键词匹配评分 + 累积分数 + 收束判定
- Timeline: allEventsConsumed() + replaceEvents() 支持章节切换
- 编辑器: ChapterEditor 分歧点完整配置 UI

**分支 Demo 端到端：**
- seed.ts: 内置剧本拆为 4 章节（风起→火起→[分歧]→灰烬之下/夜行）
- CoreLoop: maxFreeActions=0 暂停等玩家选择（Promise 模式）
- PlayerStore: activeDivergence + beginDivergenceChoice/resolveDivergenceChoice
- GameRenderer: 选项 UI 面板（标题+按钮+LLM描述+loading）
- agents/branch-describer.ts: LLM 动态生成选项情境描述

**Director 接口抽象：**
- IDirector 接口 + SinglePovDirector 实现类
- DirectorInput 新增 npcPersonas 字段
- system prompt 注入 NPC 角色信息（ID/说话风格/背景）
- CoreLoop.gatherNpcPersonas() 自动收集非 POV 角色
- 删除 runDirector 裸函数

**调研：**
- 对比 SillyTavern/OMate 生态：角色卡 V2/V3、Lorebook 世界书、玩法循环
- 分析传统引擎分支管理（Ren'Py/Ink/ChoiceScript/Quality-Based Narrative）
- 讨论引力机制设计（钻石/树状/混合结构）
- 分析莉娅引用古籍过多的根因（speechStyle 描述模糊 + LLM 过度表现）

**架构决策：**
- AD-13: 分支在章节级（不在事件级），参照 Ink/ChoiceScript 的图模型
- AD-14: Director 层抽象为接口，支持未来多 POV 扩展
- AD-15: maxFreeActions=0 → 传统选项模式；>0 → 引力评分模式

**继续实现（同 session）：**
1. ✅ CorePersona 加 dialogueExamples + liya.json 6条示例 + Director/Thinking 注入
2. ✅ CharacterPanel 重构：遍历所有角色，POV 标"主视角"徽标，NPC 显示基本信息
3. ✅ EditorTree 点击章节自动展开子树（修复分歧详情不可见的 UX 问题）
4. ✅ Lorebook 世界书系统：Schema + 匹配引擎 + Director 注入 + 5条内置条目
