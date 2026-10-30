import { spawnSync } from 'node:child_process';
// Never load local credentials or substitute a real key into exported bundles.
const result = spawnSync('npm', ['run', 'build'], { stdio: 'inherit', env: { ...process.env, EXPO_NO_DOTENV: '1', QLOO_API_KEY: '', QLOO_BASE_URL: '' } });
if (result.error) throw new Error('Could not start the Netlify Web export.');
process.exitCode = result.status ?? 1;
