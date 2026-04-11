// ====================================================
// PATIENT DASHBOARD - PROFESSIONAL INTEGRATED VERSION
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
    let mqttSimInterval;                // Interval for simulated MQTT updates
    let alertSoundEnabled = true;        // Sound toggle state
    // ==================== FIREBASE REAL-TIME DATA (PATIENT VITALS FROM CARE SYNC) ====================
// هذا القسم يجلب البيانات الحقيقية من تطبيق Care Sync PIMA Edition

let firebaseVitalsInterval = null;
let currentPatientId = null;
let lastAlertTime = 0;
const ALERT_COOLDOWN = 30000; // 30 seconds between same alert

// أسماء العناصر في Firebase (حسب هيكل البيانات من تطبيق Python)
const FIREBASE_PATHS = {
    vitals: (patientId, timestamp) => `patients/${patientId}/readings/${timestamp}/vitals`,
    clinical: (patientId, timestamp) => `patients/${patientId}/readings/${timestamp}/clinical`
};

// دالة لجلب أحدث مريض من Firebase
async function getLatestPatientId() {
    if (typeof firebase === 'undefined') {
        console.warn('Firebase not loaded');
        return null;
    }
    
    try {
        const snapshot = await firebase.database().ref('patients').once('value');
        const patients = snapshot.val();
        if (!patients) return null;
        
        // جلب أحدث مريض (آخر من أرسل بيانات)
        const patientIds = Object.keys(patients);
        // ترتيب حسب وقت آخر قراءة
        let latestPatient = null;
        let latestTime = 0;
        
        for (const pid of patientIds) {
            const readings = patients[pid]?.readings;
            if (readings) {
                const times = Object.keys(readings);
                if (times.length > 0) {
                    const lastTime = parseInt(times[times.length - 1]);
                    if (lastTime > latestTime) {
                        latestTime = lastTime;
                        latestPatient = pid;
                    }
                }
            }
        }
        
        return latestPatient;
    } catch (error) {
        console.error('Error getting patient ID:', error);
        return null;
    }
}

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

// دالة لتحديث واجهة المستخدم بالبيانات الجديدة (دمج مع البيانات الموجودة)
function updateUIVitalsFromFirebase(vitals) {
    if (!vitals) return;
    
    // تحديث قيم الضغط (Systolic و Diastolic)
    const bpValueElement = document.getElementById('bpValue');
    if (bpValueElement) {
        bpValueElement.innerHTML = `${vitals.sbp}/${vitals.dbp} <span>mmHg</span>`;
    }
    
    // تحديث السكر (Glucose) - نضيف عنصر جديد إذا لم يكن موجود
    let glucoseElement = document.getElementById('glucoseValue');
    if (!glucoseElement) {
        // إنشاء عنصر جديد للسكر في الـ dashboard
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
    
    // تحديث مؤشر الضغط (إضافة تفاصيل أكثر)
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
    
    // إضافة نبضات القلب من Firebase (إذا كانت مختلفة عن المحاكاة)
    const heartElement = document.getElementById('heartValue');
    if (heartElement && vitals.hr > 0) {
        heartElement.innerHTML = `${vitals.hr} <span>bpm</span>`;
    }
    
    // إضافة تنبيهات للقيم الحرجة من Firebase
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
        
        // إضافة إلى قائمة التنبيهات
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
    
    // تحديث الرسم البياني بالقيم الجديدة (إذا أردنا دمجها)
    if (vitals.hr > 0) {
        updateCharts(vitals.hr, null, null);
    }
}

// دالة للاستماع المباشر للتغييرات في Firebase (Realtime)
function listenToFirebaseRealtime() {
    if (typeof firebase === 'undefined') {
        console.warn('Firebase not available for realtime listening');
        return;
    }
    
    getLatestPatientId().then(patientId => {
        if (!patientId) {
            console.log('No patient data found in Firebase yet. Waiting for data from Care Sync...');
            setTimeout(listenToFirebaseRealtime, 10000);
            return;
        }
        
        currentPatientId = patientId;
        console.log(`Listening to Firebase patient: ${patientId}`);
        
        // الاستماع للتغييرات في آخر قراءة
        const latestReadingsRef = firebase.database().ref(`patients/${patientId}/readings`);
        
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
                
                // إظهار إشعار بوصول بيانات جديدة
                const lastUpdate = document.getElementById('lastUpdateTime');
                if (lastUpdate) {
                    lastUpdate.innerText = new Date().toLocaleTimeString();
                }
            }
        });
        
        // جلب آخر قراءة حالية
        getLatestVitalsFromFirebase(patientId).then(vitals => {
            if (vitals) {
                updateUIVitalsFromFirebase(vitals);
            }
        });
    }).catch(error => {
        console.error('Firebase listening error:', error);
    });
}

// دالة لإضافة عناصر واجهة Firebase (بدون تعديل الموجود)
function addFirebaseUIElements() {
    // إضافة عنصر عرض آخر تحديث في الـ header إذا وجد
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
    
    // إضافة عنصر عرض السكر في الـ vitals-grid إذا لم يكن موجود
    const vitalsGrid = document.querySelector('.vitals-grid');
    if (vitalsGrid && vitalsGrid.children.length === 3) {
        // إضافة كارد السكر إذا كان موجود فقط 3 كروت (HR, SpO2, Temp)
        const glucoseCard = document.createElement('div');
        glucoseCard.className = 'vital-card';
        glucoseCard.innerHTML = `
            <div class="vital-label">GLUCOSE</div>
            <div class="vital-value" id="glucoseValue">-- <span>mg/dL</span></div>
            <div class="card-indicator" id="glucoseIndicator">--</div>
        `;
        vitalsGrid.appendChild(glucoseCard);
    }
    
    // إضافة عنصر عرض الضغط إذا لم يكن موجود
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

// بدء جلب البيانات من Firebase (مع الحفاظ على المحاكاة الحالية)
function startFirebaseSync() {
    if (typeof firebase !== 'undefined' && firebase.database) {
        console.log('🔥 Firebase connected - Starting real-time patient data sync');
        addFirebaseUIElements();
        listenToFirebaseRealtime();
        
        // تحديث كل 30 ثانية للتأكد من الاتصال (fallback)
        firebaseVitalsInterval = setInterval(() => {
            if (currentPatientId) {
                getLatestVitalsFromFirebase(currentPatientId).then(vitals => {
                    if (vitals) updateUIVitalsFromFirebase(vitals);
                });
            } else {
                getLatestPatientId().then(pid => {
                    if (pid) {
                        currentPatientId = pid;
                        getLatestVitalsFromFirebase(pid).then(vitals => {
                            if (vitals) updateUIVitalsFromFirebase(vitals);
                        });
                    }
                });
            }
        }, 30000);
    } else {
        console.warn('Firebase not loaded, retrying in 5 seconds...');
        setTimeout(startFirebaseSync, 5000);
    }
}

// بدء المزامنة مع Firebase بعد تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    // تأخير بسيط للتأكد من تحميل Firebase
    setTimeout(startFirebaseSync, 2000);
});

// تعديل دالة cleanup لإيقاف Firebase listeners
// تعديل دالة cleanup لإيقاف Firebase listeners
window.addEventListener('beforeunload', () => {
    if (firebaseVitalsInterval) clearInterval(firebaseVitalsInterval);
    if (typeof firebase !== 'undefined' && currentPatientId) {
        firebase.database().ref(`patients/${currentPatientId}/readings`).off();
    }
});
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

    // // ==================== THEME TOGGLE ====================
    // const themeToggle = document.getElementById('themeToggle');
    // const html = document.documentElement;

    // // Load saved theme
    // const savedTheme = localStorage.getItem('theme') || 'light';
    // html.setAttribute('data-theme', savedTheme);
    // themeToggle.innerHTML = savedTheme === 'light' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';

    // themeToggle.addEventListener('click', () => {
    //     const currentTheme = html.getAttribute('data-theme');
    //     const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    //     html.setAttribute('data-theme', newTheme);
    //     localStorage.setItem('theme', newTheme);
    //     themeToggle.innerHTML = newTheme === 'light' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    //     showNotification(`${newTheme} mode activated`);
    // });

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
    muteBtn.addEventListener('click', () => {
        alertSoundEnabled = !alertSoundEnabled;
        muteBtn.innerHTML = alertSoundEnabled ? '<i class="fas fa-volume-up"></i> Mute' : '<i class="fas fa-volume-mute"></i> Unmute';
        muteBtn.classList.toggle('muted', !alertSoundEnabled);
        showNotification(alertSoundEnabled ? 'Alerts unmuted' : 'Alerts muted');
    });

    // ==================== STATS UPDATE (animated) ====================
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

    // ==================== CHARTS INITIALIZATION (Chart.js) ====================
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

    // Monthly report chart (for reports page)
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

        // Update indicators
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

        // Check for critical alerts
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
    document.getElementById('globalSearch')?.addEventListener('input', function() {
        // For dashboard? Not implemented.
    });

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

    // ==================== FILTER & DATE RANGE FUNCTIONALITY ====================
    const filterBtn = document.getElementById('filterBtn');
    const filterDropdown = document.getElementById('filterDropdown');
    const closeFilter = document.getElementById('closeFilter');
    const dateBadge = document.querySelector('.date-badge');
    const dateDropdown = document.getElementById('dateDropdown');
    const dateSpan = dateBadge.querySelector('span');
    const filterStatus = document.getElementById('filterStatus');
    const filterDoctor = document.getElementById('filterDoctor');
    const filterStartDate = document.getElementById('filterStartDate');
    const filterEndDate = document.getElementById('filterEndDate');
    const applyFilter = document.getElementById('applyFilter');
    const resetFilter = document.getElementById('resetFilter');

    // Toggle filter dropdown
    filterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        filterDropdown.classList.toggle('active');
        dateDropdown.classList.remove('active'); // Hide date dropdown if open
    });

    // Close filter dropdown
    closeFilter.addEventListener('click', () => {
        filterDropdown.classList.remove('active');
    });

    // Toggle date dropdown
    dateBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        dateDropdown.classList.toggle('active');
        filterDropdown.classList.remove('active'); // Hide filter dropdown if open
    });

    // Click outside to close dropdowns
    document.addEventListener('click', (e) => {
        if (!filterDropdown.contains(e.target) && !filterBtn.contains(e.target)) {
            filterDropdown.classList.remove('active');
        }
        if (!dateDropdown.contains(e.target) && !dateBadge.contains(e.target)) {
            dateDropdown.classList.remove('active');
        }
    });

    // Date range selection
    document.querySelectorAll('.date-dropdown li').forEach(item => {
        item.addEventListener('click', function() {
            document.querySelectorAll('.date-dropdown li').forEach(li => li.classList.remove('active'));
            this.classList.add('active');
            const range = this.dataset.range;
            if (range === 'custom') {
                dateSpan.innerText = 'Custom range';
            } else {
                dateSpan.innerText = `Last ${range} days`;
            }
            applyDateFilter(range);
            dateDropdown.classList.remove('active');
        });
    });

    // Apply filter button
    applyFilter.addEventListener('click', () => {
        const status = filterStatus.value;
        const doctor = filterDoctor.value;
        const startDate = filterStartDate.value;
        const endDate = filterEndDate.value;

        filterTables(status, doctor, startDate, endDate);
        filterDropdown.classList.remove('active');
    });

    // Reset filter button
    resetFilter.addEventListener('click', () => {
        filterStatus.value = 'all';
        filterDoctor.value = 'all';
        filterStartDate.value = '';
        filterEndDate.value = '';
        resetTableFilters();
        filterDropdown.classList.remove('active');
    });
    // function applyDateFilter(range) {
    //     showNotification(`Date range changed to ${dateSpan.innerText}`);
    // }
    function filterTables(status, doctor, startDate, endDate) {
        const historyRows = document.querySelectorAll('#historyTable tbody tr');
        const appointmentRows = document.querySelectorAll('#appointmentsTable tbody tr');

        historyRows.forEach(row => {
            let show = true;
            if (status !== 'all') {
                const rowStatus = row.querySelector('td:last-child span').innerText.toLowerCase();
                if (!rowStatus.includes(status)) show = false;
            }
            if (doctor !== 'all') {
                const rowDoctor = row.querySelector('td:nth-child(3)').innerText;
                if (rowDoctor !== doctor) show = false;
            }
            // startDate, endDate
            row.style.display = show ? '' : 'none';
        });

        appointmentRows.forEach(row => {
            let show = true;
            if (status !== 'all') {
                const rowStatus = row.querySelector('td:last-child span').innerText.toLowerCase();
                if (!rowStatus.includes(status)) show = false;
            }
            if (doctor !== 'all') {
                const rowDoctor = row.querySelector('td:nth-child(3)').innerText;
                if (rowDoctor !== doctor) show = false;
            }
            row.style.display = show ? '' : 'none';
        });

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
    
    // Delay to allow notification to show before processing
    setTimeout(() => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Title
        doc.setFontSize(18);
        doc.text("My Health Report", 105, 15, { align: "center" });
        
        // Generation date
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 22, { align: "center" });
        
        let yOffset = 30;
        
        // Function to add chart image to PDF
        function addChartImage(canvasId, title, yPos) {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return yPos;
            
            const imgData = canvas.toDataURL('image/png');
            doc.setFontSize(12);
            doc.text(title, 14, yPos);
            doc.addImage(imgData, 'PNG', 14, yPos + 5, 180, 60);
            return yPos + 70;
        }
        
        // Add charts to PDF
        yOffset = addChartImage('heartChart', 'Heart Rate (bpm)', yOffset);
        yOffset = addChartImage('spo2Chart', 'SpO₂ (%)', yOffset);
        yOffset = addChartImage('tempChart', 'Body Temperature (°C)', yOffset);
        
        // Note:
        // - For a real application, we would also want to include the historical charts and more detailed data tables.
        // - We could also add more styling, page numbers, and handle multi-page PDFs if needed.
        
        doc.save("health_report.pdf");
        showNotification('Report ready!');
    }, 100);
});
    document.getElementById('downloadReportBtn')?.addEventListener('click', () => {
        showNotification('Downloading latest report...');
    });

    // ==================== SETTINGS SAVE ====================
    document.getElementById('saveSettings')?.addEventListener('click', () => {
        const email = document.getElementById('settingsEmail').value;
        const lang = document.getElementById('settingsLanguage').value;
        showNotification(`Settings saved: Email ${email}, Language ${lang}`);
    });

    // ==================== LOGOUT BUTTON ====================
    const footer = document.querySelector('.sidebar-footer');
    const logoutBtn = document.createElement('a');
    logoutBtn.href = 'javascript:void(0)';
    logoutBtn.className = 'menu-item';
    logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i><span>Logout</span>';
    logoutBtn.addEventListener('click', async () => {
        if (confirm('Logout?')) {
            try {
                await firebase.auth().signOut();
                window.location.href = 'index.html';
            } catch (error) {
                console.error('Logout error:', error);
                showNotification('Logout failed', 'error');
            }
        }
    });
    footer.appendChild(logoutBtn);

    // ==================== CLEANUP ====================
    window.addEventListener('beforeunload', () => {
        if (mqttSimInterval) clearInterval(mqttSimInterval);
    });

        // ==================== PROFILE PAGE FUNCTIONALITY ====================
    
    // دالة بسيطة للتوافق - لا تفعل شيئاً لأن النظام الجديد يتولى كل شيء
    function initProfilePage() {
        console.log('Profile page ready (new Firebase save system)');
    }
    
    // ==================== PROFILE PAGE WITH FIREBASE SAVE ====================
    
    // جلب بيانات الملف الشخصي من Firebase
    async function loadProfileFromFirebase() {
        if (!careSyncPatientId) {
            setTimeout(loadProfileFromFirebase, 2000);
            return;
        }
        
        try {
            const snapshot = await firebase.database().ref(`patients/${careSyncPatientId}/profile`).once('value');
            const data = snapshot.val();
            
            if (data && Object.keys(data).length > 0) {
                updateProfileUI(data);
                console.log('📋 Profile loaded from Firebase');
            } else {
                // حفظ البيانات الافتراضية لأول مرة
                const defaultProfile = {
                    fullName: document.getElementById('profileFullName')?.innerText || 'Ahmed Mohamed Ali',
                    name: 'Ahmed Mohamed',
                    email: document.getElementById('profileEmail')?.innerText || 'ahmed.mohamed@example.com',
                    phone: document.getElementById('profilePhone')?.innerText || '+20 123 456 7890',
                    dob: '1985-03-15',
                    gender: 'Male',
                    bloodType: 'O+',
                    weight: 78,
                    height: 175,
                    address: '42 Nile Street, Cairo, Egypt',
                    emergencyContact: 'Sara Ahmed - +20 122 345 6789',
                    physician: 'Dr. Sarah Ahmed (Cardiology)',
                    chronicDiseases: 'Type 2 Diabetes, Hypertension',
                    allergies: 'Penicillin, Dust',
                    medications: 'Metformin 500mg, Lisinopril 10mg',
                    lastUpdated: Date.now()
                };
                await firebase.database().ref(`patients/${careSyncPatientId}/profile`).set(defaultProfile);
                updateProfileUI(defaultProfile);
            }
        } catch (error) {
            console.error('Error loading profile:', error);
        }
    }
    
    // تحديث واجهة المستخدم بالبيانات
    function updateProfileUI(data) {
        if (data.fullName) document.getElementById('profileFullName').innerText = data.fullName;
        if (data.name) document.getElementById('profileName').innerText = data.name;
        if (data.email) document.getElementById('profileEmail').innerText = data.email;
        if (data.phone) document.getElementById('profilePhone').innerText = data.phone;
        if (data.dob) {
            const date = new Date(data.dob);
            document.getElementById('profileDob').innerText = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        }
        if (data.gender) document.getElementById('profileGender').innerText = data.gender;
        if (data.bloodType) document.getElementById('profileBloodType').innerText = data.bloodType;
        if (data.weight) document.getElementById('profileWeight').innerHTML = data.weight + ' <span style="font-size:0.7rem;">kg</span>';
        if (data.height) document.getElementById('profileHeight').innerHTML = data.height + ' <span style="font-size:0.7rem;">cm</span>';
        if (data.address) document.getElementById('profileAddress').innerText = data.address;
        if (data.emergencyContact) document.getElementById('profileEmergency').innerText = data.emergencyContact;
        if (data.physician) document.getElementById('profilePhysician').innerText = data.physician;
        if (data.chronicDiseases) document.getElementById('profileChronic').innerText = data.chronicDiseases;
        if (data.allergies) document.getElementById('profileAllergies').innerText = data.allergies;
        if (data.medications) document.getElementById('profileMedications').innerText = data.medications;
        
        // حساب BMI
        if (data.weight && data.height) {
            const heightM = data.height / 100;
            const bmi = (data.weight / (heightM * heightM)).toFixed(1);
            document.getElementById('profileBMI').innerHTML = bmi;
            
            let status = '';
            if (bmi < 18.5) status = 'Underweight';
            else if (bmi < 25) status = 'Normal';
            else if (bmi < 30) status = 'Overweight';
            else status = 'Obese';
            document.getElementById('bmiStatus').innerText = status;
        }
    }
    
    // حفظ البيانات إلى Firebase
    async function saveProfileToFirebase(event) {
        event.preventDefault();
        
        if (!careSyncPatientId) {
            showNotification('Please wait, loading patient data...', 'error');
            return;
        }
        
        const profileData = {
            fullName: document.getElementById('edit_fullName').value,
            name: document.getElementById('edit_fullName').value.split(' ')[0] || '',
            email: document.getElementById('edit_email').value,
            phone: document.getElementById('edit_phone').value,
            dob: document.getElementById('edit_dob').value,
            gender: document.getElementById('edit_gender').value,
            bloodType: document.getElementById('edit_bloodType').value,
            weight: parseFloat(document.getElementById('edit_weight').value) || 0,
            height: parseFloat(document.getElementById('edit_height').value) || 0,
            address: document.getElementById('edit_address').value,
            emergencyContact: document.getElementById('edit_emergency').value,
            physician: document.getElementById('edit_physician').value,
            chronicDiseases: document.getElementById('edit_chronic').value,
            allergies: document.getElementById('edit_allergies').value,
            medications: document.getElementById('edit_medications').value,
            lastUpdated: Date.now()
        };
        
        try {
            await firebase.database().ref(`patients/${careSyncPatientId}/profile`).set(profileData);
            updateProfileUI(profileData);
            closeModal();
            showNotification('✅ Profile saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving profile:', error);
            showNotification('❌ Error saving profile: ' + error.message, 'error');
        }
    }
    
    // ==================== EDIT PROFILE MODAL ====================
    
    function createEditModal() {
        if (document.getElementById('editProfileModal')) return;
        
        const modalHTML = `
        <div id="editProfileModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); backdrop-filter: blur(5px); z-index: 9999; align-items: center; justify-content: center;">
            <div style="background: var(--surface); border-radius: 32px; max-width: 600px; width: 90%; max-height: 85vh; overflow-y: auto; padding: 2rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2 style="font-size: 1.8rem; font-weight: 700;"><i class="fas fa-user-edit"></i> Edit Profile</h2>
                    <button id="closeModalBtn" style="background: none; border: none; font-size: 2rem; cursor: pointer; color: var(--text-secondary);">&times;</button>
                </div>
                <form id="profileForm">
                    <div style="display: grid; gap: 1rem;">
                        <div><label style="font-weight: 600;">Full Name *</label><input type="text" id="edit_fullName" style="width: 100%; padding: 0.8rem; border-radius: 16px; border: 1px solid var(--border); background: var(--surface); color: var(--text-primary);"></div>
                        <div><label style="font-weight: 600;">Email *</label><input type="email" id="edit_email" style="width: 100%; padding: 0.8rem; border-radius: 16px; border: 1px solid var(--border); background: var(--surface); color: var(--text-primary);"></div>
                        <div><label style="font-weight: 600;">Phone Number</label><input type="text" id="edit_phone" style="width: 100%; padding: 0.8rem; border-radius: 16px; border: 1px solid var(--border); background: var(--surface); color: var(--text-primary);"></div>
                        <div><label style="font-weight: 600;">Date of Birth</label><input type="date" id="edit_dob" style="width: 100%; padding: 0.8rem; border-radius: 16px; border: 1px solid var(--border); background: var(--surface); color: var(--text-primary);"></div>
                        <div><label style="font-weight: 600;">Gender</label><select id="edit_gender" style="width: 100%; padding: 0.8rem; border-radius: 16px; border: 1px solid var(--border); background: var(--surface); color: var(--text-primary);"><option>Male</option><option>Female</option><option>Other</option></select></div>
                        <div><label style="font-weight: 600;">Blood Type</label><select id="edit_bloodType" style="width: 100%; padding: 0.8rem; border-radius: 16px; border: 1px solid var(--border); background: var(--surface); color: var(--text-primary);"><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>O+</option><option>O-</option><option>AB+</option><option>AB-</option></select></div>
                        <div><label style="font-weight: 600;">Weight (kg)</label><input type="number" step="0.1" id="edit_weight" style="width: 100%; padding: 0.8rem; border-radius: 16px; border: 1px solid var(--border); background: var(--surface); color: var(--text-primary);"></div>
                        <div><label style="font-weight: 600;">Height (cm)</label><input type="number" step="0.1" id="edit_height" style="width: 100%; padding: 0.8rem; border-radius: 16px; border: 1px solid var(--border); background: var(--surface); color: var(--text-primary);"></div>
                        <div><label style="font-weight: 600;">Address</label><textarea id="edit_address" rows="2" style="width: 100%; padding: 0.8rem; border-radius: 16px; border: 1px solid var(--border); background: var(--surface); color: var(--text-primary);"></textarea></div>
                        <div><label style="font-weight: 600;">Emergency Contact</label><input type="text" id="edit_emergency" style="width: 100%; padding: 0.8rem; border-radius: 16px; border: 1px solid var(--border); background: var(--surface); color: var(--text-primary);"></div>
                        <div><label style="font-weight: 600;">Primary Physician</label><input type="text" id="edit_physician" style="width: 100%; padding: 0.8rem; border-radius: 16px; border: 1px solid var(--border); background: var(--surface); color: var(--text-primary);"></div>
                        <div><label style="font-weight: 600;">Chronic Diseases</label><input type="text" id="edit_chronic" style="width: 100%; padding: 0.8rem; border-radius: 16px; border: 1px solid var(--border); background: var(--surface); color: var(--text-primary);" placeholder="e.g., Diabetes, Hypertension"></div>
                        <div><label style="font-weight: 600;">Allergies</label><input type="text" id="edit_allergies" style="width: 100%; padding: 0.8rem; border-radius: 16px; border: 1px solid var(--border); background: var(--surface); color: var(--text-primary);" placeholder="e.g., Penicillin, Dust"></div>
                        <div><label style="font-weight: 600;">Current Medications</label><input type="text" id="edit_medications" style="width: 100%; padding: 0.8rem; border-radius: 16px; border: 1px solid var(--border); background: var(--surface); color: var(--text-primary);" placeholder="e.g., Metformin 500mg"></div>
                    </div>
                    <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                        <button type="submit" class="export-btn" style="flex: 1;"><i class="fas fa-save"></i> Save Changes</button>
                        <button type="button" id="cancelModalBtn" style="flex: 1; background: var(--border); border: none; border-radius: 50px; font-weight: 700; cursor: pointer;"><i class="fas fa-times"></i> Cancel</button>
                    </div>
                </form>
            </div>
        </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        const modal = document.getElementById('editProfileModal');
        const closeModalBtn = document.getElementById('closeModalBtn');
        const cancelModalBtn = document.getElementById('cancelModalBtn');
        const profileForm = document.getElementById('profileForm');
        
        window.openEditModal = function() {
            document.getElementById('edit_fullName').value = document.getElementById('profileFullName')?.innerText || '';
            document.getElementById('edit_email').value = document.getElementById('profileEmail')?.innerText || '';
            document.getElementById('edit_phone').value = document.getElementById('profilePhone')?.innerText || '';
            
            const dobText = document.getElementById('profileDob')?.innerText || '';
            if (dobText) {
                const parts = dobText.split(' ');
                if (parts.length >= 3) {
                    const date = new Date(`${parts[1]} ${parts[0]}, ${parts[2]}`);
                    if (!isNaN(date)) document.getElementById('edit_dob').value = date.toISOString().split('T')[0];
                }
            }
            
            document.getElementById('edit_gender').value = document.getElementById('profileGender')?.innerText || 'Male';
            document.getElementById('edit_bloodType').value = document.getElementById('profileBloodType')?.innerText || 'O+';
            document.getElementById('edit_weight').value = parseFloat(document.getElementById('profileWeight')?.innerText) || '';
            document.getElementById('edit_height').value = parseFloat(document.getElementById('profileHeight')?.innerText) || '';
            document.getElementById('edit_address').value = document.getElementById('profileAddress')?.innerText || '';
            document.getElementById('edit_emergency').value = document.getElementById('profileEmergency')?.innerText || '';
            document.getElementById('edit_physician').value = document.getElementById('profilePhysician')?.innerText || '';
            document.getElementById('edit_chronic').value = document.getElementById('profileChronic')?.innerText || '';
            document.getElementById('edit_allergies').value = document.getElementById('profileAllergies')?.innerText || '';
            document.getElementById('edit_medications').value = document.getElementById('profileMedications')?.innerText || '';
            
            modal.style.display = 'flex';
        };
        
        window.closeModal = function() {
            modal.style.display = 'none';
        };
        
        closeModalBtn?.addEventListener('click', () => modal.style.display = 'none');
        cancelModalBtn?.addEventListener('click', () => modal.style.display = 'none');
        profileForm?.addEventListener('submit', saveProfileToFirebase);
        modal?.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    }
    
    // ربط زر Edit Profile
    function bindEditProfileButton() {
        const editBtn = document.getElementById('editProfileBtn');
        if (editBtn) {
            const newEditBtn = editBtn.cloneNode(true);
            editBtn.parentNode.replaceChild(newEditBtn, editBtn);
            
            newEditBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Edit button clicked');
                if (window.openEditModal) window.openEditModal();
            });
        } else {
            setTimeout(bindEditProfileButton, 1000);
        }
    }
    
    // تحديث بيانات الضغط والسكر في صفحة Profile
    function syncVitalsToProfile() {
        setInterval(() => {
            const glucoseEl = document.getElementById('glucoseValue');
            if (glucoseEl && glucoseEl.innerText !== '--') {
                const glucoseVal = glucoseEl.innerText.split(' ')[0];
                if (glucoseVal && !isNaN(glucoseVal)) {
                    const profileGlucose = document.getElementById('profileGlucose');
                    if (profileGlucose) profileGlucose.innerHTML = glucoseVal + ' <span style="font-size:0.7rem;">mg/dL</span>';
                }
            }
            
            const bpEl = document.getElementById('bpValue');
            if (bpEl && bpEl.innerText !== '--/--') {
                const bpVal = bpEl.innerText.split(' ')[0];
                if (bpVal) {
                    const profileBP = document.getElementById('profileBP');
                    if (profileBP) profileBP.innerHTML = bpVal;
                }
            }
        }, 3000);
    }
    
    // استدعاء الدوال عند تحميل الصفحة
    setTimeout(() => {
        console.log('Initializing profile system...');
        createEditModal();
        bindEditProfileButton();
        loadProfileFromFirebase();
        syncVitalsToProfile();
    }, 4000);
    
    // Override showPage to keep compatibility
    const originalShowPage = showPage;
    showPage = function(pageId) {
        originalShowPage(pageId);
        if (filterDropdown) filterDropdown.classList.remove('active');
        if (dateDropdown) dateDropdown.classList.remove('active');
        if (pageId === 'profile') {
            initProfilePage();
        }
    };
        // ==================== FIREBASE REAL-TIME DATA (BP & GLUCOSE FROM CARE SYNC) ====================
    // هذا الكود يجلب بيانات الضغط والسكر من Firebase (Care Sync PIMA Model)
    
    let careSyncPatientId = null;
    let careSyncLastAlert = 0;
    const CARE_SYNC_ALERT_COOLDOWN = 30000;
    
    // إضافة عناصر BP و Glucose في الـ UI
    function addCareSyncUIElements() {
        const vitalsGrid = document.querySelector('.vitals-grid');
        if (!vitalsGrid) return;
        if (document.getElementById('bpValue')) return;
        
        // إضافة كارد ضغط الدم
        const bpCard = document.createElement('div');
        bpCard.className = 'vital-card';
        bpCard.innerHTML = `
            <div class="vital-header"><i class="fas fa-tachometer-alt" style="color:#8b5cf6; font-size:2rem;"></i><h3>Blood Pressure</h3></div>
            <div class="vital-value" id="bpValue">--/-- <span>mmHg</span></div>
            <div id="bpGauge" class="gauge-container"></div>
            <div class="card-indicator" id="bpIndicator">Normal</div>
        `;
        vitalsGrid.appendChild(bpCard);
        
        // إضافة كارد السكر
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
    
    // إنشاء Gauge لـ BP و Glucose
    let bpGauge, glucoseGauge;
    
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
    
    // جلب آخر مريض من Care Sync
    async function getLatestCareSyncPatient() {
        try {
            const snapshot = await firebase.database().ref('patients').once('value');
            const patients = snapshot.val();
            if (!patients) return null;
            
            let latestPatient = null;
            let latestTime = 0;
            
            for (const pid of Object.keys(patients)) {
                const readings = patients[pid]?.readings;
                if (readings) {
                    const times = Object.keys(readings);
                    if (times.length > 0) {
                        const lastTime = parseInt(times[times.length - 1]);
                        if (lastTime > latestTime) {
                            latestTime = lastTime;
                            latestPatient = pid;
                        }
                    }
                }
            }
            return latestPatient;
        } catch (error) {
            console.error('Error getting Care Sync patient:', error);
            return null;
        }
    }
    
    // جلب آخر قراءة من Care Sync
    async function getLatestCareSyncVitals(patientId) {
        if (!patientId) return null;
        
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
                    timestamp: latestTimestamp
                };
            }
            return null;
        } catch (error) {
            console.error('Error fetching Care Sync vitals:', error);
            return null;
        }
    }
    
    // تحديث واجهة المستخدم ببيانات Care Sync
    function updateUICareSync(vitals) {
        if (!vitals) return;
        
        // تحديث ضغط الدم
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
        
        // تحديث السكر
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
        
        // تنبيهات للقيم الحرجة
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
                if (alertsContainer.children.length > 5) {
                    alertsContainer.removeChild(alertsContainer.lastChild);
                }
            }
        }
    }
    
    // بدء الاستماع لبيانات Care Sync
    function startCareSyncListener() {
        console.log('🔥 Starting Care Sync Firebase listener...');
        addCareSyncUIElements();
        
        setTimeout(() => {
            initCareSyncGauges();
        }, 500);
        
        getLatestCareSyncPatient().then(patientId => {
            if (!patientId) {
                console.log('No Care Sync patient data found. Waiting...');
                setTimeout(startCareSyncListener, 10000);
                return;
            }
            
            careSyncPatientId = patientId;
            console.log(`✅ Connected to Care Sync patient: ${patientId}`);
            
            const readingsRef = firebase.database().ref(`patients/${patientId}/readings`);
            
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
            
            getLatestCareSyncVitals(patientId).then(vitals => {
                if (vitals) updateUICareSync(vitals);
            });
        }).catch(error => {
            console.error('Care Sync error:', error);
            setTimeout(startCareSyncListener, 15000);
        });
    }
    
    // بدء الاستماع
    setTimeout(() => {
        startCareSyncListener();
    }, 3000);
        // ==================== INITIAL PAGE ====================
    showPage('dashboard');
    
})();
