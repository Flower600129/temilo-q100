import { QlooAdapter } from '../../../../../src/qloo/adapter.server';
import { qlooRoute } from '../../../../../src/qloo/http.server';
export async function POST(request: Request) { return qlooRoute(request, (input) => new QlooAdapter().resolve(input)); }
