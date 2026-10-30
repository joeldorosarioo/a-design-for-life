/** Public title shared by mapping and the editor's explicit slug suggestion. */
export function deriveCaseTitle(
  title?: string | null,
  titleEmphasis?: string | null,
): string | null {
  const emphasis = titleEmphasis?.trim();
  return emphasis ? [title?.trim(), emphasis].filter(Boolean).join(' ') : (title ?? null);
}
