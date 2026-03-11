/**
 * Claude.ai-inspired design tokens for the visual novel engine.
 * Extracted from claude.ai dark mode: warm neutral dark palette with terracotta accent.
 */

export const T = {
  // Backgrounds — from claude.ai body rgb(38,38,36), surface rgb(48,48,46)
  bg: '#262624',
  bgSurface: '#30302e',
  bgElevated: '#3a3836',
  bgActive: '#141413',   // claude.ai active/selected state — near-black
  bgOverlay: 'rgba(0, 0, 0, 0.6)',

  // Borders — claude.ai uses rgba(222,220,209, 0.15) warm-tinted
  border: 'rgba(222,220,209,0.15)',
  borderSubtle: 'rgba(222,220,209,0.08)',
  borderStrong: 'rgba(222,220,209,0.25)',

  // Text — claude.ai primary rgb(250,249,245), secondary rgb(194,192,182), tertiary rgb(156,154,146)
  textPrimary: '#faf9f5',
  textSecondary: '#c2c0b6',
  textTertiary: '#9c9a92',
  textMuted: '#6b6965',

  // Accent (Anthropic terracotta)
  accent: '#d97757',
  accentMuted: 'rgba(217, 119, 87, 0.15)',
  accentBorder: 'rgba(217, 119, 87, 0.3)',
  accentText: '#e8956e',

  // Semantic
  success: '#6b9e78',
  successMuted: 'rgba(107, 158, 120, 0.15)',
  error: '#c75050',
  errorMuted: 'rgba(199, 80, 80, 0.12)',
  info: '#8ba4b8',
  infoMuted: 'rgba(139, 164, 184, 0.12)',

  // Special
  gold: '#c4956a',
  narration: '#9c9a92',
  speaker: '#d97757',

  // Typography — claude.ai uses system sans-serif
  fontSerif: '"Noto Serif SC", "Source Han Serif CN", Georgia, serif',
  fontSans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontMono: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, monospace',

  // Radii — claude.ai: button 6px, input 10px, card 20px
  radius: '6px',
  radiusLg: '10px',
  radiusXl: '20px',
  radiusPill: '100px',

  // Shadows — claude.ai input card shadow
  shadowCard: 'rgba(0,0,0,0.035) 0px 4px 20px 0px, rgba(222,220,209,0.15) 0px 0px 0px 0.5px',
} as const;
