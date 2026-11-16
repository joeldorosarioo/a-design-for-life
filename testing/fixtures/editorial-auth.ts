import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { handleEndpoints } from 'payload';
import config from '@payload-config';
import { assertIsolatedTestEnvironment } from '../setup/test-environment';

export const authPassword = 'Synthetic-editorial-auth-password-123!';
function capturedMailDirectory() {
  return path.resolve(
    '.work/editorial-mail',
    createHash('sha256').update(process.env.DATABASE_URI!).digest('hex').slice(0, 16),
  );
}
export function authHTTP(
  endpoint: string,
  body: unknown,
  headers?: HeadersInit,
  payloadInstanceCacheKey = 'editorial-auth',
) {
  return handleEndpoints({
    config,
    payloadInstanceCacheKey,
    request: new Request(`${process.env.SITE_ORIGIN}/api/users/${endpoint}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: process.env.SITE_ORIGIN!, ...headers },
      body: JSON.stringify(body),
    }),
  });
}
export async function capturedMessages(email: string) {
  const directory = capturedMailDirectory();
  const files = await readdir(directory).catch(() => [] as string[]);
  const messages: { to: string; html: string; createdAt: number }[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const message = JSON.parse(await readFile(path.join(directory, file), 'utf8'));
    if (message.to === email) messages.push(message);
  }
  return messages.sort((a, b) => a.createdAt - b.createdAt);
}
export function capturedResetToken(html: string) {
  const match = /\/reset\/([a-f0-9]{40})/.exec(html);
  if (!match) throw new Error('Captured native reset link is missing');
  return match[1];
}
export async function disposeCapturedMessages(emails: string[]) {
  const directory = capturedMailDirectory();
  const files = await readdir(directory).catch(() => [] as string[]);
  for (const file of files) {
    if (!/^[a-f0-9-]{36}\.json$/.test(file)) continue;
    const target = path.join(directory, file);
    try {
      const message = JSON.parse(await readFile(target, 'utf8'));
      if (emails.includes(message.to) || message.createdAt < Date.now() - 15 * 60_000)
        await unlink(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}

export async function withUnavailableCapturedDelivery<T>(operation: () => Promise<T>): Promise<T> {
  assertIsolatedTestEnvironment(process.env);
  const root = path.resolve('.work/editorial-mail');
  const directory = capturedMailDirectory();
  const backup = `${directory}-fixture-${randomUUID()}`;
  if (!directory.startsWith(root + path.sep) || !backup.startsWith(root + path.sep))
    throw new Error('Capture fixture path rejected');
  await mkdir(root, { recursive: true });
  let moved = false;
  try {
    await rename(directory, backup);
    moved = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  try {
    await writeFile(directory, 'Synthetic local delivery fault fixture', { flag: 'wx' });
    return await operation();
  } finally {
    await unlink(directory).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
    if (moved) await rename(backup, directory);
  }
}

export async function ageCapturedMessages(email: string) {
  const directory = capturedMailDirectory();
  for (const file of await readdir(directory)) {
    if (!/^[a-f0-9-]{36}\.json$/.test(file)) continue;
    const target = path.join(directory, file);
    const message = JSON.parse(await readFile(target, 'utf8'));
    if (message.to === email)
      await writeFile(target, JSON.stringify({ ...message, createdAt: Date.now() - 16 * 60_000 }));
  }
}
