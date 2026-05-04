const API_URL = 'https://script.google.com/macros/s/AKfycbxsMinDFpWXajV5PEJY-BGbF6z0DywgzFr2Jws7f_Co1W-5SqMhkFHGXXksqTcIt9IQOw/exec';
let currentUser = null, allAgenda = [], calendarDate = new Date(), importData = null;

document.addEventListener('DOMContentLoaded', () => {
    checkLogin(); setupEvents(); updateClock(); setInterval(updateClock, 1000);
});

function setupEvents() {
     document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('sidebar');
        const menuToggle = document.getElementById('menuToggle');
        if (window.innerWidth <= 767 && 
            !sidebar.contains(e.target) && 
            !menuToggle.contains(e.target) && 
            sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
        }
    });
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('agendaForm').addEventListener('submit', handleAgendaSubmit);
    document.getElementById('userForm').addEventListener('submit', handleUserSubmit);
    document.querySelectorAll('.nav-link').forEach(l => l.addEventListener('click', e => { e.preventDefault(); navigateTo(l.dataset.page); }));
    document.getElementById('menuToggle')?.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('active'));
    document.getElementById('importFile')?.addEventListener('change', handleImportFile);
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

// ============================================
// AUTH & NAV
// ============================================
function checkLogin() { const s=localStorage.getItem('agendaUser'); if(s){currentUser=JSON.parse(s); showApp();} }
async function handleLogin(e) {
    e.preventDefault(); const btn=document.getElementById('loginBtn'); const errDiv=document.getElementById('loginError');
    btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Memuat...'; errDiv.textContent='';
    const res = await api('login', {username:document.getElementById('loginUsername').value, password:document.getElementById('loginPassword').value});
    btn.disabled=false; btn.innerHTML='<i class="fas fa-sign-in-alt"></i> Masuk';
    if(res.status==='success'){currentUser=res.data; localStorage.setItem('agendaUser',JSON.stringify(currentUser)); showApp();}
    else {errDiv.textContent=res.message;}
}
function handleLogout() { if(confirm('Yakin keluar?')){localStorage.removeItem('agendaUser'); currentUser=null; document.getElementById('loginPage').style.display='flex'; document.getElementById('appPage').style.display='none'; document.getElementById('loginForm').reset();} }
function showApp() {
    document.getElementById('loginPage').style.display='none'; document.getElementById('appPage').style.display='flex';
    document.getElementById('userAvatar').textContent=currentUser.nama_lengkap.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
    document.getElementById('userName').textContent=currentUser.nama_lengkap; document.getElementById('userRole').textContent=currentUser.jabatan;
    document.querySelectorAll('.admin-only').forEach(el=>el.style.display=currentUser.role==='admin'?'flex':'none');
    navigateTo('dashboard');
}
function navigateTo(page) {
    // Close sidebar on mobile after navigation
    if (window.innerWidth <= 767) {
        document.getElementById('sidebar').classList.remove('active');
    }
    
    // ... rest of existing code ...
}

// ============================================
// AGENDA & WHATSAPP (UPDATED)
// ============================================
async function loadAgenda() {
    const res = await api('getAgenda', {username:currentUser.username, role:currentUser.role, startDate:document.getElementById('filterStartDate')?.value||'', endDate:document.getElementById('filterEndDate')?.value||'', search:document.getElementById('filterSearch')?.value||''});
    if(res.status==='success') { allAgenda = res.data || []; renderAgendaTable(); updateStats(); }
    return res;
}

async function handleAgendaSubmit(e) {
    e.preventDefault(); 
    const id = document.getElementById('agendaId').value;
    const payload = {
        tanggal: document.getElementById('agendaTanggal').value,
        waktu_mulai: document.getElementById('agendaWaktuMulai').value,
        waktu_selesai: document.getElementById('agendaWaktuSelesai').value,
        kegiatan: document.getElementById('agendaKegiatan').value,
        tempat: document.getElementById('agendaTempat').value,
        penanggung_jawab: document.getElementById('agendaPJ').value,
        pakaian: document.getElementById('agendaPakaian').value,
        petugas: document.getElementById('agendaPetugas').value,
        pejabat: document.getElementById('agendaPejabat').value,
        keterangan: document.getElementById('agendaKeterangan').value,
        dibuat_oleh: currentUser.username
    };
    const wantWA = document.getElementById('sendWhatsApp').checked;

    let res; 
    if(id){ payload.id=id; res=await api('updateAgenda',payload); } 
    else { res=await api('addAgenda',payload); }

    if(res.status==='success'){
        showToast(res.message, 'success'); closeAgendaModal(); 
        if(!id && wantWA && res.data?.id) sendWhatsAppDirect({...payload, id: res.data.id});
        await loadAgenda(); 
    }
}

// ✅ TEMPLATE WA DINAMIS & RESMI
function sendWhatsAppDirect(agenda) {
    let phone = localStorage.getItem('waNumber')||''; 
    phone = phone.replace(/\D/g,''); if(!phone.startsWith('62'))phone='62'+phone.replace(/^0/,'');
    if(phone.length<10) return showToast('Nomor WA belum diatur di Pengaturan','warning');

    let msg = `🏛️ *KEMENTERIAN AGAMA KAB. TANAH DATAR*\n━━━━━━━━━━━━━━\n📋 *AGENDA KEGIATAN*\n\n`;
    msg += `📅 *Tanggal:* ${formatDate(agenda.tanggal)}\n`;
    msg += `⏰ *Waktu:* ${agenda.waktu_mulai||'-'} s/d ${agenda.waktu_selesai||'-'}\n`;
    msg += `📍 *Tempat:* ${agenda.tempat||'-'}\n\n`;
    msg += `📝 *Kegiatan:* ${agenda.kegiatan||'-'}\n`;
    if(agenda.penanggung_jawab) msg += `👤 *Penanggung Jawab:* ${agenda.penanggung_jawab}\n`;
    if(agenda.pakaian) msg += `👔 *Pakaian:* ${agenda.pakaian}\n`;
    if(agenda.petugas) msg += `👥 *Petugas:* ${agenda.petugas}\n`;
    if(agenda.pejabat) msg += `🏅 *Pejabat:* ${agenda.pejabat}\n`;
    if(agenda.keterangan) msg += `\n📌 *Keterangan:* ${agenda.keterangan}\n`;
    msg += `━━━━━━━━━━━━━━\n👤 *Input oleh:* ${agenda.dibuat_oleh}\n_Mohon kehadiran tepat waktu. Terima kasih._`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

function renderAgendaTable() {
    const tbody = document.querySelector('#agendaTable tbody'); tbody.innerHTML='';
    if(!allAgenda.length) { tbody.innerHTML='<tr><td colspan="8" class="text-center text-muted">Tidak ada data agenda</td></tr>'; return; }
    const sorted = [...allAgenda].sort((a,b)=>(a.tanggal||'').localeCompare(b.tanggal||'')||(a.waktu_mulai||'').localeCompare(b.waktu_mulai||''));
    const today = new Date().toISOString().split('T')[0];
    sorted.forEach((a,i)=>{
        const tr=document.createElement('tr');
        tr.innerHTML=`<td>${i+1}</td><td>${formatDate(a.tanggal)} ${a.tanggal===today?'<span class="badge badge-warning">Hari Ini</span>':''}</td><td>${a.waktu_mulai||'-'} - ${a.waktu_selesai||'-'}</td><td>${a.kegiatan||'-'}</td><td>${a.tempat||'-'}</td><td>${a.dibuat_oleh||'-'}</td><td><span class="badge badge-success">Aktif</span></td><td><div class="action-btns"><button class="btn btn-info btn-sm" onclick="sendWhatsAppDirect(allAgenda.find(x=>x.id==='${a.id}'))" title="Kirim WA"><i class="fab fa-whatsapp"></i></button><button class="btn btn-warning btn-sm" onclick="editAgenda('${a.id}')"><i class="fas fa-edit"></i></button><button class="btn btn-danger btn-sm" onclick="deleteAgenda('${a.id}')"><i class="fas fa-trash"></i></button></div></td>`;
        tbody.appendChild(tr);
    });
}

function openAgendaModal(id=null) {
    document.getElementById('agendaModal').classList.add('active'); document.getElementById('agendaModalTitle').textContent=id?'Edit Agenda':'Tambah Agenda'; document.getElementById('agendaForm').reset(); document.getElementById('agendaId').value=''; document.getElementById('agendaTanggal').value=new Date().toISOString().split('T')[0];
    if(id) { 
        const a=allAgenda.find(x=>x.id===id); if(!a)return showToast('Data tidak ditemukan','error'); 
        document.getElementById('agendaId').value=a.id; 
        document.getElementById('agendaTanggal').value=a.tanggal; 
        document.getElementById('agendaWaktuMulai').value=a.waktu_mulai; 
        document.getElementById('agendaWaktuSelesai').value=a.waktu_selesai; 
        document.getElementById('agendaKegiatan').value=a.kegiatan; 
        document.getElementById('agendaTempat').value=a.tempat; 
        document.getElementById('agendaPJ').value=a.penanggung_jawab||''; 
        document.getElementById('agendaPakaian').value=a.pakaian||''; 
        document.getElementById('agendaPetugas').value=a.petugas||''; 
        document.getElementById('agendaPejabat').value=a.pejabat||''; 
        document.getElementById('agendaKeterangan').value=a.keterangan||''; 
    }
}
function closeAgendaModal(){document.getElementById('agendaModal').classList.remove('active');}
function editAgenda(id){openAgendaModal(id);}
async function deleteAgenda(id){if(!confirm('Hapus agenda ini?'))return; const res=await api('deleteAgenda',{id}); if(res.status==='success'){showToast(res.message,'success'); loadAgenda();}}

// ============================================
// USERS, DASHBOARD, CALENDAR, IMPORT/EXPORT, SETTINGS
// ============================================
async function loadUsers(){const res=await api('getUsers'); if(res.status==='success')renderUserTable(res.data);}
function renderUserTable(users){const tbody=document.querySelector('#usersTable tbody'); tbody.innerHTML=''; if(!users.length){tbody.innerHTML='<tr><td colspan="6" class="text-center text-muted">Tidak ada user</td></tr>'; return;} users.forEach((u,i)=>{const roleClean=(u.role||'user').toString().trim().toLowerCase(); const badge=roleClean==='admin'?'badge-warning':'badge-success'; const tr=document.createElement('tr'); tr.innerHTML=`<td>${i+1}</td><td>${u.username}</td><td>${u.nama_lengkap}</td><td>${u.jabatan}</td><td><span class="badge ${badge}">${roleClean==='admin'?'Admin':'User'}</span></td><td><div class="action-btns"><button class="btn btn-warning btn-sm" onclick="editUser('${u.username}')"><i class="fas fa-edit"></i></button><button class="btn btn-danger btn-sm" onclick="deleteUser('${u.username}')" ${roleClean==='admin'?'disabled':''}><i class="fas fa-trash"></i></button></div></td>`; tbody.appendChild(tr);});}
function openUserModal(username=null){document.getElementById('userModal').classList.add('active'); document.getElementById('userModalTitle').textContent=username?'Edit User':'Tambah User'; document.getElementById('userForm').reset(); document.getElementById('userOldUsername').value=''; document.getElementById('userPassword').placeholder='Masukkan password'; document.getElementById('userPassword').required=true; if(username){const rows=document.querySelectorAll('#usersTable tbody tr'); for(let row of rows)if(row.cells[1].textContent===username){document.getElementById('userUsername').value=username; document.getElementById('userOldUsername').value=username; document.getElementById('userNama').value=row.cells[2].textContent; document.getElementById('userJabatan').value=row.cells[3].textContent; document.getElementById('userRole').value=(row.cells[4].textContent||'').trim().toLowerCase()==='admin'?'admin':'user'; document.getElementById('userPassword').required=false; document.getElementById('userPassword').placeholder='Kosongkan jika tidak diubah'; break;}}}
async function handleUserSubmit(e){e.preventDefault(); const old=document.getElementById('userOldUsername').value; const p={username:document.getElementById('userUsername').value, role:document.getElementById('userRole').value, nama_lengkap:document.getElementById('userNama').value, jabatan:document.getElementById('userJabatan').value}; const pwd=document.getElementById('userPassword').value; let res; if(old){if(pwd)p.newPassword=pwd; res=await api('updateUser',p);}else{p.password=pwd; res=await api('addUser',p);} if(res.status==='success'){showToast(res.message,'success'); closeUserModal(); loadUsers();}}
function closeUserModal(){document.getElementById('userModal').classList.remove('active');}
function editUser(u){openUserModal(u);}
async function deleteUser(u){if(!confirm(`Hapus ${u}?`))return; const res=await api('deleteUser',{username:u}); if(res.status==='success'){showToast(res.message,'success'); loadUsers();}}

async function loadDashboard(){const today=new Date().toISOString().split('T')[0]; const weekEnd=new Date(); weekEnd.setDate(weekEnd.getDate()+7); const weekEndStr=weekEnd.toISOString().split('T')[0]; const monthStr=today.substring(0,7)+'-01'; document.getElementById('statTotal').textContent=allAgenda.length; document.getElementById('statToday').textContent=allAgenda.filter(a=>a.tanggal===today).length; document.getElementById('statWeek').textContent=allAgenda.filter(a=>a.tanggal>=today&&a.tanggal<=weekEndStr).length; document.getElementById('statMonth').textContent=allAgenda.filter(a=>a.tanggal>=monthStr).length; renderUpcomingTable();}
function renderUpcomingTable(){const tbody=document.querySelector('#upcomingTable tbody'); tbody.innerHTML=''; const today=new Date().toISOString().split('T')[0]; const up=allAgenda.filter(a=>a.tanggal>=today).sort((a,b)=>(a.tanggal||'').localeCompare(b.tanggal||'')).slice(0,5); if(!up.length){tbody.innerHTML='<tr><td colspan="5" class="text-center text-muted">Tidak ada agenda mendatang</td></tr>'; return;} up.forEach(a=>{tbody.innerHTML+=`<tr><td>${formatDate(a.tanggal)}</td><td>${a.waktu_mulai} - ${a.waktu_selesai}</td><td>${a.kegiatan}</td><td>${a.tempat}</td><td><button class="btn btn-info btn-sm" onclick="sendWhatsAppDirect(a)"><i class="fab fa-whatsapp"></i></button></td></tr>`;});}

function renderCalendar(){const y=calendarDate.getFullYear(), m=calendarDate.getMonth(); const months=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']; document.getElementById('calendarMonthYear').textContent=`${months[m]} ${y}`; const grid=document.getElementById('calendarGrid'); grid.innerHTML=''; ['Min','Sen','Sel','Rab','Kam','Jum','Sab'].forEach(d=>{const h=document.createElement('div'); h.className='calendar-header'; h.textContent=d; grid.appendChild(h);}); const firstDay=new Date(y,m,1).getDay(); const daysInMonth=new Date(y,m+1,0).getDate(); const today=new Date().toISOString().split('T')[0]; for(let i=0;i<firstDay;i++){const d=document.createElement('div'); d.className='calendar-day other-month'; grid.appendChild(d);} for(let d=1;d<=daysInMonth;d++){const dateStr=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; const el=document.createElement('div'); el.className='calendar-day'; if(dateStr===today)el.classList.add('today'); const count=allAgenda.filter(a=>a.tanggal===dateStr).length; el.innerHTML=`<div class="day-number">${d}</div>${count?`<span class="day-events">${count}</span>`:''}`; el.onclick=()=>showCalendarEvents(dateStr); grid.appendChild(el);}}
function changeMonth(dir){calendarDate.setMonth(calendarDate.getMonth()+dir); renderCalendar();}
function showCalendarEvents(dateStr){document.getElementById('selectedDate').textContent=formatDate(dateStr); const body=document.getElementById('calendarEventsBody'); const ags=allAgenda.filter(a=>a.tanggal===dateStr); body.innerHTML=ags.length?ags.map(a=>`<div style="padding:10px; border-left:4px solid var(--primary); background:#f8f9fa; margin-bottom:8px; border-radius:0 6px 6px 0;"><strong>${a.waktu_mulai} - ${a.waktu_selesai}</strong> | ${a.kegiatan}<br><small class="text-muted">📍 ${a.tempat}</small></div>`).join(''):'<p class="text-muted">Tidak ada agenda</p>';}

function handleImportFile(e){const file=e.target.files[0]; if(!file)return; const reader=new FileReader(); reader.onload=(ev)=>{try{importData=JSON.parse(ev.target.result); document.getElementById('importPreview').style.display='block'; document.getElementById('importPreviewContent').innerHTML=`<p>✅ Siap impor: <b>${importData.length}</b> data</p>`; showToast('File siap. Klik Konfirmasi.','info');}catch{showToast('Format JSON salah','error');}}; reader.readAsText(file);}
async function confirmImport(){if(!importData)return; const res=await api('importAgenda',{agendaData:importData}); if(res.status==='success'){showToast(res.message,'success'); document.getElementById('importPreview').style.display='none'; importData=null; document.getElementById('importFile').value=''; loadAgenda();}}
async function exportAgenda(fmt){const res=await api('exportAgenda',{username:currentUser.username, role:currentUser.role}); if(res.status!=='success')return; let c,t,ext; if(fmt==='json'){c=JSON.stringify(res.data,null,2); t='application/json'; ext='json';} else if(fmt==='csv'){const h=Object.keys(res.data[0]||{}); c=[h.join(','), ...res.data.map(r=>h.map(k=>`"${String(r[k]||'').replace(/"/g,'""')}"`).join(','))].join('\n'); t='text/csv'; ext='csv';} const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([c],{type})); a.download=`agenda_${new Date().toISOString().split('T')[0]}.${ext}`; a.click(); showToast('Export berhasil','success');}
function loadSettings(){document.getElementById('waNumber').value=localStorage.getItem('waNumber')||'';}
function saveWaNumber(){let num=document.getElementById('waNumber').value.replace(/\D/g,''); if(!num.startsWith('62'))num='62'+num.replace(/^0/,''); localStorage.setItem('waNumber',num); showToast('Nomor WA disimpan','success');}

// ============================================
// UTILS
// ============================================
function showLoading(show){document.getElementById('loading').style.display=show?'flex':'none';}
function showToast(msg,type='info'){const t=document.getElementById('toast'); t.textContent=msg; t.className=`toast ${type} show`; setTimeout(()=>t.classList.remove('show'),4000);}
function updateClock(){const now=new Date(); const opts={weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}; const el=document.getElementById('currentDateTime'); if(el)el.textContent=now.toLocaleDateString('id-ID',opts);}
function formatDate(ds){if(!ds)return'-'; const[y,m,d]=ds.split('-'); const months=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']; return`${parseInt(d)} ${months[parseInt(m)-1]} ${y}`;}
