/**
 * ScriptEditor — full-screen editor with tree outline + side panel.
 * Layout C: VS Code-style two-panel layout.
 */

import { useEffect } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useEditorStore } from './editor-store';
import { EditorToolbar } from './EditorToolbar';
import { EditorTree } from './EditorTree';
import { EditorPanel } from './EditorPanel';

interface ScriptEditorProps {
  scriptId: string;
  onClose: () => void;
}

export function ScriptEditor({ scriptId, onClose }: ScriptEditorProps) {
  const load = useEditorStore((s) => s.load);
  const close = useEditorStore((s) => s.close);

  useEffect(() => {
    load(scriptId);
    return () => close();
  }, [scriptId, load, close]);

  return (
    <div className="flex flex-col h-full bg-background">
      <EditorToolbar onClose={onClose} />
      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        <ResizablePanel defaultSize={30} minSize={20}>
          <EditorTree />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={70}>
          <EditorPanel />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
