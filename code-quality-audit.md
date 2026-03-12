# 代码质量诊断报告

> 基于 `dialog.md` 中的信息论代码质量框架，对当前代码库进行审计。
> 审计时间：2026-03-12
> 基准 commit：`b86d469`

---

## 审计框架

dialog.md 提出了一套基于信息论（熵）和图论的代码质量度量体系。本报告使用其中以下指标：

| 指标 | 全称 | 含义 |
|------|------|------|
| EDR | Explicit Dependency Rate | 显式依赖率——多少依赖通过参数注入 vs 全局隐式访问 |
| OA | Ownership Ambiguity | 所有权模糊度——某状态被多少模块写入 |
| SLM | Scope-Lifetime Mismatch | 作用域-生命周期错配——函数是否过长、职责过重 |
| ESE | Error Space Entropy | 错误空间熵——catch 块是否过宽、吞没有用信息 |
| PLME | Path-Length & Module Entropy | 路径长度与模块熵——import 路径是否混乱 |
| SSE | State Space Expansion | 状态空间膨胀——let 变量是否可以收紧为 const |
| SCC | Strongly Connected Components | 强连通分量——循环依赖的密度 |
| IIE | Interface-Implementation Entropy | 接口-实现熵——接口是否与唯一实现存在冗余 |
| CCD | Creation-Consumption Distance | 创建-消费距离——数据从创建到使用的跨越层级 |

---

## 发现

### P0 — EDR: 全局 Store 隐式耦合 🔴

**严重度**: CRITICAL
**位置**: `src/engine/core-loop.ts` 为重灾区

**现状**:
- 全代码库共 **20 处** `xxxStore.getState()` 调用分散在非 React 组件中
- `core-loop.ts` 内有 **31 处** `debug.xxx` 调用（通过 `useDebugStore.getState()` 获取）
- `core-loop.ts` 直接 `getState()` 了 **4 个 store**：debugStore、playerStore、characterStore（加上 config 注入的 contextEngine）

**受影响的 store 与消费者**:

| Store | 被哪些非组件文件直接 getState() |
|-------|-------------------------------|
| `useDebugStore` | core-loop.ts, goap-generator.ts |
| `usePlayerStore` | core-loop.ts |
| `useCharacterStore` | core-loop.ts, context-engine.ts |

**问题**: 这违反了 EDR（显式依赖率）原则。CoreLoop 类的构造函数接受 `CoreLoopConfig`，但实际运行时还隐式依赖了 3 个全局 store。如果要单元测试 CoreLoop，无法 mock 这些依赖。

**建议方向**: 将 debug、player、character store 通过 CoreLoopConfig 注入，或提取为 callback 接口（如 `onPhaseChange`, `onTrace`, `onError`）。

---

### P1 — OA: debugStore 写入权分散 🟠

**严重度**: HIGH
**位置**: 多文件

**现状**: `useDebugStore` 被以下 **4 个独立文件** 写入：

1. `src/engine/core-loop.ts` — `setPhase`, `pushTrace`, `setScenes`, `setGoapQueue`, `setMemoryContext`, `setTimeline`, `setCurrentGoal`, `pushError`, `incrementLoop`, `updateGoapStatus`（几乎所有写方法）
2. `src/App.tsx` — 初始化时 `setPhase('idle')`
3. `src/debug/DebugDrawer.tsx` — React 组件读取（正常）
4. `src/player/CharacterPanel.tsx` — React 组件读取（正常）

**问题**: OA 过高。debugStore 的 10+ 个写方法全部由 core-loop 一个文件调用，但 store 定义为全局可写。任何文件都可以调用 `setPhase('reflection')` 制造状态混乱。

**建议方向**: 收拢写入权到 CoreLoop 内部或专门的 DebugReporter 类，对外仅暴露只读 subscribe。

---

### P1 — SLM: runOneCycle() 过长 🟠

**严重度**: HIGH
**位置**: `src/engine/core-loop.ts:106-297`

**现状**: `runOneCycle()` 方法 **192 行**，包含：
- ① 上下文组装
- ② 认知推理
- ②½ 动态 GOAP 生成
- ③ GOAP 规划
- ④ 时间线冲突检测
- ⑤⑥ 叙事生成 + 渲染（通过 executeAction 委托）
- ⑧ 后处理
- ⑨ 自动暂停
- ⑩ 反思

**问题**: SLM（作用域-生命周期错配）过高。一个方法编排了 8 个阶段，局部变量（`assembled`, `cognitionResult`, `goal`, `plan`, `conflict` 等）的生命周期贯穿整个方法，但每个变量只在 1-2 个阶段内有意义。

**建议方向**: 提取为独立的阶段方法：`assembleContext()`, `think()`, `planActions()`, `executeWithTimeline()`, `postProcess()`。每个方法返回下一阶段所需的数据。

---

### P1 — ESE: 宽泛的 catch 块 🟠

**严重度**: HIGH
**位置**: 多处

**当前 catch 块统计**:

| 文件 | 行号 | catch 范围 | 问题 |
|------|------|-----------|------|
| `core-loop.ts` | L79 | 整个 `runOneCycle()` | 192 行的 try 块，任何阶段失败都走同一个 `sleep(3000)` 重试 |
| `core-loop.ts` | L199 | 动态 GOAP 生成 | 合理，范围小 |
| `core-loop.ts` | L492 | Reflection | 合理，范围小 |

**问题**: L79 的 catch 块覆盖了从 context assembly 到 reflection 的全部阶段。如果 cognition agent 失败，和 GOAP planner 失败，得到的错误处理完全相同（推 error + sleep 3s）。丢失了"哪个阶段失败"的上下文信息。

**建议方向**: 将 runOneCycle 内的各阶段分别 try-catch，或至少在 error 中标注 `phase` 信息。

---

### P2 — PLME: 相对路径 import 统一性 🟡

**严重度**: MEDIUM
**位置**: 全代码库

**现状**:
- **54 处** 相对路径 import（`from '../xxx'`）
- **0 处** 别名路径 import（`from '@/xxx'`）
- `tsconfig.json` 未配置 `@/*` 路径别名

**问题**: 在 `src/engine/core-loop.ts` 中，import 路径如 `../memory/context-engine`, `../agents/cognition`, `../debug/debug-store` 等达 10 条，阅读时需要心算相对位置。

**建议方向**: 配置 `@/` 路径别名（tsconfig paths + vite resolve alias），统一为 `@/memory/context-engine` 形式。非阻塞问题，可在后续 refactor 时一并处理。

---

### P3 — SSE: let 可收紧为 const 🟢

**严重度**: LOW
**位置**: 少量

**现状**: 仅发现 **1 处**可优化：
- `src/agents/reflection.ts:94` — `let shift: PersonaShift | null = null` → 可重构为 `const shift = output.hasShift ? {...} : null`

其余 `let` 使用（for 循环计数器、index 递增）均合理。

---

### P3 — SCC: 循环依赖 🟢

**严重度**: LOW（无问题）

**现状**: **0 个循环依赖**。模块依赖关系为单向 DAG：
```
core-loop → agents/* → deepseek/utils
core-loop → memory/* → schemas
core-loop → goap/*
core-loop → timeline/*
core-loop → debug/*
core-loop → player/*
```

解耦后 `memory/context-engine.ts` 不再依赖 `agents/` 或 `debug/`，保持了数据层的纯净。

---

### P3 — IIE: 接口冗余 🟢

**严重度**: LOW

**现状**: `IFullContextEngine = Required<IContextEngine>` 目前只有一个实现 `NovelContextEngine`。

**评估**: 虽然只有一个实现，但这是有意的设计——为了支持未来切换 Mastra 或其他记忆引擎。接口的存在是合理的架构预留，不构成过度抽象。

---

### P3 — CCD: 创建-消费距离 🟢

**严重度**: LOW

**现状**: 大部分数据的创建和消费在相邻层级：
- `AssembleResult` 在 context-engine 创建，在 core-loop 同一方法内消费
- `CognitionResult` 在 cognition agent 创建，在 core-loop 同一方法内消费
- `SceneOutput[]` 在 director agent 创建，通过 callback (`onScenesReady`) 传递给渲染层

唯一的长距离数据流是 `PersonaShift`：在 reflection agent 创建 → 写入 character-store → 下一轮 assemble 时读取。但这是有意的持久化设计，不是泄漏。

---

## 优先级总览

| 优先级 | 指标 | 问题 | 影响范围 | 修复难度 |
|--------|------|------|----------|----------|
| P0 | EDR | 全局 Store 隐式耦合 | core-loop 为主 | 中 — 需重构 Config |
| P1 | OA | debugStore 写入权分散 | 4 个文件 | 中 — 可提取 reporter |
| P1 | SLM | runOneCycle() 192 行 | core-loop | 中 — 提取阶段方法 |
| P1 | ESE | 宽泛 catch 块 | core-loop L79 | 低 — 加阶段标记即可 |
| P2 | PLME | 54 处相对路径 import | 全局 | 低 — 配置 alias |
| P3 | SSE | 1 处 let→const | reflection.ts | 极低 |
| P3 | SCC | 0 循环依赖 | — | 无需修复 |
| P3 | IIE | 1 接口 1 实现 | context-engine | 无需修复（有意设计） |
| P3 | CCD | 最小距离 | — | 无需修复 |

---

## 正面发现

1. **解耦后 memory 层干净**: context-engine.ts 不依赖任何 agent 或 debug 模块
2. **零循环依赖**: 模块依赖图为 DAG
3. **Agent 模式统一**: cognition/director/reflection 三个 agent 遵循相同模式（generateText + extractJSON + Zod）
4. **接口预留合理**: IFullContextEngine 接口为 Mastra 迁移预留了空间
5. **类型安全**: Zod schema 覆盖了所有数据结构，TypeScript strict mode 无错误

---

## 下一步建议

1. **P0 EDR**: 将 debugStore/playerStore/characterStore 的交互提取为 CoreLoopConfig 的 callback 接口
2. **P1 SLM + ESE**: 拆分 runOneCycle() 为阶段方法，每个阶段独立 try-catch
3. **P1 OA**: 引入 DebugReporter 收拢写入权
4. **P2 PLME**: 后续统一 refactor 时配置 `@/` 别名
