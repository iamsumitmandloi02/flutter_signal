import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

execSync('node scripts/fetchContent.mjs', {stdio:'inherit'});
await fs.rm('dist',{recursive:true,force:true});
await fs.mkdir('dist/src/content',{recursive:true});
for (const f of ['index.html']) await fs.copyFile(f, `dist/${f}`);
for (const f of ['src/main.js','src/spa.js','src/storage.js','src/scoring.js','src/scheduler.js','src/pwa.js','src/styles.css','src/content/questionBank.json']) await fs.copyFile(f, `dist/${f}`);
for (const f of ['public/sw.js','public/manifest.webmanifest']) if(existsSync(f)) await fs.copyFile(f, `dist/${f.replace('public/','')}`);
console.log('Build complete -> dist');
