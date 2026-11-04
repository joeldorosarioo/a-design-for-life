export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  await import('./payload.config');
  if (process.env.PUBLICATION_RETRY_WORKER_ENABLED === 'true') {
    const { registerRuntimePublicationRetryWorker } = await import('./config/publication-worker');
    registerRuntimePublicationRetryWorker();
  }
}
