/**
 * EditorToolbar — top bar with back button, script name, dirty indicator, save button.
 */

import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useEditorStore } from './editor-store';

interface EditorToolbarProps {
  onClose: () => void;
}

export function EditorToolbar({ onClose }: EditorToolbarProps) {
  const bundle = useEditorStore((s) => s.bundle);
  const dirty = useEditorStore((s) => s.dirty);
  const save = useEditorStore((s) => s.save);

  const handleClose = () => {
    if (dirty && !window.confirm('有未保存的修改，确认离开？')) return;
    onClose();
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card">
      <Button variant="ghost" size="sm" onClick={handleClose}>
        <ArrowLeft className="h-4 w-4 mr-1" /> 返回
      </Button>
      <Separator orientation="vertical" className="h-5" />
      <span className="text-sm font-medium text-foreground truncate flex-1">
        {bundle?.metadata.name ?? '加载中...'}
      </span>
      {dirty && (
        <span className="text-xs text-muted-foreground">未保存</span>
      )}
      <Button
        size="sm"
        disabled={!dirty}
        onClick={() => save()}
      >
        <Save className="h-3.5 w-3.5 mr-1" /> 保存
      </Button>
    </div>
  );
}
