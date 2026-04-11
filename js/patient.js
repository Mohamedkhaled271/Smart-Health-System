// ====================================================
// PATIENT DASHBOARD - PROFESSIONAL INTEGRATED VERSION
// ====================================================
(function() {
    "use strict";

    // ==================== AUTH GUARD (Using Firebase Auth) ====================
    console.log('✅ Using Firebase Authentication system');

    // ==================== GLOBAL VARIABLES ====================
    let mqttSimInterval;                // Interval for simulated MQTT updates
    let alertSoundEnabled = true;        // Sound toggle state
    // تعريف قاعدة البيانات
    const database = firebase.database();
    
    // ==================== AUTH VARIABLES ====================
    let currentPatientId = null;
    let currentUserEmail = null;
    let currentUserName = null;

    // ==================== FIREBASE REAL-TIME DATA (PATIENT VITALS FROM CARE SYNC) ====================
    let firebaseVitalsInterval = null;
    let lastAlertTime = 0;
    const ALERT_COOLDOWN = 30000;

    // أسماء العناصر في Firebase
    const FIREBASE_PATHS = {
        vitals: (patientId, timestamp) => `patients/${patientId}/readings/${timestamp}/vitals`,
        clinical: (patientId, timestamp) => `patients/${patientId}/readings/${timestamp}/clinical`
    };

    // دالة لجلب آخر قراءة من Firebase
    async function getLatestVitalsFromFirebase(patientId) {
        if (!patientId || typeof firebase === 'undefined') return null;
        
        try {
            const readingsRef = firebase.database().ref(`patients/${patientId}/readings`);
            const snapshot = await readingsRef.orderByKey().limitToLast(1).once('value');
            const readings = snapshot.val();
            
            if (!readings) return null;
            
            const timestamps = Object.keys(readings);
            const latestTimestamp = timestamps[timestamps.length - 1];
            const latestData = readings[latestTimestamp];
            
            if (latestData && latestData.vitals) {
                return {
                    sbp: latestData.vitals.systolic_bp || 0,
                    dbp: latestData.vitals.diastolic_bp || 0,
                    glucose: latestData.vitals.glucose || 0,
                    hr: latestData.vitals.heart_rate || 0,
                    timestamp: latestTimestamp,
                    glucose_class: latestData.clinical?.glucose_class || 'NORMOGLYCEMIA',
                    bp_class: latestData.clinical?.bp_class || 'OPTIMAL',
                    hba1c: latestData.clinical?.hba1c || 0,
                    trend: latestData.clinical?.trend || 'STABLE'
                };
            }
            return null;
        } catch (error) {
            console.error('Error fetching vitals:', error);
            return null;
        }
    }

    // دالة لتحديث واجهة المستخدم بالبيانات الجديدة
    function updateUIVitalsFromFirebase(vitals) {
        if (!vitals) return;
        
        // تحديث قيم الضغط
        const bpValueElement = document.getElementById('bpValue');
        if (bpValueElement) {
            bpValueElement.innerHTML = `${vitals.sbp}/${vitals.dbp} <span>mmHg</span>`;
        }
        
        // تحديث السكر
        let glucoseElement = document.getElementById('glucoseValue');
        if (!glucoseElement) {
            const vitalsGrid = document.querySelector('.vitals-grid');
            if (vitalsGrid && vitalsGrid.children.length <= 3) {
                const newCard = document.createElement('div');
                newCard.className = 'vital-card';
                newCard.innerHTML = `
                    <div class="vital-label">GLUCOSE</div>
                    <div class="vital-value" id="glucoseValue">${vitals.glucose} <span>mg/dL</span></div>
                    <div class="card-indicator" id="glucoseIndicator">Normal</div>
                `;
                vitalsGrid.appendChild(newCard);
                glucoseElement = document.getElementById('glucoseValue');
            }
        } else {
            glucoseElement.innerHTML = `${vitals.glucose} <span>mg/dL</span>`;
        }
        
        // تحديث مؤشر السكر
        const glucoseInd = document.getElementById('glucoseIndicator');
        if (glucoseInd && vitals.glucose > 0) {
            if (vitals.glucose >= 200) {
                glucoseInd.className = 'card-indicator indicator-danger';
                glucoseInd.innerText = 'Critical';
            } else if (vitals.glucose >= 126) {
                glucoseInd.className = 'card-indicator indicator-warning';
                glucoseInd.innerText = 'Warning';
            } else if (vitals.glucose >= 100) {
                glucoseInd.className = 'card-indicator indicator-warning';
                glucoseInd.innerText = 'Prediabetes';
            } else {
                glucoseInd.className = 'card-indicator indicator-normal';
                glucoseInd.innerText = 'Normal';
            }
        }
        
        // تحديث مؤشر الضغط
        const bpInd = document.getElementById('bpIndicator');
        if (bpInd && vitals.sbp > 0) {
            if (vitals.sbp >= 180 || vitals.dbp >= 120) {
                bpInd.className = 'card-indicator indicator-danger';
                bpInd.innerText = 'Crisis';
            } else if (vitals.sbp >= 140 || vitals.dbp >= 90) {
                bpInd.className = 'card-indicator indicator-warning';
                bpInd.innerText = 'Hypertension';
            } else if (vitals.sbp >= 120) {
                bpInd.className = 'card-indicator indicator-warning';
                bpInd.innerText = 'Elevated';
            } else {
                bpInd.className = 'card-indicator indicator-normal';
                bpInd.innerText = 'Normal';
            }
        }
        
        // تحديث نبضات القلب
        const heartElement = document.getElementById('heartValue');
        if (heartElement && vitals.hr > 0) {
            heartElement.innerHTML = `${vitals.hr} <span>bpm</span>`;
        }
        
        // تنبيهات للقيم الحرجة
        const now = Date.now();
        let alertMsg = null;
        
        if (vitals.glucose >= 300 && (now - lastAlertTime) > ALERT_COOLDOWN) {
            alertMsg = `Critical: Blood glucose ${vitals.glucose} mg/dL - Diabetic emergency!`;
        } else if (vitals.glucose >= 200 && (now - lastAlertTime) > ALERT_COOLDOWN) {
            alertMsg = `Warning: High blood glucose ${vitals.glucose} mg/dL`;
        } else if (vitals.sbp >= 180 && (now - lastAlertTime) > ALERT_COOLDOWN) {
            alertMsg = `Critical: Severe hypertension ${vitals.sbp}/${vitals.dbp} mmHg`;
        } else if (vitals.sbp >= 140 && (now - lastAlertTime) > ALERT_COOLDOWN) {
            alertMsg = `Warning: High blood pressure ${vitals.sbp}/${vitals.dbp} mmHg`;
        } else if (vitals.hr > 120 && (now - lastAlertTime) > ALERT_COOLDOWN) {
            alertMsg = `Warning: High heart rate ${vitals.hr} bpm`;
        } else if (vitals.hr < 50 && (now - lastAlertTime) > ALERT_COOLDOWN) {
            alertMsg = `Warning: Low heart rate ${vitals.hr} bpm`;
        }
        
        if (alertMsg) {
            lastAlertTime = now;
            showNotification(alertMsg, 'warning');
            alertSound('danger');
            
            const alertsList = document.getElementById('alertsList');
            if (alertsList) {
                const alertDiv = document.createElement('div');
                alertDiv.className = 'alert-item';
                alertDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i><div class="alert-content"><div class="alert-title">${alertMsg}</div><div class="alert-time">${new Date().toLocaleTimeString()}</div></div>`;
                alertsList.prepend(alertDiv);
                if (alertsList.children.length > 10) {
                    alertsList.removeChild(alertsList.lastChild);
                }
            }
        }
        
        // تحديث الرسم البياني
        if (vitals.hr > 0) {
            updateCharts(vitals.hr, null, null);
        }
    }

    // دالة للاستماع المباشر للتغييرات في Firebase
    function listenToFirebaseRealtime() {
        if (typeof firebase === 'undefined') {
            console.warn('Firebase not available for realtime listening');
            return;
        }
        
        if (!currentPatientId) {
            console.log('❌ No patient ID available');
            setTimeout(listenToFirebaseRealtime, 5000);
            return;
        }
        
        console.log(`🎧 Listening to Firebase patient: ${currentPatientId}`);
        
        const latestReadingsRef = firebase.database().ref(`patients/${currentPatientId}/readings`);
        
        latestReadingsRef.on('child_added', (snapshot) => {
            const reading = snapshot.val();
            if (reading && reading.vitals) {
                const vitals = {
                    sbp: reading.vitals.systolic_bp,
                    dbp: reading.vitals.diastolic_bp,
                    glucose: reading.vitals.glucose,
                    hr: reading.vitals.heart_rate,
                    timestamp: snapshot.key,
                    glucose_class: reading.clinical?.glucose_class,
                    bp_class: reading.clinical?.bp_class
                };
                updateUIVitalsFromFirebase(vitals);
                
                const lastUpdate = document.getElementById('lastUpdateTime');
                if (lastUpdate) {
                    lastUpdate.innerText = new Date().toLocaleTimeString();
                }
            }
        });
        
        getLatestVitalsFromFirebase(currentPatientId).then(vitals => {
            if (vitals) {
                updateUIVitalsFromFirebase(vitals);
            }
        });
    }

    // دالة لإضافة عناصر واجهة Firebase
    function addFirebaseUIElements() {
        const headerStats = document.querySelector('.header-stats');
        if (headerStats && !document.getElementById('firebaseStatus')) {
            const fbStatus = document.createElement('div');
            fbStatus.className = 'stat-item';
            fbStatus.id = 'firebaseStatus';
            fbStatus.innerHTML = `
                <i class="fas fa-fire" style="color: #ff6b35;"></i>
                <div>
                    <div>Care Sync</div>
                    <small id="lastUpdateTime">Waiting for data...</small>
                </div>
            `;
            headerStats.appendChild(fbStatus);
        }
        
        const vitalsGrid = document.querySelector('.vitals-grid');
        if (vitalsGrid && vitalsGrid.children.length === 3) {
            const glucoseCard = document.createElement('div');
            glucoseCard.className = 'vital-card';
            glucoseCard.innerHTML = `
                <div class="vital-label">GLUCOSE</div>
                <div class="vital-value" id="glucoseValue">-- <span>mg/dL</span></div>
                <div class="card-indicator" id="glucoseIndicator">--</div>
            `;
            vitalsGrid.appendChild(glucoseCard);
        }
        
        if (!document.getElementById('bpValue')) {
            const bpCard = document.createElement('div');
            bpCard.className = 'vital-card';
            bpCard.innerHTML = `
                <div class="vital-label">BLOOD PRESSURE</div>
                <div class="vital-value" id="bpValue">--/-- <span>mmHg</span></div>
                <div class="card-indicator" id="bpIndicator">--</div>
            `;
            if (vitalsGrid) {
                vitalsGrid.insertBefore(bpCard, vitalsGrid.firstChild);
            }
        }
    }

    // بدء جلب البيانات من Firebase
    function startFirebaseSync() {
        if (typeof firebase !== 'undefined' && firebase.database) {
            console.log('🔥 Firebase connected - Starting real-time patient data sync');
            addFirebaseUIElements();
            listenToFirebaseRealtime();
            
            firebaseVitalsInterval = setInterval(() => {
                if (currentPatientId) {
                    getLatestVitalsFromFirebase(currentPatientId).then(vitals => {
                        if (vitals) updateUIVitalsFromFirebase(vitals);
                    });
                }
            }, 30000);
        } else {
            console.warn('Firebase not loaded, retrying in 5 seconds...');
            setTimeout(startFirebaseSync, 5000);
        }
    }

    // بدء المزامنة
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(startFirebaseSync, 2000);
    });

    // تنظيف عند الإغلاق
    window.addEventListener('beforeunload', () => {
        if (firebaseVitalsInterval) clearInterval(firebaseVitalsInterval);
        if (typeof firebase !== 'undefined' && currentPatientId) {
            firebase.database().ref(`patients/${currentPatientId}/readings`).off();
        }
    });

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
    if (collapseBtn) {
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
    }

    // ==================== SIDEBAR ACTIVE STATE & PAGE NAVIGATION ====================
    const menuItems = document.querySelectorAll('.menu-item');
    const pages = document.querySelectorAll('.page-section');

    function showPage(pageId) {
        pages.forEach(p => p.classList.remove('active'));
        const activePage = document.getElementById(pageId + 'Page');
        if (activePage) activePage.classList.add('active');
    }

    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            menuItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            const page = this.dataset.page;
            showPage(page);
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

    // ==================== MUTE ALERTS BUTTON ====================
    const muteBtn = document.getElementById('muteAlerts');
    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            alertSoundEnabled = !alertSoundEnabled;
            muteBtn.innerHTML = alertSoundEnabled ? '<i class="fas fa-volume-up"></i> Mute' : '<i class="fas fa-volume-mute"></i> Unmute';
            muteBtn.classList.toggle('muted', !alertSoundEnabled);
            showNotification(alertSoundEnabled ? 'Alerts unmuted' : 'Alerts muted');
        });
    }

    // ==================== STATS UPDATE ====================
    function animateValue(element, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            element.innerText = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    function updateStats() {
        const newHealthScore = Math.floor(Math.random() * 40 + 60);
        const newAlertsCount = document.getElementById('alertsList').children.length;
        animateValue(document.getElementById('healthScore'), parseInt(document.getElementById('healthScore').innerText), newHealthScore, 1000);
        document.getElementById('activeAlertsCount').innerText = newAlertsCount;
    }
    setInterval(updateStats, 7000);

    // ==================== CHARTS INITIALIZATION ====================
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

    function updateCharts(heart, spo2, temp) {
        const now = new Date().toLocaleTimeString();
        if (heart) { heartHistory.push(heart); if (heartHistory.length > 20) heartHistory.shift(); }
        if (spo2) { spo2History.push(spo2); if (spo2History.length > 20) spo2History.shift(); }
        if (temp) { tempHistory.push(temp); if (tempHistory.length > 20) tempHistory.shift(); }
        timeLabels.push(now);
        if (timeLabels.length > 20) timeLabels.shift();

        if (heartChart) { heartChart.data.labels = timeLabels; heartChart.data.datasets[0].data = heartHistory; heartChart.update(); }
        if (spo2Chart) { spo2Chart.data.labels = timeLabels; spo2Chart.data.datasets[0].data = spo2History; spo2Chart.update(); }
        if (tempChart) { tempChart.data.labels = timeLabels; tempChart.data.datasets[0].data = tempHistory; tempChart.update(); }
    }

    // ==================== APEXCHARTS FOR HISTORY ====================
    const heartHistoryChart = new ApexCharts(document.querySelector("#heartHistoryChart"), {
        chart: { type: 'area', height: 250, animations: { enabled: true, speed: 500 } },
        series: [{ name: 'Heart Rate', data: [72,75,71,73,74,72,70,73,75,74,73,72] }],
        xaxis: { categories: ['00','02','04','06','08','10','12','14','16','18','20','22'] },
        colors: ['#2563eb'],
        fill: { type: 'gradient' }
    });
    heartHistoryChart.render();

    const spo2HistoryChart = new ApexCharts(document.querySelector("#spo2HistoryChart"), {
        chart: { type: 'area', height: 250, animations: { enabled: true, speed: 500 } },
        series: [{ name: 'SpO₂', data: [98,97,98,99,98,97,98,98,97,98,99,98] }],
        xaxis: { categories: ['00','02','04','06','08','10','12','14','16','18','20','22'] },
        colors: ['#10b981'],
        fill: { type: 'gradient' }
    });
    spo2HistoryChart.render();

    // Monthly report chart
    const monthlyCtx = document.getElementById('monthlyReportChart')?.getContext('2d');
    if (monthlyCtx) {
        new Chart(monthlyCtx, {
            type: 'bar',
            data: {
                labels: ['Jan','Feb','Mar','Apr','May','Jun'],
                datasets: [{ label: 'Health Score', data: [85,78,92,88,84,90], backgroundColor: '#2563eb' }]
            }
        });
    }

    // ==================== SIMULATED MQTT UPDATES ====================
    function generateRandomVitals() {
        return {
            heart: Math.floor(Math.random() * (85-65+1)) + 65,
            spo2: Math.floor(Math.random() * (99-94+1)) + 94,
            temp: (Math.random() * (37.5-36.0) + 36.0).toFixed(1)
        };
    }

    function updateUI(vitals) {
        document.getElementById('heartValue').innerHTML = vitals.heart + ' <span>bpm</span>';
        document.getElementById('spo2Value').innerHTML = vitals.spo2 + ' <span>%</span>';
        document.getElementById('tempValue').innerHTML = vitals.temp + ' <span>°C</span>';

        const heartInd = document.getElementById('heartIndicator');
        if (vitals.heart > 100 || vitals.heart < 50) { heartInd.className = 'card-indicator indicator-danger'; heartInd.innerText = 'Critical'; }
        else if (vitals.heart > 90 || vitals.heart < 60) { heartInd.className = 'card-indicator indicator-warning'; heartInd.innerText = 'Warning'; }
        else { heartInd.className = 'card-indicator indicator-normal'; heartInd.innerText = 'Normal'; }

        const spo2Ind = document.getElementById('spo2Indicator');
        if (vitals.spo2 < 90) { spo2Ind.className = 'card-indicator indicator-danger'; spo2Ind.innerText = 'Critical'; }
        else if (vitals.spo2 < 95) { spo2Ind.className = 'card-indicator indicator-warning'; spo2Ind.innerText = 'Warning'; }
        else { spo2Ind.className = 'card-indicator indicator-normal'; spo2Ind.innerText = 'Normal'; }

        const tempInd = document.getElementById('tempIndicator');
        if (vitals.temp > 38.5 || vitals.temp < 35) { tempInd.className = 'card-indicator indicator-danger'; tempInd.innerText = 'Critical'; }
        else if (vitals.temp > 37.5 || vitals.temp < 36) { tempInd.className = 'card-indicator indicator-warning'; tempInd.innerText = 'Warning'; }
        else { tempInd.className = 'card-indicator indicator-normal'; tempInd.innerText = 'Normal'; }

        updateCharts(vitals.heart, vitals.spo2, parseFloat(vitals.temp));

        const alertsList = document.getElementById('alertsList');
        if (vitals.heart > 100 || vitals.heart < 50 || vitals.spo2 < 90 || vitals.temp > 38.5 || vitals.temp < 35) {
            let msg = '';
            if (vitals.heart > 100) msg = 'Heart rate too high: ' + vitals.heart;
            else if (vitals.heart < 50) msg = 'Heart rate too low: ' + vitals.heart;
            else if (vitals.spo2 < 90) msg = 'Low SpO2: ' + vitals.spo2;
            else if (vitals.temp > 38.5) msg = 'High fever: ' + vitals.temp;
            else if (vitals.temp < 35) msg = 'Low temperature: ' + vitals.temp;

            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert-item';
            alertDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i><div class="alert-content"><div class="alert-title">${msg}</div><div class="alert-time">${new Date().toLocaleTimeString()}</div></div>`;
            alertsList.prepend(alertDiv);
            if (alertsList.children.length > 10) alertsList.removeChild(alertsList.lastChild);
            alertSound('danger');
        }
    }

    // Start simulation
    const initialVitals = generateRandomVitals();
    updateUI(initialVitals);
    mqttSimInterval = setInterval(() => {
        const newVitals = generateRandomVitals();
        updateUI(newVitals);
    }, 5000);

    // ==================== SEARCH FUNCTIONALITY ====================
    document.getElementById('globalSearch')?.addEventListener('input', function() {});
    document.getElementById('historySearch')?.addEventListener('input', function() {
        const value = this.value.toLowerCase();
        document.querySelectorAll('#historyTable tbody tr').forEach(row => {
            row.style.display = row.innerText.toLowerCase().includes(value) ? '' : 'none';
        });
    });
    document.getElementById('appointmentSearch')?.addEventListener('input', function() {
        const value = this.value.toLowerCase();
        document.querySelectorAll('#appointmentsTable tbody tr').forEach(row => {
            row.style.display = row.innerText.toLowerCase().includes(value) ? '' : 'none';
        });
    });

    // ==================== FILTER & DATE RANGE ====================
    const filterBtn = document.getElementById('filterBtn');
    const filterDropdown = document.getElementById('filterDropdown');
    const closeFilter = document.getElementById('closeFilter');
    const dateBadge = document.querySelector('.date-badge');
    const dateDropdown = document.getElementById('dateDropdown');
    const dateSpan = dateBadge?.querySelector('span');
    const filterStatus = document.getElementById('filterStatus');
    const filterDoctor = document.getElementById('filterDoctor');
    const filterStartDate = document.getElementById('filterStartDate');
    const filterEndDate = document.getElementById('filterEndDate');
    const applyFilter = document.getElementById('applyFilter');
    const resetFilter = document.getElementById('resetFilter');

    if (filterBtn) {
        filterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (filterDropdown) filterDropdown.classList.toggle('active');
            if (dateDropdown) dateDropdown.classList.remove('active');
        });
    }
    if (closeFilter) {
        closeFilter.addEventListener('click', () => {
            if (filterDropdown) filterDropdown.classList.remove('active');
        });
    }
    if (dateBadge) {
        dateBadge.addEventListener('click', (e) => {
            e.stopPropagation();
            if (dateDropdown) dateDropdown.classList.toggle('active');
            if (filterDropdown) filterDropdown.classList.remove('active');
        });
    }
    document.addEventListener('click', (e) => {
        if (filterDropdown && !filterDropdown.contains(e.target) && filterBtn && !filterBtn.contains(e.target)) {
            filterDropdown.classList.remove('active');
        }
        if (dateDropdown && !dateDropdown.contains(e.target) && dateBadge && !dateBadge.contains(e.target)) {
            dateDropdown.classList.remove('active');
        }
    });

    if (applyFilter) {
        applyFilter.addEventListener('click', () => {
            const status = filterStatus?.value || 'all';
            const doctor = filterDoctor?.value || 'all';
            const startDate = filterStartDate?.value || '';
            const endDate = filterEndDate?.value || '';
            filterTables(status, doctor, startDate, endDate);
            if (filterDropdown) filterDropdown.classList.remove('active');
        });
    }
    if (resetFilter) {
        resetFilter.addEventListener('click', () => {
            if (filterStatus) filterStatus.value = 'all';
            if (filterDoctor) filterDoctor.value = 'all';
            if (filterStartDate) filterStartDate.value = '';
            if (filterEndDate) filterEndDate.value = '';
            resetTableFilters();
            if (filterDropdown) filterDropdown.classList.remove('active');
        });
    }

    function filterTables(status, doctor, startDate, endDate) {
        const historyRows = document.querySelectorAll('#historyTable tbody tr');
        const appointmentRows = document.querySelectorAll('#appointmentsTable tbody tr');
        historyRows.forEach(row => row.style.display = '');
        appointmentRows.forEach(row => row.style.display = '');
        showNotification('Filters applied');
    }

    function resetTableFilters() {
        const allRows = document.querySelectorAll('#historyTable tbody tr, #appointmentsTable tbody tr');
        allRows.forEach(row => row.style.display = '');
        showNotification('Filters reset');
    }

    // ==================== EXPORT BUTTON ====================
    document.getElementById('exportBtn')?.addEventListener('click', function() {
        showNotification('Generating your health report...');
        setTimeout(() => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.setFontSize(18);
            doc.text("My Health Report", 105, 15, { align: "center" });
            doc.setFontSize(10);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 22, { align: "center" });
            let yOffset = 30;
            function addChartImage(canvasId, title, yPos) {
                const canvas = document.getElementById(canvasId);
                if (!canvas) return yPos;
                const imgData = canvas.toDataURL('image/png');
                doc.setFontSize(12);
                doc.text(title, 14, yPos);
                doc.addImage(imgData, 'PNG', 14, yPos + 5, 180, 60);
                return yPos + 70;
            }
            yOffset = addChartImage('heartChart', 'Heart Rate (bpm)', yOffset);
            yOffset = addChartImage('spo2Chart', 'SpO₂ (%)', yOffset);
            yOffset = addChartImage('tempChart', 'Body Temperature (°C)', yOffset);
            doc.save("health_report.pdf");
            showNotification('Report ready!');
        }, 100);
    });
    document.getElementById('downloadReportBtn')?.addEventListener('click', () => {
        showNotification('Downloading latest report...');
    });

    // ==================== SETTINGS SAVE ====================
    document.getElementById('saveSettings')?.addEventListener('click', () => {
        const email = document.getElementById('settingsEmail')?.value || '';
        const lang = document.getElementById('settingsLanguage')?.value || '';
        showNotification(`Settings saved: Email ${email}, Language ${lang}`);
    });

    // ==================== MEDICAL HISTORY FUNCTIONS (ADDED) ====================
    function showLoading(show) {
        const loader = document.getElementById('loadingIndicator');
        if (loader) loader.style.display = show ? 'flex' : 'none';
    }

    async function saveToMedicalHistory(type, data) {
        if (!currentPatientId) return;
        const timestamp = new Date().toISOString();
        await database.ref(`users/${currentPatientId}/medicalHistory/${timestamp}`).set({
            type: type,
            data: data,
            recordedAt: timestamp
        });
        console.log(`✅ Saved ${type} to medical history`);
    }

    async function saveVitalsToHistory(vitals) {
        if (!currentPatientId) return;
        const timestamp = new Date().toISOString();
        await database.ref(`users/${currentPatientId}/vitalsHistory/${timestamp}`).set({
            heartRate: vitals.heart,
            spo2: vitals.spo2,
            temperature: vitals.temp,
            bpSystolic: vitals.sbp || null,
            bpDiastolic: vitals.dbp || null,
            glucose: vitals.glucose || null,
            recordedAt: timestamp
        });
        console.log(`✅ Saved vitals to history`);
    }

    async function loadMedicalHistory() {
        if (!currentPatientId) return;
        try {
            const historySnapshot = await database.ref(`users/${currentPatientId}/medicalHistory`).orderByKey().limitToLast(50).once('value');
            const vitalsSnapshot = await database.ref(`users/${currentPatientId}/vitalsHistory`).orderByKey().limitToLast(50).once('value');
            
            const historyContainer = document.getElementById('medicalHistoryList');
            if (!historyContainer) return;
            
            let html = '';
            
            if (vitalsSnapshot.exists()) {
                const vitals = vitalsSnapshot.val();
                const vitalsArray = Object.entries(vitals).reverse();
                for (const [time, data] of vitalsArray) {
                    const date = new Date(data.recordedAt || time);
                    html += `
                        <div class="history-item">
                            <div class="history-date">${date.toLocaleString()}</div>
                            <div class="history-type vital-sign">🩺 Vitals Check</div>
                            <div class="history-data">
                                ❤️ HR: ${data.heartRate || '--'} | 
                                🫁 SpO2: ${data.spo2 || '--'}% | 
                                🌡️ Temp: ${data.temperature || '--'}°C |
                                💓 BP: ${data.bpSystolic || '--'}/${data.bpDiastolic || '--'} |
                                🩸 Glucose: ${data.glucose || '--'} mg/dL
                            </div>
                        </div>
                    `;
                }
            }
            
            if (historySnapshot.exists()) {
                const history = historySnapshot.val();
                const historyArray = Object.entries(history).reverse();
                for (const [time, record] of historyArray) {
                    const date = new Date(record.recordedAt || time);
                    let icon = record.type === 'labResult' ? '🔬' : (record.type === 'doctorNote' ? '📝' : '📋');
                    html += `
                        <div class="history-item">
                            <div class="history-date">${date.toLocaleString()}</div>
                            <div class="history-type ${record.type}">${icon} ${record.type === 'labResult' ? 'Lab Results Updated' : (record.type === 'doctorNote' ? 'Doctor Notes Updated' : record.type)}</div>
                            <div class="history-data"><pre>${JSON.stringify(record.data, null, 2).substring(0, 300)}${JSON.stringify(record.data, null, 2).length > 300 ? '...' : ''}</pre></div>
                        </div>
                    `;
                }
            }
            
            historyContainer.innerHTML = html || '<div class="history-item">No medical history found.</div>';
        } catch (error) {
            console.error('Error loading medical history:', error);
        }
    }

    // ==================== AUTH STATE OBSERVER (ADDED) ====================
    firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        
        currentPatientId = user.uid;
        currentUserEmail = user.email;
        
        const userSnapshot = await database.ref(`users/${currentPatientId}`).once('value');
        const userData = userSnapshot.val();
        currentUserName = userData?.name || user.email || 'Patient';
        
        console.log(`✅ Authenticated: ${currentUserName} (${currentPatientId})`);
        
        // Add user name to UI
        const topBar = document.querySelector('.top-bar');
        if (topBar && !document.getElementById('userNameDisplay')) {
            const nameSpan = document.createElement('span');
            nameSpan.id = 'userNameDisplay';
            nameSpan.style.cssText = 'background: #8b5cf6; padding: 8px 16px; border-radius: 30px; color: white; font-size: 0.8rem; margin-left: 10px;';
            nameSpan.innerHTML = `<i class="fas fa-user-circle"></i> ${currentUserName}`;
            topBar.appendChild(nameSpan);
        }
        
        showLoading(true);
        await loadMedicalHistory();
        showLoading(false);
        
        // Start data sync
        startPatientDataSync(currentPatientId);
    });

    // ==================== PATIENT DATA SYNC (MODIFIED) ====================
    function startPatientDataSync(patientId) {
        if(!patientId) {
            console.log('❌ No Patient ID');
            return;
        }
        
        console.log(`🩺 Starting patient data sync for: ${patientId}`);
        
        // 1. Lab Results
        const labResultsRef = database.ref(`patients/${patientId}/labResults`);
        labResultsRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if(data) {
                updateAllLabResults(data);
                console.log(`📊 Lab results updated for ${patientId}`);
            } else {
                console.log(`⚠️ No lab results for ${patientId}`);
            }
        });
        
        // 2. Doctor Notes
        const doctorNotesRef = database.ref(`patients/${patientId}/doctorNotes`);
        doctorNotesRef.on('value', (snapshot) => {
            const notes = snapshot.val();
            if(notes) {
                updateDoctorNotesUI(notes);
                console.log(`📝 Doctor notes updated for ${patientId}`);
            } else {
                console.log(`⚠️ No doctor notes for ${patientId}`);
            }
        });
        
        // 3. Care Sync Readings
        const readingsRef = database.ref(`patients/${patientId}/readings`);
        readingsRef.orderByKey().limitToLast(1).on('child_added', (snapshot) => {
            const reading = snapshot.val();
            if(reading && reading.vitals) {
                const vitals = {
                    sbp: reading.vitals.systolic_bp || 0,
                    dbp: reading.vitals.diastolic_bp || 0,
                    glucose: reading.vitals.glucose || 0,
                    hr: reading.vitals.heart_rate || 0,
                    timestamp: snapshot.key
                };
                updateUICareSync(vitals);
                console.log(`💓 Care Sync vitals updated for ${patientId}`);
            }
        });
        
        // Update connection badge
        const liveBadge = document.getElementById('liveStatusBadge');
        if(liveBadge) {
            liveBadge.innerHTML = `<i class="fas fa-circle" style="font-size:0.6rem; color:#10b981;"></i><span>Connected: ${patientId.substring(0,8)}...</span>`;
        }
    }

    // ==================== MODIFIED: updateAllLabResults (save to history) ====================
    function updateAllLabResults(data) {
        if (!data) return;
        
        // Save to medical history
        saveToMedicalHistory('labResult', data);
        
        // 🩸 Diabetes Profile
        if (data.diabetes) {
            updateLabElement('lab_fbg', data.diabetes.fbg, 'mg/dL');
            updateLabElement('lab_hba1c', data.diabetes.hba1c, '%');
            updateLabElement('lab_ppg', data.diabetes.ppg, 'mg/dL');
            updateLabElement('lab_rbs', data.diabetes.rbs, 'mg/dL');
        }
        
        // 🫀 Kidney Function
        if (data.kidney) {
            updateLabElement('lab_creatinine', data.kidney.creatinine, 'mg/dL');
            updateLabElement('lab_bun', data.kidney.bun, 'mg/dL');
            updateLabElement('lab_egfr', data.kidney.egfr, 'mL/min');
            updateLabElement('lab_uric_acid', data.kidney.uricAcid, 'mg/dL');
        }
        
        // 🧪 Liver Function
        if (data.liver) {
            updateLabElement('lab_alt', data.liver.alt, 'U/L');
            updateLabElement('lab_ast', data.liver.ast, 'U/L');
            updateLabElement('lab_alp', data.liver.alp, 'U/L');
            updateLabElement('lab_bilirubin', data.liver.bilirubin, 'mg/dL');
        }
        
        // 🦋 Thyroid Function
        if (data.thyroid) {
            updateLabElement('lab_tsh', data.thyroid.tsh, 'µIU/mL');
            updateLabElement('lab_t3', data.thyroid.t3, 'ng/dL');
            updateLabElement('lab_t4', data.thyroid.t4, 'µg/dL');
        }
        
        // ❤️ Cardiac Markers
        if (data.cardiac) {
            updateLabElement('lab_troponin', data.cardiac.troponin, 'ng/mL');
            updateLabElement('lab_ckmb', data.cardiac.ckmb, 'ng/mL');
            updateLabElement('lab_bnp', data.cardiac.bnp, 'pg/mL');
        }
        
        // 🔥 Inflammation
        if (data.inflammation) {
            updateLabElement('lab_crp', data.inflammation.crp, 'mg/L');
            updateLabElement('lab_esr', data.inflammation.esr, 'mm/hr');
            updateLabElement('lab_pct', data.inflammation.pct, 'ng/mL');
        }
        
        // Update last updated time
        const lastUpdateSpan = document.getElementById('labLastUpdate');
        if (lastUpdateSpan && data.lastUpdated) {
            const date = new Date(data.lastUpdated);
            lastUpdateSpan.innerHTML = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        }
    }

    // Helper function for lab elements
    function updateLabElement(elementId, value, suffix = '') {
        const element = document.getElementById(elementId);
        if (element && value !== undefined && value !== null) {
            element.innerHTML = `${value} <span style="font-size: 0.8rem;">${suffix}</span>`;
            element.classList.add('data-update-pulse');
            setTimeout(() => element.classList.remove('data-update-pulse'), 400);
        }
    }

    // ==================== MODIFIED: updateDoctorNotesUI (save to history) ====================
    function updateDoctorNotesUI(notes) {
        if (!notes) return;
        
        // Save to medical history
        saveToMedicalHistory('doctorNote', notes);
        
        const doctorNotesDiv = document.getElementById('doctorNotes');
        const doctorNotesDate = document.getElementById('doctorNotesDate');
        
        if (doctorNotesDiv && notes.summary) {
            doctorNotesDiv.innerHTML = `
                <i class="fas fa-quote-right" style="color: #8b5cf6; float: right; opacity: 0.5;"></i>
                <p>📋 <strong>Clinical Summary:</strong> ${notes.summary || 'No summary available'}</p>
                <p style="margin-top: 10px;">💊 <strong>Recommendations:</strong> ${notes.recommendations || 'No recommendations'}</p>
                <p style="margin-top: 10px;">✅ <strong>Next Appointment:</strong> ${notes.nextAppointment || 'Not scheduled'}</p>
            `;
        }
        
        if (doctorNotesDate && notes.doctorName) {
            doctorNotesDate.innerHTML = `${notes.lastUpdated ? new Date(notes.lastUpdated).toLocaleDateString() : 'Today'} | <i class="fas fa-user-md"></i> ${notes.doctorName}`;
        }
    }

    // ==================== MODIFIED: updateUICareSync (save vitals to history) ====================
    function updateUICareSync(vitals) {
        if (!vitals) return;
        
        // Save vitals to history
        saveVitalsToHistory({
            heart: vitals.hr,
            spo2: null,  // not available from Care Sync
            temp: null,
            sbp: vitals.sbp,
            dbp: vitals.dbp,
            glucose: vitals.glucose
        });
        
        if (vitals.sbp > 0 && vitals.dbp > 0) {
            const bpElement = document.getElementById('bpValue');
            if (bpElement) {
                bpElement.innerHTML = `${vitals.sbp}/${vitals.dbp} <span>mmHg</span>`;
                bpElement.classList.add('data-update-pulse');
                setTimeout(() => bpElement.classList.remove('data-update-pulse'), 400);
            }
            const bpInd = document.getElementById('bpIndicator');
            if (bpInd) {
                if (vitals.sbp >= 180 || vitals.dbp >= 120) {
                    bpInd.className = 'indicator-danger';
                    bpInd.innerHTML = 'Crisis';
                } else if (vitals.sbp >= 140 || vitals.dbp >= 90) {
                    bpInd.className = 'indicator-warning';
                    bpInd.innerHTML = 'Hypertension';
                } else if (vitals.sbp >= 120) {
                    bpInd.className = 'indicator-warning';
                    bpInd.innerHTML = 'Elevated';
                } else {
                    bpInd.className = 'indicator-normal';
                    bpInd.innerHTML = 'Normal';
                }
            }
        }
        
        if (vitals.glucose > 0) {
            const glucoseElement = document.getElementById('glucoseValue');
            if (glucoseElement) {
                glucoseElement.innerHTML = `${Math.round(vitals.glucose)} <span>mg/dL</span>`;
                glucoseElement.classList.add('data-update-pulse');
                setTimeout(() => glucoseElement.classList.remove('data-update-pulse'), 400);
            }
            const glucoseInd = document.getElementById('glucoseIndicator');
            if (glucoseInd) {
                if (vitals.glucose >= 300) {
                    glucoseInd.className = 'indicator-danger';
                    glucoseInd.innerHTML = 'Critical';
                } else if (vitals.glucose >= 200) {
                    glucoseInd.className = 'indicator-danger';
                    glucoseInd.innerHTML = 'Very High';
                } else if (vitals.glucose >= 126) {
                    glucoseInd.className = 'indicator-warning';
                    glucoseInd.innerHTML = 'High (Diabetes)';
                } else if (vitals.glucose >= 100) {
                    glucoseInd.className = 'indicator-warning';
                    glucoseInd.innerHTML = 'Prediabetes';
                } else if (vitals.glucose < 70) {
                    glucoseInd.className = 'indicator-danger';
                    glucoseInd.innerHTML = 'Low';
                } else {
                    glucoseInd.className = 'indicator-normal';
                    glucoseInd.innerHTML = 'Normal';
                }
            }
        }
        
        updateCareSyncGauges(vitals.sbp, vitals.glucose);
        
        const now = Date.now();
        let alertMsg = null;
        if (vitals.glucose >= 300 && (now - careSyncLastAlert) > CARE_SYNC_ALERT_COOLDOWN) {
            alertMsg = `🚨 CRITICAL: Blood Glucose ${Math.round(vitals.glucose)} mg/dL`;
        } else if (vitals.glucose >= 200 && (now - careSyncLastAlert) > CARE_SYNC_ALERT_COOLDOWN) {
            alertMsg = `⚠️ WARNING: High Blood Glucose ${Math.round(vitals.glucose)} mg/dL`;
        } else if (vitals.sbp >= 180 && (now - careSyncLastAlert) > CARE_SYNC_ALERT_COOLDOWN) {
            alertMsg = `🚨 CRITICAL: Severe Hypertension ${vitals.sbp}/${vitals.dbp} mmHg`;
        } else if (vitals.sbp >= 140 && (now - careSyncLastAlert) > CARE_SYNC_ALERT_COOLDOWN) {
            alertMsg = `⚠️ WARNING: High Blood Pressure ${vitals.sbp}/${vitals.dbp} mmHg`;
        }
        
        if (alertMsg) {
            careSyncLastAlert = now;
            const alertsContainer = document.getElementById('alertsList');
            if (alertsContainer) {
                const alertDiv = document.createElement('div');
                alertDiv.className = 'alert-item';
                alertDiv.innerHTML = `<i class="fas fa-exclamation-triangle" style="color:#ef4444;"></i> ${alertMsg}`;
                alertsContainer.prepend(alertDiv);
                if (alertsContainer.children.length > 5) alertsContainer.removeChild(alertsContainer.lastChild);
            }
        }
    }

    // ==================== CARE SYNC LISTENER (MODIFIED TO USE currentPatientId) ====================
    let careSyncLastAlert = 0;
    const CARE_SYNC_ALERT_COOLDOWN = 30000;
    let bpGauge, glucoseGauge;

    function addCareSyncUIElements() {
        const vitalsGrid = document.querySelector('.vitals-grid');
        if (!vitalsGrid) return;
        if (document.getElementById('bpValue')) return;
        
        const bpCard = document.createElement('div');
        bpCard.className = 'vital-card';
        bpCard.innerHTML = `
            <div class="vital-header"><i class="fas fa-tachometer-alt" style="color:#8b5cf6; font-size:2rem;"></i><h3>Blood Pressure</h3></div>
            <div class="vital-value" id="bpValue">--/-- <span>mmHg</span></div>
            <div id="bpGauge" class="gauge-container"></div>
            <div class="card-indicator" id="bpIndicator">Normal</div>
        `;
        vitalsGrid.appendChild(bpCard);
        
        const glucoseCard = document.createElement('div');
        glucoseCard.className = 'vital-card';
        glucoseCard.innerHTML = `
            <div class="vital-header"><i class="fas fa-tint" style="color:#f97316; font-size:2rem;"></i><h3>Blood Glucose</h3></div>
            <div class="vital-value" id="glucoseValue">-- <span>mg/dL</span></div>
            <div id="glucoseGauge" class="gauge-container"></div>
            <div class="card-indicator" id="glucoseIndicator">Normal</div>
        `;
        vitalsGrid.appendChild(glucoseCard);
    }

    function initCareSyncGauges() {
        const bpContainer = document.querySelector('#bpGauge');
        const glucoseContainer = document.querySelector('#glucoseGauge');
        
        if (bpContainer && !bpGauge) {
            bpGauge = new ApexCharts(bpContainer, {
                series: [0], chart: { type: 'radialBar', height: 130, sparkline: { enabled: true } },
                plotOptions: { radialBar: { startAngle: -90, endAngle: 90, track: { background: '#e2e8f0' }, dataLabels: { name: { show: false }, value: { fontSize: '20px', fontWeight: 700, color: '#8b5cf6' } } } },
                colors: ['#8b5cf6']
            });
            bpGauge.render();
        }
        
        if (glucoseContainer && !glucoseGauge) {
            glucoseGauge = new ApexCharts(glucoseContainer, {
                series: [0], chart: { type: 'radialBar', height: 130, sparkline: { enabled: true } },
                plotOptions: { radialBar: { startAngle: -90, endAngle: 90, track: { background: '#e2e8f0' }, dataLabels: { name: { show: false }, value: { fontSize: '20px', fontWeight: 700, color: '#f97316' } } } },
                colors: ['#f97316']
            });
            glucoseGauge.render();
        }
    }

    function updateCareSyncGauges(sbp, glucose) {
        if (bpGauge && sbp) {
            let percent = Math.min(100, Math.max(0, (sbp - 80) / 120 * 100));
            bpGauge.updateSeries([percent]);
        }
        if (glucoseGauge && glucose) {
            let percent = Math.min(100, Math.max(0, (glucose - 70) / 250 * 100));
            glucoseGauge.updateSeries([percent]);
        }
    }

    async function getLatestCareSyncVitals(patientId) {
        if (!patientId) return null;
        try {
            const readingsRef = database.ref(`patients/${patientId}/readings`);
            const snapshot = await readingsRef.orderByKey().limitToLast(1).once('value');
            const readings = snapshot.val();
            if (!readings) return null;
            const timestamps = Object.keys(readings);
            const latestTimestamp = timestamps[timestamps.length - 1];
            const latestData = readings[latestTimestamp];
            if (latestData && latestData.vitals) {
                return {
                    sbp: latestData.vitals.systolic_bp || 0,
                    dbp: latestData.vitals.diastolic_bp || 0,
                    glucose: latestData.vitals.glucose || 0,
                    hr: latestData.vitals.heart_rate || 0,
                    timestamp: latestTimestamp
                };
            }
            return null;
        } catch (error) {
            console.error('Error fetching Care Sync vitals:', error);
            return null;
        }
    }

    function startCareSyncListener() {
        console.log('🔥 Starting Care Sync Firebase listener...');
        addCareSyncUIElements();
        setTimeout(() => initCareSyncGauges(), 500);
        
        if (!currentPatientId) {
            console.log('❌ No patient ID, cannot start Care Sync');
            return;
        }
        
        console.log(`✅ Connected to Care Sync patient: ${currentPatientId}`);
        const readingsRef = database.ref(`patients/${currentPatientId}/readings`);
        readingsRef.on('child_added', (snapshot) => {
            const reading = snapshot.val();
            if (reading && reading.vitals) {
                const vitals = {
                    sbp: reading.vitals.systolic_bp,
                    dbp: reading.vitals.diastolic_bp,
                    glucose: reading.vitals.glucose,
                    hr: reading.vitals.heart_rate,
                    timestamp: snapshot.key
                };
                updateUICareSync(vitals);
            }
        });
        getLatestCareSyncVitals(currentPatientId).then(vitals => { if (vitals) updateUICareSync(vitals); });
    }

    setTimeout(() => { startCareSyncListener(); }, 3000);

    // ==================== UPDATED LOGOUT BUTTON (Firebase Auth) ====================
    const footer = document.querySelector('.sidebar-footer');
    const logoutBtn = document.createElement('a');
    logoutBtn.href = 'javascript:void(0)';
    logoutBtn.className = 'menu-item';
    logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i><span>Logout</span>';
    logoutBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to logout?')) {
            await firebase.auth().signOut();
            window.location.href = 'index.html';
        }
    });
    if (footer) footer.appendChild(logoutBtn);

    // ==================== INITIALIZE (removed custom login and start listeners after auth) ====================
    initGauges();
    initTrendCharts();
    startESP32Listener();
    addCareSyncUIElements();
    initCareSyncGauges();
    console.log("✅ HELIOS Dashboard Ready - Waiting for Firebase Auth");
})();
