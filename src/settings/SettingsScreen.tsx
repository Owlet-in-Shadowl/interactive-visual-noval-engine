/**
 * SettingsScreen — Main settings container with tab navigation.
 * Tabs: 选择剧本 / 上传剧本 / 生成剧本
 */

import { useSettingsStore, type SettingsTab } from './settings-store';
import { ScriptList } from './ScriptList';
import { ScriptUpload } from './ScriptUpload';
import { ScriptGenerator } from './ScriptGenerator';
import { ModelConfigPanel } from './ModelConfig';
import { T } from '../theme';
import { BookOpen, Upload, Sparkles, Wrench, ArrowLeft } from 'lucide-react';

interface SettingsScreenProps {
  onBack: () => void;
  onStartGame: () => void;
}

const tabIcons: Record<SettingsTab, React.ReactNode> = {
  select: <BookOpen size={13} strokeWidth={1.5} />,
  upload: <Upload size={13} strokeWidth={1.5} />,
  generate: <Sparkles size={13} strokeWidth={1.5} />,
  model: <Wrench size={13} strokeWidth={1.5} />,
};

const tabs: { key: SettingsTab; label: string }[] = [
  { key: 'select', label: '选择剧本' },
  { key: 'upload', label: '上传剧本' },
  { key: 'generate', label: '生成剧本' },
  { key: 'model', label: '模型配置' },
];

export function SettingsScreen({ onBack, onStartGame }: SettingsScreenProps) {
  const currentTab = useSettingsStore((s) => s.currentTab);
  const setTab = useSettingsStore((s) => s.setTab);
  const error = useSettingsStore((s) => s.error);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={14} strokeWidth={1.5} /> 返回
        </button>
        <h2 style={styles.title}>设置</h2>
        <div style={{ width: 60 }} /> {/* spacer for centering */}
      </div>

      {/* Tab bar */}
      <div style={styles.tabBar}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            style={{
              ...styles.tabBtn,
              ...(currentTab === tab.key ? styles.tabBtnActive : {}),
            }}
            onClick={() => setTab(tab.key)}
          >
            {tabIcons[tab.key]} {tab.label}
          </button>
        ))}
      </div>

      {/* Error display */}
      {error && (
        <div style={styles.errorBar}>
          {error}
        </div>
      )}

      {/* Content */}
      <div style={styles.content}>
        {currentTab === 'select' && (
          <ScriptList onStartGame={onStartGame} />
        )}
        {currentTab === 'upload' && <ScriptUpload />}
        {currentTab === 'generate' && <ScriptGenerator />}
        {currentTab === 'model' && <ModelConfigPanel />}
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: T.bg,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: `1px solid ${T.border}`,
  },
  backBtn: {
    padding: '6px 12px',
    background: 'transparent',
    border: 'none',
    borderRadius: T.radius,
    color: T.textSecondary,
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  title: {
    color: T.textPrimary,
    fontSize: '18px',
    fontFamily: T.fontSerif,
    margin: 0,
    fontWeight: 560,
  },
  tabBar: {
    display: 'flex',
    gap: '4px',
    padding: '12px 20px',
    borderBottom: `1px solid ${T.borderSubtle}`,
  },
  tabBtn: {
    flex: 1,
    padding: '8px 12px',
    background: 'transparent',
    border: 'none',
    borderRadius: T.radius,
    color: T.textPrimary,
    fontSize: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
  },
  tabBtnActive: {
    background: T.bgActive,
  },
  errorBar: {
    margin: '8px 20px 0',
    padding: '8px 12px',
    background: T.errorMuted,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: T.error,
    borderRadius: T.radius,
    color: T.error,
    fontSize: '12px',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '16px 20px',
  },
};
