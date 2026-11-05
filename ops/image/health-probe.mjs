import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { embeddedDatabaseTarget, stagingDatabaseOnly } from './staging-mode.mjs';
import { get } from 'node:http';

const maximumBodyBytes = 512;

// Readiness is local even when the app uses an ambient proxy for external traffic.
try {
  if (stagingDatabaseOnly(process.env)) {
    const { user, database } = embeddedDatabaseTarget(process.env);
    await promisify(execFile)(
      'pg_isready',
      ['-h', '127.0.0.1', '-p', '5432', '-U', user, '-d', database, '-t', '2'],
      { env: { PATH: process.env.PATH, LANG: process.env.LANG }, timeout: 4000, windowsHide: true },
    );
  } else {
    const selectedPort = process.env.PORT ?? '3000';
    const port = Number(selectedPort);
    if (!/^[1-9]\d{0,4}$/.test(selectedPort) || port > 65_535) throw new Error('Invalid port.');
    const signal = AbortSignal.timeout(4_000);
    const response = await new Promise((resolve, reject) => {
      const request = get(
        { hostname: '127.0.0.1', port, path: '/health', agent: false, signal },
        resolve,
      );
      request.once('error', reject);
    });
    try {
      const type = response.headers['content-type']?.split(';')[0]?.trim().toLowerCase();
      if (response.statusCode !== 200 || type !== 'application/json')
        throw new Error('Unexpected readiness response.');
      let size = 0;
      const chunks = [];
      for await (const chunk of response) {
        size += chunk.length;
        if (size > maximumBodyBytes) throw new Error('Oversized readiness response.');
        chunks.push(chunk);
      }
      if (!response.complete) throw new Error('Incomplete readiness response.');
      const body = JSON.parse(Buffer.concat(chunks, size).toString('utf8'));
      if (body?.status !== 'ready' || Object.keys(body).length !== 1)
        throw new Error('Unexpected readiness body.');
    } finally {
      response.destroy();
    }
  }
} catch {
  process.exitCode = 1;
}
