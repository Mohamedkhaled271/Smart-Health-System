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
    let mqttSimInterval;                // Interval for simulated MQTT updates
    let alertSoundEnabled = true;        // Sound toggle state

    // -------------------- Alert Sound using Web Audio API --------------------
    const alertSound = (() => {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            return (type = 'warning') => {
                if (!alertSoundEnabled) return;                     // Do nothing if muted
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.frequency.value = type === 'danger' ? 800 : 400; // Higher pitch for danger
                gain.gain.value = 0.2;                               // Volume
                osc.start();
                osc.stop(audioCtx.currentTime + 0.2);
            };
        } catch (e) {
            // Fallback if Web Audio API is not supported
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

    // ==================== STATS UPDATE (simulated + animated) ====================
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
        const newPatients = Math.floor(Math.random() * 50 + 200);
        const newCritical = Math.floor(Math.random() * 10 + 5);
        const newAvgHR = Math.floor(Math.random() * 20 + 65);
        const newOccupancy = Math.floor(Math.random() * 15 + 75) + '%';

        animateValue(document.getElementById('totalPatients'), parseInt(document.getElementById('totalPatients').innerText), newPatients, 1000);
        animateValue(document.getElementById('criticalCases'), parseInt(document.getElementById('criticalCases').innerText), newCritical, 1000);
        document.getElementById('avgHR').innerHTML = newAvgHR + ' <span style="font-size:1rem;">bpm</span>';
        document.getElementById('bedOccupancy').innerHTML = newOccupancy + '<small style="font-size:1rem;">%</small>';
    }
    setInterval(updateStats, 10000);

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

    // Function to update real-time charts with new data
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

    // ==================== HISTORICAL CHARTS (ApexCharts) ====================
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
const reportForm = document.getElementById('patientReportForm');

reportForm.addEventListener('submit', function(e) {
    e.preventDefault();

    // Gather form data
    const reportData = {
        name: document.getElementById('patientName').value,
        age: document.getElementById('patientAge').value,
        gender: document.getElementById('patientGender').value,
        condition: document.getElementById('healthCondition').value,
        medications: document.getElementById('medications').value,
        notes: document.getElementById('additionalNotes').value
    };

    //Create PDF using jsPDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Patient Report", 105, 20, { align: "center" });

    doc.setFontSize(12);
    doc.text(`Name: ${reportData.name}`, 20, 40);
    doc.text(`Age: ${reportData.age}`, 20, 50);
    doc.text(`Gender: ${reportData.gender}`, 20, 60);
    
    doc.text("Health Condition:", 20, 70);
    doc.text(reportData.condition, 25, 80, { maxWidth: 160 });

    doc.text("Medications:", 20, 100);
    doc.text(reportData.medications, 25, 110, { maxWidth: 160 });

    doc.text("Additional Notes:", 20, 130);
    doc.text(reportData.notes, 25, 140, { maxWidth: 160 });

    // Save the PDF with patient's name
    doc.save(`${reportData.name}_report.pdf`);

    // Reset form and show success message
    reportForm.reset();
    alert("Report saved as PDF successfully!");
});
    // ==================== SIMULATED MQTT UPDATES ====================
    // Generates random realistic vital signs
    function generateRandomVitals() {
        return {
            heart: Math.floor(Math.random() * (85-65+1)) + 65,
            spo2: Math.floor(Math.random() * (99-94+1)) + 94,
            temp: (Math.random() * (37.5-36.0) + 36.0).toFixed(1),
            roomTemp: Math.floor(Math.random() * (25-22+1)) + 22,
            humidity: Math.floor(Math.random() * (60-40+1)) + 40,
            position: ['sitting', 'standing', 'lying', 'walking'][Math.floor(Math.random() * 4)]
        };
    }

    // Update UI elements with new vitals and trigger alerts
    function updateUI(vitals) {
        document.getElementById('heartValue').innerHTML = vitals.heart + ' <span>bpm</span>';
        document.getElementById('spo2Value').innerHTML = vitals.spo2 + ' <span>%</span>';
        document.getElementById('tempValue').innerHTML = vitals.temp + ' <span>°C</span>';
        document.getElementById('roomTempValue').innerHTML = vitals.roomTemp + ' <span>°C</span>';
        document.getElementById('humidityValue').innerHTML = vitals.humidity + ' <span>%</span>';
        document.getElementById('positionValue').innerText = vitals.position;

        // Update color-coded indicators based on thresholds
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

        const posInd = document.getElementById('positionIndicator');
        if (vitals.position === 'fall') { posInd.className = 'card-indicator indicator-danger'; posInd.innerText = 'FALL'; }
        else { posInd.className = 'card-indicator indicator-normal'; posInd.innerText = 'Normal'; }

        updateCharts(vitals.heart, vitals.spo2, parseFloat(vitals.temp));

        // Check for critical conditions and add alert
        const alertsList = document.getElementById('alertsList');
        if (vitals.heart > 100 || vitals.heart < 50 || vitals.spo2 < 90 || vitals.temp > 38.5 || vitals.temp < 35 || vitals.position === 'fall') {
            let msg = '';
            if (vitals.heart > 100) msg = 'Heart rate too high: ' + vitals.heart;
            else if (vitals.heart < 50) msg = 'Heart rate too low: ' + vitals.heart;
            else if (vitals.spo2 < 90) msg = 'Low SpO2: ' + vitals.spo2;
            else if (vitals.temp > 38.5) msg = 'High fever: ' + vitals.temp;
            else if (vitals.temp < 35) msg = 'Low temperature: ' + vitals.temp;
            else if (vitals.position === 'fall') msg = 'FALL DETECTED!';

            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert-item';
            alertDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i><div class="alert-content"><div class="alert-title">${msg}</div><div class="alert-time">${new Date().toLocaleTimeString()}</div></div>`;
            alertsList.prepend(alertDiv);
            if (alertsList.children.length > 10) alertsList.removeChild(alertsList.lastChild);
            alertSound('danger');
        }
    }

    // Start simulation with initial data
    const vitals = generateRandomVitals();
    updateUI(vitals);
    mqttSimInterval = setInterval(() => {
        const newVitals = generateRandomVitals();
        updateUI(newVitals);
    }, 5000);

    // ==================== SEARCH FUNCTIONALITY ====================
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

    // ==================== FILTER & DATE RANGE FUNCTIONALITY ====================
    const filterBtn = document.getElementById('filterBtn');
    const filterDropdown = document.getElementById('filterDropdown');
    const closeFilter = document.getElementById('closeFilter');
    const dateBadge = document.querySelector('.date-badge');
    const dateDropdown = document.getElementById('dateDropdown');
    const dateSpan = dateBadge.querySelector('span');
    const filterStatus = document.getElementById('filterStatus');
    const filterCondition = document.getElementById('filterCondition');
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
        const condition = filterCondition.value;
        const startDate = filterStartDate.value;
        const endDate = filterEndDate.value;

        filterTables(status, condition, startDate, endDate);
        filterDropdown.classList.remove('active');
    });

    // Reset filter button
    resetFilter.addEventListener('click', () => {
        filterStatus.value = 'all';
        filterCondition.value = 'all';
        filterStartDate.value = '';
        filterEndDate.value = '';
        resetTableFilters();
        filterDropdown.classList.remove('active');
    });
    // function applyDateFilter(range) {
    //     showNotification(`Date range changed to ${dateSpan.innerText}`);
    // }
    function filterTables(status, condition, startDate, endDate) {
        const recentRows = document.querySelectorAll('#recentPatientsTable tbody tr');
        const patientRows = document.querySelectorAll('#patientsFullTable tbody tr');
        const appointmentRows = document.querySelectorAll('#appointmentsTable tbody tr');

        recentRows.forEach(row => {
            let show = true;
            const rowStatus = row.querySelector('td:last-child span').innerText.toLowerCase();
            const rowCondition = row.querySelector('td:nth-child(3)').innerText.toLowerCase();
            if (status !== 'all' && !rowStatus.includes(status)) show = false;
            if (condition !== 'all' && !rowCondition.includes(condition)) show = false;
            row.style.display = show ? '' : 'none';
        });

        patientRows.forEach(row => {
            let show = true;
            const rowStatus = row.querySelector('td:last-child span').innerText.toLowerCase();
            const rowCondition = row.querySelector('td:nth-child(3)').innerText.toLowerCase();
            if (status !== 'all' && !rowStatus.includes(status)) show = false;
            if (condition !== 'all' && !rowCondition.includes(condition)) show = false;
            row.style.display = show ? '' : 'none';
        });

        appointmentRows.forEach(row => {
            let show = true;
            const rowStatus = row.querySelector('td:last-child span').innerText.toLowerCase();
            if (status !== 'all' && !rowStatus.includes(status)) show = false;
            row.style.display = show ? '' : 'none';
        });

        showNotification('Filters applied');
    }

    function resetTableFilters() {
        const allRows = document.querySelectorAll('#recentPatientsTable tbody tr, #patientsFullTable tbody tr, #appointmentsTable tbody tr');
        allRows.forEach(row => row.style.display = '');
        showNotification('Filters reset');
    }
// ==================== EXPORT BUTTON - GENERATE PDF FROM RECENT PATIENTS TABLE ====================
document.getElementById('exportBtn').addEventListener('click', function() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Add title to PDF
    doc.setFontSize(18);
    doc.text("Recent Patients Report", 14, 22);

    // Extract table data
    const table = document.getElementById('recentPatientsTable');
    const headers = [];
    const rows = [];

    //
    const headerCells = table.querySelectorAll('thead th');
    headerCells.forEach(cell => headers.push(cell.innerText));

    // 
    const bodyRows = table.querySelectorAll('tbody tr');
    bodyRows.forEach(row => {
        const rowData = [];
        row.querySelectorAll('td').forEach(cell => {
            // Trim text and handle multi-line content if necessary
            rowData.push(cell.innerText.trim());
        });
        rows.push(rowData);
    });

    // Use jsPDF-AutoTable plugin to add table to PDF
    doc.autoTable({
        head: [headers],
        body: rows,
        startY: 30,
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235] }, // لون أزرق
        styles: { fontSize: 10 }
    });

    // Save the PDF
    doc.save('recent_patients_report.pdf');

    // Show success notification 
    showNotification('PDF exported successfully!');
});

    // ==================== EXPORT PATIENT HEALTH BUTTON (All Vitals & Charts) ====================
    //
    document.getElementById('export-btn-Patient-Health')?.addEventListener('click', function() {
        showNotification('Generating patient health report...');
        
        // Delay to ensure charts are fully rendered before capturing them
        setTimeout(() => {
            try {
                // verify jsPDF is loaded
                if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
                    showNotification('PDF library not loaded!', 'error');
                    return;
                }
                
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                
                // add title
                doc.setFontSize(20);
                doc.text("Patient Health Report", 105, 15, { align: "center" });
                
                // date and time
                doc.setFontSize(10);
                doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 22, { align: "center" });
                
                let yOffset = 30;
                
                // function to add chart image to PDF
                function addChartImage(canvasId, title, yPos) {
                    const canvas = document.getElementById(canvasId);
                    if (!canvas) {
                        console.warn(`Canvas with id "${canvasId}" not found`);
                        return yPos;
                    }
                    try {
                        const imgData = canvas.toDataURL('image/png');
                        doc.setFontSize(12);
                        doc.text(title, 14, yPos);
                        doc.addImage(imgData, 'PNG', 14, yPos + 5, 180, 60);
                        return yPos + 70;
                    } catch (e) {
                        console.error('Could not add chart:', canvasId, e);
                        doc.text(`[${title} chart unavailable]`, 14, yPos + 10);
                        return yPos + 15;
                    }
                }
                
                // add charts to PDF
                yOffset = addChartImage('heartChart', 'Heart Rate (bpm)', yOffset);
                yOffset = addChartImage('spo2Chart', 'SpO₂ (%)', yOffset);
                yOffset = addChartImage('tempChart', 'Body Temperature (°C)', yOffset);
                
                // add current vitals section
                doc.setFontSize(14);
                doc.text("Current Vitals:", 14, yOffset);
                yOffset += 8;
                
                const roomTemp = document.getElementById('roomTempValue')?.innerText || '--';
                const humidity = document.getElementById('humidityValue')?.innerText || '--';
                const position = document.getElementById('positionValue')?.innerText || '--';
                const positionIndicator = document.getElementById('positionIndicator')?.innerText || '';
                
                doc.setFontSize(11);
                doc.text(`• Room Temperature: ${roomTemp}`, 20, yOffset);
                yOffset += 6;
                doc.text(`• Humidity: ${humidity}`, 20, yOffset);
                yOffset += 6;
                doc.text(`• Position: ${position} (${positionIndicator})`, 20, yOffset);
                
                // Save the PDF
                doc.save("patient_health_report.pdf");
                showNotification('Health report ready!');
            } catch (error) {
                console.error('PDF generation error:', error);
                showNotification('Failed to generate PDF', 'error');
            }
        }, 100);
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

    // ==================== CLEANUP ON PAGE UNLOAD ====================
    window.addEventListener('beforeunload', () => {
        if (mqttSimInterval) clearInterval(mqttSimInterval);
    });

    // Override showPage to close dropdowns when changing page
    const originalShowPage = showPage;
    showPage = function(pageId) {
        originalShowPage(pageId);
        if (filterDropdown) filterDropdown.classList.remove('active');
        if (dateDropdown) dateDropdown.classList.remove('active');
    };

    // ==================== INITIAL PAGE ====================
    showPage('dashboard');
})();
