import questionBank from './content/questionBank.json' with { type: 'json' };
import { db } from './storage.js';
import { evaluateAttempt, overallScore, readinessFromScore } from './scoring.js';
import { pickSessionQuestions, updateSchedulerFromAttempt, nextDueLabel } from './scheduler.js';

const BASE = '/flutter_signal/';
const appState = {
  settings: JSON.parse(localStorage.getItem('fs_settings') || '{"targetLevel":"Senior","dailyTime":"21:00","privacyAudio":true,"theme":"dark","demoMode":false}'),
  scheduler: JSON.parse(localStorage.getItem('fs_scheduler') || '{}'),
  attempts: [],
  profile: null,
  parsedHealth: JSON.parse(localStorage.getItem('fs_content_health') || '[]')
};

const routes = {
  '/': renderLanding,
  '/start': renderStart,
  '/session/today': renderSession,
  '/library': renderLibrary,
  '/signal': renderSignal,
  '/settings': renderSettings,
  '/content-health': renderContentHealth
};

export async function initApp() {
  appState.attempts = await db.getAttempts();
  window.addEventListener('popstate', render);
  document.body.addEventListener('click', onClick);
  render();
}

function navigate(path) {
  history.pushState({}, '', `${BASE}#${path}`);
  render();
}

function currentPath() {
  return location.hash.replace('#', '') || '/';
}

function shell(content) {
  return `<div class="app"><header><h1>Flutter Signal</h1><nav>
  <a data-nav="/">Home</a><a data-nav="/session/today">Today</a><a data-nav="/library">Library</a><a data-nav="/signal">Signal</a><a data-nav="/settings">Settings</a></nav></header>
  <main>${content}</main></div>`;
}

async function render() {
  const fn = routes[currentPath()] || (currentPath().startsWith('/review/') ? renderReview : renderLanding);
  document.getElementById('app').innerHTML = shell(await fn());
  bindDynamic();
}

function renderLanding() {
  return `<section><p class='thesis'>Earn a Flutter interview signal. Don't study. Prove it.</p>
  <button data-nav='/session/today'>Start Session</button>
  <button data-action='load-demo'>View Sample Signal Profile</button>
  <div class='cards'><article>Interview Tape</article><article>Rubric</article><article>Design Brief</article></div></section>`;
}

function renderStart() {
  const s = appState.settings;
  return `<section><h2>Onboarding</h2><label>Target level <select id='targetLevel'><option ${sel(s.targetLevel,'Junior')}>Junior</option><option ${sel(s.targetLevel,'Mid')}>Mid</option><option ${sel(s.targetLevel,'Senior')}>Senior</option><option ${sel(s.targetLevel,'Expert')}>Expert</option></select></label>
  <label>Daily session time <input id='dailyTime' type='time' value='${s.dailyTime}'/></label><button data-action='save-onboard'>Save</button></section>`;
}

function sel(v,x){return v===x?'selected':''}

function renderSession() {
  const picks = pickSessionQuestions(questionBank, appState.scheduler, appState.settings.targetLevel);
  appState.currentSession = picks;
  return `<section><h2>Today's 20-minute Signal Session</h2><p>Blocks: 2 spoken, 1 written, 1 challenge, 1 follow-up</p>
  <div id='session-list'>${picks.map((p,i)=>`<div class='card'><h3>${i+1}. ${p.mode}</h3><p>${p.question.title}</p><textarea id='ans-${p.question.id}' placeholder='Submit attempt before reveal'></textarea><label>Confidence 0-3<input type='range' min='0' max='3' value='1' id='conf-${p.question.id}'/></label><button data-action='record' data-q='${p.question.id}'>Record 60s</button><button data-action='submit-attempt' data-mode='${p.mode}' data-q='${p.question.id}'>Submit</button></div>`).join('')}</div></section>`;
}

function renderLibrary() {
  return `<section><h2>Practice Library</h2><input id='library-search' placeholder='search'/><div>${questionBank.map(q=>`<article><h3>${q.title}</h3><p>${q.level} • ${q.topics.join(', ')}</p><button data-action='train' data-q='${q.id}'>Train this</button></article>`).join('')}</div></section>`;
}

async function renderReview() {
  const id = currentPath().split('/').pop();
  const attempt = appState.attempts.find(a=>a.id===id);
  if(!attempt) return '<p>No attempt.</p>';
  const q = questionBank.find(x=>x.id===attempt.questionId);
  return `<section><h2>Review</h2><p>Score: ${attempt.overall}</p><ul>${attempt.systemFeedback.map(f=>`<li>${f}</li>`).join('')}</ul>
  <h3>Model Answer</h3><p>${q.referenceAnswerSections.theory}</p><h4>Miss checklist</h4><ul>${q.referenceAnswerSections.mistakes.map(m=>`<li>${m}</li>`).join('')}</ul></section>`;
}

async function renderSignal() {
  const items = appState.attempts;
  const score = overallScore(items.map(a=>a.rubricScores));
  const readiness = readinessFromScore(score);
  const sharePayload = btoa(unescape(encodeURIComponent(JSON.stringify({score, readiness, top: items.slice(-3)}))));
  const link = `${location.origin}${BASE}#${'/signal?payload='+sharePayload}`;
  return `<section><h2>Signal Profile</h2><p>7-minute manager view: score ${score} (${readiness})</p>
  <button data-action='copy-share' data-link='${link}'>Copy Share Link</button>
  <button data-action='download-report'>Download HTML Report</button>
  <div><h3>Interview Tape</h3>${items.filter(a=>a.audioBlobKey).map(a=>`<audio controls src='${a.audioUrl||''}'></audio>`).join('') || 'No audio yet'}</div>
  <div><h3>Highlights</h3><p>Best recent answers: ${items.slice(-2).map(a=>a.questionId).join(', ')}</p></div></section>`;
}

function renderSettings() {
  const s = appState.settings;
  return `<section><h2>Settings</h2><label><input id='privacyAudio' type='checkbox' ${s.privacyAudio?'checked':''}/> Include audio in share</label>
  <label><input id='demoMode' type='checkbox' ${s.demoMode?'checked':''}/> Load Demo Mode</label>
  <button data-action='save-settings'>Save</button><button data-action='reset'>Reset data</button>
  <button data-action='export'>Export JSON</button><input type='file' id='importFile'/><button data-action='import'>Import</button></section>`;
}

function renderContentHealth() {
  const health = appState.parsedHealth;
  return `<section><h2>Content Health</h2><p>Parsed cleanly vs fallback.</p>${health.map(h=>`<div>${h.id}: ${h.status}</div>`).join('') || '<p>No ingestion metadata; using fallback bank.</p>'}</section>`;
}

function onClick(e) {
  const nav = e.target.getAttribute('data-nav');
  if (nav) return navigate(nav);
  const action = e.target.getAttribute('data-action');
  if (!action) return;
  if (action === 'save-onboard') {
    appState.settings.targetLevel = document.getElementById('targetLevel').value;
    appState.settings.dailyTime = document.getElementById('dailyTime').value;
    persist(); navigate('/session/today');
  }
  if (action === 'submit-attempt') submitAttempt(e.target.dataset.q, e.target.dataset.mode);
  if (action === 'train') { const q=e.target.dataset.q; appState.scheduler[q]={...(appState.scheduler[q]||{}),priorityBoost:2,nextDueAt:new Date().toISOString()}; persist(); }
  if (action === 'copy-share') navigator.clipboard.writeText(e.target.dataset.link);
  if (action === 'download-report') downloadReport();
  if (action === 'save-settings') {appState.settings.privacyAudio=document.getElementById('privacyAudio').checked;appState.settings.demoMode=document.getElementById('demoMode').checked;persist();}
  if (action === 'reset') {localStorage.clear(); indexedDB.deleteDatabase('flutter-signal'); location.reload();}
  if (action === 'export') {
    const blob = new Blob([JSON.stringify({settings:appState.settings,scheduler:appState.scheduler,attempts:appState.attempts},null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob);a.download='flutter-signal-export.json';a.click();
  }
  if (action === 'import') {
    const file=document.getElementById('importFile').files[0]; if(!file) return;
    file.text().then(t=>{const data=JSON.parse(t); appState.settings=data.settings; appState.scheduler=data.scheduler; appState.attempts=data.attempts; persist(); location.reload();});
  }
  if (action === 'load-demo') {loadDemo(); navigate('/signal');}
}

let mediaRecorder; let chunks=[];
function bindDynamic(){
  document.querySelectorAll("button[data-action='record']").forEach(btn=>btn.onclick=async()=>{
    const stream = await navigator.mediaDevices.getUserMedia({audio:true});
    mediaRecorder = new MediaRecorder(stream); chunks=[];
    mediaRecorder.ondataavailable = e=>chunks.push(e.data);
    mediaRecorder.start();
    setTimeout(()=>mediaRecorder.stop(), 60000);
    mediaRecorder.onstop=async()=>{ const blob=new Blob(chunks,{type:'audio/webm'}); await db.putAudio(btn.dataset.q, blob); };
  });
}

async function submitAttempt(questionId, mode) {
  const textAnswer = document.getElementById(`ans-${questionId}`).value;
  const selfConfidence = Number(document.getElementById(`conf-${questionId}`).value);
  const question = questionBank.find(q=>q.id===questionId);
  const rubric = evaluateAttempt(textAnswer, question);
  const attempt = {
    id: crypto.randomUUID(), questionId, mode, createdAt:new Date().toISOString(), durationSec:120, textAnswer,
    audioBlobKey: await db.hasAudio(questionId) ? questionId : undefined, selfConfidence, rubricScores: rubric.scores,
    notes: rubric.notes, systemFeedback: rubric.feedback, overall: rubric.overall
  };
  appState.attempts.push(attempt);
  appState.scheduler[questionId] = updateSchedulerFromAttempt(appState.scheduler[questionId], rubric.overall, selfConfidence);
  await db.saveAttempt(attempt);
  persist(); navigate(`/review/${attempt.id}`);
}

function persist(){
  localStorage.setItem('fs_settings', JSON.stringify(appState.settings));
  localStorage.setItem('fs_scheduler', JSON.stringify(appState.scheduler));
}

function loadDemo() {
  if (appState.attempts.length) return;
  const sample = {id:crypto.randomUUID(),questionId:questionBank[0].id,mode:'written',createdAt:new Date().toISOString(),durationSec:300,textAnswer:'Demo strong answer with tradeoffs performance testing',selfConfidence:3,rubricScores:{clarity:3,correctness:3,depth:4,tradeoffs:3,performance:3,testing:3,architecture:3},notes:['Demo'],systemFeedback:['Great depth'],overall:85};
  appState.attempts.push(sample); db.saveAttempt(sample);
}

function downloadReport() {
  const html = `<!doctype html><html><body><h1>Flutter Signal Report</h1><p>Attempts: ${appState.attempts.length}</p><pre>${JSON.stringify(appState.attempts.slice(-5),null,2)}</pre></body></html>`;
  const blob = new Blob([html], {type:'text/html'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='flutter-signal-report.html'; a.click();
}
