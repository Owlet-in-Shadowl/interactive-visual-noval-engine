/**
 * ChapterEditor — edit chapter title, ID, locations, and branching (next/divergence).
 */

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Plus, Trash2, GitBranch } from 'lucide-react';
import { useEditorStore } from './editor-store';
import type { DivergencePoint, BranchOption } from '../storage/storage-interface';

interface ChapterEditorProps {
  ci: number;
}

export function ChapterEditor({ ci }: ChapterEditorProps) {
  const bundle = useEditorStore((s) => s.bundle);
  const updateChapter = useEditorStore((s) => s.updateChapter);

  if (!bundle) return null;
  const chapter = bundle.chapters[ci];
  if (!chapter) return null;

  const totalFrames = chapter.events.reduce(
    (sum, ev) => sum + (ev.frames?.length ?? 0), 0,
  );

  // All chapter IDs for dropdown (excluding current)
  const otherChapters = bundle.chapters
    .map((ch, i) => ({ id: ch.id ?? `chapter-${i}`, label: ch.chapter, index: i }))
    .filter((_, i) => i !== ci);

  const forceUpdate = () => {
    useEditorStore.setState((s) => ({
      bundle: s.bundle ? { ...s.bundle } : null,
      dirty: true,
    }));
  };

  const updateChapterName = (name: string) => {
    chapter.chapter = name;
    forceUpdate();
  };

  const updateChapterId = (id: string) => {
    updateChapter(ci, { id });
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

  // ─── Next / Divergence helpers ───

  const nextType = chapter.next === undefined
    ? 'auto'
    : typeof chapter.next === 'string'
      ? 'linear'
      : 'divergence';

  const setNextType = (type: 'auto' | 'linear' | 'divergence') => {
    if (type === 'auto') {
      updateChapter(ci, { next: undefined });
    } else if (type === 'linear') {
      const target = otherChapters[0]?.id ?? '';
      updateChapter(ci, { next: target });
    } else {
      const div: DivergencePoint = {
        branches: [
          { targetChapterId: otherChapters[0]?.id ?? '', label: '分支 A', gravityKeywords: [], gravityDescription: '', weight: 1.0 },
          { targetChapterId: otherChapters[1]?.id ?? otherChapters[0]?.id ?? '', label: '分支 B', gravityKeywords: [], gravityDescription: '', weight: 1.0 },
        ],
        maxFreeActions: 5,
        defaultBranch: otherChapters[0]?.id ?? '',
      };
      updateChapter(ci, { next: div });
    }
  };

  const divergence = nextType === 'divergence' ? (chapter.next as DivergencePoint) : null;

  const updateBranch = (bi: number, patch: Partial<BranchOption>) => {
    if (!divergence) return;
    Object.assign(divergence.branches[bi], patch);
    forceUpdate();
  };

  const addBranch = () => {
    if (!divergence) return;
    divergence.branches.push({
      targetChapterId: otherChapters[0]?.id ?? '',
      label: `分支 ${String.fromCharCode(65 + divergence.branches.length)}`,
      gravityKeywords: [],
      gravityDescription: '',
      weight: 1.0,
    });
    forceUpdate();
  };

  const removeBranch = (bi: number) => {
    if (!divergence || divergence.branches.length <= 2) return;
    divergence.branches.splice(bi, 1);
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
        {nextType === 'divergence' && (
          <Badge variant="default" className="text-xs">
            <GitBranch className="h-3 w-3 mr-1" /> 分歧点
          </Badge>
        )}
      </div>

      <FieldGroup label="章节 ID">
        <Input
          value={chapter.id ?? ''}
          onChange={(e) => updateChapterId(e.target.value)}
          placeholder="auto-generated"
          className="font-mono text-xs"
        />
      </FieldGroup>

      <FieldGroup label="章节标题">
        <Input
          value={chapter.chapter}
          onChange={(e) => updateChapterName(e.target.value)}
        />
      </FieldGroup>

      {/* ─── Next Chapter ─── */}
      <FieldGroup label="后继章节">
        <Select value={nextType} onValueChange={(v) => setNextType(v as 'auto' | 'linear' | 'divergence')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">按顺序（默认）</SelectItem>
            <SelectItem value="linear">指定章节</SelectItem>
            <SelectItem value="divergence">分歧点</SelectItem>
          </SelectContent>
        </Select>

        {nextType === 'linear' && (
          <Select
            value={typeof chapter.next === 'string' ? chapter.next : ''}
            onValueChange={(v) => updateChapter(ci, { next: v })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="选择目标章节" />
            </SelectTrigger>
            <SelectContent>
              {otherChapters.map((ch) => (
                <SelectItem key={ch.id} value={ch.id}>
                  {ch.label} ({ch.id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FieldGroup>

      {/* ─── Divergence Point Config ─── */}
      {divergence && (
        <div className="flex flex-col gap-3 p-3 rounded-md border border-border bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">分歧点配置</span>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">自由行动轮数</label>
              <Input
                type="number"
                className="w-16 h-7 text-xs"
                value={divergence.maxFreeActions}
                onChange={(e) => {
                  divergence.maxFreeActions = Number(e.target.value) || 5;
                  forceUpdate();
                }}
              />
            </div>
          </div>

          <FieldGroup label="默认分支">
            <Select
              value={divergence.defaultBranch}
              onValueChange={(v) => { divergence.defaultBranch = v; forceUpdate(); }}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {otherChapters.map((ch) => (
                  <SelectItem key={ch.id} value={ch.id}>
                    {ch.label} ({ch.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldGroup>

          {/* Branches */}
          {divergence.branches.map((branch, bi) => (
            <div key={bi} className="flex flex-col gap-2 p-2 rounded border border-border bg-background">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">分支 {bi + 1}</span>
                {divergence.branches.length > 2 && (
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeBranch(bi)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <FieldGroup label="标签">
                  <Input
                    className="h-7 text-xs"
                    value={branch.label}
                    onChange={(e) => updateBranch(bi, { label: e.target.value })}
                  />
                </FieldGroup>
                <FieldGroup label="目标章节">
                  <Select
                    value={branch.targetChapterId}
                    onValueChange={(v) => updateBranch(bi, { targetChapterId: v })}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {otherChapters.map((ch) => (
                        <SelectItem key={ch.id} value={ch.id}>
                          {ch.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldGroup>
              </div>

              <FieldGroup label="引力关键词（逗号分隔）">
                <Input
                  className="h-7 text-xs"
                  value={branch.gravityKeywords.join(', ')}
                  onChange={(e) => updateBranch(bi, {
                    gravityKeywords: e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
                  })}
                  placeholder="信任, 合作, 一起"
                />
              </FieldGroup>

              <FieldGroup label="引力描述（给 LLM 判定用）">
                <Textarea
                  className="text-xs min-h-[48px]"
                  value={branch.gravityDescription}
                  onChange={(e) => updateBranch(bi, { gravityDescription: e.target.value })}
                  placeholder="玩家倾向于信任莉娅，愿意与她合作调查"
                />
              </FieldGroup>

              <FieldGroup label={`权重: ${branch.weight.toFixed(1)}`}>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  value={branch.weight}
                  onChange={(e) => updateBranch(bi, { weight: Number(e.target.value) })}
                  className="w-full h-2 accent-primary"
                />
              </FieldGroup>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addBranch}>
            <Plus className="h-3.5 w-3.5 mr-1" /> 添加分支
          </Button>
        </div>
      )}

      {/* ─── Locations ─── */}
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
