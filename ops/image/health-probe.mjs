// A readiness probe only. Database/R2 diagnostics are deliberately separate.
try {
  const response = await fetch(`http://127.0.0.1:${process.env.PORT ?? '3000'}/health`, {
    signal: AbortSignal.timeout(4_000),
    redirect: 'error',
  });
  const body = await response.json();
  if (response.status !== 200 || body?.status !== 'ready' || Object.keys(body).length !== 1)
    process.exitCode = 1;
} catch {
  process.exitCode = 1;
}
