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
| 18 | CLAUDE.md + 进度追踪体系 | in-progress | 当前 session |
| — | **以下为待做功能** | — | — |
| 19 | 剧本导入验证（上传时 schema 校验 + 错误提示） | pending | |
| 20 | 多章节切换（chapter selector UI） | pending | |
| 21 | 存档/读档功能 | pending | |
| 22 | 角色立绘/头像系统 | pending | |
| 23 | 背景图/场景图系统 | pending | |
| 24 | 音效/BGM 系统 | pending | |
| 25 | 剧本编辑器（在线编辑角色/事件） | pending | |
| 26 | 移动端全面优化 | pending | |
| 27 | PWA 离线支持 | pending | |
| 28 | 多语言支持 | pending | |

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

### Session 8 (当前)
- 血色多瑙河剧本转换（人物档案 + 小说文本 → ScriptBundle JSON）
- CLAUDE.md 工作流 + claude-progress.md 进度追踪体系建立
