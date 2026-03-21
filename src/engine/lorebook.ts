/**
 * Lorebook (World Book) — keyword-triggered context injection.
 *
 * Scans recent scene text for keyword matches against lorebook entries.
 * Matched entries are injected into the Director's system prompt.
 */

import type { LorebookEntry } from '../storage/storage-interface';

/**
 * Find lorebook entries triggered by the given text.
 * Returns entries sorted by priority (highest first).
 */
export function matchLorebook(
  text: string,
  entries: LorebookEntry[],
): LorebookEntry[] {
  const lowerText = text.toLowerCase();
  const matched: LorebookEntry[] = [];

  for (const entry of entries) {
    if (!entry.enabled) continue;

    // Constant entries are always active
    if (entry.constant) {
      matched.push(entry);
      continue;
    }

    // Check primary keys — any match triggers
    const primaryHit = entry.keys.some((key) =>
      lowerText.includes(key.toLowerCase()),
    );

    if (!primaryHit) continue;

    // If selective mode, also need secondary key match
    if (entry.selective && entry.secondaryKeys?.length) {
      const secondaryHit = entry.secondaryKeys.some((key) =>
        lowerText.includes(key.toLowerCase()),
      );
      if (!secondaryHit) continue;
    }

    matched.push(entry);
  }

  // Sort by priority (highest first)
  return matched.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

/**
 * Build a context string from matched lorebook entries,
 * grouped by injection position.
 */
export function buildLorebookContext(
  entries: LorebookEntry[],
  position: LorebookEntry['position'],
): string {
  const relevant = entries.filter((e) => (e.position ?? 'after_persona') === position);
  if (relevant.length === 0) return '';
  return '\n\n【世界设定】\n' + relevant.map((e) => e.content).join('\n\n');
}
