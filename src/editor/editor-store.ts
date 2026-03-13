/**
 * Editor Store — manages script editing state.
 * Holds a mutable copy of ScriptBundle, tracks selection/expansion/dirty state.
 */

import { create } from 'zustand';
import type { ScriptBundle } from '../storage/storage-interface';
import type { WorldEvent } from '../memory/schemas';
import type { ParticipationFrame } from '../pf/schema';
import { useSettingsStore } from '../settings/settings-store';

// ─── Node ID helpers ──────────────────────────────────────

export function nodeId(type: 'chapter', ci: number): string;
export function nodeId(type: 'event', ci: number, ei: number): string;
export function nodeId(type: 'frame', ci: number, ei: number, fi: number): string;
export function nodeId(type: string, ci: number, ei?: number, fi?: number): string {
  if (type === 'chapter') return `ch-${ci}`;
  if (type === 'event') return `ch-${ci}-ev-${ei}`;
  return `ch-${ci}-ev-${ei}-fr-${fi}`;
}

export function parseNodeId(id: string): {
  type: 'chapter' | 'event' | 'frame';
  ci: number;
  ei: number;
  fi: number;
} {
  const parts = id.split('-');
  const ci = Number(parts[1]);
  if (parts.length === 2) return { type: 'chapter', ci, ei: -1, fi: -1 };
  const ei = Number(parts[3]);
  if (parts.length === 4) return { type: 'event', ci, ei, fi: -1 };
  const fi = Number(parts[5]);
  return { type: 'frame', ci, ei, fi };
}

// ─── Store ────────────────────────────────────────────────

interface EditorState {
  scriptId: string | null;
  bundle: ScriptBundle | null;
  dirty: boolean;
  selectedNode: string | null;
  expandedNodes: Set<string>;

  load(scriptId: string): Promise<void>;
  close(): void;
  selectNode(nodeId: string): void;
  toggleExpand(nodeId: string): void;

  updateEvent(ci: number, ei: number, patch: Partial<WorldEvent>): void;
  updateFrame(ci: number, ei: number, fi: number, patch: Partial<ParticipationFrame>): void;
  addFrame(ci: number, ei: number, afterIndex?: number): void;
  deleteFrame(ci: number, ei: number, fi: number): void;

  save(): Promise<void>;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  scriptId: null,
  bundle: null,
  dirty: false,
  selectedNode: null,
  expandedNodes: new Set<string>(),

  async load(scriptId: string) {
    const storage = useSettingsStore.getState().storage;
    const bundle = await storage.getScript(scriptId);
    if (!bundle) throw new Error(`Script ${scriptId} not found`);
    // Deep clone so edits don't affect the original
    const clone = JSON.parse(JSON.stringify(bundle)) as ScriptBundle;
    set({
      scriptId,
      bundle: clone,
      dirty: false,
      selectedNode: null,
      expandedNodes: new Set<string>(),
    });
  },

  close() {
    set({
      scriptId: null,
      bundle: null,
      dirty: false,
      selectedNode: null,
      expandedNodes: new Set<string>(),
    });
  },

  selectNode(id: string) {
    set({ selectedNode: id });
  },

  toggleExpand(id: string) {
    set((state) => {
      const next = new Set(state.expandedNodes);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { expandedNodes: next };
    });
  },

  updateEvent(ci: number, ei: number, patch: Partial<WorldEvent>) {
    const bundle = get().bundle;
    if (!bundle) return;
    const event = bundle.chapters[ci]?.events[ei];
    if (!event) return;
    Object.assign(event, patch);
    set({ bundle: { ...bundle }, dirty: true });
  },

  updateFrame(ci: number, ei: number, fi: number, patch: Partial<ParticipationFrame>) {
    const bundle = get().bundle;
    if (!bundle) return;
    const frames = bundle.chapters[ci]?.events[ei]?.frames;
    if (!frames || !frames[fi]) return;
    Object.assign(frames[fi], patch);
    set({ bundle: { ...bundle }, dirty: true });
  },

  addFrame(ci: number, ei: number, afterIndex?: number) {
    const bundle = get().bundle;
    if (!bundle) return;
    const event = bundle.chapters[ci]?.events[ei];
    if (!event) return;
    if (!event.frames) event.frames = [];
    const idx = afterIndex !== undefined ? afterIndex + 1 : event.frames.length;
    const newFrame: ParticipationFrame = {
      id: `pf-${event.id}-${String(event.frames.length + 1).padStart(3, '0')}`,
      eventId: event.id,
      speaker: null,
      content: { text: '', type: 'prose' },
      ratified: [],
    };
    event.frames.splice(idx, 0, newFrame);
    set({
      bundle: { ...bundle },
      dirty: true,
      selectedNode: nodeId('frame', ci, ei, idx),
    });
  },

  deleteFrame(ci: number, ei: number, fi: number) {
    const bundle = get().bundle;
    if (!bundle) return;
    const frames = bundle.chapters[ci]?.events[ei]?.frames;
    if (!frames || !frames[fi]) return;
    frames.splice(fi, 1);
    // Adjust selection
    const { selectedNode } = get();
    let nextSelected = selectedNode;
    if (selectedNode === nodeId('frame', ci, ei, fi)) {
      // Select previous frame, or event if no frames left
      if (frames.length === 0) nextSelected = nodeId('event', ci, ei);
      else if (fi > 0) nextSelected = nodeId('frame', ci, ei, fi - 1);
      else nextSelected = nodeId('frame', ci, ei, 0);
    }
    set({ bundle: { ...bundle }, dirty: true, selectedNode: nextSelected });
  },

  async save() {
    const { bundle, scriptId } = get();
    if (!bundle || !scriptId) return;
    bundle.metadata.updatedAt = Date.now();
    const storage = useSettingsStore.getState().storage;
    await storage.saveScript(bundle);
    // Refresh settings store script list
    await useSettingsStore.getState().refreshScripts();
    set({ dirty: false });
  },
}));
