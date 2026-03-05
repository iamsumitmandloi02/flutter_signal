import fs from 'node:fs';
const required=['index.html','src/main.js','src/spa.js','.github/workflows/pages.yml'];
const missing=required.filter(f=>!fs.existsSync(f));
if(missing.length){console.error('Missing',missing);process.exit(1);} else console.log('Checks passed');
