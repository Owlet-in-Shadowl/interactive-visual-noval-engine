/**
 * Core Loop Graph — node/edge data for the state machine visualization.
 *
 * Three-column layout:
 *   Left column  (x=75):  Preset pipeline (PF frames→render→memory)
 *   Center column (x=190): AI pipeline (cognition→GOAP→director→render)
 *   Right side   (x=290):  Side branches (waiting_input, goap_gen, error)
 */

import type { GamePhase } from './debug-store';

/* ── Phase metadata ── */

export const phaseLabels: Record<GamePhase, string> = {
  idle: '空闲',
  assemble: '上下文',
  cognition: '5W1H',
  goap: 'GOAP',
  goap_gen: '动态动作',
  timeline: '时间线',
  director: '叙事',
  render: '渲染',
  preset: '预置',
  reflection: '反思',
  waiting_input: '等待',
  error: '错误',
};

export const phaseColors: Record<GamePhase, string> = {
  idle: '#666',
  assemble: '#7ec8e3',
  cognition: '#e6c3a1',
  goap: '#a1e6c3',
  goap_gen: '#b8e6a1',
  timeline: '#e6a1c3',
  director: '#c3a1e6',
  render: '#a1c3e6',
  preset: '#e6d4a1',
  reflection: '#e6e6a1',
  waiting_input: '#c3e6a1',
  error: '#e64545',
};

/* ── Graph types ── */

export type NodeKind = 'phase' | 'ce';

export interface GraphNode {
  id: string;
  label: string;
  icon: string;
  x: number;
  y: number;
  kind: NodeKind;
  phase?: GamePhase;       // phase nodes
  parentPhase?: GamePhase; // CE nodes: which phase they follow
}

export interface GraphEdge {
  from: string;
  to: string;
  dashed?: boolean;
}

/* ── Dimensions ── */

export const NODE_W = 76;
export const NODE_H = 24;
export const CE_W = 62;
export const CE_H = 18;
export const SVG_W = 370;
export const SVG_H = 420;

const PX = 75;   // Preset pipeline center (left)
const MX = 190;  // AI pipeline center (center)
const SX = 300;  // Side branches (right)

/* ── Nodes ── */

export const NODES: GraphNode[] = [
  // ── Shared: idle at center top ──
  { id: 'idle', label: '空闲', icon: 'Pause', x: MX, y: 22, kind: 'phase', phase: 'idle' },

  // ── Left column: Preset pipeline ──
  { id: 'preset_render', label: '渲染投影', icon: 'BookOpen', x: PX, y: 75,  kind: 'phase', phase: 'preset' },
  { id: 'preset_wait',   label: '等待点击', icon: 'Hand',     x: PX, y: 125, kind: 'phase', phase: 'preset' },
  { id: 'preset_mem',    label: '记忆投影', icon: 'Layers',   x: PX, y: 175, kind: 'phase', phase: 'preset' },
  { id: 'ce_preset',     label: 'ingest',   icon: 'Database', x: PX, y: 210, kind: 'ce',    parentPhase: 'preset' },
  { id: 'ce_preset_at',  label: 'afterTurn', icon: 'Zap',     x: PX, y: 240, kind: 'ce',    parentPhase: 'preset' },

  // ── Center column: AI pipeline ──
  { id: 'ce_idle',       label: 'boot·turn',  icon: 'Zap',       x: MX, y: 55,  kind: 'ce',    parentPhase: 'idle' },
  { id: 'assemble',      label: '上下文',     icon: 'Package',   x: MX, y: 85,  kind: 'phase', phase: 'assemble' },
  { id: 'ce_assemble',   label: 'ingest·asm', icon: 'Database',  x: MX, y: 112, kind: 'ce',    parentPhase: 'assemble' },
  { id: 'cognition',     label: '5W1H',       icon: 'Brain',     x: MX, y: 142, kind: 'phase', phase: 'cognition' },
  { id: 'ce_cognition',  label: 'ingest',     icon: 'Database',  x: MX, y: 169, kind: 'ce',    parentPhase: 'cognition' },
  { id: 'goap',          label: 'GOAP',       icon: 'Route',     x: MX, y: 202, kind: 'phase', phase: 'goap' },
  { id: 'timeline',      label: '时间线',     icon: 'Clock',     x: MX, y: 236, kind: 'phase', phase: 'timeline' },
  { id: 'director',      label: '叙事',       icon: 'PenTool',   x: MX, y: 270, kind: 'phase', phase: 'director' },
  { id: 'ce_director',   label: 'ingest',     icon: 'Database',  x: MX, y: 297, kind: 'ce',    parentPhase: 'director' },
  { id: 'render',        label: '渲染',       icon: 'Play',      x: MX, y: 327, kind: 'phase', phase: 'render' },
  { id: 'ce_render',     label: 'ingest',     icon: 'Database',  x: MX, y: 354, kind: 'ce',    parentPhase: 'render' },

  // ── Right side: Side branches ──
  { id: 'waiting_input', label: '等待输入', icon: 'MessageCircle', x: SX, y: 55,  kind: 'phase', phase: 'waiting_input' },
  { id: 'goap_gen',      label: '动态动作', icon: 'Wand2',         x: SX, y: 175, kind: 'phase', phase: 'goap_gen' },
  { id: 'error',         label: '错误',     icon: 'AlertTriangle', x: SX, y: 236, kind: 'phase', phase: 'error' },
  { id: 'reflection',    label: '反思',     icon: 'RefreshCw',     x: MX, y: 385, kind: 'phase', phase: 'reflection' },
];

/* ── Edges ── */

export const EDGES: GraphEdge[] = [
  // ── Preset Pipeline (left column) ──
  { from: 'idle',          to: 'preset_render', dashed: true },  // conditional fork
  { from: 'preset_render', to: 'preset_wait' },
  { from: 'preset_wait',   to: 'preset_mem' },
  { from: 'preset_mem',    to: 'ce_preset' },
  { from: 'ce_preset',     to: 'ce_preset_at' },
  { from: 'ce_preset_at',  to: 'idle' },          // loop back (left side)

  // ── AI Pipeline (center column) ──
  { from: 'idle',         to: 'ce_idle' },
  { from: 'ce_idle',      to: 'assemble' },
  { from: 'assemble',     to: 'ce_assemble' },
  { from: 'ce_assemble',  to: 'cognition' },
  { from: 'cognition',    to: 'ce_cognition' },
  { from: 'ce_cognition', to: 'goap' },
  { from: 'goap',         to: 'timeline' },
  { from: 'timeline',     to: 'director' },
  { from: 'director',     to: 'ce_director' },
  { from: 'ce_director',  to: 'render' },
  { from: 'render',       to: 'ce_render' },
  { from: 'ce_render',    to: 'idle' },           // loop back (right side of center)

  // ── Side branches (right) ──
  { from: 'idle',          to: 'waiting_input', dashed: true },
  { from: 'waiting_input', to: 'ce_idle' },
  { from: 'cognition',  to: 'goap_gen',   dashed: true },
  { from: 'goap_gen',   to: 'goap',       dashed: true },
  { from: 'ce_render',  to: 'reflection', dashed: true },
  { from: 'reflection', to: 'idle' },
];
