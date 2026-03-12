/**
 * StateMachineDiagram — SVG visualization of the core loop state machine.
 *
 * - Main phase nodes: rounded rects with Lucide icons
 * - CE protocol pills: smaller pill nodes connected horizontally
 * - Per-node elapsed time display
 * - Active node pulse animation
 */

import type { GamePhase } from './debug-store';
import {
  NODES, EDGES,
  NODE_W, NODE_H, CE_W, CE_H,
  SVG_W, SVG_H,
  phaseColors,
  type GraphNode, type GraphEdge,
} from './core-loop-graph';
import { T } from '../theme';

import {
  Pause, Package, Brain, Route, Wand2, Clock,
  PenTool, Play, RefreshCw, MessageCircle, AlertTriangle,
  Zap, Database, BookOpen, Hand, Layers,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import type { ComponentType } from 'react';

const ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  Pause, Package, Brain, Route, Wand2, Clock,
  PenTool, Play, RefreshCw, MessageCircle, AlertTriangle,
  Zap, Database, BookOpen, Hand, Layers,
};

/* ── CE accent color ── */
const CE_COLOR = T.info;

/* ── Props ── */

interface Props {
  phase: GamePhase;
  prevPhase: GamePhase;
  phaseStartedAt: number;
  phaseDurations: Partial<Record<GamePhase, number>>;
}

export function StateMachineDiagram({ phase, prevPhase, phaseStartedAt, phaseDurations }: Props) {
  const nodeMap = new Map(NODES.map((n) => [n.id, n]));

  /* ── Edge path computation ── */

  function edgePath(e: GraphEdge): string {
    const f = nodeMap.get(e.from)!;
    const t = nodeMap.get(e.to)!;
    const fHw = f.kind === 'ce' ? CE_W / 2 : NODE_W / 2;
    const fHh = f.kind === 'ce' ? CE_H / 2 : NODE_H / 2;
    const tHw = t.kind === 'ce' ? CE_W / 2 : NODE_W / 2;
    const tHh = t.kind === 'ce' ? CE_H / 2 : NODE_H / 2;

    // ── Special paths ──

    // ce_preset_at → idle: left-side loop back to top
    if (e.from === 'ce_preset_at' && e.to === 'idle') {
      const lx = f.x - fHw - 16;
      return `M${f.x - fHw},${f.y} L${lx},${f.y} L${lx},${t.y} L${t.x - tHw},${t.y}`;
    }

    // ce_render → idle: right-side loop back to top
    if (e.from === 'ce_render' && e.to === 'idle') {
      const rx = f.x + fHw + 16;
      return `M${f.x + fHw},${f.y} L${rx},${f.y} L${rx},${t.y} L${t.x + tHw},${t.y}`;
    }

    // reflection → idle: loop from bottom back up
    if (e.from === 'reflection' && e.to === 'idle') {
      const lx = f.x - fHw - 8;
      return `M${f.x - fHw},${f.y} L${lx},${f.y} L${lx},${t.y + tHh + 2} L${t.x},${t.y + tHh + 2}`;
    }

    // idle → ce_idle: straight down (same column)
    if (e.from === 'idle' && e.to === 'ce_idle') {
      return `M${f.x},${f.y + fHh} L${t.x},${t.y - tHh}`;
    }

    // idle → preset_render: diagonal down-left
    if (e.from === 'idle' && e.to === 'preset_render') {
      return `M${f.x - fHw},${f.y + fHh * 0.5} C${t.x + tHw + 15},${f.y + 15}, ${t.x + tHw + 5},${t.y - 8}, ${t.x},${t.y - tHh}`;
    }

    // idle → waiting_input: diagonal down-right
    if (e.from === 'idle' && e.to === 'waiting_input') {
      return `M${f.x + fHw},${f.y + fHh * 0.5} C${t.x - tHw - 15},${f.y + 15}, ${t.x - tHw - 5},${t.y - 8}, ${t.x},${t.y - tHh}`;
    }

    // waiting_input → ce_idle: curve down-left back to center
    if (e.from === 'waiting_input' && e.to === 'ce_idle') {
      const mx = (f.x + t.x) / 2;
      return `M${f.x},${f.y + fHh} C${mx},${f.y + 30}, ${mx},${t.y}, ${t.x + tHw},${t.y}`;
    }

    // ce_render → reflection: straight down (same column)
    if (e.from === 'ce_render' && e.to === 'reflection') {
      return `M${f.x},${f.y + fHh} L${t.x},${t.y - tHh}`;
    }

    // ── Generic paths ──

    // Same column, going down
    if (f.x === t.x && f.y < t.y) {
      return `M${f.x},${f.y + fHh} L${t.x},${t.y - tHh}`;
    }

    // Same row → horizontal
    if (Math.abs(f.y - t.y) < 2) {
      const d = f.x < t.x ? 1 : -1;
      return `M${f.x + d * fHw},${f.y} L${t.x - d * tHw},${t.y}`;
    }

    // Cross-column, down-right
    if (f.x < t.x) {
      const mx = (f.x + t.x) / 2;
      return `M${f.x + fHw},${f.y} C${mx},${f.y}, ${mx},${t.y}, ${t.x - tHw},${t.y}`;
    }

    // Cross-column, down-left
    if (f.x > t.x && f.y < t.y) {
      const mx = (f.x + t.x) / 2;
      return `M${f.x - fHw},${f.y} C${mx},${f.y}, ${mx},${t.y}, ${t.x + tHw},${t.y}`;
    }

    return `M${f.x},${f.y + fHh} L${t.x},${t.y - tHh}`;
  }

  /* ── Edge active check ── */

  function resolvePhase(nodeId: string): GamePhase | undefined {
    const n = nodeMap.get(nodeId);
    if (!n) return undefined;
    return n.kind === 'phase' ? n.phase : n.parentPhase;
  }

  function isEdgeActive(e: GraphEdge): boolean {
    const rFrom = resolvePhase(e.from);
    const rTo = resolvePhase(e.to);
    if (!rFrom || !rTo) return false;
    // Direct transition: from previous phase to current phase
    if (rFrom === prevPhase && rTo === phase) return true;
    // CE node between parent phase and next: both endpoints resolve to prevPhase
    if (rFrom === prevPhase && rTo === prevPhase && prevPhase !== phase) return true;
    return false;
  }

  /* ── Node active / duration check ── */

  function getNodePhase(n: GraphNode): GamePhase | undefined {
    return n.kind === 'phase' ? n.phase : n.parentPhase;
  }

  function isNodeActive(n: GraphNode): boolean {
    return getNodePhase(n) === phase;
  }

  function nodeDuration(n: GraphNode): string | null {
    const p = getNodePhase(n);
    if (!p) return null;
    if (p === phase && phaseStartedAt > 0) {
      return ((Date.now() - phaseStartedAt) / 1000).toFixed(1) + 's';
    }
    const dur = phaseDurations[p];
    if (dur !== undefined) {
      return (dur / 1000).toFixed(1) + 's';
    }
    return null;
  }

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      <style>{`
        @keyframes sm-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .sm-active { animation: sm-pulse 2s ease-in-out infinite; }
      `}</style>

      <defs>
        <marker id="sm-arr" viewBox="0 0 8 6" refX="7" refY="3"
          markerWidth="7" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L8,3 L0,6z" fill={T.textMuted} />
        </marker>
        <marker id="sm-arr-a" viewBox="0 0 8 6" refX="7" refY="3"
          markerWidth="7" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L8,3 L0,6z" fill={T.accent} />
        </marker>
      </defs>

      {/* ── Edges ── */}
      {EDGES.map((e, i) => {
        const active = isEdgeActive(e);
        return (
          <path
            key={i}
            d={edgePath(e)}
            fill="none"
            stroke={active ? T.accent : T.textMuted}
            strokeWidth={active ? 1.5 : 0.7}
            strokeDasharray={e.dashed ? '3,2' : undefined}
            markerEnd={`url(#${active ? 'sm-arr-a' : 'sm-arr'})`}
            opacity={active ? 1 : 0.4}
          />
        );
      })}

      {/* ── Phase nodes ── */}
      {NODES.filter((n) => n.kind === 'phase').map((n) => {
        const active = isNodeActive(n);
        const c = phaseColors[n.phase!];
        const hw = NODE_W / 2;
        const hh = NODE_H / 2;
        const dur = nodeDuration(n);

        return (
          <g key={n.id} className={active ? 'sm-active' : undefined}>
            <rect
              x={n.x - hw} y={n.y - hh}
              width={NODE_W} height={NODE_H}
              rx={4}
              fill={active ? c : T.bgElevated}
              stroke={c}
              strokeWidth={active ? 1.5 : 0.7}
              opacity={active ? 1 : 0.65}
            />
            <foreignObject x={n.x - hw} y={n.y - hh} width={NODE_W} height={NODE_H}>
              <div style={phaseNodeStyle}>
                <NodeIcon name={n.icon} size={11} color={active ? T.bg : T.textSecondary} />
                <span style={{ fontSize: 9, color: active ? T.bg : T.textSecondary, lineHeight: 1 }}>
                  {n.label}
                </span>
              </div>
            </foreignObject>
            {dur && (
              <text
                x={n.x} y={n.y + hh + 10}
                textAnchor="middle"
                fill={active ? T.accent : T.textTertiary}
                fontSize={7}
                fontFamily={T.fontMono}
              >
                {dur}
              </text>
            )}
          </g>
        );
      })}

      {/* ── CE pill nodes ── */}
      {NODES.filter((n) => n.kind === 'ce').map((n) => {
        const active = isNodeActive(n);
        const hw = CE_W / 2;
        const hh = CE_H / 2;
        const dur = nodeDuration(n);

        return (
          <g key={n.id} className={active ? 'sm-active' : undefined}>
            <rect
              x={n.x - hw} y={n.y - hh}
              width={CE_W} height={CE_H}
              rx={9}
              fill={active ? CE_COLOR : 'transparent'}
              stroke={CE_COLOR}
              strokeWidth={active ? 1 : 0.5}
              opacity={active ? 0.8 : 0.35}
            />
            <foreignObject x={n.x - hw} y={n.y - hh} width={CE_W} height={CE_H}>
              <div style={ceNodeStyle}>
                <NodeIcon name={n.icon} size={8} color={active ? T.textPrimary : CE_COLOR} />
                <span style={{ fontSize: 7, color: active ? T.textPrimary : CE_COLOR, lineHeight: 1, opacity: active ? 1 : 0.7 }}>
                  {n.label}
                </span>
              </div>
            </foreignObject>
            {dur && (
              <text
                x={n.x + hw + 4} y={n.y + 3}
                textAnchor="start"
                fill={active ? T.accent : T.textTertiary}
                fontSize={6}
                fontFamily={T.fontMono}
              >
                {dur}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ── Helpers ── */

function NodeIcon({ name, size, color }: { name: string; size: number; color: string }) {
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon size={size} color={color} strokeWidth={1.5} />;
}

const phaseNodeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  gap: 3,
};

const ceNodeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  gap: 2,
};
