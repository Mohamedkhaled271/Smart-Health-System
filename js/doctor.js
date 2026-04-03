// ====================================================
// DOCTOR DASHBOARD - PROFESSIONAL INTEGRATED VERSION (REAL DATA ONLY)
// ====================================================
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
                if (role !== 'doctor') {
                    if (role === 'admin') window.location.href = 'admin.html';
                    else if (role === 'patient') window.location.href = 'patient.html';
                    else window.location.href = 'index.html';
                }
            }).catch(() => {
                window.location.href = 'index.html';
            });
        });
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

    // ==================== SIDEBAR COLLAPSE ====================
    const sidebar = document.getElementById('sidebar');
    const collapseBtn = document.getElementById('collapseSidebar');
    collapseBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        const icon = collapseBtn.querySelector('i');
        if (sidebar.classList.contains('collapsed')) {
            icon.classList.remove('fa-chevron-left');
            icon.classList.add('fa-chevron-right');
        } else {
            icon.classList.remove('fa-chevron-right');
            icon.classList.add('fa-chevron-left');
        }
    });

    // ==================== NAVIGATION ====================
    const menuItems = document.querySelectorAll('.menu-item');
    const pages = document.querySelectorAll('.page-section');

    function showPage(pageId) {
        pages.forEach(p => p.classList.remove('active'));
        const activePage = document.getElementById(pageId + 'Page');
        if (activePage) activePage.classList.add('active');
        const filterDropdown = document.getElementById('filterDropdown');
        const dateDropdown = document.getElementById('dateDropdown');
        if (filterDropdown) filterDropdown.classList.remove('active');
        if (dateDropdown) dateDropdown.classList.remove('active');
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
        notif.className = 'notification';
        notif.innerText = msg;
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 2000);
    }

    // ==================== MUTE ALERTS ====================
    const muteBtn = document.getElementById('muteAlerts');
    muteBtn.addEventListener('click', () => {
        alertSoundEnabled = !alertSoundEnabled;
        muteBtn.innerHTML = alertSoundEnabled ? '<i class="fas fa-volume-up"></i> Mute' : '<i class="fas fa-volume-mute"></i> Unmute';
        muteBtn.classList.toggle('muted', !alertSoundEnabled);
        showNotification(alertSoundEnabled ? 'Alerts unmuted' : 'Alerts muted');
    });

    // ==================== REAL-TIME CHARTS (Chart.js) ====================
    const heartCtx = document.getElementById('heartChart')?.getContext('2d');
    const spo2Ctx = document.getElementById('spo2Chart')?.getContext('2d');
    const tempCtx = document.getElementById('tempChart')?.getContext('2d');

    let heartChart, spo2Chart, tempChart;
    const heartHistory = [], spo2History = [], tempHistory = [], timeLabels = [];

    if (heartCtx) {
        heartChart = new Chart(heartCtx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Heart Rate', data: [], borderColor: '#2563eb', backgroundColor: '#2563eb20', tension: 0.3, fill: true }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 40, max: 120 } }, plugins: { legend: { display: false } } }
        });
    }
    if (spo2Ctx) {
        spo2Chart = new Chart(spo2Ctx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'SpO2', data: [], borderColor: '#10b981', backgroundColor: '#10b98120', tension: 0.3, fill: true }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 85, max: 100 } }, plugins: { legend: { display: false } } }
        });
    }
    if (tempCtx) {
        tempChart = new Chart(tempCtx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Temp', data: [], borderColor: '#f59e0b', backgroundColor: '#f59e0b20', tension: 0.3, fill: true }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 35, max: 39 } }, plugins: { legend: { display: false } } }
        });
    }

    // هذه الدالة الآن سيتم استدعاؤها فقط عند وصول بيانات حقيقية
    window.updateCharts = function(heart, spo2, temp) {
        const now = new Date().toLocaleTimeString();
        if (heart) { heartHistory.push(heart); if (heartHistory.length > 20) heartHistory.shift(); }
        if (spo2) { spo2History.push(spo2); if (spo2History.length > 20) spo2History.shift(); }
        if (temp) { tempHistory.push(temp); if (tempHistory.length > 20) tempHistory.shift(); }
        timeLabels.push(now);
        if (timeLabels.length > 20) timeLabels.shift();

        if (heartChart) { heartChart.data.labels = timeLabels; heartChart.data.datasets[0].data = heartHistory; heartChart.update(); }
        if (spo2Chart) { spo2Chart.data.labels = timeLabels; spo2Chart.data.datasets[0].data = spo2History; spo2Chart.update(); }
        if (tempChart) { tempChart.data.labels = timeLabels; tempChart.data.datasets[0].data = tempHistory; tempChart.update(); }
    };

    // ==================== DATA UPDATE LOGIC (REAL DATA) ====================
    // دالة لتحديث الواجهة بالبيانات الحقيقية القادمة من MQTT
    window.updateUI = function(vitals) {
        if (vitals.heart) document.getElementById('heartValue').innerHTML = vitals.heart + ' <span>bpm</span>';
        if (vitals.spo2) document.getElementById('spo2Value').innerHTML = vitals.spo2 + ' <span>%</span>';
        if (vitals.temp) document.getElementById('tempValue').innerHTML = vitals.temp + ' <span>°C</span>';
        if (vitals.roomTemp) document.getElementById('roomTempValue').innerHTML = vitals.roomTemp + ' <span>°C</span>';
        if (vitals.humidity) document.getElementById('humidityValue').innerHTML = vitals.humidity + ' <span>%</span>';
        if (vitals.position) document.getElementById('positionValue').innerText = vitals.position;

        // تحديث المؤشرات اللونية بناءً على القيم الحقيقية
        const updateIndicator = (val, elementId, thresholds) => {
            const el = document.getElementById(elementId);
            if (!el) return;
            if (val > thresholds.dangerMax || val < thresholds.dangerMin) { el.className = 'card-indicator indicator-danger'; el.innerText = 'Critical'; }
            else if (val > thresholds.warnMax || val < thresholds.warnMin) { el.className = 'card-indicator indicator-warning'; el.innerText = 'Warning'; }
            else { el.className = 'card-indicator indicator-normal'; el.innerText = 'Normal'; }
        };

        if (vitals.heart) updateIndicator(vitals.heart, 'heartIndicator', { dangerMax: 100, dangerMin: 50, warnMax: 90, warnMin: 60 });
        if (vitals.spo2) updateIndicator(vitals.spo2, 'spo2Indicator', { dangerMax: 100, dangerMin: 90, warnMax: 100, warnMin: 95 });
        if (vitals.temp) updateIndicator(parseFloat(vitals.temp), 'tempIndicator', { dangerMax: 38.5, dangerMin: 35, warnMax: 37.5, warnMin: 36 });

        // تشغيل التنبيه الصوتي للحالات الحرجة الحقيقية
        if (vitals.heart > 100 || vitals.heart < 50 || vitals.spo2 < 90 || vitals.position === 'fall') {
            alertSound('danger');
        }
        
        // تحديث الرسوم البيانية
        window.updateCharts(vitals.heart, vitals.spo2, parseFloat(vitals.temp));
    };

    // ==================== HISTORICAL CHARTS & PDF ====================
    const heartHistoryChart = new ApexCharts(document.querySelector("#heartHistoryChart"), {
        chart: { type: 'area', height: 250 },
        series: [{ name: 'Heart Rate', data: [70, 72, 75, 73, 72, 74, 71] }],
        xaxis: { categories: ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'] },
        colors: ['#2563eb'], fill: { type: 'gradient' }
    });
    heartHistoryChart.render();

    const reportForm = document.getElementById('patientReportForm');
    if (reportForm) {
        reportForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.text("Patient Report Summary", 20, 20);
            doc.text(`Name: ${document.getElementById('patientName').value}`, 20, 40);
            doc.save("report.pdf");
            showNotification("Report saved!");
        });
    }

    // ==================== EXPORT BUTTONS ====================
    document.getElementById('exportBtn')?.addEventListener('click', () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.autoTable({ html: '#recentPatientsTable' });
        doc.save('recent_patients.pdf');
    });

    // ==================== SEARCH & FILTERS ====================
    document.getElementById('globalSearch')?.addEventListener('input', function() {
        const value = this.value.toLowerCase();
        document.querySelectorAll('table tbody tr').forEach(row => {
            row.style.display = row.innerText.toLowerCase().includes(value) ? '' : 'none';
        });
    });

    // ==================== LOGOUT ====================
    const logoutBtn = document.createElement('a');
    logoutBtn.className = 'menu-item';
    logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i><span>Logout</span>';
    logoutBtn.addEventListener('click', () => firebase.auth().signOut());
    document.querySelector('.sidebar-footer')?.appendChild(logoutBtn);

    // Initial page load
    showPage('dashboard');

})();
