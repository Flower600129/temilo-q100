import Constants from 'expo-constants';
import { Platform } from 'react-native';
const reasons: Record<string, string> = {
  quota_exhausted: 'The demo’s daily exploration allowance has been used. Continue with your wishes and gift box, or try again tomorrow.',
  server_unavailable: 'The server is temporarily unavailable. Your saved records are kept; continue manually or retry later.',
  missing_key: 'Qloo is unavailable: the server key has not been configured. You can continue with wishes and your gift box.',
  missing_base_url: 'Qloo is unavailable: the server endpoint has not been configured.', invalid_configuration: 'The Qloo server configuration needs to be checked.',
  unauthorized: 'Qloo did not authorize this request. The server credentials need to be checked.', rate_limited: 'Qloo’s request limit was reached. Wait a little and retry.',
  timeout: 'Qloo took too long to respond. Please retry.', upstream_error: 'Qloo could not complete this request. Please retry later.',
  network_error: 'The server could not reach Qloo. Please retry.', invalid_response: 'The Qloo response could not be verified. No suggestions have been generated.',
};
export async function tasteRequest(path: 'resolve' | 'explore' | 'status', input?: unknown): Promise<unknown> {
  const host = Constants.expoConfig?.hostUri;
  const base = Platform.OS === 'web' ? '' : process.env.EXPO_PUBLIC_API_URL ?? (host ? `http://${host}` : '');
  if (Platform.OS !== 'web' && !base) throw new Error('Connect this app to its deployed API server before using Qloo.');
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(`${base}/api/taste/${path}`, { method: input ? 'POST' : 'GET', headers: input ? { 'Content-Type': 'application/json' } : undefined, body: input ? JSON.stringify(input) : undefined, signal: controller.signal });
    const json = await response.json();
    if (!response.ok || json.status === 'unavailable') throw new Error(reasons[json.reason] ?? 'The server could not complete this request. No verified Qloo results are available.');
    return json;
  } catch (cause) {
    if (controller.signal.aborted) throw new Error('The request timed out. Please retry.');
    if (cause instanceof SyntaxError || cause instanceof TypeError) throw new Error('The API server is unreachable. Please retry when the preview server is available.');
    throw cause;
  } finally { clearTimeout(timer); }
}
