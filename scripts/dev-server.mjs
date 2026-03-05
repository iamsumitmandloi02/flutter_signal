import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const port=5173;
http.createServer((req,res)=>{
  const p=req.url.split('?')[0];
  let rel=p.replace('/flutter_signal/','');
  if(rel===''||rel.endsWith('/')) rel+='index.html';
  let file=path.join(process.cwd(), rel);
  if(!fs.existsSync(file) || fs.statSync(file).isDirectory()) file=path.join(process.cwd(),'index.html');
  res.end(fs.readFileSync(file));
}).listen(port,'0.0.0.0',()=>console.log('dev server http://localhost:'+port+'/flutter_signal/'));
