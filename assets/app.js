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





(function(){

  function q(root, sel){
    return root.querySelector(sel);
  }

 
  window.initCutoffTool = function(root){
    if(!root) return;
    if(root.dataset.cutoffBound) return; // ��ֹ�ظ���
    root.dataset.cutoffBound = '1';

    var btn = q(root, '#calcCutoff');
    var out = q(root, '#cutoffOut');

    if(!btn || !out) return;

    function calcCutoff(){
      var bedtimeEl = q(root, '#bedtime');
      var doseEl    = q(root, '#dose');
      var targetEl  = q(root, '#target');
      var absorbEl  = q(root, '#absorb');
      var sensEl    = q(root, '#sens');

      var bedtimeMin = parseTimeToMinutes(bedtimeEl ? bedtimeEl.value : '');
      var dose   = Number(doseEl ? doseEl.value : 0);
      var target = Number(targetEl ? targetEl.value : 0);
      var absorb = Math.max(0, Number(absorbEl ? absorbEl.value : 0));

      var tier = sensEl ? sensEl.value : 'med';
      var halfLifeH = (tier === 'low') ? 4.0 : (tier === 'high') ? 7.0 : 5.5;

      out.style.display = 'block';

      if(bedtimeMin === null || !isFinite(dose) || !isFinite(target) || dose <= 0 || target <= 0){
        out.className = 'notice warn';
        out.innerHTML =
          '<strong>Please check your inputs.</strong>' +
          '<div class="muted">Dose and target must be greater than 0.</div>';
        return;
      }

      var deltaHours = 0;
      if(dose > target){
        deltaHours = halfLifeH * log2(dose / target);
      }

      var deltaMin = Math.ceil(deltaHours * 60);
      var cutoffMin = bedtimeMin - deltaMin - absorb;

      out.className = 'notice ok';
      out.innerHTML =
        '<div class="result">Latest cutoff time: ' + minutesToTime(cutoffMin) + '</div>' +
        '<div class="kv">' +
          '<div class="item"><div class="k">Half-life used</div><div class="v">' + halfLifeH.toFixed(1) + 'h</div></div>' +
          '<div class="item"><div class="k">Clearance window</div><div class="v">' + (deltaMin/60).toFixed(1) + 'h</div></div>' +
          '<div class="item"><div class="k">Absorption buffer</div><div class="v">' + absorb + ' min</div></div>' +
          '<div class="item"><div class="k">Bedtime target</div><div class="v">' + target + ' mg</div></div>' +
        '</div>' +
        '<div class="muted" style="margin-top:10px">' +
          'Reminder: many sleep resources recommend avoiding substantial caffeine within ~6 hours of bedtime.' +
        '</div>';
    }

    btn.addEventListener('click', calcCutoff);
  };

  // ------------------------
  // Levels Tool (multi-dose)
  // ------------------------
  window.initLevelsTool = function(root){
    if(!root) return;
    if(root.dataset.levelsBound) return;
    root.dataset.levelsBound = '1';

    const q = (sel)=>root.querySelector(sel);

    const addBtn = q('#addDose');
    const calcBtn = q('#calcLevels');
    const tbody = q('#doseRows');
    const out = q('#levelsOut');
    const canvas = q('#levelsChart');

    if(!tbody || !calcBtn || !out || !canvas) return;

    function doseRowTemplate(time='09:00', mg=80, note=''){
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td><input type="time" value="'+time+'" class="dose-time"></td>' +
        '<td><input type="number" min="0" step="1" value="'+mg+'" class="dose-mg"></td>' +
        '<td><input type="text" placeholder="coffee, tea, energy drink..." value="'+note+'" class="dose-note"></td>' +
        '<td><button class="btn secondary btn-del" type="button">Remove</button></td>';
      const del = tr.querySelector('.btn-del');
      if(del) del.addEventListener('click', ()=>tr.remove());
      return tr;
    }

    function seedRows(){
      // only seed if empty (avoid overwriting user input)
      if(tbody.querySelectorAll('tr').length) return;
      tbody.appendChild(doseRowTemplate('09:00', 80, 'coffee'));
      tbody.appendChild(doseRowTemplate('14:00', 100, 'coffee'));
    }

    function readDoses(){
      const rows = Array.from(tbody.querySelectorAll('tr'));
      const doses = [];
      for(const r of rows){
        const t = (r.querySelector('.dose-time')||{}).value;
        const mg = Number((r.querySelector('.dose-mg')||{}).value);
        const minutes = parseTimeToMinutes(t);
        if(minutes===null || !isFinite(mg) || mg<=0) continue;
        doses.push({ timeHours: minutes/60, mg: mg });
      }
      doses.sort((a,b)=>a.timeHours-b.timeHours);
      return doses;
    }

    function remainingAt(doses, tHours, halfLifeH){
      let sum = 0;
      for(const d of doses){
        const dt = tHours - d.timeHours;
        if(dt < 0) continue;
        sum += d.mg * Math.pow(0.5, dt/halfLifeH);
      }
      return sum;
    }

    function calcCurve(){
      const doses = readDoses();
      out.style.display = 'block';

      if(!doses.length){
        out.className = 'notice warn';
        out.innerHTML = '<strong>Please add at least one dose.</strong><div class="muted">Enter a time and mg.</div>';
        return;
      }

      const tierEl = q('#hlTier2');
      const tier = tierEl ? tierEl.value : 'med';
      const halfLifeH = halfLifeFromTier(tier);

      // Build points across 24h at 15-min steps
      const stepH = 0.25; // 15 min
      const points = [];
      let peak = 0;
      for(let h=0; h<=24+1e-9; h+=stepH){
        const y = remainingAt(doses, h, halfLifeH);
        peak = Math.max(peak, y);
        points.push({x:h, y:y});
      }

      // Bedtime marker
      const bedtimeEl = q('#bedtime2');
      const bedtimeStr = bedtimeEl ? (bedtimeEl.value||'') : '';
      const bmin = parseTimeToMinutes(bedtimeStr);
      let marker = null;
      let bedtimeRem = null;
      if(bmin !== null){
        const bx = bmin/60;
        bedtimeRem = remainingAt(doses, bx, halfLifeH);
        marker = { x: bx, label: 'Bedtime • '+bedtimeStr+' • '+Math.round(bedtimeRem)+' mg' };
      }

      // Draw
      drawLineChart(canvas, points, {
        yLabel: 'mg remaining',
        xTicks: 6,
        xFormatter: (x)=>{
          const m = Math.round(x*60);
          return minutesToTime(m);
        },
        marker: marker
      });

      const totalMg = doses.reduce((s,d)=>s+d.mg,0);

      out.className = 'notice ok';
      out.innerHTML =
        '<div class="result">Estimated caffeine level curve (multi-dose)</div>' +
        '<div class="kv">' +
          '<div class="item"><div class="k">Half-life used</div><div class="v">'+halfLifeH.toFixed(1)+'h</div></div>' +
          '<div class="item"><div class="k">Doses</div><div class="v">'+doses.length+'</div></div>' +
          '<div class="item"><div class="k">Total entered</div><div class="v">'+Math.round(totalMg)+' mg</div></div>' +
          '<div class="item"><div class="k">Peak level</div><div class="v">'+Math.round(peak)+' mg</div></div>' +
          (bedtimeRem===null ? '' : '<div class="item"><div class="k">At bedtime</div><div class="v">'+Math.round(bedtimeRem)+' mg</div></div>') +
        '</div>' +
        '<div class="muted" style="margin-top:10px">Educational estimate only. Exact caffeine content varies by drink and serving size.</div>';
    }

    // Bind events
    if(addBtn){
      addBtn.addEventListener('click', ()=>{
        tbody.appendChild(doseRowTemplate('16:00', 60, 'tea'));
      });
    }
    calcBtn.addEventListener('click', calcCurve);

    // Seed default rows and run once (silent)
    seedRows();
    // Do NOT auto-show errors on load; only calculate after a short delay if desired.
    setTimeout(()=>{ try{ calcCurve(); }catch(e){} }, 50);
  };

  // ------------------------
  // Clearance Tool
  // ------------------------
  window.initClearanceTool = function(root){
    if(!root) return;
    if(root.dataset.clearanceBound) return;
    root.dataset.clearanceBound = '1';

    const q = (sel)=>root.querySelector(sel);

    const btn = q('#calcClear');
    const out = q('#clearOut');
    if(!btn || !out) return;

    function calcClearance(){
      const dose = Number((q('#dose3')||{}).value);
      const thr  = Number((q('#threshold3')||{}).value);
      const tier = (q('#tier3')||{}).value || 'med';
      const nowStr = (q('#now3')||{}).value || '';
      const nowMin = parseTimeToMinutes(nowStr);

      const halfLifeH = halfLifeFromTier(tier);

      out.style.display = 'block';

      if(!isFinite(dose) || !isFinite(thr) || dose<=0 || thr<=0){
        out.className='notice warn';
        out.innerHTML='<strong>Please check your inputs.</strong><div class="muted">Dose and threshold must be greater than 0.</div>';
        return;
      }

      if(dose <= thr){
        out.className='notice ok';
        out.innerHTML='<div class="result">Already below threshold</div><div class="muted">Dose ('+Math.round(dose)+' mg) is already ≤ '+Math.round(thr)+' mg.</div>';
        return;
      }

      const hours = halfLifeH * log2(dose/thr);
      const minutes = Math.ceil(hours*60);
      const crossMin = (nowMin===null) ? null : (nowMin + minutes);

      out.className='notice ok';
      out.innerHTML =
        '<div class="result">Time to drop below '+Math.round(thr)+' mg: '+(minutes/60).toFixed(1)+' hours</div>' +
        '<div class="kv">' +
          '<div class="item"><div class="k">Half-life used</div><div class="v">'+halfLifeH.toFixed(1)+'h</div></div>' +
          '<div class="item"><div class="k">Estimated cross time</div><div class="v">'+(crossMin===null?'—':minutesToTime(crossMin))+'</div></div>' +
        '</div>' +
        '<div class="muted" style="margin-top:10px">Educational estimate only. Individual clearance varies.</div>';
    }

    btn.addEventListener('click', calcClearance);
  };



 
  document.addEventListener('DOMContentLoaded', function(){
    var root = document.getElementById('tool-root');
    if(!root) return;
    if(window.initCutoffTool) window.initCutoffTool(root);
    if(window.initLevelsTool) window.initLevelsTool(root);
    if(window.initClearanceTool) window.initClearanceTool(root);
  });
})();

