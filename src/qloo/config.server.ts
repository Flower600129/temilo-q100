
// Event credentials require this exact host; production and staging use separate keys.
export const approvedHosts = ['https://hackathon.api.qloo.com', 'https://api.qloo.com', 'https://staging.api.qloo.com'];
export function qlooConfigStatus() {
  if (!process.env.QLOO_API_KEY?.trim()) return { status: 'blocked' as const, reason: 'missing_key' as const };
  if (!process.env.QLOO_BASE_URL?.trim()) return { status: 'blocked' as const, reason: 'missing_base_url' as const };
  if (!approvedHosts.includes(process.env.QLOO_BASE_URL.trim().replace(/\/$/, ''))) return { status: 'blocked' as const, reason: 'invalid_configuration' as const };
  return { status: 'configured_unverified' as const, reason: null };
}
