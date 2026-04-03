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
    window.togglePasswordVisibility = function(fieldId) {
        const field = document.getElementById(fieldId);
        const icon = field.parentElement.querySelector('.password-toggle i');
        if (field.type === 'password') {
            field.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            field.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    };

    function initProfilePage() {
        const editBtn = document.getElementById('editProfileBtn');
        const saveBtn = document.getElementById('saveProfileBtn');
        const cancelBtn = document.getElementById('cancelProfileBtn');
        const changePwdBtn = document.getElementById('changePasswordBtn');
        const passwordSection = document.getElementById('passwordSection');
        const savePasswordBtn = document.getElementById('savePasswordBtn');
        const profileInputs = document.querySelectorAll('.profile-input');
        const editIcons = document.querySelectorAll('.edit-icon');
        const profilePicInput = document.getElementById('profilePicInput');
        const profileImage = document.getElementById('profileImage');
        const changePicOverlay = document.getElementById('changePicOverlay');

        // Enable editing on field icon click
        editIcons.forEach(icon => {
            icon.addEventListener('click', function() {
                const field = this.dataset.field;
                const input = document.getElementById(`profile${field.charAt(0).toUpperCase() + field.slice(1)}`);
                if (input) {
                    input.readOnly = false;
                    input.disabled = false;
                    input.focus();
                }
            });
        });

        // Edit button: show save/cancel, hide edit button, enable all fields
        editBtn.addEventListener('click', function() {
            profileInputs.forEach(input => {
                input.readOnly = false;
                input.disabled = false;
            });
            editBtn.style.display = 'none';
            saveBtn.style.display = 'inline-block';
            cancelBtn.style.display = 'inline-block';
            changePwdBtn.style.display = 'none'; // Hide change password button during edit
            passwordSection.style.display = 'none'; // Also hide password section if open
        });

        // Cancel button: revert to original values
        cancelBtn.addEventListener('click', function() {
            profileInputs.forEach(input => {
                const original = input.getAttribute('data-original');
                if (original !== null) {
                    input.value = original;
                }
                input.readOnly = true;
                input.disabled = true;
            });
            editBtn.style.display = 'inline-block';
            saveBtn.style.display = 'none';
            cancelBtn.style.display = 'none';
            changePwdBtn.style.display = 'inline-block';
            passwordSection.style.display = 'none';
            // Clear password fields
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
            showNotification('Edit cancelled');
        });

        // Save button (main): validate and save all changes (including password if filled)
        saveBtn.addEventListener('click', function() {
            // Basic validation
            const name = document.getElementById('profileName').value.trim();
            const email = document.getElementById('profileEmail').value.trim();
            const phone = document.getElementById('profilePhone').value.trim();

            if (!name || !email || !phone) {
                showNotification('Please fill all required fields', 'error');
                return;
            }

            // Email format validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showNotification('Please enter a valid email', 'error');
                return;
            }

            // If password section visible and non-empty, validate password
            if (passwordSection.style.display === 'block') {
                const newPass = document.getElementById('newPassword').value;
                const confirmPass = document.getElementById('confirmPassword').value;
                if (newPass || confirmPass) {
                    if (!newPass || !confirmPass) {
                        showNotification('Please fill both password fields', 'error');
                        return;
                    }
                    if (newPass.length < 6) {
                        showNotification('Password must be at least 6 characters', 'error');
                        return;
                    }
                    if (newPass !== confirmPass) {
                        showNotification('Passwords do not match', 'error');
                        return;
                    }
                    // Here you would send password change request
                    showNotification('Password updated successfully');
                    // Clear password fields
                    document.getElementById('newPassword').value = '';
                    document.getElementById('confirmPassword').value = '';
                }
            }

            // Save main profile data (simulate)
            profileInputs.forEach(input => {
                input.setAttribute('data-original', input.value);
            });

            // Disable fields
            profileInputs.forEach(input => {
                input.readOnly = true;
                input.disabled = true;
            });

            editBtn.style.display = 'inline-block';
            saveBtn.style.display = 'none';
            cancelBtn.style.display = 'none';
            changePwdBtn.style.display = 'inline-block';
            passwordSection.style.display = 'none';

            showNotification('Profile updated successfully!');
        });

        // Change Password button: toggle password section
        changePwdBtn.addEventListener('click', function() {
            if (passwordSection.style.display === 'none') {
                passwordSection.style.display = 'block';
            } else {
                passwordSection.style.display = 'none';
                // Clear fields when hiding
                document.getElementById('newPassword').value = '';
                document.getElementById('confirmPassword').value = '';
            }
        });

        // Save Password button (separate): only change password
        savePasswordBtn.addEventListener('click', function() {
            const newPass = document.getElementById('newPassword').value;
            const confirmPass = document.getElementById('confirmPassword').value;

            if (!newPass || !confirmPass) {
                showNotification('Please fill both password fields', 'error');
                return;
            }
            if (newPass.length < 6) {
                showNotification('Password must be at least 6 characters', 'error');
                return;
            }
            if (newPass !== confirmPass) {
                showNotification('Passwords do not match', 'error');
                return;
            }
            // Here you would send password change request
            showNotification('Password changed successfully!');
            
            // Hide section and clear fields
            passwordSection.style.display = 'none';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        });

        // Profile picture upload
        changePicOverlay.addEventListener('click', function() {
            profilePicInput.click();
        });

        profilePicInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    profileImage.src = e.target.result;
                    showNotification('Profile picture updated');
                };
                reader.readAsDataURL(file);
            }
        });

        // Store original values on load
        profileInputs.forEach(input => {
            input.setAttribute('data-original', input.value);
        });
    }

    // Override showPage to call initProfilePage when profile page is shown
    const originalShowPage = showPage;
    showPage = function(pageId) {
        originalShowPage(pageId);
        // Close any open dropdowns when changing page
        if (filterDropdown) filterDropdown.classList.remove('active');
        if (dateDropdown) dateDropdown.classList.remove('active');
        if (pageId === 'profile') {
            initProfilePage();
        }
    };

    // ==================== INITIAL PAGE ====================
    showPage('dashboard');
})();
