import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { QlooAdapter, QlooError } from '../src/qloo/client';
import { qlooConfigStatus } from '../src/qloo/config';

const { loadEnvConfig } = createRequire(import.meta.url)('@next/env') as typeof import('@next/env');
loadEnvConfig(process.cwd());
const config = qlooConfigStatus();
const report: Record<string, unknown> = {
  checkedAt: new Date().toISOString(), config, liveRequestsAttempted: false,
  source: 'Official Qloo documentation; actual network responses only when configured',
  documentation: [
    'https://github.com/qloo/docs-public/blob/main/reference/get-search.md',
    'https://github.com/qloo/docs-public/blob/main/reference/basic-insights-use-case.md',
    'https://github.com/qloo/docs-public/blob/main/reference/insights-api-deep-dive.md',
  ],
};

async function main() {
  const attempts: unknown[] = [];
  if (config.status === 'configured_unverified') {
    const adapter = new QlooAdapter();
    report.liveRequestsAttempted = true;
    report.host = process.env.QLOO_BASE_URL?.trim();
    const cases = [
      { interest: 'Frédéric Chopin', target: 'urn:entity:book' },
      { interest: 'Jane Austen', target: 'urn:entity:movie' },
      { interest: 'Studio Ghibli', target: 'urn:entity:brand' },
    ];
    for (const item of cases) {
      const attempt: Record<string, unknown> = { input: item.interest, target: item.target, search: { method: 'GET', path: '/search', parameters: { query: item.interest, take: 5, sort_by: 'match' } } };
      try {
        const resolved = await adapter.resolve({ interests: [item.interest] });
        attempt.searchResponse = resolved;
        const candidates = resolved.matches.flatMap((match) => match.result.entities);
        const exact = candidates.filter((entity) => entity.name.toLocaleLowerCase() === item.interest.toLocaleLowerCase());
        const selected = exact.length === 1 ? exact[0] : candidates.length === 1 ? candidates[0] : null;
        if (!selected) {
          attempt.status = candidates.length ? 'needs_disambiguation' : 'no_match';
        } else if (!selected.entityType || selected.entityType === item.target) {
          attempt.status = 'cross_domain_not_established';
        } else {
          attempt.selection = selected;
          attempt.insights = { method: 'GET', path: '/v2/insights/', parameters: { 'signal.interests.entities': selected.entityId, 'filter.type': item.target, 'feature.explainability': true, take: 5 } };
          const insights = await adapter.explore({ entityIds: [selected.entityId], targetCategory: item.target });
          attempt.insightsResponse = insights;
          attempt.status = insights.entities.some((entity) => entity.entityType === item.target) ? 'cross_domain_verified_relevance_requires_review' : 'no_verified_cross_domain_result';
        }
      } catch (error) {
        attempt.status = 'unavailable';
        attempt.reason = error instanceof QlooError ? error.reason : 'validation_or_execution_error';
      }
      attempts.push(attempt);
    }
  }
  report.attempts = attempts;
  await mkdir('docs/evidence', { recursive: true });
  await writeFile('docs/evidence/qloo-spike.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(config.status === 'blocked' ? `BLOCKED: ${config.reason}. No Qloo requests made.` : 'Live attempt evidence saved; inspect per-case status before claiming success.');
  console.log('Evidence: docs/evidence/qloo-spike.json (no credentials recorded).');
}
main().catch(() => { console.error('Spike could not write its report.'); process.exitCode = 1; });
