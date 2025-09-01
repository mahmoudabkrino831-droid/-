// Simple Attendance App with QR/Barcode scanning via BarcodeDetector (if available)
// Data is stored in localStorage

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const db = {
  get employees(){ return JSON.parse(localStorage.getItem('employees')||'[]'); },
  set employees(v){ localStorage.setItem('employees', JSON.stringify(v)); },
  get logs(){ return JSON.parse(localStorage.getItem('logs')||'[]'); },
  set logs(v){ localStorage.setItem('logs', JSON.stringify(v)); },
  get settings(){ return JSON.parse(localStorage.getItem('settings')||'{}'); },
  set settings(v){ localStorage.setItem('settings', JSON.stringify(v)); },
};

// Tabs
$$('.tab-btn').forEach(btn=>btn.addEventListener('click', e=>{
  $$('.tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const tab = btn.dataset.tab;
  $$('.tab').forEach(t=>t.classList.remove('active'));
  $('#'+tab).classList.add('active');
}));

// SETTINGS
const orgName = $('#orgName');
const tzInput = $('#tz');
function loadSettings(){
  const s = db.settings;
  orgName.value = s.orgName || '';
  tzInput.value = s.tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
}
$('#saveSettings').addEventListener('click', ()=>{
  db.settings = { orgName: orgName.value.trim(), tz: tzInput.value.trim() };
  alert('تم حفظ الإعدادات');
});
loadSettings();

// EMPLOYEES
const empForm = $('#empForm');
const empName = $('#empName');
const empId = $('#empId');
const empTableBody = $('#empTable tbody');

function uid(){ return 'EMP-' + Math.random().toString(36).slice(2,7).toUpperCase(); }

function renderEmployees(){
  const list = db.employees;
  empTableBody.innerHTML = '';
  list.forEach((e,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${e.name}</td>
      <td>${e.id}</td>
      <td><a href="${location.origin + location.pathname}?quick=${encodeURIComponent(e.id)}" target="_blank">رابط تسجيل سريع</a></td>
      <td>
        <button data-act="edit" data-id="${e.id}">تعديل</button>
        <button class="danger" data-act="del" data-id="${e.id}">حذف</button>
      </td>
    `;
    empTableBody.appendChild(tr);
  });
}
renderEmployees();

empForm.addEventListener('submit', e=>{
  e.preventDefault();
  const name = empName.value.trim();
  let id = empId.value.trim() || uid();
  if(!name){ alert('أدخل الاسم'); return; }
  const list = db.employees;
  const idx = list.findIndex(x=>x.id===id || x.name===name);
  const rec = { name, id };
  if(idx>=0){ list[idx] = rec; } else { list.push(rec); }
  db.employees = list;
  renderEmployees();
  empForm.reset();
});

$('#clearEmployees').addEventListener('click', ()=>{
  if(confirm('تأكيد حذف جميع الموظفين؟')){
    db.employees = [];
    renderEmployees();
  }
});

$('#downloadEmployees').addEventListener('click', ()=>{
  const rows = [['name','id'], ...db.employees.map(e=>[e.name,e.id])];
  downloadCSV(rows, 'employees.csv');
});

empTableBody.addEventListener('click', e=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  const act = btn.dataset.act;
  const id = btn.dataset.id;
  const list = db.employees;
  const idx = list.findIndex(x=>x.id===id);
  if(idx<0) return;
  if(act==='edit'){
    empName.value = list[idx].name;
    empId.value = list[idx].id;
    window.scrollTo({top:0,behavior:'smooth'});
  }else if(act==='del'){
    if(confirm('حذف هذا الموظف؟')){
      list.splice(idx,1);
      db.employees = list;
      renderEmployees();
    }
  }
});

// LOGS
const logBody = $('#logTable tbody');
const searchLogs = $('#searchLogs');
const dateFilter = $('#dateFilter');

function nowParts(){
  const tz = (db.settings.tz || Intl.DateTimeFormat().resolvedOptions().timeZone);
  const d = new Date();
  try {
    // Intl formatting with timeZone
    const fmtDate = new Intl.DateTimeFormat('ar-EG', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' }).format(d);
    const [day,month,year] = fmtDate.split('/'); // ar-EG typically dd/mm/yyyy
    const fmtTime = new Intl.DateTimeFormat('ar-EG', { timeZone: tz, hour:'2-digit', minute:'2-digit', hour12:false }).format(d);
    return { date: `${year}-${month}-${day}`, time: fmtTime };
  } catch {
    const iso = new Date().toISOString();
    return { date: iso.slice(0,10), time: iso.slice(11,16) };
  }
}

function addLog({id, type}){
  const emp = db.employees.find(e=>e.id===id);
  const name = emp ? emp.name : 'غير معروف';
  const {date,time} = nowParts();
  const log = db.logs;
  log.unshift({ name, id, type, date, time });
  db.logs = log;
  renderLogs();
}

function renderLogs(){
  const q = searchLogs.value.trim().toLowerCase();
  const d = dateFilter.value;
  const rows = db.logs.filter(r=>(
    (!q || r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)) &&
    (!d || r.date===d)
  ));
  logBody.innerHTML = '';
  rows.forEach((r,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td>${r.name}</td><td>${r.id}</td><td>${typeLabel(r.type)}</td><td>${r.date}</td><td>${r.time}</td>`;
    logBody.appendChild(tr);
  });
}
function typeLabel(t){
  if(t==='checkin') return 'دخول';
  if(t==='checkout') return 'خروج';
  if(t==='absent') return 'غياب';
  return t;
}
renderLogs();
searchLogs.addEventListener('input', renderLogs);
dateFilter.addEventListener('change', renderLogs);

$('#exportCSV').addEventListener('click', ()=>{
  const rows = [['name','id','type','date','time'], ...db.logs.map(r=>[r.name,r.id,r.type,r.date,r.time])];
  downloadCSV(rows, 'attendance_logs.csv');
});
$('#clearLogs').addEventListener('click', ()=>{
  if(confirm('تأكيد حذف السجلات؟')){
    db.logs = [];
    renderLogs();
  }
});

// SCAN
const video = $('#video');
const canvas = $('#frame');
const ctx = canvas.getContext('2d');
const statusEl = $('#scan-status');
const scanType = $('#scanType');
const toggleBtn = $('#toggleCam');
const manualCode = $('#manualCode');
const manualSubmit = $('#manualSubmit');

let stream = null;
let scanning = false;
let detector = null;

async function initDetector(){
  if('BarcodeDetector' in window){
    const formats = ['qr_code','code_128','ean_13','ean_8','code_39','upc_e','upc_a','codabar','itf'];
    try{
      detector = new BarcodeDetector({ formats });
      return true;
    }catch(e){
      console.warn(e);
      detector = null;
      return false;
    }
  }
  return false;
}

async function startCamera(){
  if(scanning) return;
  try{
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:'environment' }, audio:false });
    video.srcObject = stream;
    await video.play();
    scanning = true;
    statusEl.textContent = 'الكاميرا تعمل — وجّه الكود نحو الإطار.';
    tick();
  }catch(e){
    statusEl.textContent = 'تعذر تشغيل الكاميرا. استخدم الإدخال اليدوي.';
    console.error(e);
  }
}

function stopCamera(){
  scanning = false;
  if(stream){
    stream.getTracks().forEach(t=>t.stop());
    stream = null;
  }
  statusEl.textContent = 'الكاميرا متوقفة.';
}

toggleBtn.addEventListener('click', ()=>{
  if(scanning) stopCamera(); else startCamera();
});

manualSubmit.addEventListener('click', ()=>{
  const code = manualCode.value.trim();
  if(!code){ alert('أدخل الكود'); return; }
  addLog({ id: code, type: scanType.value });
  manualCode.value='';
  flash();
});

function flash(){
  statusEl.textContent = 'تم التسجيل ✅';
  setTimeout(()=>statusEl.textContent = scanning ? 'الكاميرا تعمل — وجّه الكود نحو الإطار.' : 'الكاميرا متوقفة.', 1200);
}

async function tick(){
  if(!scanning) return;
  if(video.readyState === video.HAVE_ENOUGH_DATA){
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    if(detector){
      try{
        const barcodes = await detector.detect(canvas);
        if(barcodes && barcodes.length){
          const raw = barcodes[0].rawValue.trim();
          addLog({ id: raw, type: scanType.value });
          flash();
          await new Promise(r=>setTimeout(r, 1200)); // debounce
        }
      }catch(e){ console.warn('Detector error', e); }
    }
  }
  requestAnimationFrame(tick);
}

(async()=>{
  const ok = await initDetector();
  if(ok){
    statusEl.textContent = 'جاهز للمسح. شغّل الكاميرا ووجّه الكود.';
  }else{
    statusEl.textContent = 'المتصفح لا يدعم المسح بالكاميرا. استخدم الإدخال اليدوي.';
  }
})();

// Helpers
function downloadCSV(rows, filename){
  const csv = rows.map(r => r.map(v=> `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// QUICK LINK (?quick=EMP-001) to instantly log check-in
(function handleQuick(){
  const params = new URLSearchParams(location.search);
  const q = params.get('quick');
  const t = params.get('type') || 'checkin';
  if(q){
    addLog({ id: q, type: t });
    alert('تم تسجيل ' + (t==='checkin'?'الدخول':'الخروج') + ' لـ ' + q);
  }
})();
