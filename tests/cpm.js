/* ============================================================
   CPM CORE START  —  identico al modulo verificato con test
   ============================================================ */

function parseISO(s){const[y,m,d]=s.split('-').map(Number);return new Date(Date.UTC(y,m-1,d));}
function toISO(dt){return dt.toISOString().slice(0,10);}
function isWeekend(dt){const g=dt.getUTCDay();return g===0||g===6;}

function makeCalendar(startISO, holidays){
  const holiSet=new Set(holidays||[]);
  const start=parseISO(startISO);
  function isWorking(dt){return !isWeekend(dt)&&!holiSet.has(toISO(dt));}
  let cursor=new Date(start.getTime()),guard=0;
  while(!isWorking(cursor)&&guard++<3650) cursor=new Date(cursor.getTime()+86400000);
  const origin=cursor,cache=[];
  function dateOfIndex(i){
    if(i<0)i=0;
    if(cache.length===0)cache.push(new Date(origin.getTime()));
    while(cache.length<=i){
      let d=new Date(cache[cache.length-1].getTime()+86400000),g=0;
      while(!isWorking(d)&&g++<3650)d=new Date(d.getTime()+86400000);
      cache.push(d);
    }
    return cache[i];
  }
  function indexOfDate(iso){
    const target=parseISO(iso);
    if(target<=origin)return 0;
    let i=0; while(dateOfIndex(i)<target&&i<20000)i++;
    return i;
  }
  return {dateOfIndex,indexOfDate,isWorking,originISO:toISO(origin)};
}

function topoSort(tasks,links){
  const indeg=new Map(),out=new Map();
  tasks.forEach(t=>{indeg.set(t.id,0);out.set(t.id,[]);});
  for(const l of links){
    if(!indeg.has(l.from)||!indeg.has(l.to))continue;
    out.get(l.from).push(l.to); indeg.set(l.to,indeg.get(l.to)+1);
  }
  const queue=[]; indeg.forEach((v,k)=>{if(v===0)queue.push(k);});
  const order=[];
  while(queue.length){
    const id=queue.shift(); order.push(id);
    for(const nxt of out.get(id)){
      indeg.set(nxt,indeg.get(nxt)-1);
      if(indeg.get(nxt)===0)queue.push(nxt);
    }
  }
  if(order.length===tasks.length)return {order,cycle:null};
  const remaining=new Set(tasks.map(t=>t.id).filter(id=>!order.includes(id)));
  const path=[],onPath=new Set(); let found=null;
  function dfs(id){
    if(found)return;
    if(onPath.has(id)){found=path.slice(path.indexOf(id)).concat([id]);return;}
    if(!remaining.has(id))return;
    onPath.add(id);path.push(id);
    for(const nxt of out.get(id)||[])dfs(nxt);
    onPath.delete(id);path.pop();
  }
  for(const id of remaining){dfs(id);if(found)break;}
  return {order,cycle:found};
}

function reachability(tasks,links){
  const fwd=new Map(),bwd=new Map();
  tasks.forEach(t=>{fwd.set(t.id,[]);bwd.set(t.id,[]);});
  for(const l of links){
    if(!fwd.has(l.from)||!fwd.has(l.to))continue;
    fwd.get(l.from).push(l.to); bwd.get(l.to).push(l.from);
  }
  function walk(map,seed){
    const seen=new Set([seed]),stack=[seed];
    while(stack.length){const id=stack.pop();
      for(const n of map.get(id)||[])if(!seen.has(n)){seen.add(n);stack.push(n);}}
    return seen;
  }
  return {fromStart:walk(fwd,'START'),toEnd:walk(bwd,'END')};
}

function esFromLink(link,predES,predEF,succDur){
  const lag=link.lag||0;
  switch(link.type){
    case 'FS':return predEF+lag;
    case 'SS':return predES+lag;
    case 'FF':return predEF+lag-succDur;
    case 'SF':return predES+lag-succDur;
    default:  return predEF+lag;
  }
}
function lfFromLink(link,succLS,succLF,predDur){
  const lag=link.lag||0;
  switch(link.type){
    case 'FS':return succLS-lag;
    case 'SS':return succLS-lag+predDur;
    case 'FF':return succLF-lag;
    case 'SF':return succLF-lag+predDur;
    default:  return succLS-lag;
  }
}

function computeCPM(plan,opts){
  opts=opts||{};
  const threshold=opts.nearCriticalThreshold!=null?opts.nearCriticalThreshold:3;
  const tasks=plan.tasks,links=plan.links;
  const dur=id=>(plan.durations&&plan.durations[id])||0;
  const constraintOf=id=>(plan.constraints&&plan.constraints[id]!=null)?plan.constraints[id]:null;
  const errors=[],byId=new Map(tasks.map(t=>[t.id,t]));

  for(const l of links){
    if(!byId.has(l.from))errors.push({code:'LINK_FROM_MISSING',id:l.from,link:l});
    if(!byId.has(l.to))  errors.push({code:'LINK_TO_MISSING',id:l.to,link:l});
  }
  if(!byId.has('START'))errors.push({code:'START_MISSING'});
  if(!byId.has('END'))  errors.push({code:'END_MISSING'});

  const {order,cycle}=topoSort(tasks,links);
  if(cycle){errors.push({code:'CYCLE',path:cycle});return {errors,ok:false};}
  if(errors.length)return {errors,ok:false};

  const reach=reachability(tasks,links),warnings=[];
  for(const t of tasks){
    if(!reach.fromStart.has(t.id))warnings.push({code:'UNREACHABLE_FROM_START',id:t.id});
    if(!reach.toEnd.has(t.id))    warnings.push({code:'DOES_NOT_REACH_END',id:t.id});
  }

  const preds=new Map(tasks.map(t=>[t.id,[]])),succs=new Map(tasks.map(t=>[t.id,[]]));
  for(const l of links){preds.get(l.to).push(l);succs.get(l.from).push(l);}

  const ES={},EF={};
  for(const id of order){
    const d=dur(id); let es=0;
    for(const l of preds.get(id)){
      const cand=esFromLink(l,ES[l.from],EF[l.from],d);
      if(cand>es)es=cand;
    }
    const c=constraintOf(id);
    if(c!=null&&c>es)es=c;
    if(es<0)es=0;
    ES[id]=es; EF[id]=es+d;
  }

  const calcEnd=EF['END'];
  const projectEnd=(opts.imposedEndDay!=null)?opts.imposedEndDay:calcEnd;

  const LS={},LF={};
  for(let i=order.length-1;i>=0;i--){
    const id=order[i],d=dur(id),ss=succs.get(id);
    let lf;
    if(ss.length===0){lf=projectEnd;}
    else{lf=Infinity;
      for(const l of ss){const cand=lfFromLink(l,LS[l.to],LF[l.to],d);if(cand<lf)lf=cand;}}
    if(id==='END')lf=projectEnd;
    LF[id]=lf; LS[id]=lf-d;
  }

  const TF={},FF={};
  for(const t of tasks){
    TF[t.id]=LS[t.id]-ES[t.id];
    const ss=succs.get(t.id);
    if(ss.length===0){FF[t.id]=projectEnd-EF[t.id];}
    else{let m=Infinity;
      for(const l of ss){
        const need=esFromLink(l,ES[t.id],EF[t.id],dur(l.to));
        m=Math.min(m,ES[l.to]-need);
      }
      FF[t.id]=m;}
    if(FF[t.id]<0)FF[t.id]=0;
  }

  const minTF=Math.min(...tasks.map(t=>TF[t.id]));
  const critical={},nearCritical={},hypercritical={};
  for(const t of tasks){
    critical[t.id]=TF[t.id]===minTF&&minTF<=0?true:TF[t.id]===0;
    hypercritical[t.id]=TF[t.id]<0;
    nearCritical[t.id]=!critical[t.id]&&!hypercritical[t.id]&&TF[t.id]<=threshold;
  }

  let variance=0;
  for(const t of tasks){
    if(!critical[t.id]&&!hypercritical[t.id])continue;
    const e=plan.threePoint&&plan.threePoint[t.id];
    if(e){const sd=(e.pessimistic-e.optimistic)/6;variance+=sd*sd;}
  }

  return {ok:true,errors:[],warnings,ES,EF,LS,LF,TF,FF,
    critical,nearCritical,hypercritical,
    calculatedEndDay:calcEnd,projectEndDay:projectEnd,
    minTotalFloat:minTF,criticalPathStdDev:Math.sqrt(variance),order};
}


/* ---------- simulazione Monte Carlo ---------- */

function triangularSample(o, m, p, rnd) {
  if (p === o) return o;
  const f = (m - o) / (p - o);
  const u = rnd();
  return u < f
    ? o + Math.sqrt(u * (p - o) * (m - o))
    : p - Math.sqrt((1 - u) * (p - o) * (p - m));
}

function simulate(plan, opts, iterations, seed) {
  iterations = iterations || 2000;
  let s = seed || 123456789;
  const rnd = () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 1000000) / 1000000;
  };
  const ends = [], critCount = {};
  plan.tasks.forEach(t => { critCount[t.id] = 0; });

  for (let i = 0; i < iterations; i++) {
    const durations = Object.assign({}, plan.durations);
    if (plan.threePoint) {
      for (const id in plan.threePoint) {
        const e = plan.threePoint[id];
        durations[id] = Math.max(0, Math.round(
          triangularSample(e.optimistic, e.mostLikely, e.pessimistic, rnd)));
      }
    }
    const r = computeCPM(Object.assign({}, plan, { durations }), opts);
    if (!r.ok) continue;
    ends.push(r.calculatedEndDay);
    plan.tasks.forEach(t => { if (r.critical[t.id]) critCount[t.id]++; });
  }

  ends.sort((a, b) => a - b);
  const pct = q => ends.length ? ends[Math.min(ends.length - 1, Math.floor(q * ends.length))] : null;
  const criticalityIndex = {};
  plan.tasks.forEach(t => { criticalityIndex[t.id] = ends.length ? critCount[t.id] / ends.length : 0; });

  return { iterations: ends.length, p50: pct(0.5), p80: pct(0.8), p90: pct(0.9),
    min: ends[0], max: ends[ends.length - 1], distribution: ends, criticalityIndex };
}

/* CPM CORE END */

module.exports = { makeCalendar, topoSort, computeCPM, simulate, esFromLink, lfFromLink };
