const API_URL = 'https://script.google.com/macros/s/AKfycbxsMinDFpWXajV5PEJY-BGbF6z0DywgzFr2Jws7f_Co1W-5SqMhkFHGXXksqTcIt9IQOw/exec';
let currentUser = null, allAgenda = [], calendarDate = new Date(), importData = null;
let inactivityTimer, sessionCheckTimer;
const SESSION_TIMEOUT = 10 * 60 * 1000;

// ✅ SISTEM LOADING COUNTER + TIMEOUT (TIDAK PERNAH STUCK)
let loadingCounter = 0;
let loadingTimeout;

function showLoading() {
    loadingCounter++;
    clearTimeout(loadingTimeout);
    const el = document.getElementById('loading');
    if (el) el.style.display = 'flex';
    // Fallback: paksa hide setelah 8 detik jika request hang
    loadingTimeout = setTimeout(() => {
        loadingCounter = 0;
        const el = document.getElementById('loading');
        if (el) el.style.display = 'none';
    }, 8000);
}

function hideLoading() {
    loadingCounter--;
    clearTimeout(loadingTimeout);
    if (loadingCounter <= 0) {
        loadingCounter = 0;
        const el = document.getElementById('loading');
        if (el) el.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => { checkLogin(); setupEvents(); updateClock(); setInterval(updateClock, 1000); });

function setupEvents() {
    const loginForm = document.getElementById('loginForm'); if(loginForm) loginForm.addEventListener('submit', e => { e.preventDefault(); handleLogin(e); });
    const logoutBtn = document.getElementById('logoutBtn'); if(logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    const agendaForm = document.getElementById('agendaForm'); if(agendaForm) agendaForm.addEventListener('submit', e => { e.preventDefault(); handleAgendaSubmit(e); });
    const userForm = document.getElementById('userForm'); if(userForm) userForm.addEventListener('submit', e => { e.preventDefault(); handleUserSubmit(e); });
    
    document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); const page=link.dataset.page; if(page) window.navigateTo(page); }));
    document.getElementById('btnViewAllAgenda')?.addEventListener('click', e => { e.preventDefault(); window.navigateTo('agenda'); });
    document.getElementById('btnSendDaily')?.addEventListener('click', e => { e.preventDefault(); sendDailyAgenda(); });
    const menuToggle = document.getElementById('menuToggle'); if(menuToggle) menuToggle.addEventListener('click', e => { e.stopPropagation(); document.getElementById('sidebar')?.classList.toggle('active'); });
    document.addEventListener('click', e => { const sidebar=document.getElementById('sidebar'), toggle=document.getElementById('menuToggle'); if(window.innerWidth<=767 && sidebar?.classList.contains('active') && !sidebar.contains(e.target) && !toggle?.contains(e.target)) sidebar.classList.remove('active'); });
    const importFile = document.getElementById('importFile'); if(importFile) importFile.addEventListener('change', handleImportFile);
    document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if(e.target===m) m.classList.remove('active'); }));
    document.getElementById('selectAllAgenda')?.addEventListener('change', e => { document.querySelectorAll('.agenda-check').forEach(cb => cb.checked = e.target.checked); });
}

// ✅ API DENGAN ABORTCONTROLLER & TIMEOUT (CEGAH LOADING NYANGKUT)
async function api(action, payload={}) {
    resetActivityTimer();
    showLoading();
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // Batas 15 detik
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action, ...payload }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error('🔍 API ERROR:', err);
        if (err.name === 'AbortError') showToast('Koneksi timeout. Periksa internet Anda.', 'error');
        else showToast('Gagal terhubung ke server.', 'error');
        return { status: 'error', message: err.message };
    } finally {
        hideLoading();
    }
}

function setupAutoLogout() {
    ['click','keydown','mousemove','scroll','touchstart'].forEach(evt => document.addEventListener(evt, resetActivityTimer, true));
    resetActivityTimer();
    if(sessionCheckTimer) clearInterval(sessionCheckTimer);
    sessionCheckTimer = setInterval(checkMySession, 20000);
}
function resetActivityTimer() { clearTimeout(inactivityTimer); inactivityTimer = setTimeout(() => { if(currentUser){ showToast('Sesi berakhir karena tidak aktif 10 menit.', 'warning'); handleLogout(); } }, SESSION_TIMEOUT); }

function checkLogin() { const s=localStorage.getItem('agendaUser'); if(s){currentUser=JSON.parse(s); showApp();} }
async function handleLogin(e) {
    e.preventDefault(); const btn=document.getElementById('loginBtn'), errDiv=document.getElementById('loginError'); btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Memuat...'; errDiv.textContent='';
    const res = await api('login', {username:document.getElementById('loginUsername').value, password:document.getElementById('loginPassword').value});
    btn.disabled=false; btn.innerHTML='<i class="fas fa-sign-in-alt"></i> Masuk';
    if(res.status==='success'){currentUser=res.data; localStorage.setItem('agendaUser',JSON.stringify(currentUser)); showApp();} else {errDiv.textContent=res.message;}
}
function handleLogout() { 
    clearTimeout(inactivityTimer); if(sessionCheckTimer) clearInterval(sessionCheckTimer);
    localStorage.removeItem('agendaUser'); currentUser=null; 
    document.getElementById('loginPage').style.display='flex'; document.getElementById('appPage').style.display='none'; 
    document.getElementById('loginForm')?.reset(); 
}
function showApp() {
    document.getElementById('loginPage').style.display='none'; document.getElementById('appPage').style.display='flex';
    document.getElementById('userAvatar').textContent=currentUser.nama_lengkap.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
    document.getElementById('userName').textContent=currentUser.nama_lengkap; document.getElementById('userRole').textContent=currentUser.jabatan;
    document.querySelectorAll('.admin-only').forEach(el=>el.style.display=currentUser.role==='admin'?'flex':'none');
    setupAutoLogout(); window.navigateTo('dashboard');
}

async function checkMySession() {
    if(!currentUser) return;
    const res = await api('checkMySession', {username: currentUser.username});
    if(res.status==='success' && res.data?.force_logout) {
        showToast('⚠️ Sesi Anda telah diakhiri oleh Admin.', 'warning');
        setTimeout(() => handleLogout(), 1500);
    }
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

function normalizeStatus() { const today=new Date().toISOString().split('T')[0]; allAgenda.forEach(a=>{if(a.tanggal && a.tanggal<today) a.status='selesai';}); }

async function loadAgenda() {
    const res = await api('getAgenda',{username:currentUser.username,role:currentUser.role,startDate:document.getElementById('filterStartDate')?.value||'',endDate:document.getElementById('filterEndDate')?.value||'',search:document.getElementById('filterSearch')?.value||''});
    if(res.status==='success'){ allAgenda=res.data||[]; normalizeStatus(); renderAgendaTable(); loadDashboard(); } return res;
}

async function handleAgendaSubmit(e) {
    e.preventDefault(); 
    const id=document.getElementById('agendaId').value; 
    const p = {
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
    const wantWA=document.getElementById('sendWhatsApp')?.checked;
    let res; if(id){p.id=id;res=await api('updateAgenda',p);} else {res=await api('addAgenda',p);}
    if(res.status==='success'){showToast(res.message,'success');closeAgendaModal();if(!id&&wantWA&&res.data?.id)sendWhatsAppDirect({...p,id:res.data.id});await loadAgenda();}
}

// ✅ FIX WA ICON `?` DI DEVICE LAMA: Encoding bersih + Fallback popup
function openWhatsApp(msg) {
    let ph = localStorage.getItem('waNumber') || '';
    ph = ph.replace(/\D/g, '');
    if (!ph.startsWith('62')) ph = '62' + ph.replace(/^0/, '');
    if (ph.length < 10) return showToast('Atur nomor WA di Pengaturan dulu', 'warning');

    // Bersihkan karakter kontrol & pastikan line break standar
    const cleanMsg = msg.replace(/[\r\x00-\x1F\x7F-\x9F]/g, '').replace(/\n/g, '\n');
    const encoded = encodeURIComponent(cleanMsg);
    const url = `https://wa.me/${ph}?text=${encoded}`;

    try {
        const win = window.open(url, '_blank');
        // Deteksi jika popup diblokir atau gagal
        if (!win || win.closed || typeof win.closed === 'undefined') {
            showToast('Popup diblokir. Izinkan popup untuk WhatsApp, atau klik ikon WA lagi.', 'warning');
            // Fallback: buka di tab yang sama
            window.location.href = url;
        }
    } catch (e) {
        console.error('WA Open Error:', e);
        // Fallback aman
        window.location.href = url;
    }
}

window.sendWhatsAppDirect = function(a) {
    let msg = `🏛️ *KEMENTERIAN AGAMA KAB. TANAH DATAR*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📋 *AGENDA KEGIATAN PIMPINAN*\n\n`;
    msg += `📅 *Tanggal:* ${formatDate(a.tanggal)}\n`;
    msg += `⏰ *Waktu:* ${a.waktu_mulai||'-'} - ${a.waktu_selesai||'-'}\n`;
    msg += `📍 *Tempat/Lokasi:* ${a.tempat||'-'}\n\n`;
    msg += `📝 *Nama Kegiatan:*\n*${a.kegiatan||'-'}*\n\n`;
    
    if(a.penanggung_jawab?.trim()) msg += `👤 *Penanggung Jawab:* ${a.penanggung_jawab}\n`;
    if(a.pakaian?.trim()) msg += `👔 *Pakaian:* ${a.pakaian}\n`;
    if(a.petugas?.trim()) msg += `👥 *Petugas:* ${a.petugas}\n`;
    if(a.pejabat?.trim()) msg += `🏅 *Pejabat:* ${a.pejabat}\n`;
    if(a.keterangan?.trim()) msg += `\n📌 *Keterangan:* ${a.keterangan}\n`;
    
    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `👤 *Input oleh:* ${a.dibuat_oleh||currentUser.username}\n`;
    msg += `_Mohon kehadiran tepat waktu._\n`;
    msg += `_Terima kasih._`;
    
    openWhatsApp(msg);
}

window.sendWhatsAppById = function(id) { const a=allAgenda.find(x=>String(x.id)===String(id)); if(!a){showToast('Memuat data terbaru...','info');loadAgenda().then(()=>{const r=allAgenda.find(x=>String(x.id)===String(id));r?sendWhatsAppDirect(r):showToast('Data tidak ditemukan.','error');});return;} sendWhatsAppDirect(a); }
window.sendWhatsApp = window.sendWhatsAppDirect;

window.sendDailyAgenda = function() {
    const td = new Date().toISOString().split('T')[0];
    const daily = allAgenda.filter(a => a.tanggal === td && a.status !== 'selesai').sort((a,b)=>(a.waktu_mulai||'').localeCompare(b.waktu_mulai||''));
    if(daily.length===0) return showToast('Tidak ada agenda aktif hari ini', 'info');
    if(!confirm(`Kirim ${daily.length} agenda hari ini ke WhatsApp?`)) return;
    
    let msg = `🏛️ *KEMENTERIAN AGAMA KAB. TANAH DATAR*\n━━━━━━━━━━━━━━\n📋 *AGENDA HARI INI*\n📅 ${formatDate(td)}\n\n`;
    daily.forEach((a,i)=>{ 
        msg+=`🔹 *${i+1}. ${a.kegiatan||'Kegiatan'}*\n`;
        msg+=`⏰ ${a.waktu_mulai||'-'} - ${a.waktu_selesai||'-'}\n📍 ${a.tempat||'-'}\n`; 
        if(a.penanggung_jawab) msg+=`👤 PJ: ${a.penanggung_jawab}\n`; 
        msg+=`──────────────────────\n`; 
    });
    msg+=`👤 *Dibuat oleh:* ${currentUser.username}\n_Mohon kehadiran tepat waktu. Terima kasih._`;
    openWhatsApp(msg);
}

window.sendSelectedAgendas = function() {
    const checked = document.querySelectorAll('.agenda-check:checked');
    if(checked.length === 0) return showToast('Pilih minimal 1 agenda untuk dikirim.', 'warning');

    const ids = Array.from(checked).map(c => c.value);
    const sel = allAgenda.filter(a => ids.includes(a.id))
        .sort((a,b) => (a.tanggal||'').localeCompare(b.tanggal||'') || (a.waktu_mulai||'').localeCompare(b.waktu_mulai||''));

    if(!confirm(`Kirim ${sel.length} agenda sekaligus ke WhatsApp?\n(Pastikan data sudah lengkap)`)) return;

    let msg = `🏛️ *KEMENTERIAN AGAMA KAB. TANAH DATAR*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📋 *AGENDA KEGIATAN PIMPINAN (TERPILIH: ${sel.length})*\n\n`;

    sel.forEach((a, i) => {
        msg += `🔹 *${i+1}. ${a.kegiatan||'Kegiatan'}*\n`;
        msg += `📅 ${formatDate(a.tanggal)} | ⏰ ${a.waktu_mulai||'-'} - ${a.waktu_selesai||'-'}\n`;
        msg += `📍 ${a.tempat||'-'}\n`;
        if(a.penanggung_jawab) msg += `👤 PJ: ${a.penanggung_jawab}\n`;
        if(a.pakaian) msg += `👔 Pakaian: ${a.pakaian}\n`;
        if(a.petugas) msg += `👥 Petugas: ${a.petugas}\n`;
        if(a.pejabat) msg += `🏅 Pejabat: ${a.pejabat}\n`;
        msg += `──────────────────────\n`;
    });

    msg += `👤 *Dibuat oleh:* ${currentUser.username}\n`;
    msg += `_Mohon kehadiran tepat waktu. Terima kasih._`;
    openWhatsApp(msg);
}

function renderAgendaTable() {
    const tbody=document.querySelector('#agendaTable tbody'); if(!tbody)return; tbody.innerHTML=''; if(!allAgenda.length){tbody.innerHTML='<tr><td colspan="9" class="text-center text-muted">Tidak ada data agenda</td></tr>';return;}
    const s=[...allAgenda].sort((a,b)=>(a.tanggal||'').localeCompare(b.tanggal||'')||(a.waktu_mulai||'').localeCompare(b.waktu_mulai||'')), td=new Date().toISOString().split('T')[0];
    s.forEach((a,i)=>{ const isSelesai = a.status === 'selesai'; const tr=document.createElement('tr'); tr.innerHTML=`<td><input type="checkbox" class="agenda-check" value="${a.id}"></td><td>${i+1}</td><td>${formatDate(a.tanggal)} ${a.tanggal===td?'<span class="badge badge-warning">Hari Ini</span>':''}</td><td>${a.waktu_mulai||'-'} - ${a.waktu_selesai||'-'}</td><td>${a.kegiatan||'-'}</td><td>${a.tempat||'-'}</td><td>${a.dibuat_oleh||'-'}</td><td><span class="badge ${isSelesai?'badge-danger':'badge-success'}">${isSelesai?'Selesai':'Aktif'}</span></td><td><div class="action-btns"><button class="btn btn-info btn-sm" onclick="sendWhatsAppById('${a.id}')" title="Kirim WA"><i class="fab fa-whatsapp"></i></button><button class="btn btn-warning btn-sm" onclick="editAgenda('${a.id}')"><i class="fas fa-edit"></i></button><button class="btn btn-danger btn-sm" onclick="deleteAgenda('${a.id}')"><i class="fas fa-trash"></i></button></div></td>`; if(isSelesai) tr.style.opacity='0.7'; tbody.appendChild(tr); });
}
function openAgendaModal(id=null){document.getElementById('agendaModal').classList.add('active');document.getElementById('agendaModalTitle').textContent=id?'Edit Agenda':'Tambah Agenda';document.getElementById('agendaForm').reset();document.getElementById('agendaId').value='';document.getElementById('agendaTanggal').value=new Date().toISOString().split('T')[0];if(id){const a=allAgenda.find(x=>x.id===id);if(!a)return showToast('Data tidak ditemukan','error');document.getElementById('agendaId').value=a.id;document.getElementById('agendaTanggal').value=a.tanggal;document.getElementById('agendaWaktuMulai').value=a.waktu_mulai;document.getElementById('agendaWaktuSelesai').value=a.waktu_selesai;document.getElementById('agendaKegiatan').value=a.kegiatan;document.getElementById('agendaTempat').value=a.tempat;document.getElementById('agendaPJ').value=a.penanggung_jawab||'';document.getElementById('agendaPakaian').value=a.pakaian||'';document.getElementById('agendaPetugas').value=a.petugas||'';document.getElementById('agendaPejabat').value=a.pejabat||'';document.getElementById('agendaKeterangan').value=a.keterangan||'';}}
function closeAgendaModal(){document.getElementById('agendaModal').classList.remove('active');}
window.editAgenda=function(id){openAgendaModal(id);};
window.deleteAgenda=async function(id){if(!confirm('Hapus agenda ini?'))return;const res=await api('deleteAgenda',{id});if(res.status==='success'){showToast(res.message,'success');loadAgenda();}};

async function loadUsers(){ const res = await api('getUsers'); if(res.status === 'success') renderUsersTableCompact(res.data); }
function renderUsersTableCompact(users){
    const tbody = document.querySelector('#usersTableCompact tbody'); if(!tbody) return; tbody.innerHTML = '';
    if(!users.length){ tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding: 30px;"><i class="fas fa-users fa-2x mb-2"></i><br>Tidak ada user</td></tr>'; return; }
    
    users.forEach((u, index) => {
        const rc = (u.role || 'user').toString().trim().toLowerCase();
        const roleClass = rc === 'admin' ? 'role-admin' : 'role-user';
        const roleLabel = rc === 'admin' ? 'Admin' : 'User';
        const roleIcon = rc === 'admin' ? 'fas fa-shield-alt' : 'fas fa-user';
        const isForced = u.force_logout;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td><div class="user-info-compact"><div class="user-avatar-compact">${(u.nama_lengkap || u.username).charAt(0).toUpperCase()}</div><div class="user-details-compact"><div class="user-name-compact">${u.nama_lengkap || '-'}</div><div class="user-username-compact">@${u.username}</div></div></div></td>
            <td>${u.jabatan || '-'}</td>
            <td><span class="badge-compact ${roleClass}"><i class="${roleIcon}"></i> ${roleLabel}</span></td>
            <td><span class="badge ${isForced ? 'badge-danger' : 'badge-success'}">${isForced ? '🔴 Nonaktif' : '🟢 Aktif'}</span></td>
            <td>
                <div class="action-btns-compact">
                    ${rc !== 'admin' ? `
                    <button class="btn btn-danger btn-sm" onclick="forceLogoutUser('${u.username}')" title="Paksa Logout">
                        <i class="fas fa-power-off"></i> Logout
                    </button>
                    <button class="btn btn-success btn-sm" onclick="allowLoginUser('${u.username}')" title="Izinkan Login">
                        <i class="fas fa-check"></i> Izinkan
                    </button>` : `<span class="text-muted" style="font-size:0.8rem;">Admin Utama</span>`}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.forceLogoutUser = async function(username) {
    if(!confirm(`Paksa logout user ${username}? User akan keluar otomatis dalam 20 detik.`)) return;
    const res = await api('forceLogoutUser', {username});
    if(res.status==='success'){ showToast(res.message, 'success'); loadUsers(); }
}
window.allowLoginUser = async function(username) {
    const res = await api('allowLoginUser', {username});
    if(res.status==='success'){ showToast(res.message, 'success'); loadUsers(); }
}

function openUserModal(username=null){document.getElementById('userModal').classList.add('active');document.getElementById('userModalTitle').textContent=username?'Edit User':'Tambah User';document.getElementById('userForm').reset();document.getElementById('userOldUsername').value='';document.getElementById('userPassword').placeholder='Masukkan password';document.getElementById('userPassword').required=true;if(username){const rows=document.querySelectorAll('#usersTableCompact tbody tr'); for(let row of rows){if(row.querySelector('.user-username-compact')?.textContent.includes(username)){document.getElementById('userUsername').value=username;document.getElementById('userOldUsername').value=username;document.getElementById('userNama').value=row.querySelector('.user-name-compact').textContent;document.getElementById('userJabatan').value=row.querySelector('td:nth-child(3)').textContent;document.getElementById('userRole').value=(row.querySelector('.badge-compact').textContent || '').trim().toLowerCase().includes('admin')?'admin':'user';document.getElementById('userPassword').required=false;document.getElementById('userPassword').placeholder='Kosongkan jika tidak diubah';break;}}}}
async function handleUserSubmit(e){e.preventDefault();const old=document.getElementById('userOldUsername').value,p={username:document.getElementById('userUsername').value,role:document.getElementById('userRole').value,nama_lengkap:document.getElementById('userNama').value,jabatan:document.getElementById('userJabatan').value},pwd=document.getElementById('userPassword').value;let res;if(old){if(pwd)p.newPassword=pwd;res=await api('updateUser',p);}else{p.password=pwd;res=await api('addUser',p);}if(res.status==='success'){showToast(res.message,'success');closeUserModal();loadUsers();}}
function closeUserModal(){document.getElementById('userModal').classList.remove('active');}
window.editUser=function(u){openUserModal(u);};
window.deleteUser=async function(u){if(!confirm(`Hapus user ${u}?`))return;const res=await api('deleteUser',{username:u});if(res.status==='success'){showToast(res.message,'success');loadUsers();}};

async function loadDashboard(){ const td=new Date().toISOString().split('T')[0],we=new Date();we.setDate(we.getDate()+7);const weS=we.toISOString().split('T')[0],mS=td.substring(0,7)+'-01'; const active=allAgenda.filter(a=>a.status!=='selesai'); document.getElementById('statTotal').textContent=active.length; document.getElementById('statToday').textContent=active.filter(a=>a.tanggal===td).length; document.getElementById('statWeek').textContent=active.filter(a=>a.tanggal>=td&&a.tanggal<=weS).length; document.getElementById('statMonth').textContent=active.filter(a=>a.tanggal>=mS).length; renderUpcomingTable(); }
function renderUpcomingTable(){ const tbody=document.querySelector('#upcomingTable tbody');if(!tbody)return;tbody.innerHTML=''; const td=new Date().toISOString().split('T')[0]; const up=allAgenda.filter(a=>a.status!=='selesai' && a.tanggal && a.tanggal>=td).sort((a,b)=>(a.tanggal||'').localeCompare(b.tanggal||'')||(a.waktu_mulai||'').localeCompare(b.waktu_mulai||'')).slice(0,5); document.getElementById('upcomingTitle').textContent = up.length > 0 ? `${up.length} Agenda Mendatang` : 'Agenda Mendatang'; if(!up.length){tbody.innerHTML='<tr><td colspan="6" class="text-center text-muted"><i class="fas fa-calendar-check fa-2x mb-2"></i><br>Tidak ada agenda mendatang</td></tr>';return;} up.forEach(a=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${formatDate(a.tanggal)} ${a.tanggal===td?'<span class="badge badge-warning">Hari Ini</span>':''}</td><td style="white-space:nowrap;">${a.waktu_mulai||'-'} - ${a.waktu_selesai||'-'}</td><td><strong>${a.kegiatan||'-'}</strong></td><td>${a.tempat||'-'}</td><td><div style="font-size:0.85rem;">👤 ${a.penanggung_jawab||'-'} ${a.pakaian?`<br><span class="badge badge-info" style="font-size:0.7rem;">👔 ${a.pakaian}</span>`:''}</div></td><td><button class="btn btn-info btn-sm" onclick="sendWhatsAppById('${a.id}')" title="Kirim WA"><i class="fab fa-whatsapp"></i></button></td>`;tbody.appendChild(tr);});}

function renderCalendar(){const y=calendarDate.getFullYear(),m=calendarDate.getMonth(),months=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];document.getElementById('calendarMonthYear').textContent=`${months[m]} ${y}`;const grid=document.getElementById('calendarGrid');if(!grid)return;grid.innerHTML='';['Min','Sen','Sel','Rab','Kam','Jum','Sab'].forEach(d=>{const h=document.createElement('div');h.className='calendar-header';h.textContent=d;grid.appendChild(h);});const fd=new Date(y,m,1).getDay(),dm=new Date(y,m+1,0).getDate(),td=new Date().toISOString().split('T')[0];for(let i=0;i<fd;i++){const d=document.createElement('div');d.className='calendar-day other-month';grid.appendChild(d);}for(let d=1;d<=dm;d++){const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,el=document.createElement('div');el.className='calendar-day';if(ds===td)el.classList.add('today');const count=allAgenda.filter(a=>a.tanggal===ds).length;el.innerHTML=`<div class="day-number">${d}</div>${count?`<span class="day-events">${count}</span>`:''}`;el.onclick=()=>showCalendarEvents(ds);grid.appendChild(el);}}
window.changeMonth=function(dir){calendarDate.setMonth(calendarDate.getMonth()+dir);renderCalendar();};
function showCalendarEvents(ds){document.getElementById('selectedDate').textContent=formatDate(ds);const body=document.getElementById('calendarEventsBody');if(!body)return;const ags=allAgenda.filter(a=>a.tanggal===ds);body.innerHTML=ags.length?ags.map(a=>`<div class="calendar-event-item"><strong>${a.waktu_mulai||'-'} - ${a.waktu_selesai||'-'}</strong> | ${a.kegiatan||'-'}<br><small class="text-muted">📍 ${a.tempat||'-'}</small></div>`).join(''):'<p class="text-muted">Tidak ada agenda</p>';}

function handleImportFile(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=(ev)=>{try{importData=JSON.parse(ev.target.result);document.getElementById('importPreview').style.display='block';document.getElementById('importPreviewContent').innerHTML=`<p>✅ Siap impor: <b>${importData.length}</b> data</p>`;showToast('File siap. Klik Konfirmasi.','info');}catch{showToast('Format JSON salah','error');}};r.readAsText(f);}
async function confirmImport(){if(!importData)return;const res=await api('importAgenda',{agendaData:importData});if(res.status==='success'){showToast(res.message,'success');document.getElementById('importPreview').style.display='none';importData=null;document.getElementById('importFile').value='';loadAgenda();}}
async function exportAgenda(fmt){const res=await api('exportAgenda',{username:currentUser.username,role:currentUser.role});if(res.status!=='success')return;let c,t,ex;if(fmt==='json'){c=JSON.stringify(res.data,null,2);t='application/json';ex='json';}else if(fmt==='csv'){const h=Object.keys(res.data[0]||{});c=[h.join(','),...res.data.map(r=>h.map(k=>`"${String(r[k]||'').replace(/"/g,'""')}"`).join(','))].join('\n');t='text/csv';ex='csv';}const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([c],{type}));a.download=`agenda_${new Date().toISOString().split('T')[0]}.${ex}`;a.click();showToast('Export berhasil','success');}

function loadSettings(){document.getElementById('waNumber').value=localStorage.getItem('waNumber')||'';}
function saveWaNumber(){let n=document.getElementById('waNumber').value.replace(/\D/g,'');if(!n.startsWith('62'))n='62'+n.replace(/^0/,'');localStorage.setItem('waNumber',n);showToast('Nomor WA disimpan','success');}

function showToast(msg,type='info'){const t=document.getElementById('toast');t.textContent=msg;t.className=`toast ${type} show`;setTimeout(()=>t.classList.remove('show'),4000);}
function updateClock(){const n=new Date();const o={weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'};const e=document.getElementById('currentDateTime');if(e)e.textContent=n.toLocaleDateString('id-ID',o);}
function formatDate(ds){if(!ds)return'-';if(ds instanceof Date){const d=ds.getDate(),m=ds.getMonth(),y=ds.getFullYear();const mo=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];return`${d} ${mo[m]} ${y}`;}const p=String(ds).trim().split(/[-T]/);if(p.length>=3){const[y,m,d]=p;const mo=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];return`${parseInt(d,10)} ${mo[parseInt(m,10)-1]} ${y}`;}return String(ds);}

// ✅ GLOBAL EXPORT LENGKAP
window.navigateTo=window.navigateTo||navigateTo;
window.sendWhatsAppDirect=window.sendWhatsAppDirect||sendWhatsAppDirect;
window.sendWhatsAppById=window.sendWhatsAppById||sendWhatsAppById;
window.sendWhatsApp=window.sendWhatsApp||sendWhatsAppDirect;
window.sendDailyAgenda=window.sendDailyAgenda||sendDailyAgenda;
window.sendSelectedAgendas=window.sendSelectedAgendas||sendSelectedAgendas;
window.editAgenda=window.editAgenda||editAgenda;
window.deleteAgenda=window.deleteAgenda||deleteAgenda;
window.openAgendaModal=window.openAgendaModal||openAgendaModal;
window.closeAgendaModal=window.closeAgendaModal||closeAgendaModal;
window.loadAgenda=window.loadAgenda||loadAgenda;
window.changeMonth=window.changeMonth||changeMonth;
window.openUserModal=window.openUserModal||openUserModal;
window.closeUserModal=window.closeUserModal||closeUserModal;
window.editUser=window.editUser||editUser;
window.deleteUser=window.deleteUser||deleteUser;
window.forceLogoutUser=window.forceLogoutUser||forceLogoutUser;
window.allowLoginUser=window.allowLoginUser||allowLoginUser;
window.confirmImport=window.confirmImport||confirmImport;
window.exportAgenda=window.exportAgenda||exportAgenda;
window.saveWaNumber=window.saveWaNumber||saveWaNumber;
