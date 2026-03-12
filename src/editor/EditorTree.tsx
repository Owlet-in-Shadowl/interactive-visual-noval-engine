/**
 * EditorTree — left panel collapsible tree outline.
 * Chapters > Events > Frames
 */

import {
  BookOpen,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Eye,
  Brain,
  Quote,
  Circle,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useEditorStore, nodeId } from './editor-store';
import type { FrameType } from '../pf/schema';

const frameTypeIcon: Record<FrameType, typeof MessageSquare> = {
  line: MessageSquare,
  prose: Eye,
  thought: Brain,
  intertext: Quote,
};

const severityColor: Record<string, string> = {
  minor: 'text-muted-foreground',
  major: 'text-yellow-500',
  critical: 'text-red-400',
};

export function EditorTree() {
  const bundle = useEditorStore((s) => s.bundle);
  const selectedNode = useEditorStore((s) => s.selectedNode);
  const expandedNodes = useEditorStore((s) => s.expandedNodes);
  const selectNode = useEditorStore((s) => s.selectNode);
  const toggleExpand = useEditorStore((s) => s.toggleExpand);

  if (!bundle) return null;

  return (
    <ScrollArea className="h-full">
      <div className="p-2 text-sm">
        {bundle.chapters.map((chapter, ci) => {
          const chId = nodeId('chapter', ci);
          const chExpanded = expandedNodes.has(chId);

          return (
            <div key={ci}>
              {/* Chapter node */}
              <button
                className={cn(
                  'flex items-center gap-1.5 w-full px-2 py-1 rounded-md text-left hover:bg-accent/50 transition-colors',
                  selectedNode === chId && 'bg-accent text-accent-foreground',
                )}
                onClick={() => selectNode(chId)}
                onDoubleClick={() => toggleExpand(chId)}
              >
                <span
                  className="cursor-pointer shrink-0"
                  onClick={(e) => { e.stopPropagation(); toggleExpand(chId); }}
                >
                  {chExpanded
                    ? <ChevronDown className="h-3.5 w-3.5" />
                    : <ChevronRight className="h-3.5 w-3.5" />}
                </span>
                <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{chapter.chapter}</span>
                <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
                  {chapter.events.length}
                </Badge>
              </button>

              {/* Events */}
              {chExpanded && chapter.events.map((event, ei) => {
                const evId = nodeId('event', ci, ei);
                const evExpanded = expandedNodes.has(evId);
                const frameCount = event.frames?.length ?? 0;

                return (
                  <div key={ei}>
                    {/* Event node */}
                    <button
                      className={cn(
                        'flex items-center gap-1.5 w-full pl-6 pr-2 py-1 rounded-md text-left hover:bg-accent/50 transition-colors',
                        selectedNode === evId && 'bg-accent text-accent-foreground',
                      )}
                      onClick={() => selectNode(evId)}
                      onDoubleClick={() => toggleExpand(evId)}
                    >
                      <span
                        className="cursor-pointer shrink-0"
                        onClick={(e) => { e.stopPropagation(); toggleExpand(evId); }}
                      >
                        {evExpanded
                          ? <ChevronDown className="h-3 w-3" />
                          : <ChevronRight className="h-3 w-3" />}
                      </span>
                      <Circle className={cn('h-2.5 w-2.5 fill-current shrink-0', severityColor[event.severity] ?? 'text-muted-foreground')} />
                      <span className="truncate text-xs">{event.name}</span>
                      {frameCount > 0 && (
                        <Badge variant="outline" className="ml-auto text-[10px] px-1 py-0">
                          {frameCount}
                        </Badge>
                      )}
                    </button>

                    {/* Frames */}
                    {evExpanded && event.frames?.map((frame, fi) => {
                      const frId = nodeId('frame', ci, ei, fi);
                      const Icon = frameTypeIcon[frame.content.type] ?? Eye;
                      const label = frame.speaker
                        ? `${frame.speaker}: ${frame.content.text.slice(0, 16)}`
                        : frame.content.text.slice(0, 20);

                      return (
                        <button
                          key={fi}
                          className={cn(
                            'flex items-center gap-1.5 w-full pl-11 pr-2 py-0.5 rounded-md text-left hover:bg-accent/50 transition-colors',
                            selectedNode === frId && 'bg-accent text-accent-foreground',
                          )}
                          onClick={() => selectNode(frId)}
                          style={{ contentVisibility: 'auto', containIntrinsicSize: '0 24px' }}
                        >
                          <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="truncate text-xs text-muted-foreground">
                            {label || '(空)'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
