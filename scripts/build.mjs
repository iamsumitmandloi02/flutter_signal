import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

execSync('node scripts/fetchContent.mjs', { stdio: 'inherit' });

await fs.rm('dist', { recursive: true, force: true });
await fs.mkdir('dist/src/content', { recursive: true });

for (const file of ['index.html']) {
  await fs.copyFile(file, `dist/${file}`);
}

for (const file of [
  'src/main.js',
  'src/spa.js',
  'src/storage.js',
  'src/scoring.js',
  'src/scheduler.js',
  'src/pwa.js',
  'src/styles.css',
  'src/content/questionBank.json',
  'src/content/contentHealth.json'
]) {
  await fs.copyFile(file, `dist/${file}`);
}

for (const file of ['public/sw.js', 'public/manifest.webmanifest']) {
  if (existsSync(file)) {
    await fs.copyFile(file, `dist/${file.replace('public/', '')}`);
  }
}

for (const required of ['dist/src/content/questionBank.json', 'dist/src/content/contentHealth.json']) {
  if (!existsSync(required)) {
    throw new Error(`Build failed: missing required artifact ${required}`);
  }
}

console.log('Build complete -> dist');
