function $(id){return document.getElementById(id);}

function parseTimeToMinutes(t){
  if(!t || !t.includes(':')) return null;
  const [hh,mm]=t.split(':').map(Number);
  if(Number.isNaN(hh)||Number.isNaN(mm)) return null;
  return hh*60+mm;
}
function minutesToTime(min){
  let m=((min%1440)+1440)%1440;
  const hh=String(Math.floor(m/60)).padStart(2,'0');
  const mm=String(Math.round(m%60)).padStart(2,'0');
  return `${hh}:${mm}`;
}
function log2(x){return Math.log(x)/Math.log(2);}

function halfLifeFromTier(tier){
  if(tier==='low') return 4.0;
  if(tier==='high') return 7.0;
  return 5.5;
}

function setActiveTab(containerId, tabId){
  const wrap=$(containerId);
  const buttons=wrap.querySelectorAll('[data-tab]');
  const panels=wrap.querySelectorAll('[data-panel]');
  buttons.forEach(b=>{
    const active=b.getAttribute('data-tab')===tabId;
    b.setAttribute('aria-selected', active ? 'true':'false');
  });
  panels.forEach(p=>{
    p.classList.toggle('active', p.getAttribute('data-panel')===tabId);
  });
  // update hash without jumping too hard
  history.replaceState(null,'',`#${tabId}`);
}

function initTabs(containerId, defaultTab){
  const wrap=$(containerId);
  const buttons=wrap.querySelectorAll('[data-tab]');
  buttons.forEach(b=>{
    b.addEventListener('click',()=>setActiveTab(containerId, b.getAttribute('data-tab')));
  });
  const hash=(location.hash||'').replace('#','');
  const desired = hash && wrap.querySelector(`[data-panel="${hash}"]`) ? hash : defaultTab;
  setActiveTab(containerId, desired);
}

// Simple line chart with Canvas
function drawLineChart(canvas, points, options){
  const ctx=canvas.getContext('2d');
  const w=canvas.width=canvas.clientWidth*2;   // high DPI
  const h=canvas.height=canvas.clientHeight*2;
  ctx.clearRect(0,0,w,h);

  const pad=40;
  const xmin=Math.min(...points.map(p=>p.x));
  const xmax=Math.max(...points.map(p=>p.x));
  const ymin=0;
  const ymax=Math.max(...points.map(p=>p.y))*1.08 || 1;

  function X(x){ return pad + (x-xmin)/(xmax-xmin||1) * (w-2*pad); }
  function Y(y){ return h-pad - (y-ymin)/(ymax-ymin||1) * (h-2*pad); }

  // grid
  ctx.globalAlpha=1;
  ctx.lineWidth=2;
  ctx.strokeStyle = '#e6e9ef';
  for(let i=0;i<=4;i++){
    const yy=pad + i*(h-2*pad)/4;
    ctx.beginPath(); ctx.moveTo(pad,yy); ctx.lineTo(w-pad,yy); ctx.stroke();
  }
  for(let i=0;i<=4;i++){
    const xx=pad + i*(w-2*pad)/4;
    ctx.beginPath(); ctx.moveTo(xx,pad); ctx.lineTo(xx,h-pad); ctx.stroke();
  }

  // axis labels
  ctx.fillStyle='#5f6b7a';
  ctx.font = '24px system-ui';
  ctx.fillText(options?.yLabel || 'mg remaining', pad, pad-10);

  // line
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 5;
  ctx.beginPath();
  points.forEach((p,i)=>{
    const xx=X(p.x), yy=Y(p.y);
    if(i===0) ctx.moveTo(xx,yy); else ctx.lineTo(xx,yy);
  });
  ctx.stroke();

  // highlight last point
  const last=points[points.length-1];
  ctx.fillStyle='#111827';
  ctx.beginPath(); ctx.arc(X(last.x), Y(last.y), 7, 0, Math.PI*2); ctx.fill();

  // x ticks
  ctx.fillStyle='#5f6b7a';
  ctx.font = '22px system-ui';
  const xticks=options?.xTicks || 6;
  for(let i=0;i<=xticks;i++){
    const x=xmin + i*(xmax-xmin)/xticks;
    const label = options?.xFormatter ? options.xFormatter(x) : String(Math.round(x));
    const xx=X(x);
    ctx.fillText(label, xx-12, h-10);
  }
}

// Helpers for caffeine math
function remainingFromDose(doseMg, hoursSince, halfLifeH){
  return doseMg * Math.pow(0.5, hoursSince/halfLifeH);
}
function sumRemaining(doses, tHours, halfLifeH){
  // doses: [{timeHours, mg}]
  let total=0;
  for(const d of doses){
    if(tHours >= d.timeHours){
      total += remainingFromDose(d.mg, tHours - d.timeHours, halfLifeH);
    }
  }
  return total;
}