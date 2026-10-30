import { QlooAdapter } from '@/qloo/client';
import { qlooRoute } from '@/qloo/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return qlooRoute(request, (input) => new QlooAdapter().explore(input));
}
