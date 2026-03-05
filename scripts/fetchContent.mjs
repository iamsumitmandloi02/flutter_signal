import fs from 'node:fs/promises';

const OUT='src/content/questionBank.json';
const HEALTH='src/content/contentHealth.json';
const urls=['https://raw.githubusercontent.com/debasmitasarkar/flutter_interview_topics/main/README.md'];

const fallback=[{
  id:'fallback-network-restricted',level:'Senior',title:'Rendering performance strategy',prompt:'How do you reduce jank in complex Flutter screens?',topics:['performance'],followups:['How to verify with profiling?'],referenceAnswerSections:{theory:'Use build splitting, const, repaint boundaries, isolate expensive work and measure frame timings.',examples:['DevTools frame chart + trace events'],mistakes:['Ignoring raster thread bottlenecks'],diagrams:['UI Thread -> Raster Thread'],followups:['What metrics define success?']},sourceMarkdown:'Fallback because ingestion unavailable.'
}];

function parseMarkdown(md){
  const lines=md.split('\n'); const out=[]; let cur=null;
  for (const l of lines){
    if(/^##\s+/.test(l)){ if(cur) out.push(cur); cur={id:l.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),level:'Senior',title:l.replace(/^##\s+/,''),prompt:'',topics:[],followups:[],referenceAnswerSections:{theory:'',examples:[],mistakes:[],diagrams:[],followups:[]},sourceMarkdown:''}; continue;}
    if(!cur) continue;
    cur.sourceMarkdown += l+'\n';
    if(!cur.prompt && /\?$/.test(l.trim())) cur.prompt=l.trim();
    if(/tradeoff|performance|state|testing/i.test(l)) cur.topics=[...new Set([...cur.topics,...(l.match(/tradeoff|performance|state|testing/ig)||[]).map(t=>t.toLowerCase())])];
    if(l.trim().startsWith('- ')) cur.referenceAnswerSections.mistakes.push(l.trim().slice(2));
    if(l.startsWith('```')) cur.referenceAnswerSections.examples.push('code-block');
  }
  if(cur) out.push(cur);
  return out.filter(x=>x.title);
}

let bank=fallback; let health=[{id:fallback[0].id,status:'fallback'}];
try{
  const responses=await Promise.all(urls.map(u=>fetch(u)));
  const ok=responses.every(r=>r.ok);
  if(ok){
    const markdown=(await Promise.all(responses.map(r=>r.text()))).join('\n');
    const parsed=parseMarkdown(markdown);
    if(parsed.length){bank=parsed; health=parsed.map(p=>({id:p.id,status:p.prompt?'parsed':'fallback'}));}
  }
}catch{}

await fs.mkdir('src/content',{recursive:true});
await fs.writeFile(OUT, JSON.stringify(bank,null,2));
await fs.writeFile(HEALTH, JSON.stringify(health,null,2));
console.log(`questionBank entries: ${bank.length}`);
