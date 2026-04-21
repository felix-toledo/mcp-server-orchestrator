import { CopilotClient } from '@github/copilot-sdk';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '../../../.env');

const env = Object.fromEntries(
  readFileSync(envPath, 'utf-8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#') && l.trim())
    .map((l) => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    }),
);

const token = env['COPILOT_GITHUB_TOKEN'];
if (!token) {
  console.error('No COPILOT_GITHUB_TOKEN found in .env');
  process.exit(1);
}

const client = new CopilotClient({ env: { COPILOT_GITHUB_TOKEN: token } });
await client.start();
const models = await client.listModels();
console.log('\nModelos disponibles:\n');
console.log(JSON.stringify(models, null, 2));
await client.stop();
