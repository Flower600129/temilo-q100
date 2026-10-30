import { z } from 'zod';

export const targetCategories = ['urn:entity:book', 'urn:entity:brand', 'urn:entity:movie', 'urn:entity:artist'] as const;
export const resolveInput = z.object({ interests: z.array(z.string().trim().min(2).max(120)).min(1).max(3) }).strict();
export const exploreInput = z.object({ entityIds: z.array(z.uuid()).min(1).max(3), targetCategory: z.enum(targetCategories) }).strict();
export const publicEntitySchema = z.object({ entityId: z.string().min(1), name: z.string(), entityType: z.string().optional(), score: z.number().finite().optional(), scoreField: z.string().optional(), explainability: z.record(z.string(), z.unknown()).optional() });
export const qlooResultSchema = z.object({ status: z.enum(['success', 'no_match']), provider: z.literal('Qloo'), requestedAt: z.iso.datetime(), entities: z.array(publicEntitySchema), warnings: z.array(z.string()) });
export const resolveResultSchema = z.object({ status: z.enum(['success', 'partial', 'no_match']), provider: z.literal('Qloo'), matches: z.array(z.object({ input: z.string(), result: qlooResultSchema })), unresolved: z.array(z.string()) });
export type QlooEntity = {
  entityId: string; name: string; entityType?: string;
  score?: number; scoreField?: string; explainability?: Record<string, unknown>;
};
export type QlooResult = {
  status: 'success' | 'no_match'; provider: 'Qloo'; requestedAt: string;
  entities: QlooEntity[]; warnings: string[];
};
export type ResolveResult = {
  status: 'success' | 'partial' | 'no_match'; provider: 'Qloo';
  matches: Array<{ input: string; result: QlooResult }>; unresolved: string[];
};
