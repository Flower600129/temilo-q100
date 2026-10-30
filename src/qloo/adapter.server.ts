import { z } from 'zod';
import { approvedHosts } from './config.server';
import { exploreInput, resolveInput, type QlooEntity, type QlooResult, type ResolveResult } from './contracts';

export type QlooFailure = 'missing_key' | 'missing_base_url' | 'invalid_configuration' | 'unauthorized' | 'rate_limited' | 'upstream_error' | 'timeout' | 'network_error' | 'invalid_response';
export class QlooError extends Error {
  constructor(readonly reason: QlooFailure, readonly httpStatus = 503) {
    super(`Qloo request unavailable: ${reason}`);
  }
}
const entitySchema = z.object({
  entity_id: z.string().min(1).max(200), name: z.string().min(1).max(500),
  subtype: z.string().optional(), type: z.string().optional(), types: z.array(z.string()).optional(),
  query: z.object({ affinity: z.number().finite().optional(), explainability: z.record(z.string(), z.unknown()).optional() }).passthrough().optional(),
}).passthrough();
const responseSchema = z.object({
  success: z.boolean().optional(),
  results: z.union([z.array(entitySchema), z.object({ entities: z.array(entitySchema) }).passthrough()]),
  query: z.object({ explainability: z.record(z.string(), z.unknown()).optional() }).passthrough().optional(),
}).passthrough();

export class QlooAdapter {
  constructor(private options: { apiKey?: string; baseUrl?: string; fetcher?: typeof fetch; timeoutMs?: number } = {}) {}

  private async request(path: '/search' | '/v2/insights/', query: URLSearchParams): Promise<QlooResult> {
    const apiKey = (this.options.apiKey ?? process.env.QLOO_API_KEY)?.trim();
    const baseUrl = (this.options.baseUrl ?? process.env.QLOO_BASE_URL)?.trim().replace(/\/$/, '');
    if (!apiKey) throw new QlooError('missing_key');
    if (!baseUrl) throw new QlooError('missing_base_url');
    if (!approvedHosts.includes(baseUrl)) throw new QlooError('invalid_configuration');
    const requestedAt = new Date().toISOString();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 8000);
    try {
      const response = await (this.options.fetcher ?? fetch)(`${baseUrl}${path}?${query}`, {
        headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
        signal: controller.signal, cache: 'no-store', redirect: 'error',
      });
      if (response.status === 401 || response.status === 403) throw new QlooError('unauthorized');
      if (response.status === 429) throw new QlooError('rate_limited', 429);
      if (response.status === 404) return { status: 'no_match', provider: 'Qloo', requestedAt, entities: [], warnings: [] };
      if (!response.ok) throw new QlooError('upstream_error', 502);
      if (Number(response.headers.get('content-length')) > 2_000_000) throw new QlooError('invalid_response', 502);
      const body = await response.text();
      if (body.length > 2_000_000) throw new QlooError('invalid_response', 502);
      let json: unknown;
      try { json = JSON.parse(body); } catch { throw new QlooError('invalid_response', 502); }
      const parsed = responseSchema.safeParse(json);
      if (!parsed.success || parsed.data.success === false) throw new QlooError('invalid_response', 502);
      const values = Array.isArray(parsed.data.results) ? parsed.data.results : parsed.data.results.entities;
      const entities: QlooEntity[] = values.map((entity) => ({
        entityId: entity.entity_id, name: entity.name,
        entityType: entity.subtype ?? entity.types?.find((type) => type.startsWith('urn:entity:')) ?? (entity.type?.startsWith('urn:entity:') ? entity.type : undefined),
        ...(entity.query?.affinity !== undefined ? { score: entity.query.affinity, scoreField: 'query.affinity' } : {}),
        ...(entity.query?.explainability ? { explainability: entity.query.explainability } : {}),
      }));
      const warning = parsed.data.query?.explainability?.warning;
      return { status: entities.length ? 'success' : 'no_match', provider: 'Qloo', requestedAt, entities, warnings: typeof warning === 'string' ? [warning] : [] };
    } catch (error) {
      if (error instanceof QlooError) throw error;
      throw new QlooError(controller.signal.aborted ? 'timeout' : 'network_error');
    } finally { clearTimeout(timer); }
  }

  async resolve(input: unknown): Promise<ResolveResult> {
    const { interests } = resolveInput.parse(input);
    const matches: ResolveResult['matches'] = [];
    for (const interest of [...new Set(interests)]) {
      const result = await this.request('/search', new URLSearchParams({ query: interest, take: '5', sort_by: 'match' }));
      matches.push({ input: interest, result });
    }
    const unresolved = matches.filter((match) => !match.result.entities.length).map((match) => match.input);
    return { status: unresolved.length === matches.length ? 'no_match' : unresolved.length ? 'partial' : 'success', provider: 'Qloo', matches, unresolved };
  }

  async explore(input: unknown): Promise<QlooResult> {
    const { entityIds, targetCategory } = exploreInput.parse(input);
    return this.request('/v2/insights/', new URLSearchParams({
      'filter.type': targetCategory, 'signal.interests.entities': [...new Set(entityIds)].join(','),
      'feature.explainability': 'true', take: '5',
    }));
  }
}
