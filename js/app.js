const API_URL = 'https://script.google.com/macros/s/AKfycbxsMinDFpWXajV5PEJY-BGbF6z0DywgzFr2Jws7f_Co1W-5SqMhkFHGXXksqTcIt9IQOw/exec';
let currentUser = null, allAgenda = [], calendarDate = new Date(), importData = null;

document.addEventListener('DOMContentLoaded', () => { checkLogin(); setupEvents(); updateClock(); setInterval(updateClock, 1000); });

function setupEvents() {
    const loginForm = document.getElementById('loginForm'); if(loginForm) loginForm.addEventListener('submit', e => { e.preventDefault(); handleLogin(e); });
    const logoutBtn = document.getElementById('logoutBtn'); if(logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    const agendaForm = document.getElementById('agendaForm'); if(agendaForm) agendaForm.addEventListener('submit', e => { e.preventDefault(); handleAgendaSubmit(e); });
    const userForm = document.getElementById('userForm'); if(userForm) userForm.addEventListener('submit', e => { e.preventDefault(); handleUserSubmit(e); });
    
    document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); const page=link.dataset.page; if(page) window.navigateTo(page); }));
    
    const btnViewAll = document.getElementById('btnViewAllAgenda'); if(btnViewAll) btnViewAll.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); window.navigateTo('agenda'); });
    
    const menuToggle = document.getElementById('menuToggle'); if(menuToggle) menuToggle.addEventListener('click', e => { e.stopPropagation(); document.getElementById('sidebar')?.classList.toggle('active'); });
    
    document.addEventListener('click', e => { const sidebar=document.getElementById('sidebar'), toggle=document.getElementById('menuToggle'); if(window.innerWidth<=767 && sidebar?.classList.contains('active') && !sidebar.contains(e.target) && !toggle?.contains(e.target)) sidebar.classList.remove('active'); });
    
    const importFile = document.getElementById('importFile'); if(importFile) importFile.addEventListener('change', handleImportFile);
    document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if(e.target===m) m.classList.remove('active'); }));
}

async function api(action, payload={}) {
    showLoading(true);
    try {
        const res = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({action,...payload}) });
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch(err) { console.error('🔍 API ERROR:', err); showToast('Gagal terhubung ke server.', 'error'); return {status:'error', message:'Connection Failed'}; }
    finally { showLoading(false); }
}

function checkLogin() { const s=localStorage.getItem('agendaUser'); if(s){currentUser=JSON.parse(s); showApp();} }
async function handleLogin(e) {
    e.preventDefault(); const btn=document.getElementById('loginBtn'), errDiv=document.getElementById('loginError'); btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Memuat...'; errDiv.textContent='';
    const res = await api('login', {username:document.getElementById('loginUsername').value, password:document.getElementById('loginPassword').value});
    btn.disabled=false; btn.innerHTML='<i class="fas fa-sign-in-alt"></i> Masuk';
    if(res.status==='success'){currentUser=res.data; localStorage.setItem('agendaUser',JSON.stringify(currentUser)); showApp();} else {errDiv.textContent=res.message;}
}
function handleLogout() { if(confirm('Yakin keluar?')){localStorage.removeItem('agendaUser'); currentUser=null; document.getElementById('loginPage').style.display='flex'; document.getElementById('appPage').style.display='none'; document.getElementById('loginForm')?.reset();} }
function showApp() {
    document.getElementById('loginPage').style.display='none'; document.getElementById('appPage').style.display='flex';
    document.getElementById('userAvatar').textContent=currentUser.nama_lengkap.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
    document.getElementById('userName').textContent=currentUser.nama_lengkap; document.getElementById('userRole').textContent=currentUser.jabatan;
    document.querySelectorAll('.admin-only').forEach(el=>el.style.display=currentUser.role==='admin'?'flex':'none');
    window.navigateTo('dashboard');
}

window.navigateTo = function(page) {
    document.querySelectorAll('.nav-link').forEach(l=>l.classList.toggle('active', l.dataset.page===page));
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    setTimeout(()=>{const t=document.getElementById(`page-${page}`); if(t) t.classList.add('active');},50);
    const t={dashboard:'Dashboard',agenda:'Manajemen Agenda',calendar:'Kalender',importExport:'Import/Export',users:'Manajemen User',settings:'Pengaturan'};
    document.getElementById('pageTitle').textContent=t[page]||'Dashboard';
    if(page==='dashboard')loadDashboard(); if(page==='agenda')loadAgenda(); if(page==='calendar')renderCalendar(); if(page==='users')loadUsers(); if(page==='settings')loadSettings();
    if(window.innerWidth<=767) document.getElementById('sidebar')?.classList.remove('active');
    window.scrollTo({top:0,behavior:'smooth'});
}

async function loadAgenda() {
    const res = await api('getAgenda',{username:currentUser.username,role:currentUser.role,startDate:document.getElementById('filterStartDate')?.value||'',endDate:document.getElementById('filterEndDate')?.value||'',search:document.getElementById('filterSearch')?.value||''});
    if(res.status==='success'){allAgenda=res.data||[]; renderAgendaTable(); updateStats();} return res;
}
async function handleAgendaSubmit(e) {
    e.preventDefault(); const id=document.getElementById('agendaId').value; const p={tanggal:document.getElementById('agendaTanggal').value,waktu_mulai:document.getElementById('agendaWaktuMulai').value,waktu_selesai:document.getElementById('agendaWaktuSelesai').value,kegiatan:document.getElementById('agendaKegiatan').value,tempat:document.getElementById('agendaTempat').value,keterangan:document.getElementById('agendaKeterangan').value,dibuat_oleh:currentUser.username}; const wantWA=document.getElementById('sendWhatsApp')?.checked;
    let res; if(id){p.id=id;res=await api('updateAgenda',p);} else {res=await api('addAgenda',p);}
    if(res.status==='success'){showToast(res.message,'success');closeAgendaModal();if(!id&&wantWA&&res.data?.id)sendWhatsAppDirect({...p,id:res.data.id});await loadAgenda();}
}

window.sendWhatsAppDirect = function(a) {
    let ph=localStorage.getItem('waNumber')||''; ph=ph.replace(/\D/g,''); if(!ph.startsWith('62'))ph='62'+ph.replace(/^0/,''); if(ph.length<10)return showToast('Nomor WA belum diatur','warning');
    let msg=`🏛️ *KEMENTERIAN AGAMA KAB. TANAH DATAR*\n━━━━━━━━━━━━━━\n📋 *AGENDA KEGIATAN*\n\n📅 *Tanggal:* ${formatDate(a.tanggal)}\n⏰ *Waktu:* ${a.waktu_mulai||'-'} s/d ${a.waktu_selesai||'-'}\n📍 *Tempat:* ${a.tempat||'-'}\n\n📝 *Kegiatan:* ${a.kegiatan||'-'}\n`;
    if(a.penanggung_jawab?.trim())msg+=`👤 *Penanggung Jawab:* ${a.penanggung_jawab}\n`;
    if(a.pakaian?.trim())msg+=`👔 *Pakaian:* ${a.pakaian}\n`;
    if(a.petugas?.trim())msg+=`👥 *Petugas:* ${a.petugas}\n`;
    if(a.pejabat?.trim())msg+=`🏅 *Pejabat:* ${a.pejabat}\n`;
    if(a.keterangan?.trim())msg+=`\n📌 *Keterangan:* ${a.keterangan}\n`;
    msg+=`━━━━━━━━━━━━━━\n👤 *Input oleh:* ${a.dibuat_oleh||currentUser.username}\n_Mohon kehadiran tepat waktu._`;
    window.open(`https://wa.me/${ph}?text=${encodeURIComponent(msg)}`,'_blank');
}
window.sendWhatsAppById = function(id) { const a=allAgenda.find(x=>String(x.id)===String(id)); if(!a){showToast('Memuat data terbaru...','info');loadAgenda().then(()=>{const r=allAgenda.find(x=>String(x.id)===String(id));r?sendWhatsAppDirect(r):showToast('Data tidak ditemukan.','error');});return;} sendWhatsAppDirect(a); }
window.sendWhatsApp = window.sendWhatsAppDirect;

function renderAgendaTable() {
    const tbody=document.querySelector('#agendaTable tbody'); if(!tbody)return; tbody.innerHTML=''; if(!allAgenda.length){tbody.innerHTML='<tr><td colspan="8" class="text-center text-muted">Tidak ada data agenda</td></tr>';return;}
    const s=[...allAgenda].sort((a,b)=>(a.tanggal||'').localeCompare(b.tanggal||'')||(a.waktu_mulai||'').localeCompare(b.waktu_mulai||'')), td=new Date().toISOString().split('T')[0];
    s.forEach((a,i)=>{const tr=document.createElement('tr'); tr.innerHTML=`<td>${i+1}</td><td>${formatDate(a.tanggal)} ${a.tanggal===td?'<span class="badge badge-warning">Hari Ini</span>':''}</td><td>${a.waktu_mulai||'-'} - ${a.waktu_selesai||'-'}</td><td>${a.kegiatan||'-'}</td><td>${a.tempat||'-'}</td><td>${a.dibuat_oleh||'-'}</td><td><span class="badge badge-success">Aktif</span></td><td><div class="action-btns"><button class="btn btn-info btn-sm" onclick="sendWhatsAppById('${a.id}')" title="Kirim WA"><i class="fab fa-whatsapp"></i></button><button class="btn btn-warning btn-sm" onclick="editAgenda('${a.id}')"><i class="fas fa-edit"></i></button><button class="btn btn-danger btn-sm" onclick="deleteAgenda('${a.id}')"><i class="fas fa-trash"></i></button></div></td>`; tbody.appendChild(tr);});
}
function openAgendaModal(id=null){document.getElementById('agendaModal').classList.add('active');document.getElementById('agendaModalTitle').textContent=id?'Edit Agenda':'Tambah Agenda';document.getElementById('agendaForm').reset();document.getElementById('agendaId').value='';document.getElementById('agendaTanggal').value=new Date().toISOString().split('T')[0];if(id){const a=allAgenda.find(x=>x.id===id);if(!a)return showToast('Data tidak ditemukan','error');document.getElementById('agendaId').value=a.id;document.getElementById('agendaTanggal').value=a.tanggal;document.getElementById('agendaWaktuMulai').value=a.waktu_mulai;document.getElementById('agendaWaktuSelesai').value=a.waktu_selesai;document.getElementById('agendaKegiatan').value=a.kegiatan;document.getElementById('agendaTempat').value=a.tempat;document.getElementById('agendaPJ').value=a.penanggung_jawab||'';document.getElementById('agendaPakaian').value=a.pakaian||'';document.getElementById('agendaPetugas').value=a.petugas||'';document.getElementById('agendaPejabat').value=a.pejabat||'';document.getElementById('agendaKeterangan').value=a.keterangan||'';}}
function closeAgendaModal(){document.getElementById('agendaModal').classList.remove('active');}
window.editAgenda=function(id){openAgendaModal(id);};
window.deleteAgenda=async function(id){if(!confirm('Hapus agenda ini?'))return;const res=await api('deleteAgenda',{id});if(res.status==='success'){showToast(res.message,'success');loadAgenda();}};

async function loadUsers(){const res=await api('getUsers');if(res.status==='success')renderUserTable(res.data);}
function renderUserTable(users){const tbody=document.querySelector('#usersTable tbody');if(!tbody)return;tbody.innerHTML='';if(!users.length){tbody.innerHTML='<tr><td colspan="6" class="text-center text-muted"><i class="fas fa-users fa-2x mb-2"></i><br>Tidak ada user</td></tr>';return;}
    users.forEach((u,i)=>{const rc=(u.role||'user').toString().trim().toLowerCase(), ri=rc==='admin'?'fas fa-shield-alt':'fas fa-user', rcl=rc==='admin'?'role-admin':'role-user', rl=rc==='admin'?'Admin':'User';
    const tr=document.createElement('tr'); tr.className='user-row'; tr.innerHTML=`<td><div class="user-cell-main"><div class="user-avatar-sm">${(u.nama_lengkap||u.username).charAt(0).toUpperCase()}</div><div><div class="user-name-cell">${u.nama_lengkap||'-'}</div><small class="text-muted">@${u.username}</small></div></div></td><td><span class="user-jabatan">${u.jabatan||'-'}</span></td><td><span class="badge-role ${rcl}"><i class="${ri}"></i> ${rl}</span></td><td><div class="action-btns"><button class="btn btn-warning btn-sm" onclick="editUser('${u.username}')" title="Edit"><i class="fas fa-edit"></i></button><button class="btn btn-danger btn-sm" onclick="deleteUser('${u.username}')" ${rc==='admin'?'disabled':''} title="Hapus"><i class="fas fa-trash"></i></button></div></td>`;tbody.appendChild(tr);});
}
function openUserModal(username=null){document.getElementById('userModal').classList.add('active');document.getElementById('userModalTitle').textContent=username?'Edit User':'Tambah User';document.getElementById('userForm').reset();document.getElementById('userOldUsername').value='';document.getElementById('userPassword').placeholder='Masukkan password';document.getElementById('userPassword').required=true;if(username){const rows=document.querySelectorAll('#usersTable tbody tr');for(let row of rows){if(row.querySelector('.text-muted')?.textContent.includes(username)){document.getElementById('userUsername').value=username;document.getElementById('userOldUsername').value=username;document.getElementById('userNama').value=row.querySelector('.user-name-cell')?.textContent||'';document.getElementById('userJabatan').value=row.querySelector('.user-jabatan')?.textContent||'';document.getElementById('userRole').value=(row.querySelector('.badge-role')?.textContent||'').trim().toLowerCase().includes('admin')?'admin':'user';document.getElementById('userPassword').required=false;document.getElementById('userPassword').placeholder='Kosongkan jika tidak diubah';break;}}}}
async function handleUserSubmit(e){e.preventDefault();const old=document.getElementById('userOldUsername').value,p={username:document.getElementById('userUsername').value,role:document.getElementById('userRole').value,nama_lengkap:document.getElementById('userNama').value,jabatan:document.getElementById('userJabatan').value},pwd=document.getElementById('userPassword').value;let res;if(old){if(pwd)p.newPassword=pwd;res=await api('updateUser',p);}else{p.password=pwd;res=await api('addUser',p);}if(res.status==='success'){showToast(res.message,'success');closeUserModal();loadUsers();}}
function closeUserModal(){document.getElementById('userModal').classList.remove('active');}
window.editUser=function(u){openUserModal(u);};
window.deleteUser=async function(u){if(!confirm(`Hapus user ${u}?`))return;const res=await api('deleteUser',{username:u});if(res.status==='success'){showToast(res.message,'success');loadUsers();}};

async function loadDashboard(){const td=new Date().toISOString().split('T')[0],we=new Date();we.setDate(we.getDate()+7);const weS=we.toISOString().split('T')[0],mS=td.substring(0,7)+'-01';document.getElementById('statTotal').textContent=allAgenda.length;document.getElementById('statToday').textContent=allAgenda.filter(a=>a.tanggal===td).length;document.getElementById('statWeek').textContent=allAgenda.filter(a=>a.tanggal>=td&&a.tanggal<=weS).length;document.getElementById('statMonth').textContent=allAgenda.filter(a=>a.tanggal>=mS).length;renderUpcomingTable();}
function renderUpcomingTable(){const tbody=document.querySelector('#upcomingTable tbody');if(!tbody)return;tbody.innerHTML='';const td=new Date().toISOString().split('T')[0],up=allAgenda.filter(a=>a.tanggal&&a.tanggal>=td).sort((a,b)=>(a.tanggal||'').localeCompare(b.tanggal||'')||(a.waktu_mulai||'').localeCompare(b.waktu_mulai||'')).slice(0,5);if(!up.length){tbody.innerHTML='<tr><td colspan="6" class="text-center text-muted"><i class="fas fa-calendar-check fa-2x mb-2"></i><br>Tidak ada agenda mendatang</td></tr>';return;}up.forEach(a=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${formatDate(a.tanggal)} ${a.tanggal===td?'<span class="badge badge-warning">Hari Ini</span>':''}</td><td style="white-space:nowrap;">${a.waktu_mulai||'-'} - ${a.waktu_selesai||'-'}</td><td><strong>${a.kegiatan||'-'}</strong></td><td>${a.tempat||'-'}</td><td><div style="font-size:0.85rem;">👤 ${a.penanggung_jawab||'-'} ${a.pakaian?`<br><span class="badge badge-info" style="font-size:0.7rem;">👔 ${a.pakaian}</span>`:''}</div></td><td><button class="btn btn-info btn-sm" onclick="sendWhatsAppById('${a.id}')" title="Kirim WA"><i class="fab fa-whatsapp"></i></button></td>`;tbody.appendChild(tr);});}
function updateStats(){}

function renderCalendar(){const y=calendarDate.getFullYear(),m=calendarDate.getMonth(),months=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];document.getElementById('calendarMonthYear').textContent=`${months[m]} ${y}`;const grid=document.getElementById('calendarGrid');if(!grid)return;grid.innerHTML='';['Min','Sen','Sel','Rab','Kam','Jum','Sab'].forEach(d=>{const h=document.createElement('div');h.className='calendar-header';h.textContent=d;grid.appendChild(h);});const fd=new Date(y,m,1).getDay(),dm=new Date(y,m+1,0).getDate(),td=new Date().toISOString().split('T')[0];for(let i=0;i<fd;i++){const d=document.createElement('div');d.className='calendar-day other-month';grid.appendChild(d);}for(let d=1;d<=dm;d++){const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,el=document.createElement('div');el.className='calendar-day';if(ds===td)el.classList.add('today');const count=allAgenda.filter(a=>a.tanggal===ds).length;el.innerHTML=`<div class="day-number">${d}</div>${count?`<span class="day-events">${count}</span>`:''}`;el.onclick=()=>showCalendarEvents(ds);grid.appendChild(el);}}
window.changeMonth=function(dir){calendarDate.setMonth(calendarDate.getMonth()+dir);renderCalendar();};
function showCalendarEvents(ds){document.getElementById('selectedDate').textContent=formatDate(ds);const body=document.getElementById('calendarEventsBody');if(!body)return;const ags=allAgenda.filter(a=>a.tanggal===ds);body.innerHTML=ags.length?ags.map(a=>`<div class="calendar-event-item"><strong>${a.waktu_mulai||'-'} - ${a.waktu_selesai||'-'}</strong> | ${a.kegiatan||'-'}<br><small class="text-muted">📍 ${a.tempat||'-'}</small></div>`).join(''):'<p class="text-muted">Tidak ada agenda</p>';}

function handleImportFile(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=(ev)=>{try{importData=JSON.parse(ev.target.result);document.getElementById('importPreview').style.display='block';document.getElementById('importPreviewContent').innerHTML=`<p>✅ Siap impor: <b>${importData.length}</b> data</p>`;showToast('File siap. Klik Konfirmasi.','info');}catch{showToast('Format JSON salah','error');}};r.readAsText(f);}
async function confirmImport(){if(!importData)return;const res=await api('importAgenda',{agendaData:importData});if(res.status==='success'){showToast(res.message,'success');document.getElementById('importPreview').style.display='none';importData=null;document.getElementById('importFile').value='';loadAgenda();}}
async function exportAgenda(fmt){const res=await api('exportAgenda',{username:currentUser.username,role:currentUser.role});if(res.status!=='success')return;let c,t,ex;if(fmt==='json'){c=JSON.stringify(res.data,null,2);t='application/json';ex='json';}else if(fmt==='csv'){const h=Object.keys(res.data[0]||{});c=[h.join(','),...res.data.map(r=>h.map(k=>`"${String(r[k]||'').replace(/"/g,'""')}"`).join(','))].join('\n');t='text/csv';ex='csv';}const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([c],{type}));a.download=`agenda_${new Date().toISOString().split('T')[0]}.${ex}`;a.click();showToast('Export berhasil','success');}

function loadSettings(){document.getElementById('waNumber').value=localStorage.getItem('waNumber')||'';}
function saveWaNumber(){let n=document.getElementById('waNumber').value.replace(/\D/g,'');if(!n.startsWith('62'))n='62'+n.replace(/^0/,'');localStorage.setItem('waNumber',n);showToast('Nomor WA disimpan','success');}

function showLoading(s){document.getElementById('loading').style.display=s?'flex':'none';}
function showToast(msg,type='info'){const t=document.getElementById('toast');t.textContent=msg;t.className=`toast ${type} show`;setTimeout(()=>t.classList.remove('show'),4000);}
function updateClock(){const n=new Date();const o={weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'};const e=document.getElementById('currentDateTime');if(e)e.textContent=n.toLocaleDateString('id-ID',o);}
function formatDate(ds){if(!ds)return'-';if(ds instanceof Date){const d=ds.getDate(),m=ds.getMonth(),y=ds.getFullYear();const mo=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];return`${d} ${mo[m]} ${y}`;}const p=String(ds).trim().split(/[-T]/);if(p.length>=3){const[y,m,d]=p;const mo=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];return`${parseInt(d,10)} ${mo[parseInt(m,10)-1]} ${y}`;}return String(ds);}

window.navigateTo=window.navigateTo||navigateTo;window.sendWhatsAppDirect=window.sendWhatsAppDirect||sendWhatsAppDirect;window.sendWhatsAppById=window.sendWhatsAppById||sendWhatsAppById;window.sendWhatsApp=window.sendWhatsApp||sendWhatsAppDirect;window.editAgenda=window.editAgenda||editAgenda;window.deleteAgenda=window.deleteAgenda||deleteAgenda;window.openAgendaModal=window.openAgendaModal||openAgendaModal;window.closeAgendaModal=window.closeAgendaModal||closeAgendaModal;window.loadAgenda=window.loadAgenda||loadAgenda;window.changeMonth=window.changeMonth||changeMonth;window.openUserModal=window.openUserModal||openUserModal;window.closeUserModal=window.closeUserModal||closeUserModal;window.editUser=window.editUser||editUser;window.deleteUser=window.deleteUser||deleteUser;window.confirmImport=window.confirmImport||confirmImport;window.exportAgenda=window.exportAgenda||exportAgenda;window.saveWaNumber=window.saveWaNumber||saveWaNumber;
