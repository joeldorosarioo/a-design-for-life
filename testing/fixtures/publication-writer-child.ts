import { withPublicationWriter } from '../../src/helpers/payload/publication-writer';
process.once('message', async (identity: string) => {
  try {
    await withPublicationWriter(identity, async () => {
      process.send?.('acquired');
      await new Promise<void>((resolve) =>
        process.once('message', (command) => {
          if (command === 'pause') {
            process.send?.('paused');
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);
            process.send?.('resumed');
            process.once('message', () => resolve());
          } else resolve();
        }),
      );
    });
    process.exit(0);
  } catch (error) {
    process.send?.(error instanceof Error ? error.message : 'error');
    process.exit(1);
  }
});
