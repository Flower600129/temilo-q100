// Hosting entry only: reuse the verified SDK54 production server unchanged.
// Render supplies the public HTTPS URL after allocating the service hostname.
if (process.env.RENDER !== 'true' || !process.env.RENDER_EXTERNAL_URL) {
  throw new Error('Use this entry on Render with its supplied RENDER_EXTERNAL_URL. For localhost use start:production.');
}
process.env.TEMILO_BIND = '0.0.0.0';
process.env.TEMILO_PUBLIC_ORIGIN ??= process.env.RENDER_EXTERNAL_URL;
process.env.TEMILO_QUOTA_FILE ??= '/var/data/temilo/qloo-quota.json';
process.env.PORT ??= '10000';
await import('./serve-production.mjs');
