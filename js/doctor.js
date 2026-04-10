// ====================================================
// DOCTOR DASHBOARD - PROFESSIONAL INTEGRATED VERSION
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
    } else {
        console.warn('Firebase not loaded, skipping auth guard');
    }

    // ==================== GLOBAL VARIABLES ====================
    let mqttSimInterval;
    let alertSoundEnabled = true;
    
    // تعريف database
    let database = null;
    
    // انتظار تحميل Firebase
    function waitForFirebase() {
        if (typeof firebase !== 'undefined' && firebase.database) {
            database = firebase.database();
            console.log("✅ Firebase database initialized");
            startDoctorFirebaseSync();
            startSimulation();
        } else {
            console.log("⏳ Waiting for Firebase...");
            setTimeout(waitForFirebase, 500);
        }
    }

    // -------------------- Alert Sound --------------------
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

    // ==================== UPDATE DOCTOR VITALS DISPLAY ====================
    function updateDoctorHeartRate(value) {
        const el = document.getElementById('doctorHeartValue');
        if (el) el.innerHTML = value + ' <span>bpm</span>';
        const indicator = document.getElementById('doctorHeartIndicator');
        if (indicator) {
            if (value > 100 || value < 50) { indicator.className = 'indicator-danger'; indicator.innerText = 'Critical'; }
            else if (value > 90 || value < 60) { indicator.className = 'indicator-warning'; indicator.innerText = 'Warning'; }
            else { indicator.className = 'indicator-normal'; indicator.innerText = 'Normal'; }
        }
        updateCharts(value, null, null);
    }

    function updateDoctorSpO2(value) {
        const el = document.getElementById('doctorSpo2Value');
        if (el) el.innerHTML = value + ' <span>%</span>';
        const indicator = document.getElementById('doctorSpo2Indicator');
        if (indicator) {
            if (value < 90) { indicator.className = 'indicator-danger'; indicator.innerText = 'Critical'; }
            else if (value < 95) { indicator.className = 'indicator-warning'; indicator.innerText = 'Warning'; }
            else { indicator.className = 'indicator-normal'; indicator.innerText = 'Normal'; }
        }
    }

    function updateDoctorTemperature(value) {
        const el = document.getElementById('doctorTempValue');
        if (el) el.innerHTML = value.toFixed(1) + ' <span>°C</span>';
        const indicator = document.getElementById('doctorTempIndicator');
        if (indicator) {
            if (value > 38.5 || value < 35) { indicator.className = 'indicator-danger'; indicator.innerText = 'Critical'; }
            else if (value > 37.5 || value < 36) { indicator.className = 'indicator-warning'; indicator.innerText = 'Warning'; }
            else { indicator.className = 'indicator-normal'; indicator.innerText = 'Normal'; }
        }
    }

    function updateDoctorBloodPressure(sbp, dbp) {
        const el = document.getElementById('doctorBpValue');
        if (el) el.innerHTML = sbp + '/' + dbp + ' <span>mmHg</span>';
        const indicator = document.getElementById('doctorBpIndicator');
        if (indicator) {
            if (sbp >= 180 || dbp >= 120) { indicator.className = 'indicator-danger'; indicator.innerText = 'Crisis'; }
            else if (sbp >= 140 || dbp >= 90) { indicator.className = 'indicator-warning'; indicator.innerText = 'Hypertension'; }
            else if (sbp >= 120) { indicator.className = 'indicator-warning'; indicator.innerText = 'Elevated'; }
            else { indicator.className = 'indicator-normal'; indicator.innerText = 'Normal'; }
        }
    }

    function updateDoctorGlucose(value) {
        const el = document.getElementById('doctorGlucoseValue');
        if (el) el.innerHTML = Math.round(value) + ' <span>mg/dL</span>';
        const indicator = document.getElementById('doctorGlucoseIndicator');
        if (indicator) {
            if (value >= 300) { indicator.className = 'indicator-danger'; indicator.innerText = 'Critical'; }
            else if (value >= 200) { indicator.className = 'indicator-danger'; indicator.innerText = 'Very High'; }
            else if (value >= 126) { indicator.className = 'indicator-warning'; indicator.innerText = 'High (Diabetes)'; }
            else if (value >= 100) { indicator.className = 'indicator-warning'; indicator.innerText = 'Prediabetes'; }
            else if (value < 70) { indicator.className = 'indicator-danger'; indicator.innerText = 'Low'; }
            else { indicator.className = 'indicator-normal'; indicator.innerText = 'Normal'; }
        }
    }

    function updateDoctorRoomTemp(value) {
        const el = document.getElementById('doctorRoomTempValue');
        if (el) el.innerHTML = value.toFixed(1) + ' <span>°C</span>';
    }

    function updateDoctorHumidity(value) {
        const el = document.getElementById('doctorHumidityValue');
        if (el) el.innerHTML = value.toFixed(1) + ' <span>%</span>';
    }

    function updateDoctorMotion(value) {
        const el = document.getElementById('doctorMotionValue');
        if (el) el.innerHTML = value.toFixed(1) + ' <span>m/s²</span>';
    }

    // ==================== جلب المرضى من users ====================
    async function loadPatientsFromUsers() {
        if (!database) return;
        
        try {
            console.log("🔄 Loading patients from users...");
            const snapshot = await database.ref('users').once('value');
            const users = snapshot.val();
            
            if (!users) {
                console.log("❌ No users found!");
                return;
            }
            
            const patientsList = [];
            for (const [uid, userData] of Object.entries(users)) {
                if (userData.role === 'patient') {
                    patientsList.push({
                        uid: uid,
                        name: userData.name || "Unknown",
                        email: userData.email || ""
                    });
                    console.log(`✅ Found patient: ${userData.name} (${uid})`);
                }
            }
            
            console.log(`📊 Total patients found: ${patientsList.length}`);
            
            // تحديث عدد المرضى
            const totalPatientsEl = document.getElementById('totalPatients');
            const dashboardTotalEl = document.getElementById('dashboardTotalPatients');
            if (totalPatientsEl) totalPatientsEl.innerHTML = patientsList.length;
            if (dashboardTotalEl) dashboardTotalEl.innerHTML = patientsList.length;
            
            // تحديث قائمة المرضى في Lab Results Page
            const labSelect = document.getElementById('labPatientSelect');
            if (labSelect) {
                labSelect.innerHTML = '<option value="">-- Select Patient --</option>';
                for (const patient of patientsList) {
                    const option = document.createElement('option');
                    option.value = patient.uid;
                    option.textContent = patient.name;
                    labSelect.appendChild(option);
                }
                console.log(`✅ Added ${patientsList.length} patients to Lab select`);
            }
            
            // تحديث قائمة المرضى في Patient Vitals Page
            const vitalsSelect = document.getElementById('vitalsPatientSelect');
            if (vitalsSelect) {
                vitalsSelect.innerHTML = '<option value="">-- Select Patient --</option>';
                for (const patient of patientsList) {
                    const option = document.createElement('option');
                    option.value = patient.uid;
                    option.textContent = patient.name;
                    vitalsSelect.appendChild(option);
                }
                console.log(`✅ Added ${patientsList.length} patients to Vitals select`);
            }
            
        } catch (error) {
            console.error("❌ Error loading patients:", error);
        }
    }

    // ==================== FIREBASE REAL-TIME DATA ====================
    let firebaseDoctorPatientId = null;

    async function getDoctorLatestPatientId() {
        if (!database) return null;
        try {
            const snapshot = await database.ref('patients').once('value');
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
            console.error('Error getting patient ID:', error);
            return null;
        }
    }

    function startDoctorFirebaseSync() {
        if (!database) {
            console.log('Waiting for database...');
            return;
        }
        
        console.log('🔥 Starting Doctor Firebase sync...');
        
        // الاستماع لبيانات ESP32
        const esp32Ref = database.ref('/HELIOS_DATA_LIVE/Vitals');
        esp32Ref.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                if (data.HeartRate) updateDoctorHeartRate(data.HeartRate);
                if (data.SpO2) updateDoctorSpO2(data.SpO2);
                if (data.BodyTemp) updateDoctorTemperature(data.BodyTemp);
                if (data.RoomTemp) updateDoctorRoomTemp(data.RoomTemp);
                if (data.Humidity) updateDoctorHumidity(data.Humidity);
                if (data.Motion) updateDoctorMotion(data.Motion);
                document.getElementById('lastUpdate').innerHTML = new Date().toLocaleTimeString();
                console.log('📊 ESP32 data updated');
            }
        });
        
        // جلب بيانات Care Sync
        getDoctorLatestPatientId().then(patientId => {
            if (!patientId) {
                console.log('No Care Sync patient data found yet...');
                return;
            }
            
            firebaseDoctorPatientId = patientId;
            document.getElementById('careSyncStatus').innerHTML = '✅ Connected: ' + patientId.substring(0, 20) + '...';
            console.log(`✅ Doctor connected to Care Sync patient: ${patientId}`);
            
            const readingsRef = database.ref(`patients/${patientId}/readings`);
            readingsRef.on('child_added', (snapshot) => {
                const reading = snapshot.val();
                if (reading && reading.vitals) {
                    if (reading.vitals.systolic_bp && reading.vitals.diastolic_bp) {
                        updateDoctorBloodPressure(reading.vitals.systolic_bp, reading.vitals.diastolic_bp);
                    }
                    if (reading.vitals.glucose) {
                        updateDoctorGlucose(reading.vitals.glucose);
                    }
                }
            });
            
            readingsRef.orderByKey().limitToLast(1).once('value', (snapshot) => {
                const readings = snapshot.val();
                if (readings) {
                    const lastKey = Object.keys(readings)[0];
                    const lastReading = readings[lastKey];
                    if (lastReading && lastReading.vitals) {
                        if (lastReading.vitals.systolic_bp && lastReading.vitals.diastolic_bp) {
                            updateDoctorBloodPressure(lastReading.vitals.systolic_bp, lastReading.vitals.diastolic_bp);
                        }
                        if (lastReading.vitals.glucose) {
                            updateDoctorGlucose(lastReading.vitals.glucose);
                        }
                    }
                }
            });
        }).catch(error => {
            console.error('Doctor Firebase error:', error);
        });
    }

    // ==================== SIMULATED MQTT UPDATES (FALLBACK) ====================
    function generateRandomVitals() {
        return {
            heart: Math.floor(Math.random() * (85-65+1)) + 65,
            spo2: Math.floor(Math.random() * (99-94+1)) + 94,
            temp: (Math.random() * (37.5-36.0) + 36.0),
            roomTemp: Math.floor(Math.random() * (25-22+1)) + 22,
            humidity: Math.floor(Math.random() * (60-40+1)) + 40
        };
    }

    function startSimulation() {
        const vitals = generateRandomVitals();
        updateDoctorHeartRate(vitals.heart);
        updateDoctorSpO2(vitals.spo2);
        updateDoctorTemperature(vitals.temp);
        updateDoctorRoomTemp(vitals.roomTemp);
        updateDoctorHumidity(vitals.humidity);
        
        mqttSimInterval = setInterval(() => {
            const newVitals = generateRandomVitals();
            updateDoctorHeartRate(newVitals.heart);
            updateDoctorSpO2(newVitals.spo2);
            updateDoctorTemperature(newVitals.temp);
            updateDoctorRoomTemp(newVitals.roomTemp);
            updateDoctorHumidity(newVitals.humidity);
        }, 5000);
    }

    // ==================== SEARCH & FILTER ====================
    document.getElementById('globalSearch')?.addEventListener('input', function() {
        const value = this.value.toLowerCase();
        document.querySelectorAll('#recentPatientsTable tbody tr').forEach(row => {
            row.style.display = row.innerText.toLowerCase().includes(value) ? '' : 'none';
        });
    });

    document.getElementById('patientSearch')?.addEventListener('input', function() {
        const value = this.value.toLowerCase();
        document.querySelectorAll('#patientsFullTable tbody tr').forEach(row => {
            row.style.display = row.innerText.toLowerCase().includes(value) ? '' : 'none';
        });
    });

    // ==================== EXPORT PDF ====================
    document.getElementById('exportBtn')?.addEventListener('click', function() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Recent Patients Report", 14, 22);
        const table = document.getElementById('recentPatientsTable');
        const headers = [];
        const rows = [];
        const headerCells = table.querySelectorAll('thead th');
        headerCells.forEach(cell => headers.push(cell.innerText));
        const bodyRows = table.querySelectorAll('tbody tr');
        bodyRows.forEach(row => {
            const rowData = [];
            row.querySelectorAll('td').forEach(cell => rowData.push(cell.innerText.trim()));
            rows.push(rowData);
        });
        doc.autoTable({ head: [headers], body: rows, startY: 30, theme: 'striped' });
        doc.save('recent_patients_report.pdf');
        showNotification('PDF exported successfully!');
    });

    // ==================== SETTINGS SAVE ====================
    document.getElementById('saveSettings')?.addEventListener('click', () => {
        const email = document.getElementById('settingsEmail')?.value;
        const lang = document.getElementById('settingsLanguage')?.value;
        showNotification(`Settings saved: Email ${email}, Language ${lang}`);
    });

    // ==================== LOGOUT ====================
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
    if (footer) footer.appendChild(logoutBtn);

    // ==================== CLEANUP ====================
    window.addEventListener('beforeunload', () => {
        if (mqttSimInterval) clearInterval(mqttSimInterval);
    });

    // Override showPage
    const originalShowPage = showPage;
    showPage = function(pageId) {
        originalShowPage(pageId);
        const filterDropdown = document.getElementById('filterDropdown');
        const dateDropdown = document.getElementById('dateDropdown');
        if (filterDropdown) filterDropdown.classList.remove('active');
        if (dateDropdown) dateDropdown.classList.remove('active');
    };

    // ==================== INITIAL PAGE ====================
    showPage('dashboard');
    
    // بدء تحميل المرضى و Firebase sync
    setTimeout(() => {
        loadPatientsFromUsers();
    }, 500);
    
    // بدء Firebase sync
    setTimeout(() => {
        waitForFirebase();
    }, 1000);
})();
