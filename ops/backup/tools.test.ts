import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { runBackupTool } from './tools';
const roots: string[] = [];
async function scratch() {
  const base = path.resolve('.work/backup-tool-tests');
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(path.join(base, 'process-'));
  roots.push(root);
  return root;
}
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (path.dirname(root) !== path.resolve('.work/backup-tool-tests'))
      throw new Error('Unsafe tool fixture cleanup');
    await rm(root, { recursive: true, force: true });
  }
});
it('runs the actual process without interpreting shell syntax in an argument', async () => {
  const result = await runBackupTool({
    binary: process.execPath,
    args: ['-e', 'process.stdout.write(process.argv[1])', 'literal $() ; & value'],
  });
  expect(result.stdout).toBe('literal $() ; & value');
});
it('streams real input to an exclusive output file', async () => {
  const root = await scratch(),
    input = path.join(root, 'input'),
    output = path.join(root, 'output');
  await writeFile(input, Buffer.alloc(200_000, 7));
  await runBackupTool({
    binary: process.execPath,
    args: ['-e', 'process.stdin.pipe(process.stdout)'],
    inputFile: input,
    outputFile: output,
  });
  expect(await readFile(output)).toEqual(Buffer.alloc(200_000, 7));
});
it('refuses an existing output before spawning and preserves its bytes', async () => {
  const root = await scratch(),
    output = path.join(root, 'output'),
    effect = path.join(root, 'effect');
  await writeFile(output, 'existing');
  await expect(
    runBackupTool({
      binary: process.execPath,
      args: ['-e', 'require("node:fs").writeFileSync(process.argv[1],"unsafe")', effect],
      outputFile: output,
    }),
  ).rejects.toThrow();
  expect(await readFile(output, 'utf8')).toBe('existing');
  await expect(readFile(effect)).rejects.toMatchObject({ code: 'ENOENT' });
});
it('refuses failed process output without exposing stderr or retaining a partial destination', async () => {
  const root = await scratch(),
    output = path.join(root, 'output');
  const failure = await runBackupTool({
    binary: process.execPath,
    args: [
      '-e',
      'process.stdout.write("partial"); process.stderr.write("AGE-SECRET-KEY-SYNTHETIC"); process.exit(3)',
    ],
    outputFile: output,
  }).then(
    () => null,
    (error) => error,
  );
  expect(failure).toBeInstanceOf(Error);
  expect(String(failure)).not.toContain('AGE-SECRET');
  await expect(readFile(output)).rejects.toMatchObject({ code: 'ENOENT' });
});
it('terminates only its own timed-out process and refuses completion', async () => {
  await expect(
    runBackupTool({
      binary: process.execPath,
      args: ['-e', 'setTimeout(()=>{},5000)'],
      timeoutMs: 50,
    }),
  ).rejects.toThrow();
});
it('bounds stdout captured in memory instead of accepting unlimited output', async () => {
  await expect(
    runBackupTool({
      binary: process.execPath,
      args: ['-e', 'process.stdout.write("x".repeat(100000))'],
    }),
  ).rejects.toThrow();
});
