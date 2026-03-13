/**
 * EventEditor — edit event metadata (name, time, description, severity, etc.)
 */

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useEditorStore } from './editor-store';
import type { WorldEvent } from '../memory/schemas';

interface EventEditorProps {
  ci: number;
  ei: number;
}

export function EventEditor({ ci, ei }: EventEditorProps) {
  const bundle = useEditorStore((s) => s.bundle);
  const updateEvent = useEditorStore((s) => s.updateEvent);

  if (!bundle) return null;
  const event = bundle.chapters[ci]?.events[ei];
  if (!event) return null;

  const patch = (p: Partial<WorldEvent>) => updateEvent(ci, ei, p);
  const frameCount = event.frames?.length ?? 0;

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-auto">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-mono text-xs">{event.id}</Badge>
        {frameCount > 0 && (
          <Badge variant="secondary" className="text-xs">{frameCount} frames</Badge>
        )}
      </div>

      <FieldGroup label="Name">
        <Input value={event.name} onChange={(e) => patch({ name: e.target.value })} />
      </FieldGroup>

      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="Time (分钟)">
          <Input
            type="number"
            value={event.time}
            onChange={(e) => patch({ time: Number(e.target.value) })}
          />
        </FieldGroup>
        <FieldGroup label="Severity">
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            value={event.severity}
            onChange={(e) => patch({ severity: e.target.value as WorldEvent['severity'] })}
          >
            <option value="minor">minor</option>
            <option value="major">major</option>
            <option value="critical">critical</option>
          </select>
        </FieldGroup>
      </div>

      <FieldGroup label="Location">
        <Input value={event.location} onChange={(e) => patch({ location: e.target.value })} />
      </FieldGroup>

      <FieldGroup label="Description">
        <Textarea
          className="min-h-[80px]"
          value={event.description}
          onChange={(e) => patch({ description: e.target.value })}
        />
      </FieldGroup>

      <FieldGroup label="Anchor Level">
        <select
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          value={event.anchorLevel ?? 'strong'}
          onChange={(e) => patch({ anchorLevel: e.target.value as WorldEvent['anchorLevel'] })}
        >
          <option value="fixed">fixed — 不可改变</option>
          <option value="strong">strong — AI须收敛</option>
          <option value="soft">soft — 可跳过</option>
        </select>
      </FieldGroup>

      <FieldGroup label="Affected Characters">
        <div className="flex flex-wrap gap-1.5">
          {bundle.characters.map((c) => (
            <label key={c.core.id} className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={event.affectedCharacters?.includes(c.core.id) ?? false}
                onChange={() => {
                  const current = event.affectedCharacters ?? [];
                  const next = current.includes(c.core.id)
                    ? current.filter((id) => id !== c.core.id)
                    : [...current, c.core.id];
                  patch({ affectedCharacters: next });
                }}
                className="accent-primary"
              />
              {c.core.id}
            </label>
          ))}
        </div>
      </FieldGroup>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
