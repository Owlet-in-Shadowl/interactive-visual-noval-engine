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
| — | **以下为待做功能** | — | — |
| 29 | P0 修复：EDR 全局 Store 解耦 | pending | code-quality-audit.md |
| 23 | P1 修复：runOneCycle 拆分 + ESE + OA | pending | code-quality-audit.md |
| 24 | 剧本导入验证（上传时 schema 校验 + 错误提示） | pending | |
| 25 | 多章节切换（chapter selector UI） | pending | |
| 26 | 存档/读档功能 | pending | |
| 27 | 角色立绘/头像系统 | pending | |
| 28 | 背景图/场景图系统 | pending | |
| 29 | 音效/BGM 系统 | pending | |
| 30 | 剧本编辑器（在线编辑角色/事件） | pending | |
| 31 | 移动端全面优化 | pending | |
| 32 | PWA 离线支持 | pending | |
| 33 | 多语言支持 | pending | |

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
