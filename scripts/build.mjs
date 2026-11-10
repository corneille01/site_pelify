// Assemble le site dans dist/ : pages statiques + application de réservation sous /arena/reserver/.
import { cpSync, rmSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// Tout ce qui est statique : pages, styles, scripts, images, vidéos, sitemap.
const skip = new Set(['node_modules', 'dist', 'apps', 'netlify', 'scripts', '.git', '.github', 'package.json', 'package-lock.json', 'netlify.toml', 'README.md', '.env', '.env.example', '.gitignore']);
for (const name of readdirSync(root)) {
  if (skip.has(name) || name.startsWith('.')) continue;
  cpSync(join(root, name), join(dist, name), { recursive: true });
}

// Application de réservation (Vite), servie sous /arena/reserver/.
execSync('npx vite build --outDir ../../dist/arena/reserver --emptyOutDir', {
  cwd: join(root, 'apps', 'live'),
  stdio: 'inherit',
  env: { ...process.env, APP_BASE: '/arena/reserver/' },
});
if (!existsSync(join(dist, 'arena', 'reserver', 'index.html'))) throw new Error('Application de réservation absente du dossier dist');
console.log('Site assemblé dans dist/');
