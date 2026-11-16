const { globSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const result = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', '--test', '--test-concurrency=1', ...globSync('src/modules/**/*.test.ts')], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
