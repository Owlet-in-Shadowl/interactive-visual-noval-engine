/**
 * Core Loop Graph — node/edge data for the state machine visualization.
 *
 * CE protocol nodes are INLINE in the main flow, rendered as smaller pills.
 * Layout:
 *   Main column (x=80): phase nodes + CE pills interleaved vertically
 *   Side column (x=215): branch nodes (waiting_input, goap_gen, error, reflection)
 */

import type { GamePhase } from './debug-store';

/* ── Phase metadata ── */

export const phaseLabels: Record<GamePhase, string> = {
  idle: '空闲',
  assemble: '上下文',
  cognition: '5W1H',
  goap: 'GOAP',
  goap_gen: '介入',
  timeline: '时间线',
  director: '叙事',
  render: '渲染',
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
export const SVG_W = 280;
export const SVG_H = 370;

const MX = 80;
const SX = 215;

/* ── Nodes ── */

export const NODES: GraphNode[] = [
  // ── Main spine: phase + CE interleaved ──
  { id: 'idle',          label: '空闲',       icon: 'Pause',     x: MX, y: 22,  kind: 'phase', phase: 'idle' },
  { id: 'ce_idle',       label: 'boot·turn',  icon: 'Zap',       x: MX, y: 49,  kind: 'ce',    parentPhase: 'idle' },
  { id: 'assemble',      label: '上下文',     icon: 'Package',   x: MX, y: 76,  kind: 'phase', phase: 'assemble' },
  { id: 'ce_assemble',   label: 'ingest·asm', icon: 'Database',  x: MX, y: 103, kind: 'ce',    parentPhase: 'assemble' },
  { id: 'cognition',     label: '5W1H',       icon: 'Brain',     x: MX, y: 130, kind: 'phase', phase: 'cognition' },
  { id: 'ce_cognition',  label: 'ingest',     icon: 'Database',  x: MX, y: 157, kind: 'ce',    parentPhase: 'cognition' },
  { id: 'goap',          label: 'GOAP',       icon: 'Route',     x: MX, y: 196, kind: 'phase', phase: 'goap' },
  { id: 'timeline',      label: '时间线',     icon: 'Clock',     x: MX, y: 234, kind: 'phase', phase: 'timeline' },
  { id: 'director',      label: '叙事',       icon: 'PenTool',   x: MX, y: 268, kind: 'phase', phase: 'director' },
  { id: 'ce_director',   label: 'ingest',     icon: 'Database',  x: MX, y: 295, kind: 'ce',    parentPhase: 'director' },
  { id: 'render',        label: '渲染',       icon: 'Play',      x: MX, y: 322, kind: 'phase', phase: 'render' },
  { id: 'ce_render',     label: 'ingest',     icon: 'Database',  x: MX, y: 349, kind: 'ce',    parentPhase: 'render' },
  // ── Side branches ──
  { id: 'waiting_input', label: '等待', icon: 'MessageCircle', x: SX, y: 22,  kind: 'phase', phase: 'waiting_input' },
  { id: 'goap_gen',      label: '介入', icon: 'Wand2',         x: SX, y: 176, kind: 'phase', phase: 'goap_gen' },
  { id: 'error',         label: '错误', icon: 'AlertTriangle', x: SX, y: 234, kind: 'phase', phase: 'error' },
  { id: 'reflection',    label: '反思', icon: 'RefreshCw',     x: SX, y: 322, kind: 'phase', phase: 'reflection' },
];

/* ── Edges ── */

export const EDGES: GraphEdge[] = [
  // Main spine (phase → CE → phase → CE → ...)
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
  // Loop back
  { from: 'ce_render', to: 'idle' },
  // Conditional branches
  { from: 'cognition',  to: 'goap_gen',   dashed: true },
  { from: 'goap_gen',   to: 'goap',       dashed: true },
  { from: 'render',     to: 'reflection', dashed: true },
  { from: 'reflection', to: 'idle' },
  // Waiting input
  { from: 'idle',          to: 'waiting_input', dashed: true },
  { from: 'waiting_input', to: 'assemble' },
];
