export function backgroundWorkerEnabled() {
  const explicit = String(process.env.APP_BACKGROUND_WORKER ?? '').trim();
  if (explicit) {
    return !['0', 'false', 'no', 'off'].includes(explicit.toLowerCase());
  }

  // PM2 cluster workers share the HTTP port safely. Only instance 0 runs
  // scheduled/background queues so adding API workers never duplicates jobs.
  const pm2Instance = String(process.env.NODE_APP_INSTANCE ?? '').trim();
  if (pm2Instance) return pm2Instance === '0';

  // Development/single-process starts keep background jobs enabled.
  return true;
}
