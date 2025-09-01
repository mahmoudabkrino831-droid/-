// UTF-8 encoded JS - attendance with fields + QR generation (uses qrserver API for QR images)
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const db = {
  get employees(){ return JSON.parse(localStorage.getItem('employees')||'[]'); },
  set employees(v){ localStorage.setItem('employees', JSON.stringify(v)); },
  get logs(){ return JSON.parse(localStorage.getItem('logs')||'[]'); },
  set logs(v){ localStorage.setItem('logs', JSON.stringify(v)); }
};

const empForm = document.getElementById('empForm');
const empName = document.getElementById('empName');
const empPhone = document.getElementById('empPhone');
const empDOB = document.getElementById('empDOB');
const empId = document.getElementById('empId');
const empTable = document.querySelector('#empTable tbody');

function uid(){ return 'EMP-' + Math.random().toString(36).slice(2,7).toUpperCase(); }

function qrUrl(data, size=160){
  return 'https://api.qrserver.com/v1/create-qr-code/?size='+size+'x'+size+'&data='+encodeURIComponent(data);
}

function renderEmployees(){
  empTable.innerHTML = '';
  db.employees.forEach((e,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${e.name}</td>
      <td>${e.phone||''}</td>
      <td>${e.dob||''}</td>
      <td>${e.id}</td>
      <td><img alt="QR" style="width:64px;height:64px" src="${qrUrl(e.id,128)}"><div><a href="${location.origin+location.pathname}?quick=${encodeURIComponent(e.id)}" target="_blank">رابط تسجيل</a></div></td>
      <td>
        <button data-act="edit" data-id="${e.id}">تعديل</button>
        <button data-act="del" class="danger" data-id="${e.id}">حذف</button>
      </td>
    `;
    empTable.appendChild(tr);
  });
}

empForm.addEventListener('submit', e=>{
  e.preventDefault();
  const name = empName.value.trim();
  const phone = empPhone.value.trim();
  const dob = empDOB.value;
  let id = empId.value.trim() || uid();
  if(!name){ alert('أدخل الاسم'); return; }
  const list = db.employees;
  const idx = list.findIndex(x=>x.id===id || x.name===name);
  const rec = { name, phone, dob, id };
  if(idx>=0){ list[idx] = rec; } else { list.push(rec); }
  db.employees = list;
  renderEmployees();
  empForm.reset();
});

document.getElementById('genId').addEventListener('click', ()=>{ empId.value = uid(); });

document.getElementById('clearEmployees').addEventListener('click', ()=>{ if(confirm('تأكيد حذف جميع الموظفين؟')){ db.employees = []; renderEmployees(); } });
document.getElementById('downloadEmployees').addEventListener('click', ()=>{
  const rows = [['name','phone','dob','id'], ...db.employees.map(e=>[e.name,e.phone||'',e.dob||'',e.id])];
  downloadCSV(rows,'employees.csv');
});

document.querySelector('#empTable tbody').addEventListener('click', e=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  const act = btn.dataset.act; const id = btn.dataset.id;
  const list = db.employees; const idx = list.findIndex(x=>x.id===id);
  if(idx<0) return;
  if(act==='edit'){ empName.value=list[idx].name; empPhone.value=list[idx].phone||''; empDOB.value=list[idx].dob||''; empId.value=list[idx].id; window.scrollTo({top:0,behavior:'smooth'}); }
  else if(act==='del'){ if(confirm('حذف هذا الموظف؟')){ list.splice(idx,1); db.employees=list; renderEmployees(); } }
});

// LOGS
const logBody = document.querySelector('#logTable tbody');
const searchLogs = document.getElementById('searchLogs');

function nowParts(){
  const d = new Date();
  const date = d.toISOString().slice(0,10);
  const time = d.toTimeString().slice(0,5);
  return {date,time};
}

function addLog({id,type}){
  const emp = db.employees.find(e=>e.id===id);
  const name = emp ? emp.name : 'غير معروف';
  const {date,time} = nowParts();
  const log = db.logs; log.unshift({name,id,type,date,time}); db.logs = log; renderLogs();
}

function renderLogs(){
  const q = searchLogs.value.trim().toLowerCase();
  logBody.innerHTML = '';
  db.logs.filter(r=>!q || r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)).forEach((r,i)=>{
    const tr = document.createElement('tr'); tr.innerHTML = `<td>${i+1}</td><td>${r.name}</td><td>${r.id}</td><td>${typeLabel(r.type)}</td><td>${r.date}</td><td>${r.time}</td>`; logBody.appendChild(tr);
  });
}
function typeLabel(t){ if(t==='checkin') return 'دخول'; if(t==='checkout') return 'خروج'; if(t==='absent') return 'غياب'; return t; }
renderEmployees(); renderLogs();

document.getElementById('exportCSV').addEventListener('click', ()=>{ const rows=[['name','id','type','date','time'], ...db.logs.map(r=>[r.name,r.id,r.type,r.date,r.time])]; downloadCSV(rows,'attendance_logs.csv'); });
document.getElementById('clearLogs').addEventListener('click', ()=>{ if(confirm('تأكيد حذف السجلات؟')){ db.logs = []; renderLogs(); } });

function downloadCSV(rows,filename){ const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n'); const blob = new Blob([csv],{type:'text/csv'}); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }

// SCAN (BarcodeDetector if available)
const video = document.getElementById('video'); const canvas = document.getElementById('frame'); const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('scan-status'); const scanType = document.getElementById('scanType'); const toggleBtn = document.getElementById('toggleCam'); const manualCode = document.getElementById('manualCode'); const manualSubmit = document.getElementById('manualSubmit');
let stream=null, scanning=false, detector=null;

async function initDetector(){ if('BarcodeDetector' in window){ try{ detector = new BarcodeDetector({formats: ['qr_code','code_128','ean_13','ean_8','code_39']}); return true;}catch(e){console.warn(e); detector=null; return false;} } return false; }

async function startCamera(){ if(scanning) return; try{ stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false}); video.srcObject = stream; await video.play(); scanning=true; statusEl.textContent='الكاميرا تعمل — وجّه الكود.'; tick(); }catch(e){ statusEl.textContent='تعذر تشغيل الكاميرا. استخدم الادخال اليدوي.'; console.error(e); } }
function stopCamera(){ scanning=false; if(stream){ stream.getTracks().forEach(t=>t.stop()); stream=null;} statusEl.textContent='الكاميرا متوقفة.'; }
toggleBtn.addEventListener('click', ()=>{ if(scanning) stopCamera(); else startCamera(); });

manualSubmit.addEventListener('click', ()=>{ const code=manualCode.value.trim(); if(!code){ alert('أدخل الكود'); return; } addLog({id:code,type:scanType.value}); manualCode.value=''; flash(); });

function flash(){ statusEl.textContent='تم التسجيل ✓'; setTimeout(()=>statusEl.textContent = scanning ? 'الكاميرا تعمل — وجّه الكود.' : 'الكاميرا متوقفة.',1200); }

async function tick(){ if(!scanning) return; if(video.readyState===video.HAVE_ENOUGH_DATA){ canvas.width=video.videoWidth; canvas.height=video.videoHeight; ctx.drawImage(video,0,0,canvas.width,canvas.height); if(detector){ try{ const codes = await detector.detect(canvas); if(codes && codes.length){ const raw = codes[0].rawValue.trim(); addLog({id:raw,type:scanType.value}); flash(); await new Promise(r=>setTimeout(r,1200)); } }catch(e){ console.warn('detector',e); } } } requestAnimationFrame(tick); }

(async()=>{ const ok = await initDetector(); if(ok){ statusEl.textContent='جاهز للمسح، شغّل الكاميرا.'; } else { statusEl.textContent='المتصفح لا يدعم المسح بالكاميرا. استخدم الإدخال اليدوي.'; } })();

(function(){ const params=new URLSearchParams(location.search); const q=params.get('quick'); const t=params.get('type')||'checkin'; if(q){ addLog({id:q,type:t}); alert('تم تسجيل '+(t==='checkin'?'الدخول':'الخروج')+' لـ '+q); } })();
