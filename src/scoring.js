const dims=['clarity','correctness','depth','tradeoffs','performance','testing','architecture'];

export function evaluateAttempt(text, question){
  const answer = (text||'').toLowerCase();
  const scores = Object.fromEntries(dims.map(d=>[d,1]));
  if(answer.length>60) scores.clarity=2;
  if(answer.includes('tradeoff')) scores.tradeoffs=3;
  if(answer.includes('test')) scores.testing=3;
  if(answer.includes('perf')||answer.includes('jank')||answer.includes('frame')) scores.performance=3;
  if(answer.includes('edge')||answer.includes('production')) scores.depth=3;
  if(answer.includes('state')||answer.includes('architecture')) scores.architecture=3;
  if(answer.includes('widget')||answer.includes('render')) scores.correctness=3;
  const notes=[]; const feedback=[];
  if(!answer.includes('tradeoff')) feedback.push('Tradeoff gap: explicitly compare alternatives and costs.');
  const mistakes=(question.referenceAnswerSections.mistakes||[]).map(m=>m.toLowerCase());
  if(mistakes.length && !mistakes.some(m=>answer.includes(m.split(' ')[0]))) feedback.push('Pitfall gap: reference common mistakes directly.');
  if(question.topics?.includes('performance') && !(answer.includes('jank')||answer.includes('16ms')||answer.includes('frame'))) feedback.push('Performance gap: mention frame budget/jank mitigation.');
  feedback.push(`Next follow-up to rehearse: ${(question.followups&&question.followups[0])||'Explain tradeoffs for an alternate solution.'}`);
  const overall = Math.round((Object.values(scores).reduce((a,b)=>a+b,0)/(dims.length*4))*100);
  return {scores, notes, feedback, overall};
}

export function overallScore(rubrics){
  if(!rubrics.length) return 0;
  const vals = rubrics.map(r=>Object.values(r).reduce((a,b)=>a+b,0)/(dims.length*4)*100);
  return Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
}

export function readinessFromScore(score){
  if(score>=85) return 'Expert-ready';
  if(score>=70) return 'Senior-ready';
  if(score>=55) return 'Mid-ready';
  return 'Junior-building';
}
