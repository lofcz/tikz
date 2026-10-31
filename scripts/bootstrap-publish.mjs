/** First real npm publication, followed by GitHub OIDC trust. Run interactively. */
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--dry-run')) throw new Error('Usage: npm run bootstrap -- [--dry-run]');
const dryRun = args.includes('--dry-run');
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run this script with npm run bootstrap');
function run(args, capture = false) {
  const result = spawnSync(process.execPath, [npm, ...args], {
    cwd: root, stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(`npm ${args.join(' ')} failed${capture ? `: ${result.stderr}` : ''}`);
  return result.stdout;
}
const version = run(['--version'], true).trim().split('.').map(Number);
if (version[0] < 11 || (version[0] === 11 && version[1] < 19))
  throw new Error('Use npm >=11.19.0 for npm trust github');
run(['run', 'check']);
const trust = ['trust', 'github', manifest.name, '--file', 'release.yml', '--repo', 'lofcz/tikz', '--allow-publish', '--yes'];
if (dryRun) {
  run(['publish', '--dry-run', '--access', 'public']);
  console.log(`Ready: npm publish --access public\nThen: npm ${trust.join(' ')}`);
  process.exit(0);
}
// npm owns authentication and interactive 2FA; no tokens are copied into this repo.
run(['whoami']);
const existing = spawnSync(process.execPath, [npm, 'view', `${manifest.name}@${manifest.version}`, 'version', '--json'], { cwd: root, encoding: 'utf8' });
if (existing.status === 0 && JSON.parse(existing.stdout) === manifest.version)
  console.log(`${manifest.name}@${manifest.version} already published; configuring trust.`);
else {
  // Only a missing version is a reason to publish; registry/auth errors must stop.
  if (!/E404|No match found/.test(existing.stderr + existing.stdout))
    throw new Error('Cannot verify the existing npm version. Check npm authentication and registry connectivity.');
  run(['publish', '--access', 'public']);
}
run(trust);
run(['trust', 'list', manifest.name]);
console.log('Bootstrap complete. Future releases: gh workflow run release.yml -R lofcz/tikz -f release_type=patch');
