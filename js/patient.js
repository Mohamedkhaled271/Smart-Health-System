// ====================================================
// PATIENT DASHBOARD - LIVE INTEGRATED VERSION
// ==================== (Helios Medical) ==============
(function() {
    "use strict";

    // ==================== AUTH GUARD ====================
    if (typeof firebase !== 'undefined') {
        firebase.auth().onAuthStateChanged((user) => {
            if (!user) {
                window.location.href = 'index.html';
                return;
            }
            firebase.database().ref(`users/${user.uid}/role`).once('value').then((snapshot) => {
                const role = snapshot.val();
                if (role !== 'patient') {
                    if (role === 'doctor') window.location.href = 'doctor.html';
                    else if (role === 'admin') window.location.href = 'admin.html';
                    else window.location.href = 'index.html';
                }
            }).catch(() => {
                window.location.href = 'index.html';
            });
        });
    } else {
        console.warn('Firebase not loaded, skipping auth guard');
    }

    // ==================== GLOBAL VARIABLES ====================
    let alertSoundEnabled = true;

    // -------------------- Alert Sound using Web Audio API --------------------
    const alertSound = (() => {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            return (type = 'warning') => {
                if (!alertSoundEnabled) return;
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.frequency.value = type === 'danger' ? 800 : 400;
                gain.gain.value = 0.2;
                osc.start();
                osc.stop(audioCtx.currentTime + 0.2);
            };
        } catch (e) {
            return () => {};
        }
    })();

    // ==================== SIDEBAR & NAVIGATION ====================
    const sidebar = document.getElementById('sidebar');
    const collapseBtn = document.getElementById('collapseSidebar');
    
    if (collapseBtn) {
        collapseBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            const icon = collapseBtn.querySelector('i');
            icon.className = sidebar.classList.contains('collapsed') ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
        });
    }

    const menuItems = document.querySelectorAll('.menu-item');
    const pages = document.querySelectorAll('.page-section');

    function showPage(pageId) {
        pages.forEach(p => p.classList.remove('active'));
        const activePage = document.getElementById(pageId + 'Page');
        if (activePage) activePage.classList.add('active');
        
        if (pageId === 'profile') initProfilePage();
    }

    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            menuItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            showPage(this.dataset.page);
        });
    });

    // ==================== NOTIFICATION SYSTEM ====================
    function showNotification(msg, type = 'info') {
        const notif = document.createElement('div');
        notif.className = `notification ${type}`;
        notif.innerText = msg;
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 3000);
    }

    // ==================== MUTE ALERTS ====================
    const muteBtn = document.getElementById('muteAlerts');
    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            alertSoundEnabled = !alertSoundEnabled;
            muteBtn.innerHTML = alertSoundEnabled ? '<i class="fas fa-volume-up"></i> Mute' : '<i class="fas fa-volume-mute"></i> Unmute';
            muteBtn.classList.toggle('muted', !alertSoundEnabled);
            showNotification(alertSoundEnabled ? 'Alerts unmuted' : 'Alerts muted');
        });
    }

    // ==================== CHARTS INITIALIZATION ====================
    const heartCtx = document.getElementById('heartChart')?.getContext('2d');
    const spo2Ctx = document.getElementById('spo2Chart')?.getContext('2d');
    const tempCtx = document.getElementById('tempChart')?.getContext('2d');

    let heartChart, spo2Chart, tempChart;
    const historyLimit = 20;
    const dataHistory = { heart: [], spo2: [], temp: [], labels: [] };

    function createChart(ctx, label, color, min, max) {
        return new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: label, data: [], borderColor: color, backgroundColor: color + '20', tension: 0.3, fill: true }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: min, max: max } }, plugins: { legend: { display: false } } }
        });
    }

    if (heartCtx) heartChart = createChart(heartCtx, 'Heart Rate', '#2563eb', 40, 120);
    if (spo2Ctx) spo2Chart = createChart(spo2Ctx, 'SpO2', '#10b981', 85, 100);
    if (tempCtx) tempChart = createChart(tempCtx, 'Temp', '#f59e0b', 34, 42);

    // ==================== CORE UI UPDATE FUNCTION ====================
    // This function is now only called by REAL data listeners (Firebase/MQTT)
    window.updateUI = function(vitals) {
        if (!vitals) return;

        // Update Values
        if(vitals.heart) document.getElementById('heartValue').innerHTML = `${vitals.heart} <span>bpm</span>`;
        if(vitals.spo2) document.getElementById('spo2Value').innerHTML = `${vitals.spo2} <span>%</span>`;
        if(vitals.temp) document.getElementById('tempValue').innerHTML = `${parseFloat(vitals.temp).toFixed(1)} <span>°C</span>`;

        // Update Indicators & Thresholds
        updateIndicator('heart', vitals.heart, 60, 100, 50, 110);
        updateIndicator('spo2', vitals.spo2, 95, 100, 90, 100);
        updateIndicator('temp', vitals.temp, 36, 37.5, 35, 38.5);

        // Update Charts
        const now = new Date().toLocaleTimeString();
        dataHistory.labels.push(now);
        if (vitals.heart) dataHistory.heart.push(vitals.heart);
        if (vitals.spo2) dataHistory.spo2.push(vitals.spo2);
        if (vitals.temp) dataHistory.temp.push(vitals.temp);

        if (dataHistory.labels.length > historyLimit) {
            dataHistory.labels.shift();
            dataHistory.heart.shift();
            dataHistory.spo2.shift();
            dataHistory.temp.shift();
        }

        if (heartChart) { heartChart.data.labels = dataHistory.labels; heartChart.data.datasets[0].data = dataHistory.heart; heartChart.update('none'); }
        if (spo2Chart) { spo2Chart.data.labels = dataHistory.labels; spo2Chart.data.datasets[0].data = dataHistory.spo2; spo2Chart.update('none'); }
        if (tempChart) { tempChart.data.labels = dataHistory.labels; tempChart.data.datasets[0].data = dataHistory.temp; tempChart.update('none'); }

        checkCriticalAlerts(vitals);
    };

    function updateIndicator(type, value, warnMin, warnMax, critMin, critMax) {
        const ind = document.getElementById(`${type}Indicator`);
        if (!ind) return;
        
        if (value < critMin || value > critMax) { ind.className = 'card-indicator indicator-danger'; ind.innerText = 'Critical'; alertSound('danger'); }
        else if (value < warnMin || value > warnMax) { ind.className = 'card-indicator indicator-warning'; ind.innerText = 'Warning'; }
        else { ind.className = 'card-indicator indicator-normal'; ind.innerText = 'Normal'; }
    }

    function checkCriticalAlerts(vitals) {
        const alertsList = document.getElementById('alertsList');
        let alertMsg = "";

        if (vitals.heart > 110 || vitals.heart < 50) alertMsg = `Irregular Heart Rate: ${vitals.heart} bpm`;
        else if (vitals.spo2 < 90) alertMsg = `Low Oxygen Level: ${vitals.spo2}%`;
        else if (vitals.temp > 38.5) alertMsg = `High Fever Detected: ${vitals.temp}°C`;

        if (alertMsg) {
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert-item danger';
            alertDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i><div class="alert-content"><b>${alertMsg}</b><br><small>${new Date().toLocaleTimeString()}</small></div>`;
            alertsList.prepend(alertDiv);
            if (alertsList.children.length > 8) alertsList.removeChild(alertsList.lastChild);
        }
    }

    // ==================== PROFILE & SETTINGS ====================
    function initProfilePage() {
        const profileInputs = document.querySelectorAll('.profile-input');
        const editBtn = document.getElementById('editProfileBtn');
        const saveBtn = document.getElementById('saveProfileBtn');

        editBtn?.addEventListener('click', () => {
            profileInputs.forEach(input => { input.readOnly = false; input.disabled = false; });
            editBtn.style.display = 'none';
            saveBtn.style.display = 'inline-block';
        });

        saveBtn?.addEventListener('click', () => {
            profileInputs.forEach(input => { input.readOnly = true; input.disabled = true; });
            saveBtn.style.display = 'none';
            editBtn.style.display = 'inline-block';
            showNotification('Profile updated successfully');
        });
    }

    // ==================== EXPORT PDF ====================
    document.getElementById('exportBtn')?.addEventListener('click', () => {
        showNotification('Generating Health Report...');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text("Helios Medical - Patient Health Report", 20, 20);
        doc.text(`Date: ${new Date().toLocaleString()}`, 20, 30);
        doc.save("health_report.pdf");
    });

    // ==================== LOGOUT ====================
    const logoutBtn = document.querySelector('.fa-sign-out-alt')?.parentElement;
    logoutBtn?.addEventListener('click', async () => {
        if (confirm('Are you sure you want to logout?')) {
            await firebase.auth().signOut();
            window.location.href = 'index.html';
        }
    });

})();
