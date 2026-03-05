export function pickSessionQuestions(bank, scheduler, targetLevel){
  const due = bank.filter(q=>!scheduler[q.id] || new Date(scheduler[q.id].nextDueAt||0)<=new Date());
  const byLevel = due.sort((a,b)=>lvlDist(a.level,targetLevel)-lvlDist(b.level,targetLevel));
  const selected = interleave(byLevel).slice(0,4);
  const modes=['spoken','spoken','written',Math.random()<0.3?'constraint':'written'];
  const follow = weakestQuestion(bank,scheduler);
  return [...selected.map((q,i)=>({question:q,mode:modes[i]})), {question: follow || bank[0], mode:'followup'}];
}

function lvlDist(a,b){const x=['Junior','Mid','Senior','Expert']; return Math.abs(x.indexOf(a)-x.indexOf(b));}

function interleave(list){
  const out=[]; const used=new Set();
  while(out.length<list.length){
    const next=list.find(q=>!used.has(q.id)&&(!out.length||q.topics?.[0]!==out[out.length-1].topics?.[0]));
    if(!next) break; used.add(next.id); out.push(next);
  }
  list.forEach(q=>{if(!used.has(q.id)) out.push(q)});
  return out;
}

function weakestQuestion(bank, scheduler){
  const ranked=Object.entries(scheduler).sort((a,b)=>(a[1].lastScore||0)-(b[1].lastScore||0));
  const id=ranked[0]?.[0]; return bank.find(q=>q.id===id);
}

export function updateSchedulerFromAttempt(item={}, overall, conf){
  const quality = Math.max(0, Math.min(5, Math.round((overall/20)+(conf-1))));
  const reps = quality<3?0:(item.repetitions||0)+1;
  const intervals=[1,3,7,14,30];
  const intervalDays = quality<3?1:intervals[Math.min(reps, intervals.length-1)];
  return {questionId:item.questionId,nextDueAt:new Date(Date.now()+intervalDays*86400000).toISOString(),intervalDays,ease:Math.max(1.3,(item.ease||2.5)+(quality-3)*0.1),repetitions:reps,lastScore:overall,priorityBoost:0};
}

export function nextDueLabel(scheduler){
  const next = Object.values(scheduler).sort((a,b)=>new Date(a.nextDueAt)-new Date(b.nextDueAt))[0];
  return next?new Date(next.nextDueAt).toLocaleDateString():'Today';
}
