import { randomUUID } from 'node:crypto';
import { fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { expect, it } from 'vitest';
import { withPublicationWriter } from './publication-writer';

it('excludes a different process while the writer event loop is paused, then releases on exit', async () => {
  const identity = randomUUID();
  const children: ChildProcess[] = [];
  const owner = fork('testing/fixtures/publication-writer-child.ts', [], {
    execArgv: ['--conditions=react-server', '--import', 'tsx'],
    windowsHide: true,
    silent: true,
  });
  children.push(owner);
  const ready = once(owner, 'message');
  owner.send(identity);
  expect((await ready)[0]).toBe('acquired');
  try {
    const paused = once(owner, 'message');
    owner.send('pause');
    expect((await paused)[0]).toBe('paused');
    await expect(withPublicationWriter(identity, async () => 'overlap')).rejects.toThrow('busy');
    const exited = once(owner, 'exit');
    owner.kill();
    await exited;
    await expect(withPublicationWriter(identity, async () => 'recovered')).resolves.toBe(
      'recovered',
    );
  } finally {
    for (const child of children)
      if (child.exitCode === null && child.signalCode === null) {
        const exited = once(child, 'exit');
        child.kill();
        await exited;
      }
  }
});

it('releases the writer after an operation fails', async () => {
  const identity = randomUUID();
  await expect(
    withPublicationWriter(identity, async () => {
      throw new Error('failure');
    }),
  ).rejects.toThrow('failure');
  await expect(withPublicationWriter(identity, async () => 42)).resolves.toBe(42);
});

it('releases the cross-process writer after normal completion', async () => {
  const identity = randomUUID();
  const child = fork('testing/fixtures/publication-writer-child.ts', [], {
    execArgv: ['--conditions=react-server', '--import', 'tsx'],
    windowsHide: true,
    silent: true,
  });
  try {
    const acquired = once(child, 'message');
    child.send(identity);
    expect((await acquired)[0]).toBe('acquired');
    await expect(withPublicationWriter(identity, async () => null)).rejects.toThrow('busy');
    const exited = once(child, 'exit');
    child.send('finish');
    expect((await exited)[0]).toBe(0);
    await expect(withPublicationWriter(identity, async () => true)).resolves.toBe(true);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
  }
});

it.skipIf(process.platform !== 'linux')(
  'retains the Linux abstract-socket lock through actual SIGSTOP and SIGCONT',
  async () => {
    const identity = randomUUID();
    const child = fork('testing/fixtures/publication-writer-child.ts', [], {
      execArgv: ['--conditions=react-server', '--import', 'tsx'],
      silent: true,
    });
    try {
      const acquired = once(child, 'message');
      child.send(identity);
      expect((await acquired)[0]).toBe('acquired');
      child.kill('SIGSTOP');
      const { readFile } = await import('node:fs/promises');
      await expect
        .poll(async () => await readFile(`/proc/${child.pid}/status`, 'utf8'))
        .toMatch(/State:\s+T/);
      await expect(withPublicationWriter(identity, async () => null)).rejects.toThrow('busy');
      child.kill('SIGCONT');
      const exited = once(child, 'exit');
      child.send('finish');
      expect((await exited)[0]).toBe(0);
      await expect(withPublicationWriter(identity, async () => true)).resolves.toBe(true);
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        const exited = once(child, 'exit');
        child.kill('SIGKILL');
        await exited;
      }
    }
  },
);
