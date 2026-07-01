// ============================================
// AGENDA PIMPINAN - FRONTEND JS (CLEAN & FIXED)
// ============================================

const API_URL = 'https://script.gogle.com/macros/s/AKfycbymrRxD3Q3t1IkFISFCRol0la4RqyOVdyhvmm0vKTMNs65BjJeSRTKWUc2AGtFjCeXV7w/exec';
let currentUser = null, allAgenda = [], calendarDate = new Date(), importData = null;
let idleTimer;
const SESSION_TIMEOUT = 10 * 60 * 1000;

const E = {
    building: String.fromCodePoint(0x1F3DB, 0xFE0F), date: String.fromCodePoint(0x1F4C5), clock: String.fromCodePoint(0x23F0),
    pin: String.fromCodePoint(0x1F4CD), doc: String.fromCodePoint(0x1F4DD), user: String.fromCodePoint(0x1F464),
    shirt: String.fromCodePoint(0x1F454), group: String.fromCodePoint(0x1F465), medal: String.fromCodePoint(0x1F3C5),
    note: String.fromCodePoint(0x1F4CC), bullet: String.fromCodePoint(0x1F539), line: '━━━━━━━━━━━━━━━━━━━━━━', divider: '──────────────────────'
};

let loadingCounter = 0; let loadingTimeout;

function showLoading() { loadingCounter++; clearTimeout(loadingTimeout); const el = document.getElementById('loading'); if (el) el.style.display = 'flex'; loadingTimeout = setTimeout(() => { loadingCounter = 0; const el = document.getElementById('loading'); if (el) el.style.display = 'none'; }, 8000); }
function hideLoading() { if (loadingCounter > 0) loadingCounter--; clearTimeout(loadingTimeout); if (loadingCounter <= 0) { loadingCounter = 0; const el = document.getElementById('loading'); if (el) el.style.display = 'none'; } }

document.addEventListener('DOMContentLoaded', () => { checkLogin(); setupEvents(); updateClock(); setInterval(updateClock, 1000); });

function setupEvents() {
    const loginForm = document.getElementById('loginForm'); if(loginForm) loginForm.addEventListener('submit', e => { e.preventDefault(); handleLogin(e); });
    // ============================================
// 🔑 FITUR EYE TOGGLE PASSWORD LOGIN
// ============================================
const togglePwd = document.getElementById('togglePassword');
if(togglePwd) {
    togglePwd.addEventListener('click', () => {
        const pwd = document.getElementById('loginPassword');
        const isPassword = pwd.type === 'password';
        pwd.type = isPassword ? 'text' : 'password';
        togglePwd.classList.toggle('fa-eye', !isPassword);
        togglePwd.classList.toggle('fa-eye-slash', isPassword);
    });
}
    const logoutBtn = document.getElementById('logoutBtn'); if(logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    const agendaForm = document.getElementById('agendaForm'); if(agendaForm) agendaForm.addEventListener('submit', e => { e.preventDefault(); handleAgendaSubmit(e); });
    
    const btnSaveUser = document.getElementById('btnSaveUser');
    if(btnSaveUser) {
        btnSaveUser.addEventListener('click', (e) => {
            e.preventDefault();
            handleUserSubmit();
        });
        // Tambahkan di dalam setupEvents(), setelah event listener lainnya:
document.addEventListener('change', (e) => {
    if (e.target.classList.contains('petugas-check') || e.target.id === 'agendaPetugasManual') {
        const hidden = document.getElementById('agendaPetugas');
        if (hidden) hidden.value = getPetugasValue();
    }
});
    }

    document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); const page=link.dataset.page; if(page) window.navigateTo(page); }));
    document.getElementById('btnViewAllAgenda')?.addEventListener('click', e => { e.preventDefault(); window.navigateTo('agenda'); });
    document.getElementById('btnSendDaily')?.addEventListener('click', e => { e.preventDefault(); sendDailyAgenda(); });
    const menuToggle = document.getElementById('menuToggle'); if(menuToggle) menuToggle.addEventListener('click', e => { e.stopPropagation(); document.getElementById('sidebar')?.classList.toggle('active'); });
    document.addEventListener('click', e => { const sidebar=document.getElementById('sidebar'), toggle=document.getElementById('menuToggle'); if(window.innerWidth<=767 && sidebar?.classList.contains('active') && !sidebar.contains(e.target) && !toggle?.contains(e.target)) sidebar.classList.remove('active'); });
    const importFile = document.getElementById('importFile'); if(importFile) importFile.addEventListener('change', handleImportFile);
    document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if(e.target===m) m.classList.remove('active'); }));
    document.getElementById('selectAllAgenda')?.addEventListener('change', e => { document.querySelectorAll('.agenda-check').forEach(cb => cb.checked = e.target.checked); });
    const waMode = document.getElementById('waMode'); const waNumInput = document.getElementById('waNumberInput');
    if(waMode && waNumInput) { waMode.addEventListener('change', () => { waNumInput.style.display = waMode.value === 'number' ? 'block' : 'none'; }); }

    // DIAGNOSTIK
    const roleSelect = document.getElementById('userRole');
    if(roleSelect) {
        roleSelect.addEventListener('change', function() {
            console.log('🔄 [LIVE] Role changed to:', this.value, '| Index:', this.selectedIndex);
        });
    }
}

async function api(action, payload = {}, options = {}) {
    if (!options.skipLoading) showLoading();
    try {
        const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({action,...payload}), signal: controller.signal });
        clearTimeout(timeoutId); if(!res.ok) throw new Error(`HTTP ${res.status}`); return await res.json();
    } catch(err) { if(err.name==='AbortError') showToast('Koneksi timeout.', 'error'); else showToast('Gagal terhubung ke server.', 'error'); return {status:'error', message: err.message}; }
    finally { if (!options.skipLoading) hideLoading(); }
}

function setupAutoLogout() { const events = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart', 'keypress']; events.forEach(evt => document.addEventListener(evt, resetActivityTimer, true)); resetActivityTimer(); }
function resetActivityTimer() { clearTimeout(idleTimer); idleTimer = setTimeout(() => { showToast('Sesi berakhir karena tidak aktif.', 'error'); handleLogout(); }, SESSION_TIMEOUT); }

function checkLogin() { const s = sessionStorage.getItem('agendaUser'); if(s){currentUser=JSON.parse(s); showApp();} }
async function handleLogin(e) {
    e.preventDefault(); const btn=document.getElementById('loginBtn'), errDiv=document.getElementById('loginError'); btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Memuat...'; errDiv.textContent='';
    const res = await api('login', {username:document.getElementById('loginUsername').value, password:document.getElementById('loginPassword').value});
    btn.disabled=false; btn.innerHTML='<i class="fas fa-sign-in-alt"></i> Masuk';
    if(res.status==='success'){ currentUser=res.data; sessionStorage.setItem('agendaUser', JSON.stringify(currentUser)); showApp(); } else {errDiv.textContent=res.message;}
}

function handleLogout() { clearTimeout(idleTimer); sessionStorage.removeItem('agendaUser'); currentUser = null; document.getElementById('loginPage').style.display='flex'; document.getElementById('appPage').style.display='none'; document.getElementById('loginForm')?.reset(); }

function showApp() {
    document.getElementById('loginPage').style.display='none'; document.getElementById('appPage').style.display='flex';
    document.getElementById('userAvatar').textContent=currentUser.nama_lengkap.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
    document.getElementById('userName').textContent=currentUser.nama_lengkap; 
    const roleTextEl = document.getElementById('userRoleText');
    if(roleTextEl) roleTextEl.textContent=currentUser.jabatan;
    
    const role = currentUser.role;
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.write-access').forEach(el => el.style.display = '');
    
    if (role === 'admin') document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
    else if (role === 'pimpinan') {
        document.querySelectorAll('.write-access').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    } else {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }

    setupAutoLogout(); loadSettings(); 
    window.navigateTo('dashboard'); 
    loadAgenda(); 
}

async function checkMySession() { if(!currentUser) return; const res = await api('checkMySession', {username: currentUser.username}, { skipLoading: true }); if(res.status==='success' && res.data?.force_logout) { showToast('⚠️ Sesi Anda telah diakhiri oleh Admin.', 'warning'); setTimeout(() => handleLogout(), 1500); } }

window.navigateTo = function(page) {
    document.querySelectorAll('.nav-link').forEach(l=>l.classList.toggle('active', l.dataset.page===page));
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    setTimeout(()=>{const t=document.getElementById(`page-${page}`); if(t) t.classList.add('active');},50);
    const t={dashboard:'Dashboard',agenda:'Manajemen Agenda',calendar:'Kalender',importExport:'Import/Export',users:'Manajemen User',settings:'Pengaturan'};
    document.getElementById('pageTitle').textContent=t[page]||'Dashboard';
    if(page==='dashboard')loadDashboard(); if(page==='agenda')loadAgenda(); if(page==='calendar')renderCalendar(); if(page==='users')loadUsers(); if(page==='settings')loadSettings();
    if(window.innerWidth<=767) document.getElementById('sidebar')?.classList.remove('active'); window.scrollTo({top:0,behavior:'smooth'});
}

function normalizeStatus() { const today=new Date().toISOString().split('T')[0]; allAgenda.forEach(a=>{if(a.tanggal && a.tanggal<today) a.status='selesai';}); }
async function loadAgenda() { 
    const res = await api('getAgenda',{
        username: currentUser.username,
        role: currentUser.role,
        startDate:document.getElementById('filterStartDate')?.value||'',
        endDate:document.getElementById('filterEndDate')?.value||'',
        search:document.getElementById('filterSearch')?.value||''
    }); 
    if(res.status==='success'){ 
        allAgenda=res.data||[]; 
        normalizeStatus(); 
        renderAgendaTable(); 
        loadDashboard(); 
    } 
    return res; 
}

async function handleAgendaSubmit(e) {
    e.preventDefault(); const id=document.getElementById('agendaId').value; 
    const p = { tanggal: document.getElementById('agendaTanggal').value, waktu_mulai: document.getElementById('agendaWaktuMulai').value, waktu_selesai: document.getElementById('agendaWaktuSelesai').value, kegiatan: document.getElementById('agendaKegiatan').value, tempat: document.getElementById('agendaTempat').value, penanggung_jawab: document.getElementById('agendaPJ').value, pakaian: document.getElementById('agendaPakaian').value,// ✅ GANTI dengan:
petugas: getPetugasValue(), pejabat: document.getElementById('agendaPejabat').value, keterangan: document.getElementById('agendaKeterangan').value, dibuat_oleh: currentUser.username }; 
    const wantWA=document.getElementById('sendWhatsApp')?.checked;
    let res; if(id){p.id=id;res=await api('updateAgenda',p);} else {res=await api('addAgenda',p);}
    if(res.status==='success'){showToast(res.message,'success');closeAgendaModal();if(!id&&wantWA&&res.data?.id)sendWhatsAppDirect({...p,id:res.data.id});await loadAgenda();}
}

// ✅ buildSingleMessage - untuk kirim 1 agenda
function buildSingleMessage(a) {
    let msg = `${E.building} *KEMENTERIAN AGAMA KAB. TANAH DATAR*\n${E.line}\n📋 *AGENDA KEGIATAN PIMPINAN*\n\n`;
    msg += `${E.date} *Tanggal:* ${(formatDate(a.tanggal) || '-')}\n${E.clock} *Waktu:* ${((a.waktu_mulai || '-') + ` - ` + (a.waktu_selesai || '-'))}\n${E.pin} *Tempat/Lokasi:* ${(a.tempat || '-')}\n\n`;
    msg += `${E.doc} *Nama Kegiatan:*\n*${(a.kegiatan || '-')}*\n\n`;
    msg += `${E.user} *Penanggung Jawab:* ${(a.penanggung_jawab || '-')}\n${E.shirt} *Pakaian:* ${(a.pakaian || '-')}\n*${E.group} Petugas:* *${(a.petugas || '-')}*\n${E.medal} *Pejabat:* ${(a.pejabat || '-')}\n\n`;
    msg += `${E.note} *Keterangan:* ${(a.keterangan || '-')}\n${E.line}\n`;
    msg += `${E.user} *Input oleh:* ${((currentUser && currentUser.username) || 'Admin')}\n_Mohon kehadiran tepat waktu._\n_Terima kasih._`;
    return msg;
}

// ✅ buildBulkMessage - untuk kirim banyak agenda
function buildBulkMessage(list) {
    let msg = `${E.building} *KEMENTERIAN AGAMA KAB. TANAH DATAR*\n${E.line}\n📋 *AGENDA KEGIATAN PIMPINAN (TERPILIH: ${list.length})*\n\n`;
    list.forEach((a, i) => {
        msg += `${E.bullet} *${(i + 1)}. ${(a.kegiatan || 'Kegiatan')}*\n`;
        msg += `${E.date} *Tanggal:* ${formatDate(a.tanggal)}\n${E.clock} *Waktu:* ${(a.waktu_mulai || '-')} - ${(a.waktu_selesai || '-')}\n`;
        msg += `${E.pin} *Tempat:* ${(a.tempat || '-')}\n`;
        if (a.penanggung_jawab?.trim()) msg += `${E.user} *PJ:* ${a.penanggung_jawab}\n`;
        if (a.pakaian?.trim()) msg += `${E.shirt} *Pakaian:* ${a.pakaian}\n`;
        if (a.petugas?.trim()) msg += `*${E.group} Petugas:* *${a.petugas}*\n`;
        if (a.pejabat?.trim()) msg += `${E.medal} *Pejabat:* ${a.pejabat}\n`;
        msg += `${E.divider}\n`;
    });
    msg += `${E.user} *Input oleh:* ${((currentUser && currentUser.username) || 'Admin')}\n_Mohon kehadiran tepat waktu._\n_Terima kasih._`;
    return msg;
}

function sendWhatsAppMessage(msg) {
    const mode = localStorage.getItem('waMode') || 'contact';
    const encoded = encodeURIComponent(msg);
    if (mode === 'contact') { window.open(`https://wa.me/?text=${encoded}`, '_blank'); showToast('Pilih <b>Grup</b> atau <b>Kontak</b> di WhatsApp yang terbuka.', 'info', 5000); return; }
    const raw = localStorage.getItem('waNumbers') || '';
    const numbers = raw.split(/[\n,]+/).map(n => n.trim().replace(/\D/g, '')).filter(n => n.startsWith('62') && n.length >= 10);
    if (numbers.length === 0) return showToast('Masukkan minimal 1 nomor di Pengaturan.', 'error');
    if (numbers.length === 1) { window.open(`https://wa.me/${numbers[0]}?text=${encoded}`, '_blank'); } 
    else {
        window.open(`https://wa.me/${numbers[0]}?text=${encoded}`, '_blank');
        let linksHtml = `<strong>📲 Klik untuk kirim ke nomor lain:</strong><br>`;
        numbers.slice(1).forEach((num) => { linksHtml += `<a href="https://wa.me/${num}?text=${encoded}" target="_blank" style="color:white;text-decoration:underline;display:block;margin:5px 0;font-size:0.9rem;">👉 ${num}</a>`; });
        showToast(linksHtml, 'info', 15000);
    }
}

window.sendWhatsAppDirect = function(a) { sendWhatsAppMessage(buildSingleMessage(a)); }
window.sendWhatsAppById = function(id) { 
    const a=allAgenda.find(x=>String(x.id)===String(id)); 
    if(!a){showToast('Memuat data terbaru...','info');loadAgenda().then(()=>{const r=allAgenda.find(x=>String(x.id)===String(id));r?sendWhatsAppDirect(r):showToast('Data tidak ditemukan.','error');});return;} 
    sendWhatsAppDirect(a); 
}
window.sendWhatsApp = window.sendWhatsAppDirect;

window.sendDailyAgenda = function() {
    const td = new Date().toISOString().split('T')[0];
    const daily = allAgenda.filter(a => a.tanggal === td && a.status !== 'selesai').sort((a,b)=>(a.waktu_mulai||'').localeCompare(b.waktu_mulai||''));
    if(daily.length===0) return showToast('Tidak ada agenda aktif hari ini', 'info');
    if(!confirm(`Kirim ${daily.length} agenda hari ini ke WhatsApp?`)) return;
    sendWhatsAppMessage(buildBulkMessage(daily));
}

window.sendSelectedAgendas = function() {
    const checked = document.querySelectorAll('.agenda-check:checked');
    if(checked.length === 0) return showToast('Pilih minimal 1 agenda untuk dikirim.', 'warning');
    const ids = Array.from(checked).map(c => c.value);
    const sel = allAgenda.filter(a => ids.includes(a.id)).sort((a,b) => (a.tanggal||'').localeCompare(b.tanggal||'') || (a.waktu_mulai||'').localeCompare(b.waktu_mulai||''));
    if(!confirm(`Kirim ${sel.length} agenda sekaligus ke WhatsApp?`)) return;
    sendWhatsAppMessage(buildBulkMessage(sel));
}

function renderAgendaTable() {
    const tbody=document.querySelector('#agendaTable tbody'); 
    if(!tbody)return; 
    tbody.innerHTML=''; 
    if(!allAgenda.length){
        tbody.innerHTML='<tr><td colspan="10" class="text-center text-muted">Tidak ada data agenda</td></tr>';
        return;
    }
    const s=[...allAgenda].sort((a,b)=>(a.tanggal||'').localeCompare(b.tanggal||'')||(a.waktu_mulai||'').localeCompare(b.waktu_mulai||'')), 
    td=new Date().toISOString().split('T')[0];
    s.forEach((a,i)=>{
        const isSelesai = a.status === 'selesai';
        const tr=document.createElement('tr');
        tr.innerHTML=`<td><input type="checkbox" class="agenda-check write-access" value="${a.id}"></td>
        <td>${i+1}</td>
        <td>${formatDate(a.tanggal)} ${a.tanggal===td?'<span class="badge badge-warning">Hari Ini</span>':''}</td>
        <td>${a.waktu_mulai||'-'} - ${a.waktu_selesai||'-'}</td>
        <td>${a.kegiatan||'-'}</td>
        <td>${a.tempat||'-'}</td>
        <td><div style="font-size:0.85rem;"><b>👥 Petugas:</b> <b>${a.petugas||'-'}</b></div></td>
        <td>${a.dibuat_oleh||'-'}</td>
        <td><span class="badge ${isSelesai?'badge-danger':'badge-success'}">${isSelesai?'Selesai':'Aktif'}</span></td>
        <td class="write-access"><div class="action-btns">
            <button class="btn btn-info btn-sm" onclick="sendWhatsAppById('${a.id}')" title="Kirim WA"><i class="fab fa-whatsapp"></i></button>
            <button class="btn btn-warning btn-sm" onclick="editAgenda('${a.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-danger btn-sm" onclick="deleteAgenda('${a.id}')"><i class="fas fa-trash"></i></button>
        </div></td>`;
        if(isSelesai) tr.style.opacity='0.7'; 
        tbody.appendChild(tr);
    });
}

function openAgendaModal(id=null){document.getElementById('agendaModal').classList.add('active');document.getElementById('agendaModalTitle').textContent=id?'Edit Agenda':'Tambah Agenda';document.getElementById('agendaForm').reset();document.getElementById('agendaId').value='';document.getElementById('agendaTanggal').value=new Date().toISOString().split('T')[0];if(id){const a=allAgenda.find(x=>x.id===id);if(!a)return showToast('Data tidak ditemukan','error');document.getElementById('agendaId').value=a.id;document.getElementById('agendaTanggal').value=a.tanggal;document.getElementById('agendaWaktuMulai').value=a.waktu_mulai;document.getElementById('agendaWaktuSelesai').value=a.waktu_selesai;document.getElementById('agendaKegiatan').value=a.kegiatan;document.getElementById('agendaTempat').value=a.tempat;document.getElementById('agendaPJ').value=a.penanggung_jawab||'';document.getElementById('agendaPakaian').value=a.pakaian||'';setPetugasValue(a.petugas || '');document.getElementById('agendaPejabat').value=a.pejabat||'';document.getElementById('agendaKeterangan').value=a.keterangan||'';}}
function closeAgendaModal(){document.getElementById('agendaModal').classList.remove('active');}
window.editAgenda=function(id){openAgendaModal(id);};
window.deleteAgenda=async function(id){if(!confirm('Hapus agenda ini?'))return;const res=await api('deleteAgenda',{id});if(res.status==='success'){showToast(res.message,'success');loadAgenda();}};

async function loadUsers(){ const res = await api('getUsers'); if(res.status === 'success') renderUsersTableCompact(res.data); }

function renderUsersTableCompact(users){
    const tbody = document.querySelector('#usersTableCompact tbody'); if(!tbody) return; tbody.innerHTML = '';
    if(!users.length){ tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding: 30px;"><i class="fas fa-users fa-2x mb-2"></i><br>Tidak ada user</td></tr>'; return; }
    users.forEach((u, index) => {
        const rc = (u.role || 'user').toString().trim().toLowerCase(); 
        const roleClass = rc === 'admin' ? 'role-admin' : (rc === 'pimpinan' ? 'role-warning' : 'role-user'); 
        const roleLabel = rc === 'admin' ? 'Admin' : (rc === 'pimpinan' ? 'Pimpinan' : 'User');
        const roleIcon = rc === 'admin' ? 'fas fa-shield-alt' : (rc === 'pimpinan' ? 'fas fa-user-tie' : 'fas fa-user'); 
        const isForced = u.force_logout;
        
        const tr = document.createElement('tr');
        tr.setAttribute('data-role', rc);
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td><div class="user-info-compact"><div class="user-avatar-compact">${(u.nama_lengkap || u.username).charAt(0).toUpperCase()}</div><div class="user-details-compact"><div class="user-name-compact">${u.nama_lengkap || '-'}</div><div class="user-username-compact">@${u.username}</div></div></div></td>
            <td>${u.jabatan || '-'}</td>
            <td><span class="badge-compact ${roleClass}"><i class="${roleIcon}"></i> ${roleLabel}</span></td>
            <td><span class="badge ${isForced ? 'badge-danger' : 'badge-success'}">${isForced ? '🔴 Nonaktif' : '🟢 Aktif'}</span></td>
            <td><div class="action-btns-compact">
                <button class="btn btn-warning btn-sm" onclick="editUser('${u.username}')" title="Edit"><i class="fas fa-edit"></i></button>
                ${rc !== 'admin' ? `
                    <button class="btn btn-danger btn-sm" onclick="deleteUser('${u.username}')" title="Hapus"><i class="fas fa-trash"></i></button>
                    <button class="btn btn-dark btn-sm" onclick="forceLogoutUser('${u.username}')" title="Paksa Logout"><i class="fas fa-power-off"></i></button>
                    <button class="btn btn-success btn-sm" onclick="allowLoginUser('${u.username}')" title="Izinkan Login"><i class="fas fa-check"></i></button>
                ` : `<span class="text-muted" style="font-size:0.8rem;">Admin Utama</span>`}
            </div></td>`;
        tbody.appendChild(tr);
    });
}

window.forceLogoutUser = async function(username) { if(!confirm(`Paksa logout user ${username}? User akan keluar otomatis dalam 20 detik.`)) return; const res = await api('forceLogoutUser', {username}); if(res.status==='success'){ showToast(res.message, 'success'); loadUsers(); } }
window.allowLoginUser = async function(username) { const res = await api('allowLoginUser', {username}); if(res.status==='success'){ showToast(res.message, 'success'); loadUsers(); } }

function openUserModal(username = null) {
    document.getElementById('userModal').classList.add('active');
    document.getElementById('userForm').reset();
    document.getElementById('userOldUsername').value = '';
    document.getElementById('userPassword').placeholder = 'Masukkan password';
    document.getElementById('userPassword').required = true;
    document.getElementById('userModalTitle').textContent = username ? 'Edit User' : 'Tambah User';
    
    const roleEl = document.getElementById('userRole');
    if(roleEl) roleEl.value = 'user';

    if (username) {
        const rows = document.querySelectorAll('#usersTableCompact tbody tr');
        for (let row of rows) {
            const uname = row.querySelector('.user-username-compact')?.textContent;
            if (uname && uname.includes(username)) {
                document.getElementById('userUsername').value = username;
                document.getElementById('userOldUsername').value = username;
                document.getElementById('userNama').value = row.querySelector('.user-name-compact').textContent;
                document.getElementById('userJabatan').value = row.querySelector('td:nth-child(3)').textContent;

                const rowRole = row.getAttribute('data-role') || 'user';
                if (roleEl) {
                    roleEl.value = rowRole;
                    roleEl.dispatchEvent(new Event('change'));
                }
                
                document.getElementById('userPassword').required = false;
                document.getElementById('userPassword').placeholder = 'Kosongkan jika tidak diubah';
                break;
            }
        }
    }
}

// ✅ DIAGNOSTIK & PERBAIKAN MUTLAK
async function handleUserSubmit() {
    console.log('🚀 [SUBMIT] Klik Simpan terdeteksi!');
    
    // Fix Typo: getElemen tById -> getElementById
    const roleEl = document.getElementById('userRole');
    if(!roleEl) return console.error('❌ Elemen #userRole TIDAK DITEMUKAN di DOM!');

    console.log('🔍 [DOM CHECK] HTML Dropdown saat ini:', roleEl.outerHTML);
    console.log('🔍 [DOM CHECK] value saat ini:', roleEl.value);
    console.log('🔍 [DOM CHECK] selectedIndex:', roleEl.selectedIndex, '-> Option value:', roleEl.options[roleEl.selectedIndex].value);

    // Fix Typo: select edRole -> selectedRole
    let selectedRole = roleEl.value.trim().toLowerCase();
    if (!selectedRole || selectedRole === '') selectedRole = roleEl.options[roleEl.selectedIndex].value.trim().toLowerCase();
    if (!selectedRole || selectedRole === '') selectedRole = 'user';

    // Fix Typo: do cument -> document
    const username = document.getElementById('userUsername').value.trim();
    const nama = document.getElementById('userNama').value.trim();
    const jabatan = document.getElementById('userJabatan').value.trim();
    const pwd = document.getElementById('userPassword').value;
    const old = document.getElementById('userOldUsername').value;

    if (!username || !nama || !jabatan) { showToast('⚠️ Username, Nama, dan Jabatan wajib diisi!', 'warning'); return; }
    // Fix Typo: & & -> &&
    if (!old && !pwd) { showToast('⚠️ Password wajib diisi untuk user baru!', 'warning'); return; }

    console.log('📤 [FINAL PAYLOAD] Role yang akan dikirim:', selectedRole);

    // Fix Typo: u sername -> username
    const payload = { username, role: selectedRole, nama_lengkap: nama, jabatan };
    if (old && pwd) payload.newPassword = pwd;
    if (!old) payload.password = pwd;

    const btn = document.getElementById('btnSaveUser');
    if(btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...'; }

    let res;
    try {
        res = old ? await api('updateUser', payload) : await api('addUser', payload);
        if (res.status === 'success') {
            showToast(res.message, 'success');
            closeUserModal();
            loadUsers();
        } else {
            showToast('❌ Gagal: ' + res.message, 'error');
        }
    } catch(err) {
        showToast('❌ Error Server.', 'error');
    } finally {
        if(btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Simpan'; }
    }
}

function closeUserModal(){document.getElementById('userModal').classList.remove('active');}
window.editUser=function(u){openUserModal(u);};
window.deleteUser=async function(u){if(!confirm(`Hapus user ${u}?`))return;const res=await api('deleteUser',{username:u});if(res.status==='success'){showToast(res.message,'success');loadUsers();}};

async function loadDashboard(){ const td=new Date().toISOString().split('T')[0],we=new Date();we.setDate(we.getDate()+7);const weS=we.toISOString().split('T')[0],mS=td.substring(0,7)+'-01'; const active=allAgenda.filter(a=>a.status!=='selesai'); document.getElementById('statTotal').textContent=active.length; document.getElementById('statToday').textContent=active.filter(a=>a.tanggal===td).length; document.getElementById('statWeek').textContent=active.filter(a=>a.tanggal>=td&&a.tanggal<=weS).length; document.getElementById('statMonth').textContent=active.filter(a=>a.tanggal>=mS).length; renderUpcomingTable(); }
function renderUpcomingTable(){ 
    const tbody=document.querySelector('#upcomingTable tbody');
    if(!tbody)return;
    tbody.innerHTML=''; 
    const td=new Date().toISOString().split('T')[0]; 
    const up=allAgenda.filter(a=>a.status!=='selesai' && a.tanggal && a.tanggal >=td)
        .sort((a,b)=>(a.tanggal||'').localeCompare(b.tanggal||'')||(a.waktu_mulai||'').localeCompare(b.waktu_mulai||''))
        .slice(0,5); 
    document.getElementById('upcomingTitle').textContent = up.length > 0 ? `${up.length} Agenda Mendatang` : 'Agenda Mendatang'; 
    
    if(!up.length){
        tbody.innerHTML='<tr><td colspan="7" class="text-center text-muted"><i class="fas fa-calendar-check fa-2x mb-2"></i><br>Tidak ada agenda mendatang</td></tr>';
        return;
    } 
    
    up.forEach(a=>{
        const tr=document.createElement('tr');
        tr.innerHTML=`<td>${formatDate(a.tanggal)} ${a.tanggal===td?'<span class="badge badge-warning">Hari Ini</span>':''}</td>
        <td style="white-space:nowrap;">${a.waktu_mulai||'-'} - ${a.waktu_selesai||'-'}</td>
        <td><strong>${a.kegiatan||'-'}</strong></td>
        <td>${a.tempat||'-'}</td>
        <td><div style="font-size:0.85rem;">👤 ${a.penanggung_jawab||'-'} ${a.pakaian?`<br><span class="badge badge-info" style="font-size:0.7rem;">👔 ${a.pakaian}</span>`:''}</div></td>
        <td><div style="font-size:0.85rem;"><b>👥 Petugas:</b> <b>${a.petugas||'-'}</b></div></td>
        <td class="write-access"><button class="btn btn-info btn-sm" onclick="sendWhatsAppById('${a.id}')" title="Kirim WA"><i class="fab fa-whatsapp"></i></button></td>`;
        tbody.appendChild(tr);
    });
}

function renderCalendar(){
    const y=calendarDate.getFullYear(), m=calendarDate.getMonth();
    const months=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    document.getElementById('calendarMonthYear').textContent=`${months[m]} ${y}`;
    const grid=document.getElementById('calendarGrid'); if(!grid) return;
    grid.innerHTML='';
    ['Min','Sen','Sel','Rab','Kam','Jum','Sab'].forEach(d=>{ const h=document.createElement('div'); h.className='calendar-header'; h.textContent=d; grid.appendChild(h); });
    const fd=new Date(y,m,1).getDay(); const dm=new Date(y,m+1,0).getDate(); const td=new Date().toISOString().split('T')[0];
    for(let i=0;i<fd;i++){ const d=document.createElement('div'); d.className='calendar-day other-month'; grid.appendChild(d); }
    for(let d=1;d<=dm;d++){
        const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; const el=document.createElement('div'); el.className='calendar-day';
        if(ds===td) el.classList.add('today');
        const count=allAgenda.filter(a=>a.tanggal===ds).length;
        if(count > 0) el.classList.add('has-event');
        el.innerHTML=`<div class="day-number">${d}</div>${count?`<span class="day-events">${count}</span>`:''}`;
        el.onclick=()=>showCalendarEvents(ds); grid.appendChild(el);
    }
}

window.changeMonth=function(dir){calendarDate.setMonth(calendarDate.getMonth()+dir);renderCalendar();};
function showCalendarEvents(ds){
    document.getElementById('selectedDate').textContent = formatDate(ds);
    const body = document.getElementById('calendarEventsBody');
    if(!body) return;
    const ags = allAgenda.filter(a => a.tanggal === ds);
    
    body.innerHTML = ags.length 
        ? ags.map(a => `
            <div class="calendar-event-item">
                <strong>${a.waktu_mulai||'-'} - ${a.waktu_selesai||'-'}</strong> | ${a.kegiatan||'-'}
                <br><small class="text-muted">📍 ${a.tempat||'-'} | <b>👥 Petugas:</b> <b>${a.petugas||'-'}</b></small>
            </div>
        `).join('')
        : '<p class="text-muted">Tidak ada agenda</p>';
}

function handleImportFile(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=(ev)=>{try{importData=JSON.parse(ev.target.result);document.getElementById('importPreview').style.display='block';document.getElementById('importPreviewContent').innerHTML=`<p>✅ Siap impor: <b>${importData.length}</b> data</p>`;showToast('File siap. Klik Konfirmasi.','info');}catch{showToast('Format JSON salah','error');}};r.readAsText(f);}
async function confirmImport(){if(!importData)return;const res=await api('importAgenda',{agendaData:importData});if(res.status==='success'){showToast(res.message,'success');document.getElementById('importPreview').style.display='none';importData=null;document.getElementById('importFile').value='';loadAgenda();}}

async function exportAgenda(fmt) {
    const res = await api('exportAgenda', { username: currentUser.username, role: currentUser.role });
    if (res.status !== 'success' || !res.data || res.data.length === 0) { showToast('Tidak ada data untuk diekspor.', 'warning'); return; }
    let content, type, ext;
    if (fmt === 'json') { content = JSON.stringify(res.data, null, 2); type = 'application/json'; ext = 'json'; } 
    else if (fmt === 'csv') {
        const BOM = '\uFEFF'; const headers = Object.keys(res.data[0]);
        const csvRows = res.data.map(row => headers.map(header => `"${String(row[header] || '').replace(/"/g, '""')}"`).join(','));
        content = BOM + [headers.join(','), ...csvRows].join('\n'); type = 'text/csv;charset=utf-8'; ext = 'csv';
    }
    const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `agenda_${new Date().toISOString().split('T')[0]}.${ext}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast(`Export ${ext.toUpperCase()} berhasil`, 'success');
}

window.generateDailyReport = function() {
    const dateInput = document.getElementById('reportDate').value;
    if (!dateInput) return showToast('Pilih tanggal terlebih dahulu', 'warning');
    
    const dailyAgenda = allAgenda.filter(a => a.tanggal === dateInput);
    if (dailyAgenda.length === 0) return showToast('Tidak ada agenda pada tanggal tersebut.', 'info');
    
    dailyAgenda.sort((a, b) => (a.waktu_mulai || '').localeCompare(b.waktu_mulai || ''));
    const fullDate = new Date(dateInput).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    const printContent = `<!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <title>Laporan Agenda - ${fullDate}</title>
        <style>
            @page { size: A4 landscape; margin: 1.5cm; }
            body { font-family: 'Segoe UI', sans-serif; color: #111; line-height: 1.4; padding: 0; margin: 0; background: #fff; }
            .container { max-width: 100%; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 25px; border-bottom: 3px double #1a5632; padding-bottom: 15px; }
            .header h1 { margin: 0; color: #1a5632; font-size: 20px; text-transform: uppercase; }
            .header h2 { margin: 8px 0 0; color: #333; font-size: 16px; }
            .header p { margin: 5px 0 0; color: #555; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
            th { background-color: #1a5632; color: #fff; padding: 10px 8px; text-align: center; border: 1px solid #1a5632; }
            td { border: 1px solid #ccc; padding: 8px; vertical-align: top; }
            tr:nth-child(even) { background-color: #f8f9fa; }
            .footer { margin-top: 30px; text-align: right; font-size: 12px; color: #444; }
            .no-print { text-align: center; margin-top: 40px; padding: 20px; background: #e9ecef; border-radius: 8px; }
            .btn-print { padding: 12px 25px; background: #1a5632; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 15px; font-weight: bold; }
            @media print { body { padding: 0; } .no-print { display: none !important; } }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Kementerian Agama Kabupaten Tanah Datar</h1>
                <h2>LAPORAN REKAP AGENDA PIMPINAN</h2>
                <p>Hari/Tanggal: ${fullDate}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>No</th>
                        <th>Waktu</th>
                        <th>Nama Kegiatan</th>
                        <th>Tempat</th>
                        <th>Penanggung Jawab</th>
                        <th>Petugas</th>
                        <th>Pejabat</th>
                        <th>Ket & Pakaian</th>
                    </tr>
                </thead>
                <tbody>
                    ${dailyAgenda.map((a, i) => `
                        <tr>
                            <td style="text-align:center;">${i + 1}</td>
                            <td style="text-align:center;">${a.waktu_mulai || '-'}<br><small>s/d ${a.waktu_selesai || '-'}</small></td>
                            <td><strong>${a.kegiatan || '-'}</strong></td>
                            <td>${a.tempat || '-'}</td>
                            <td>${a.penanggung_jawab || '-'}</td>
                            <td><strong>${a.petugas || '-'}</strong></td>
                            <td>${a.pejabat || '-'}</td>
                            <td>${a.keterangan || '-'}<br><small>${a.pakaian || ''}</small></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="footer">
                <p>Dicetak oleh: ${currentUser ? currentUser.nama_lengkap : 'Admin'}</p>
                <p>Waktu Cetak: ${new Date().toLocaleString('id-ID')}</p>
            </div>
        </div>
        <div class="no-print">
            <button class="btn-print" onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
        </div>
    </body>
    </html>`;

    const printWindow = window.open('', '_blank'); 
    printWindow.document.write(printContent); 
    printWindow.document.close();
}

function loadSettings(){ document.getElementById('waMode').value = localStorage.getItem('waMode') || 'contact'; document.getElementById('waNumbers').value = localStorage.getItem('waNumbers') || ''; document.getElementById('waNumberInput').style.display = document.getElementById('waMode').value === 'number' ? 'block' : 'none'; }
function saveWaSettings(){ localStorage.setItem('waMode', document.getElementById('waMode').value); localStorage.setItem('waNumbers', document.getElementById('waNumbers').value); showToast('Pengaturan WhatsApp berhasil disimpan', 'success'); }

function showToast(msg, type='info', duration=4000){ const t=document.getElementById('toast'); t.innerHTML = msg; t.className=`toast ${type} show`; setTimeout(()=>t.classList.remove('show'), duration); }
function updateClock(){const n=new Date();const o={weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'};const e=document.getElementById('currentDateTime');if(e)e.textContent=n.toLocaleDateString('id-ID',o);}
function formatDate(ds){if(!ds)return'-';if(ds instanceof Date){const d=ds.getDate(),m=ds.getMonth(),y=ds.getFullYear();const mo=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];return`${d} ${mo[m]} ${y}`;}const p=String(ds).trim().split(/[-T]/);if(p.length>=3){const[y,m,d]=p;const mo=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];return`${parseInt(d,10)} ${mo[parseInt(m,10)-1]} ${y}`;}return String(ds);}

window.navigateTo=window.navigateTo||navigateTo; window.sendWhatsAppDirect=window.sendWhatsAppDirect||sendWhatsAppDirect; window.sendWhatsAppById=window.sendWhatsAppById||sendWhatsAppById; window.sendWhatsApp=window.sendWhatsApp||sendWhatsAppDirect; window.sendDailyAgenda=window.sendDailyAgenda||sendDailyAgenda; window.sendSelectedAgendas=window.sendSelectedAgendas||sendSelectedAgendas; window.editAgenda=window.editAgenda||editAgenda; window.deleteAgenda=window.deleteAgenda||deleteAgenda; window.openAgendaModal=window.openAgendaModal||openAgendaModal; window.closeAgendaModal=window.closeAgendaModal||closeAgendaModal; window.loadAgenda=window.loadAgenda||loadAgenda; window.changeMonth=window.changeMonth||changeMonth; window.openUserModal=window.openUserModal||openUserModal; window.closeUserModal=window.closeUserModal||closeUserModal; window.editUser=window.editUser||editUser; window.deleteUser=window.deleteUser||deleteUser; window.forceLogoutUser=window.forceLogoutUser||forceLogoutUser; window.allowLoginUser=window.allowLoginUser||allowLoginUser; window.confirmImport=window.confirmImport||confirmImport; window.exportAgenda=window.exportAgenda||exportAgenda; window.saveWaSettings=window.saveWaSettings||saveWaSettings; window.generateDailyReport=window.generateDailyReport||generateDailyReport;

// 🔄 Helper: Ambil nilai Petugas (checkboxes + manual)
function getPetugasValue() {
    const checked = Array.from(document.querySelectorAll('.petugas-check:checked')).map(cb => cb.value);
    const manual = document.getElementById('agendaPetugasManual')?.value.trim() || '';
    const manualArr = manual ? manual.split(',').map(s => s.trim()).filter(s => s) : [];
    const combined = [...new Set([...checked, ...manualArr])]; // Unique values
    return combined.join(', ');
}

// 🔄 Helper: Set nilai Petugas ke form (untuk edit)
function setPetugasValue(value) {
    // Reset checkboxes
    document.querySelectorAll('.petugas-check').forEach(cb => cb.checked = false);
    
    if (!value) {
        if (document.getElementById('agendaPetugasManual')) document.getElementById('agendaPetugasManual').value = '';
        if (document.getElementById('agendaPetugas')) document.getElementById('agendaPetugas').value = '';
        return;
    }
    
    const items = String(value).split(',').map(s => s.trim()).filter(s => s);
    const predefined = ['Kakan Kemenag', 'Kasubag', 'Kasi PAIS', 'Kasi PD.Pontren', 'Kasi Bimas', 'Kasi Penmad', 'Kasi Zawa'];
    
    items.forEach(item => {
        // Cek checkbox jika ada di predefined
        if (predefined.includes(item)) {
            const cb = document.querySelector(`.petugas-check[value="${item}"]`);
            if (cb) cb.checked = true;
        }
    });
    
    // Input manual: tampilkan item yang tidak ada di predefined
    const manualOnly = items.filter(i => !predefined.includes(i)).join(', ');
    if (document.getElementById('agendaPetugasManual')) document.getElementById('agendaPetugasManual').value = manualOnly;
    if (document.getElementById('agendaPetugas')) document.getElementById('agendaPetugas').value = items.join(', ');
}
