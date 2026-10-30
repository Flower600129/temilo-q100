// Compatibility entry: use the same fictional seed as the App and the current
// isolated browser suite. Historical five-person captures remain historical.
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const result = spawnSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test', '--project', 'mobile', '--grep', '@visual'], {
  cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: 'inherit',
});
process.exit(result.status ?? 1);
