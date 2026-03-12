/**
 * FrameEditor — PF frame editing form.
 */

import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useEditorStore, nodeId } from './editor-store';
import type { ParticipationFrame, FrameType } from '../pf/schema';

const FRAME_TYPES: { value: FrameType; label: string }[] = [
  { value: 'line', label: '台词' },
  { value: 'prose', label: '叙述' },
  { value: 'thought', label: '心理' },
  { value: 'intertext', label: '互文' },
];

interface FrameEditorProps {
  ci: number;
  ei: number;
  fi: number;
}

export function FrameEditor({ ci, ei, fi }: FrameEditorProps) {
  const bundle = useEditorStore((s) => s.bundle);
  const updateFrame = useEditorStore((s) => s.updateFrame);
  const addFrame = useEditorStore((s) => s.addFrame);
  const deleteFrame = useEditorStore((s) => s.deleteFrame);
  const selectNode = useEditorStore((s) => s.selectNode);

  if (!bundle) return null;
  const event = bundle.chapters[ci]?.events[ei];
  const frames = event?.frames;
  if (!frames || !frames[fi]) return null;
  const frame: ParticipationFrame = frames[fi];
  const totalFrames = frames.length;

  const characters = bundle.characters.map((c) => c.core.id);

  const update = (patch: Partial<ParticipationFrame>) => updateFrame(ci, ei, fi, patch);
  const updateContent = (contentPatch: Partial<ParticipationFrame['content']>) => {
    update({ content: { ...frame.content, ...contentPatch } });
  };

  const toggleInArray = (arr: string[], value: string): string[] =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

  const goPrev = () => { if (fi > 0) selectNode(nodeId('frame', ci, ei, fi - 1)); };
  const goNext = () => { if (fi < totalFrames - 1) selectNode(nodeId('frame', ci, ei, fi + 1)); };

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-auto">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">{frame.id}</Badge>
        <span className="text-xs text-muted-foreground ml-auto">
          Frame {fi + 1} / {totalFrames}
        </span>
      </div>

      {/* Speaker + Type row */}
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="Speaker">
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={frame.speaker ?? '__null__'}
            onChange={(e) => update({ speaker: e.target.value === '__null__' ? null : e.target.value })}
          >
            <option value="__null__">旁白 (null)</option>
            {characters.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </FieldGroup>
        <FieldGroup label="Type">
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={frame.content.type}
            onChange={(e) => updateContent({ type: e.target.value as FrameType })}
          >
            {FRAME_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </FieldGroup>
      </div>

      {/* Text */}
      <FieldGroup label="Text (原文)">
        <Textarea
          className="min-h-[120px] font-serif"
          value={frame.content.text}
          onChange={(e) => updateContent({ text: e.target.value })}
        />
      </FieldGroup>

      {/* Stage + Emotion */}
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="Stage (舞台指示)">
          <Input
            value={frame.content.stage ?? ''}
            onChange={(e) => updateContent({ stage: e.target.value || undefined })}
            placeholder="可选"
          />
        </FieldGroup>
        <FieldGroup label="Emotion">
          <Input
            value={frame.content.emotion ?? ''}
            onChange={(e) => updateContent({ emotion: e.target.value || undefined })}
            placeholder="可选"
          />
        </FieldGroup>
      </div>

      {/* Addressee */}
      <FieldGroup label="Addressee">
        <select
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={frame.addressee ?? '__none__'}
          onChange={(e) => update({ addressee: e.target.value === '__none__' ? undefined : e.target.value })}
        >
          <option value="__none__">(无)</option>
          {characters.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </FieldGroup>

      {/* Participation arrays */}
      <FieldGroup label="Ratified (被认可参与者)">
        <div className="flex flex-wrap gap-1.5">
          {characters.map((c) => (
            <label key={c} className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={frame.ratified.includes(c)}
                onChange={() => update({ ratified: toggleInArray(frame.ratified, c) })}
                className="accent-primary"
              />
              {c}
            </label>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup label="Eavesdroppers (偷听者)">
        <div className="flex flex-wrap gap-1.5">
          {characters.map((c) => (
            <label key={c} className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={frame.eavesdroppers?.includes(c) ?? false}
                onChange={() => update({
                  eavesdroppers: toggleInArray(frame.eavesdroppers ?? [], c),
                })}
                className="accent-primary"
              />
              {c}
            </label>
          ))}
        </div>
      </FieldGroup>

      <Separator />

      {/* Navigation + actions */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={goPrev} disabled={fi === 0}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground">
          {fi + 1} / {totalFrames}
        </span>
        <Button variant="ghost" size="sm" onClick={goNext} disabled={fi === totalFrames - 1}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => addFrame(ci, ei, fi)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> 插入帧
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => { if (window.confirm('删除此帧？')) deleteFrame(ci, ei, fi); }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Field group helper ─────────────────────────────────

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
