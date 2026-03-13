/**
 * ChapterEditor — edit chapter title and locations.
 */

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import { useEditorStore } from './editor-store';

interface ChapterEditorProps {
  ci: number;
}

export function ChapterEditor({ ci }: ChapterEditorProps) {
  const bundle = useEditorStore((s) => s.bundle);
  const dirty = useEditorStore((s) => s.dirty);

  if (!bundle) return null;
  const chapter = bundle.chapters[ci];
  if (!chapter) return null;

  const totalFrames = chapter.events.reduce(
    (sum, ev) => sum + (ev.frames?.length ?? 0), 0,
  );

  const forceUpdate = () => {
    // Trigger re-render by spreading bundle
    useEditorStore.setState((s) => ({
      bundle: s.bundle ? { ...s.bundle } : null,
      dirty: true,
    }));
  };

  const updateChapterName = (name: string) => {
    chapter.chapter = name;
    forceUpdate();
  };

  const updateLocation = (idx: number, field: 'id' | 'name', value: string) => {
    chapter.locations[idx][field] = value;
    forceUpdate();
  };

  const addLocation = () => {
    chapter.locations.push({ id: `loc-${chapter.locations.length + 1}`, name: '' });
    forceUpdate();
  };

  const removeLocation = (idx: number) => {
    chapter.locations.splice(idx, 1);
    forceUpdate();
  };

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-auto">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          {chapter.events.length} 事件
        </Badge>
        <Badge variant="outline" className="text-xs">
          {totalFrames} 帧
        </Badge>
      </div>

      <FieldGroup label="章节标题">
        <Input
          value={chapter.chapter}
          onChange={(e) => updateChapterName(e.target.value)}
        />
      </FieldGroup>

      <FieldGroup label="场景列表">
        <div className="flex flex-col gap-2">
          {chapter.locations.map((loc, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                className="flex-1"
                placeholder="ID"
                value={loc.id}
                onChange={(e) => updateLocation(idx, 'id', e.target.value)}
              />
              <Input
                className="flex-1"
                placeholder="名称"
                value={loc.name}
                onChange={(e) => updateLocation(idx, 'name', e.target.value)}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeLocation(idx)}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addLocation}>
            <Plus className="h-3.5 w-3.5 mr-1" /> 添加场景
          </Button>
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
