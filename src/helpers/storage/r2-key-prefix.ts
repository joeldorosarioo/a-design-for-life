export function isR2KeyPrefix(prefix: string): boolean {
  return (
    prefix.length <= 959 &&
    prefix
      .replace(/\/$/, '')
      .split('/')
      .every(
        (segment) =>
          segment.length > 0 && !segment.startsWith('.') && !/[^A-Za-z0-9_.-]/.test(segment),
      )
  );
}
