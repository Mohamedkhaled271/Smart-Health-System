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
    let database = null;
    let currentVitalsPatientId = null;
    let currentLabPatientId = null;
    let currentDataPatientId = null;
    let currentDoctorName = localStorage.getItem('doctorName') || "Dr. Sarah Ahmed";

    // ==================== WAIT FOR FIREBASE ====================
    function waitForFirebase() {
        if (typeof firebase !== 'undefined' && firebase.database) {
            database = firebase.database();
            console.log("✅ Firebase database initialized");
            startDoctorFirebaseSync();
            startSimulation();
            loadPatientsFromUsers();
            setupDoctorNameListener();
        } else {
            console.log("⏳ Waiting for Firebase...");
            setTimeout(waitForFirebase, 500);
        }
    }

    // ==================== DOCTOR NAME SETUP ====================
    function setupDoctorNameListener() {
        const doctorNameInput = document.getElementById('doctorNameSetting');
        if (doctorNameInput) {
            doctorNameInput.value = currentDoctorName;
            doctorNameInput.addEventListener('change', function() {
                currentDoctorName = this.value;
                localStorage.setItem('doctorName', currentDoctorName);
                const doctorNameField = document.getElementById('doctorName');
                if (doctorNameField) doctorNameField.value = currentDoctorName;
                showSuccessMessage('Doctor name updated successfully!');
            });
        }
        const doctorNameField = document.getElementById('doctorName');
        if (doctorNameField) doctorNameField.value = currentDoctorName;
    }

    // ==================== ALERT SOUND ====================
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

    function showSuccessMessage(message) {
        const statusDiv = document.getElementById('labSaveStatus');
        if(statusDiv) {
            statusDiv.textContent = message;
            statusDiv.style.display = 'block';
            statusDiv.style.backgroundColor = '#10b981';
            statusDiv.style.color = 'white';
            statusDiv.style.padding = '12px';
            statusDiv.style.borderRadius = '10px';
            setTimeout(() => { statusDiv.style.display = 'none'; }, 3000);
        } else {
            alert(message);
        }
    }

    function showErrorMessage(message) {
        const statusDiv = document.getElementById('labSaveStatus');
        if(statusDiv) {
            statusDiv.textContent = message;
            statusDiv.style.display = 'block';
            statusDiv.style.backgroundColor = '#ef4444';
            statusDiv.style.color = 'white';
            statusDiv.style.padding = '12px';
            statusDiv.style.borderRadius = '10px';
            setTimeout(() => { statusDiv.style.display = 'none'; }, 5000);
        } else {
            alert(message);
        }
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

    // ==================== ESP32 + AI DATA LISTENER (Patient Data Page) ====================
    function startDataListener(patientId) {
        if(!patientId || !database) return;
        currentDataPatientId = patientId;
        console.log("📊 Starting data listener for patient:", patientId);
        
        const esp32Ref = database.ref('/HELIOS_DATA_LIVE/Vitals');
        esp32Ref.on('value', (snapshot) => {
            const data = snapshot.val();
            if(data) {
                if(data.HeartRate) {
                    document.getElementById('esp32HeartRate').innerHTML = data.HeartRate + ' <span>bpm</span>';
                    updateDoctorIndicator('esp32HeartIndicator', data.HeartRate, 60, 100, 55, 110);
                }
                if(data.SpO2) {
                    document.getElementById('esp32Spo2').innerHTML = data.SpO2 + ' <span>%</span>';
                    updateDoctorIndicator('esp32Spo2Indicator', data.SpO2, 95, 100, 90, 100);
                }
                if(data.BodyTemp) {
                    document.getElementById('esp32Temp').innerHTML = data.BodyTemp.toFixed(1) + ' <span>°C</span>';
                    updateDoctorIndicator('esp32TempIndicator', data.BodyTemp, 36.0, 37.5, 35.5, 38.0);
                }
                if(data.RoomTemp) document.getElementById('esp32RoomTemp').innerHTML = data.RoomTemp.toFixed(1) + ' <span>°C</span>';
                if(data.Humidity) document.getElementById('esp32Humidity').innerHTML = data.Humidity.toFixed(1) + ' <span>%</span>';
                if(data.Motion) document.getElementById('esp32Motion').innerHTML = data.Motion.toFixed(1) + ' <span>m/s²</span>';
                
                document.getElementById('esp32Status').innerHTML = '✅ Connected';
                document.getElementById('dataSyncTime').innerHTML = new Date().toLocaleTimeString();
            }
        });
        
        const readingsRef = database.ref(`patients/${patientId}/readings`);
        readingsRef.on('child_added', (snapshot) => {
            const reading = snapshot.val();
            if(reading && reading.vitals) {
                if(reading.vitals.systolic_bp) {
                    document.getElementById('aiSbp').innerHTML = reading.vitals.systolic_bp + ' <span>mmHg</span>';
                    updateDoctorIndicator('aiSbpIndicator', reading.vitals.systolic_bp, 90, 120, 130, 140);
                }
                if(reading.vitals.diastolic_bp) {
                    document.getElementById('aiDbp').innerHTML = reading.vitals.diastolic_bp + ' <span>mmHg</span>';
                }
                if(reading.vitals.glucose) {
                    document.getElementById('aiGlucose').innerHTML = Math.round(reading.vitals.glucose) + ' <span>mg/dL</span>';
                    updateDoctorIndicator('aiGlucoseIndicator', reading.vitals.glucose, 70, 100, 126, 200);
                }
                if(reading.vitals.heart_rate) {
                    document.getElementById('aiHeartRate').innerHTML = reading.vitals.heart_rate + ' <span>bpm</span>';
                }
                if(reading.clinical) {
                    document.getElementById('clinicalGlucoseClass').innerHTML = reading.clinical.glucose_class || '--';
                    document.getElementById('clinicalBpClass').innerHTML = reading.clinical.bp_class || '--';
                    document.getElementById('clinicalTrend').innerHTML = reading.clinical.trend || 'STABLE';
                }
                document.getElementById('aiModelStatus').innerHTML = '✅ PIMA Model Active';
            }
        });
        
        readingsRef.orderByKey().limitToLast(1).once('value', (snapshot) => {
            const readings = snapshot.val();
            if(readings) {
                const lastKey = Object.keys(readings)[0];
                const lastReading = readings[lastKey];
                if(lastReading && lastReading.vitals) {
                    if(lastReading.vitals.systolic_bp) document.getElementById('aiSbp').innerHTML = lastReading.vitals.systolic_bp + ' <span>mmHg</span>';
                    if(lastReading.vitals.diastolic_bp) document.getElementById('aiDbp').innerHTML = lastReading.vitals.diastolic_bp + ' <span>mmHg</span>';
                    if(lastReading.vitals.glucose) document.getElementById('aiGlucose').innerHTML = Math.round(lastReading.vitals.glucose) + ' <span>mg/dL</span>';
                    if(lastReading.clinical) {
                        document.getElementById('clinicalGlucoseClass').innerHTML = lastReading.clinical.glucose_class || '--';
                        document.getElementById('clinicalBpClass').innerHTML = lastReading.clinical.bp_class || '--';
                    }
                }
            }
        });
    }

    function updateDoctorIndicator(id, value, normalMin, normalMax, warnMin, warnMax) {
        const el = document.getElementById(id);
        if(!el) return;
        if(value < normalMin || value > normalMax) { el.className = 'indicator-danger'; el.innerHTML = 'Critical'; }
        else if((warnMin && value < warnMin) || (warnMax && value > warnMax)) { el.className = 'indicator-warning'; el.innerHTML = 'Warning'; }
        else { el.className = 'indicator-normal'; el.innerHTML = 'Normal'; }
    }

    // ==================== LOAD PATIENTS FROM USERS ====================
    async function loadPatientsFromUsers() {
        if (!database) {
            console.log("Waiting for database...");
            return;
        }
        
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
                    console.log(`✅ Found patient: ${userData.name}`);
                }
            }
            
            console.log(`📊 Total patients found: ${patientsList.length}`);
            
            const totalEl = document.getElementById('totalPatients');
            const dashboardTotalEl = document.getElementById('dashboardTotalPatients');
            if (totalEl) totalEl.innerHTML = patientsList.length;
            if (dashboardTotalEl) dashboardTotalEl.innerHTML = patientsList.length;
            
            const selects = ['vitalsPatientSelect', 'labPatientSelect', 'patientDataSelect'];
            for (const selectId of selects) {
                const select = document.getElementById(selectId);
                if (select) {
                    select.innerHTML = '<option value="">-- Select Patient --</option>';
                    for (const p of patientsList) {
                        const option = document.createElement('option');
                        option.value = p.uid;
                        option.textContent = p.name;
                        select.appendChild(option);
                    }
                    console.log(`✅ Added ${patientsList.length} patients to ${selectId}`);
                }
            }
            
            if (patientsList.length === 0) {
                console.log("⚠️ No patients found! Creating a test patient...");
                const testUid = "patient_" + Date.now();
                await database.ref(`users/${testUid}`).set({
                    name: "Demo Patient",
                    email: "demo@patient.com",
                    role: "patient",
                    createdAt: Date.now()
                });
                console.log("✅ Test patient created! Refreshing...");
                setTimeout(() => location.reload(), 1500);
            }
            
        } catch (error) {
            console.error("❌ Error loading patients:", error);
        }
    }

    // ==================== VITALS LISTENER ====================
    function startVitalsListener(patientId) {
        if(!patientId || !database) return;
        currentVitalsPatientId = patientId;
        document.getElementById('careSyncStatus').innerHTML = '✅ Connected: ' + patientId.substring(0, 20) + '...';
        
        const esp32Ref = database.ref('/HELIOS_DATA_LIVE/Vitals');
        esp32Ref.on('value', (snapshot) => {
            const data = snapshot.val();
            if(data) {
                if(data.HeartRate) updateDoctorHeartRate(data.HeartRate);
                if(data.SpO2) updateDoctorSpO2(data.SpO2);
                if(data.BodyTemp) updateDoctorTemperature(data.BodyTemp);
                if(data.RoomTemp) updateDoctorRoomTemp(data.RoomTemp);
                if(data.Humidity) updateDoctorHumidity(data.Humidity);
                if(data.Motion) updateDoctorMotion(data.Motion);
                document.getElementById('lastUpdate').innerHTML = new Date().toLocaleTimeString();
            }
        });
        
        const readingsRef = database.ref(`patients/${patientId}/readings`);
        readingsRef.on('child_added', (snapshot) => {
            const reading = snapshot.val();
            if(reading && reading.vitals) {
                if(reading.vitals.systolic_bp && reading.vitals.diastolic_bp) {
                    updateDoctorBloodPressure(reading.vitals.systolic_bp, reading.vitals.diastolic_bp);
                }
                if(reading.vitals.glucose) {
                    updateDoctorGlucose(reading.vitals.glucose);
                }
            }
        });
        
        const labRef = database.ref(`patients/${patientId}/labResults`);
        labRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if(data) {
                if(data.diabetes) {
                    document.getElementById('display_fbg').innerText = data.diabetes.fbg || '--';
                    document.getElementById('display_hba1c').innerText = data.diabetes.hba1c || '--';
                    document.getElementById('display_ppg').innerText = data.diabetes.ppg || '--';
                    document.getElementById('display_rbs').innerText = data.diabetes.rbs || '--';
                }
                if(data.kidney) {
                    document.getElementById('display_creatinine').innerText = data.kidney.creatinine || '--';
                    document.getElementById('display_bun').innerText = data.kidney.bun || '--';
                    document.getElementById('display_egfr').innerText = data.kidney.egfr || '--';
                    document.getElementById('display_uricAcid').innerText = data.kidney.uricAcid || '--';
                }
                if(data.liver) {
                    document.getElementById('display_alt').innerText = data.liver.alt || '--';
                    document.getElementById('display_ast').innerText = data.liver.ast || '--';
                    document.getElementById('display_alp').innerText = data.liver.alp || '--';
                    document.getElementById('display_bilirubin').innerText = data.liver.bilirubin || '--';
                }
                if(data.thyroid) {
                    document.getElementById('display_tsh').innerText = data.thyroid.tsh || '--';
                    document.getElementById('display_t3').innerText = data.thyroid.t3 || '--';
                    document.getElementById('display_t4').innerText = data.thyroid.t4 || '--';
                }
                if(data.cardiac) {
                    document.getElementById('display_troponin').innerText = data.cardiac.troponin || '--';
                    document.getElementById('display_ckmb').innerText = data.cardiac.ckmb || '--';
                    document.getElementById('display_bnp').innerText = data.cardiac.bnp || '--';
                }
                if(data.inflammation) {
                    document.getElementById('display_crp').innerText = data.inflammation.crp || '--';
                    document.getElementById('display_esr').innerText = data.inflammation.esr || '--';
                    document.getElementById('display_pct').innerText = data.inflammation.pct || '--';
                }
            }
        });
        
        const notesRef = database.ref(`patients/${patientId}/doctorNotes`);
        notesRef.on('value', (snapshot) => {
            const notes = snapshot.val();
            if(notes) {
                document.getElementById('display_doctorName').innerHTML = `<i class="fas fa-user-md"></i> ${notes.doctorName || '--'}`;
                document.getElementById('display_summary').innerText = notes.summary || '--';
                document.getElementById('display_recommendations').innerText = notes.recommendations || '--';
                document.getElementById('display_nextAppointment').innerText = notes.nextAppointment || '--';
            }
        });
    }

    // ==================== LOAD EXISTING LAB DATA ====================
    async function loadExistingLabData(patientId) {
        if(!patientId || !database) return;
        try {
            const snapshot = await database.ref(`patients/${patientId}/labResults`).once('value');
            const data = snapshot.val();
            if(data) {
                if(data.diabetes) {
                    if(data.diabetes.fbg) document.getElementById('fbg').value = data.diabetes.fbg;
                    if(data.diabetes.hba1c) document.getElementById('hba1c').value = data.diabetes.hba1c;
                    if(data.diabetes.ppg) document.getElementById('ppg').value = data.diabetes.ppg;
                    if(data.diabetes.rbs) document.getElementById('rbs').value = data.diabetes.rbs;
                }
                if(data.kidney) {
                    if(data.kidney.creatinine) document.getElementById('creatinine').value = data.kidney.creatinine;
                    if(data.kidney.bun) document.getElementById('bun').value = data.kidney.bun;
                    if(data.kidney.egfr) document.getElementById('egfr').value = data.kidney.egfr;
                    if(data.kidney.uricAcid) document.getElementById('uricAcid').value = data.kidney.uricAcid;
                }
                if(data.liver) {
                    if(data.liver.alt) document.getElementById('alt').value = data.liver.alt;
                    if(data.liver.ast) document.getElementById('ast').value = data.liver.ast;
                    if(data.liver.alp) document.getElementById('alp').value = data.liver.alp;
                    if(data.liver.bilirubin) document.getElementById('bilirubin').value = data.liver.bilirubin;
                }
                if(data.thyroid) {
                    if(data.thyroid.tsh) document.getElementById('tsh').value = data.thyroid.tsh;
                    if(data.thyroid.t3) document.getElementById('t3').value = data.thyroid.t3;
                    if(data.thyroid.t4) document.getElementById('t4').value = data.thyroid.t4;
                }
                if(data.cardiac) {
                    if(data.cardiac.troponin) document.getElementById('troponin').value = data.cardiac.troponin;
                    if(data.cardiac.ckmb) document.getElementById('ckmb').value = data.cardiac.ckmb;
                    if(data.cardiac.bnp) document.getElementById('bnp').value = data.cardiac.bnp;
                }
                if(data.inflammation) {
                    if(data.inflammation.crp) document.getElementById('crp').value = data.inflammation.crp;
                    if(data.inflammation.esr) document.getElementById('esr').value = data.inflammation.esr;
                    if(data.inflammation.pct) document.getElementById('pct').value = data.inflammation.pct;
                }
            }
            const notesSnapshot = await database.ref(`patients/${patientId}/doctorNotes`).once('value');
            const notes = notesSnapshot.val();
            if(notes) {
                if(notes.doctorName) document.getElementById('doctorName').value = notes.doctorName;
                if(notes.summary) document.getElementById('clinicalSummary').value = notes.summary;
                if(notes.recommendations) document.getElementById('recommendations').value = notes.recommendations;
                if(notes.nextAppointment) document.getElementById('nextAppointment').value = notes.nextAppointment;
            }
        } catch(e) { console.error(e); }
    }

    // ==================== SAVE LAB RESULTS TO FIREBASE ====================
    async function saveLabResultsToFirebase() {
        console.log("💾 Save button clicked!");
        
        const labSelect = document.getElementById('labPatientSelect');
        if (!labSelect || !labSelect.value) {
            showErrorMessage('❌ Please select a patient first!');
            return;
        }
        
        const patientId = labSelect.value;
        console.log("📌 Saving for patient:", patientId);
        
        const labData = {
            diabetes: {
                fbg: parseFloat(document.getElementById('fbg')?.value || 118),
                hba1c: parseFloat(document.getElementById('hba1c')?.value || 5.7),
                ppg: parseFloat(document.getElementById('ppg')?.value || 140),
                rbs: parseFloat(document.getElementById('rbs')?.value || 125)
            },
            kidney: {
                creatinine: parseFloat(document.getElementById('creatinine')?.value || 0.9),
                bun: parseFloat(document.getElementById('bun')?.value || 12),
                egfr: parseFloat(document.getElementById('egfr')?.value || 95),
                uricAcid: parseFloat(document.getElementById('uricAcid')?.value || 5.2)
            },
            liver: {
                alt: parseFloat(document.getElementById('alt')?.value || 25),
                ast: parseFloat(document.getElementById('ast')?.value || 22),
                alp: parseFloat(document.getElementById('alp')?.value || 70),
                bilirubin: parseFloat(document.getElementById('bilirubin')?.value || 0.8)
            },
            thyroid: {
                tsh: parseFloat(document.getElementById('tsh')?.value || 2.5),
                t3: parseFloat(document.getElementById('t3')?.value || 110),
                t4: parseFloat(document.getElementById('t4')?.value || 7.5)
            },
            cardiac: {
                troponin: parseFloat(document.getElementById('troponin')?.value || 0.02),
                ckmb: parseFloat(document.getElementById('ckmb')?.value || 1.2),
                bnp: parseFloat(document.getElementById('bnp')?.value || 85)
            },
            inflammation: {
                crp: parseFloat(document.getElementById('crp')?.value || 2.5),
                esr: parseFloat(document.getElementById('esr')?.value || 12),
                pct: parseFloat(document.getElementById('pct')?.value || 0.05)
            },
            lastUpdated: new Date().toISOString()
        };
        
        const doctorNotes = {
            doctorName: currentDoctorName,
            summary: document.getElementById('clinicalSummary')?.value || '',
            recommendations: document.getElementById('recommendations')?.value || '',
            nextAppointment: document.getElementById('nextAppointment')?.value || '',
            lastUpdated: new Date().toISOString()
        };
        
        try {
            await database.ref(`patients/${patientId}/labResults`).set(labData);
            await database.ref(`patients/${patientId}/doctorNotes`).set(doctorNotes);
            console.log("✅ Data saved successfully!");
            showSuccessMessage('✅ Lab results and notes saved successfully! Patient page will update automatically.');
            startVitalsListener(patientId);
        } catch(error) {
            console.error("❌ Save error:", error);
            showErrorMessage('❌ Error saving data: ' + error.message);
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

    document.getElementById('appointmentSearch')?.addEventListener('input', function() {
        const value = this.value.toLowerCase();
        document.querySelectorAll('#appointmentsTable tbody tr').forEach(row => {
            row.style.display = row.innerText.toLowerCase().includes(value) ? '' : 'none';
        });
    });

    // ==================== EXPORT PDF ====================
    document.getElementById('exportBtn')?.addEventListener('click', function() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Patient Health Report", 14, 22);
        doc.setFontSize(12);
        const heartRate = document.getElementById('doctorHeartValue')?.innerText || '--';
        const bloodPressure = document.getElementById('doctorBpValue')?.innerText || '--';
        const bloodGlucose = document.getElementById('doctorGlucoseValue')?.innerText || '--';
        doc.text(`Heart Rate: ${heartRate}`, 14, 45);
        doc.text(`Blood Pressure: ${bloodPressure}`, 14, 55);
        doc.text(`Blood Glucose: ${bloodGlucose}`, 14, 65);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 120);
        doc.save("patient_health_report.pdf");
        showSuccessMessage('Report exported successfully!');
    });

    // ==================== SETTINGS SAVE ====================
    document.getElementById('saveSettings')?.addEventListener('click', () => {
        const email = document.getElementById('settingsEmail')?.value;
        const lang = document.getElementById('settingsLanguage')?.value;
        showSuccessMessage(`Settings saved: Email ${email}, Language ${lang}`);
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

    // ==================== EVENT LISTENERS ====================
    document.getElementById('vitalsPatientSelect')?.addEventListener('change', (e) => { if(e.target.value) startVitalsListener(e.target.value); });
    document.getElementById('labPatientSelect')?.addEventListener('change', (e) => { if(e.target.value) { currentLabPatientId = e.target.value; loadExistingLabData(currentLabPatientId); } });
    document.getElementById('patientDataSelect')?.addEventListener('change', (e) => { if(e.target.value) startDataListener(e.target.value); });

    const saveBtn = document.getElementById('saveLabResultsBtn');
    if (saveBtn) {
        saveBtn.removeEventListener('click', saveLabResultsToFirebase);
        saveBtn.addEventListener('click', saveLabResultsToFirebase);
        console.log("✅ Save button connected!");
    }

    // ==================== INITIAL PAGE ====================
    showPage('dashboard');
    
    setTimeout(() => {
        loadPatientsFromUsers();
    }, 500);
    
    setTimeout(() => {
        waitForFirebase();
    }, 1000);
    
    setTimeout(() => {
        const firstPatient = document.getElementById('labPatientSelect')?.value;
        if(firstPatient) {
            startVitalsListener(firstPatient);
            startDataListener(firstPatient);
        }
    }, 2000);
})();
