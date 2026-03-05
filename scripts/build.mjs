import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const REQUIRED_CONTENT = ['src/content/questionBank.json', 'src/content/contentHealth.json'];

execSync('node scripts/fetchContent.mjs', { stdio: 'inherit' });

for (const file of REQUIRED_CONTENT) {
  if (!existsSync(file)) {
    throw new Error(`Missing required content file before build: ${file}`);
  }
}

await fs.rm('dist', { recursive: true, force: true });
await fs.mkdir('dist/src/content', { recursive: true });

for (const file of ['index.html']) {
  await fs.copyFile(file, `dist/${file}`);
}

for (const file of ['src/main.js', 'src/spa.js', 'src/storage.js', 'src/scoring.js', 'src/scheduler.js', 'src/pwa.js', 'src/styles.css', ...REQUIRED_CONTENT]) {
  await fs.copyFile(file, `dist/${file}`);
}

for (const file of ['public/sw.js', 'public/manifest.webmanifest']) {
  if (existsSync(file)) {
    await fs.copyFile(file, `dist/${file.replace('public/', '')}`);
  }
}

for (const file of REQUIRED_CONTENT.map((f) => `dist/${f}`)) {
  if (!existsSync(file)) {
    throw new Error(`Build failed: missing ${file} in dist output.`);
  }
}

console.log('Build complete -> dist');
