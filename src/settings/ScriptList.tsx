/**
 * ScriptList — Tab 1: Script selection list with cards.
 * Shows all saved scripts, allows selecting and deleting.
 */

import { useState } from 'react';
import { useSettingsStore } from './settings-store';
import { BUILTIN_SCRIPT_ID } from '../storage/seed';
import type { ScriptMetadata } from '../storage/storage-interface';
import { T } from '../theme';
import { Play, Trash2, Download } from 'lucide-react';

interface ScriptListProps {
  onStartGame: () => void;
}

const sourceBadges: Record<string, { label: string; color: string }> = {
  builtin: { label: '内置', color: T.info },
  uploaded: { label: '上传', color: T.success },
  generated: { label: '生成', color: T.gold },
};

export function ScriptList({ onStartGame }: ScriptListProps) {
  const scripts = useSettingsStore((s) => s.scripts);
  const activeScriptId = useSettingsStore((s) => s.activeScriptId);
  const activeScript = useSettingsStore((s) => s.activeScript);
  const selectScript = useSettingsStore((s) => s.selectScript);
  const deleteScript = useSettingsStore((s) => s.deleteScript);
  const storage = useSettingsStore((s) => s.storage);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (confirmDeleteId === id) {
      await deleteScript(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
    }
  };

  const handleDownload = async (id: string, name: string) => {
    const bundle = await storage.getScript(id);
    if (!bundle) return;
    const json = JSON.stringify(bundle, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/[/\\?%*:|"<>]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={styles.container}>
      {scripts.length === 0 ? (
        <p style={styles.emptyText}>暂无剧本，请上传或生成一个剧本。</p>
      ) : (
        <div style={styles.list}>
          {scripts.map((script) => (
            <ScriptCard
              key={script.id}
              script={script}
              isSelected={script.id === activeScriptId}
              onSelect={() => selectScript(script.id)}
              onDownload={() => handleDownload(script.id, script.name)}
              onDelete={
                script.id !== BUILTIN_SCRIPT_ID
                  ? () => handleDelete(script.id)
                  : undefined
              }
              isConfirmingDelete={confirmDeleteId === script.id}
            />
          ))}
        </div>
      )}

      {/* Start game button */}
      <button
        style={{
          ...styles.startBtn,
          opacity: activeScript ? 1 : 0.4,
        }}
        onClick={onStartGame}
        disabled={!activeScript}
      >
        <Play size={14} /> 开始游戏
        {activeScript && (
          <span style={styles.startBtnSub}>
            {' '}— {activeScript.metadata.name}
          </span>
        )}
      </button>
    </div>
  );
}

// ─── ScriptCard sub-component ──────────────────────────

function ScriptCard({
  script,
  isSelected,
  onSelect,
  onDownload,
  onDelete,
  isConfirmingDelete,
}: {
  script: ScriptMetadata;
  isSelected: boolean;
  onSelect: () => void;
  onDownload: () => void;
  onDelete?: () => void;
  isConfirmingDelete: boolean;
}) {
  const badge = sourceBadges[script.source] || sourceBadges.uploaded;

  return (
    <div
      style={{
        ...styles.card,
        ...(isSelected ? styles.cardSelected : {}),
      }}
      onClick={onSelect}
    >
      <div style={styles.cardHeader}>
        <span style={styles.cardName}>{script.name}</span>
        <span
          style={{
            ...styles.badge,
            background: `${badge.color}33`,
            color: badge.color,
            borderColor: `${badge.color}66`,
          }}
        >
          {badge.label}
        </span>
      </div>
      {script.description && (
        <p style={styles.cardDesc}>{script.description}</p>
      )}
      <div style={styles.cardFooter}>
        <span style={styles.cardMeta}>
          {script.updatedAt > 0
            ? new Date(script.updatedAt).toLocaleDateString('zh-CN')
            : '默认'}
        </span>
        <div style={styles.cardActions}>
          <button
            style={styles.actionBtn}
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            title="下载 JSON"
          >
            <Download size={12} />
          </button>
          {onDelete && (
            <button
              style={{
                ...styles.actionBtn,
                ...(isConfirmingDelete ? styles.deleteBtnConfirm : {}),
              }}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              {isConfirmingDelete ? '确认删除' : <Trash2 size={12} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    height: '100%',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: 1,
    overflow: 'auto',
  },
  emptyText: {
    color: T.textMuted,
    fontSize: '13px',
    textAlign: 'center',
    marginTop: '40px',
  },
  card: {
    padding: '12px 16px',
    background: T.bgSurface,
    border: 'none',
    borderRadius: T.radiusLg,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  cardSelected: {
    background: T.bgActive,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  cardName: {
    color: T.textPrimary,
    fontSize: '14px',
    fontWeight: 500,
  },
  badge: {
    padding: '2px 8px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderRadius: T.radiusLg,
    fontSize: '10px',
    whiteSpace: 'nowrap' as const,
  },
  cardDesc: {
    color: T.textTertiary,
    fontSize: '12px',
    margin: '6px 0 0',
    lineHeight: '1.4',
  },
  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '8px',
  },
  cardMeta: {
    color: T.textMuted,
    fontSize: '11px',
  },
  cardActions: {
    display: 'flex',
    gap: '4px',
  },
  actionBtn: {
    padding: '2px 8px',
    background: 'transparent',
    border: 'none',
    borderRadius: '4px',
    color: T.textTertiary,
    fontSize: '11px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  deleteBtnConfirm: {
    color: T.error,
    background: T.errorMuted,
  },
  startBtn: {
    padding: '14px 24px',
    background: T.accent,
    color: 'white',
    borderWidth: '0',
    borderStyle: 'none',
    borderRadius: T.radiusLg,
    fontSize: '16px',
    cursor: 'pointer',
    fontFamily: T.fontSerif,
    marginTop: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  startBtnSub: {
    fontSize: '12px',
    opacity: 0.8,
  },
};
