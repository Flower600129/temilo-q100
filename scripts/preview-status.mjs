const url = 'http://127.0.0.1:8082';
try {
  const response = await fetch(`${url}/api/taste/status`, { signal: AbortSignal.timeout(5000), redirect: 'error' });
  const value = await response.json();
  if (!response.ok || !['blocked', 'configured_unverified'].includes(value.status)) throw new Error('unexpected_service');
  console.log(`Preview is responding at ${url}/`);
  console.log(`Local Qloo configuration: ${value.status}${value.reason ? ` (${value.reason})` : ''}.`);
  console.log('This configuration check makes no upstream Qloo request and does not verify live API health.');
} catch (error) {
  const code = error.cause?.code ?? error.code ?? error.name;
  console.error(`Preview did not answer (${code}). In the project root run npm run dev and keep that terminal open.`);
  console.error('If the port is occupied, inspect lsof -nP -iTCP:8082 -sTCP:LISTEN before stopping the original terminal.');
  process.exitCode = 1;
}
