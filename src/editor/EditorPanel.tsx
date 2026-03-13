/**
 * EditorPanel — right panel that routes to the appropriate sub-editor
 * based on the selected tree node.
 */

import { MousePointerClick } from 'lucide-react';
import { useEditorStore, parseNodeId } from './editor-store';
import { ChapterEditor } from './ChapterEditor';
import { EventEditor } from './EventEditor';
import { FrameEditor } from './FrameEditor';

export function EditorPanel() {
  const selectedNode = useEditorStore((s) => s.selectedNode);
  const bundle = useEditorStore((s) => s.bundle);

  if (!selectedNode || !bundle) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <MousePointerClick className="h-8 w-8" />
        <p className="text-sm">在左侧大纲中选择一个节点</p>
      </div>
    );
  }

  const parsed = parseNodeId(selectedNode);

  switch (parsed.type) {
    case 'chapter':
      return <ChapterEditor ci={parsed.ci} />;
    case 'event':
      return <EventEditor ci={parsed.ci} ei={parsed.ei} />;
    case 'frame':
      return <FrameEditor ci={parsed.ci} ei={parsed.ei} fi={parsed.fi} />;
  }
}
