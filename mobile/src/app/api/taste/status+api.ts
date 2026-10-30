import { qlooConfigStatus } from '../../../../../src/qloo/config.server';
export function GET() { return Response.json(qlooConfigStatus(), { headers: { 'Cache-Control': 'no-store' } }); }
