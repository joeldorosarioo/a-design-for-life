// Runtime needs the served path, without importing build-time filesystem guards.
export function selectNextDistDir(input: Partial<NodeJS.ProcessEnv>): string {
  const selected = input.NEXT_TEST_DIST_DIR ?? '.work/next-build';
  if (
    selected !== '.work/next-build' &&
    !/^\.work\/next-tests\/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      selected,
    )
  )
    throw new Error('Unsafe Next build output refused.');
  return selected;
}
