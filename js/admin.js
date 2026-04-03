// ====================================================
// CARE SYNC - PROFESSIONAL ADMIN DASHBOARD
// FULLY INTEGRATED WITH FIREBASE AUTH & DATABASE
// ====================================================

(function() {
    "use strict";

    // ==================== GLOBAL STATE ====================
    let usersData = [];
    let currentFilter = 'all';
    let currentSearchTerm = '';
    let currentDateRange = '30';
    let charts = {};
    let realtimeListeners = [];

    // ==================== AUTH GUARD & INITIALIZATION ====================
    async function initializeAdminPanel() {
        if (typeof firebase === 'undefined') {
            console.error('Firebase not loaded');
            showNotification('Firebase connection failed', 'error');
            return false;
        }

        return new Promise((resolve) => {
            firebase.auth().onAuthStateChanged(async (user) => {
                if (!user) {
                    showNotification('Please login to continue', 'warning');
                    setTimeout(() => window.location.href = 'index.html', 1500);
                    resolve(false);
                    return;
                }

                try {
                    const snapshot = await firebase.database().ref(`users/${user.uid}`).once('value');
                    const userData = snapshot.val();
                    
                    if (!userData || userData.role !== 'admin') {
                        showNotification('Access Denied. Admin privileges required.', 'error');
                        setTimeout(() => {
                            if (userData?.role === 'doctor') window.location.href = 'doctor.html';
                            else if (userData?.role === 'patient') window.location.href = 'patient.html';
                            else window.location.href = 'index.html';
                        }, 1500);
                        resolve(false);
                        return;
                    }
                    
                    // Initialize admin dashboard
                    await loadAllData();
                    setupRealtimeListeners();
                    initializeCharts();
                    setupEventListeners();
                    showNotification('Welcome to Admin Dashboard', 'success');
                    resolve(true);
                    
                } catch (error) {
                    console.error('Auth check error:', error);
                    showNotification('Authentication error', 'error');
                    resolve(false);
                }
            });
        });
    }

    // ==================== LOAD ALL DATA ====================
    async function loadAllData() {
        await Promise.all([
            loadUsersFromFirebase(),
            loadSystemStats(),
            loadRecentActivities()
        ]);
    }

    async function loadUsersFromFirebase() {
        try {
            const snapshot = await firebase.database().ref('users').once('value');
            const users = snapshot.val();
            
            if (users) {
                usersData = Object.entries(users).map(([id, data]) => ({
                    id: id,
                    name: data.name || 'Not specified',
                    email: data.email || 'Not specified',
                    role: data.role || 'patient',
                    status: data.status || 'active',
                    phone: data.phone || '',
                    createdAt: data.createdAt || Date.now(),
                    lastLogin: data.lastLogin || null,
                    profileComplete: data.profileComplete || false
                }));
            } else {
                // Load demo data for initial display
                usersData = getDemoUsers();
            }
            
            renderUsersTable();
            updateStatisticsCards();
            
        } catch (error) {
            console.error('Error loading users:', error);
            showNotification('Failed to load user data', 'error');
            usersData = getDemoUsers();
            renderUsersTable();
        }
    }

    function getDemoUsers() {
        return [
            { id: '1', name: 'Dr. Emily Davis', email: 'emily.davis@hospital.com', role: 'doctor', status: 'active', phone: '+1 234 567 890', createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000, profileComplete: true },
            { id: '2', name: 'John Doe', email: 'john.doe@example.com', role: 'patient', status: 'active', phone: '+1 234 567 891', createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000, profileComplete: true },
            { id: '3', name: 'Jane Smith', email: 'jane.smith@example.com', role: 'patient', status: 'active', phone: '+1 234 567 892', createdAt: Date.now() - 45 * 24 * 60 * 60 * 1000, profileComplete: false },
            { id: '4', name: 'Admin User', email: 'admin@caresync.com', role: 'admin', status: 'active', phone: '+1 234 567 893', createdAt: Date.now() - 100 * 24 * 60 * 60 * 1000, profileComplete: true },
            { id: '5', name: 'Dr. Michael Chen', email: 'michael.chen@hospital.com', role: 'doctor', status: 'inactive', phone: '+1 234 567 894', createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000, profileComplete: true }
        ];
    }

    async function loadSystemStats() {
        try {
            const stats = {
                totalPatients: usersData.filter(u => u.role === 'patient').length,
                totalDoctors: usersData.filter(u => u.role === 'doctor').length,
                activeUsers: usersData.filter(u => u.status === 'active').length,
                newThisMonth: usersData.filter(u => u.createdAt > Date.now() - 30 * 24 * 60 * 60 * 1000).length
            };
            
            updateStatsUI(stats);
            
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    async function loadRecentActivities() {
        const activities = [
            { action: 'User John Doe was added', timestamp: Date.now() - 2 * 60 * 60 * 1000, type: 'create' },
            { action: 'Dr. Emily Davis updated patient records', timestamp: Date.now() - 5 * 60 * 60 * 1000, type: 'update' },
            { action: 'System backup completed', timestamp: Date.now() - 24 * 60 * 60 * 1000, type: 'system' }
        ];
        
        renderActivities(activities);
    }

    // ==================== UI RENDERING ====================
    function renderUsersTable() {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;
        
        let filteredUsers = [...usersData];
        
        // Apply role filter
        if (currentFilter !== 'all') {
            filteredUsers = filteredUsers.filter(user => user.role === currentFilter);
        }
        
        // Apply search filter
        if (currentSearchTerm) {
            filteredUsers = filteredUsers.filter(user => 
                user.name.toLowerCase().includes(currentSearchTerm) ||
                user.email.toLowerCase().includes(currentSearchTerm)
            );
        }
        
        if (filteredUsers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 40px;">
                        <i class="fas fa-users" style="font-size: 48px; opacity: 0.3;"></i>
                        <p>No users found</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = filteredUsers.map(user => `
            <tr data-user-id="${user.id}">
                <td>
                    <div class="user-info">
                        <div class="user-avatar" style="background: ${getAvatarColor(user.role)}">
                            ${user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div class="user-name">${escapeHtml(user.name)}</div>
                            <div class="user-email">${escapeHtml(user.email)}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="role-badge role-${user.role}">
                        <i class="fas ${getRoleIcon(user.role)}"></i>
                        ${capitalize(user.role)}
                    </span>
                </td>
                <td>
                    <span class="status-badge status-${user.status}" onclick="toggleUserStatus('${user.id}')">
                        <i class="fas ${user.status === 'active' ? 'fa-check-circle' : 'fa-clock'}"></i>
                        ${capitalize(user.status)}
                    </span>
                </td>
                <td>
                    <div class="user-meta">
                        <small><i class="fas fa-phone"></i> ${user.phone || 'Not provided'}</small>
                        <small><i class="fas fa-calendar-alt"></i> ${formatDate(user.createdAt)}</small>
                    </div>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn edit" onclick="editUser('${user.id}')" title="Edit User">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn view" onclick="viewUser('${user.id}')" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn delete" onclick="deleteUser('${user.id}')" title="Delete User">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        
        updateSpecializedTables(filteredUsers);
    }

    function updateSpecializedTables(users) {
        // Update patients table
        const patientsBody = document.getElementById('patientsTableBody');
        if (patientsBody) {
            const patients = users.filter(u => u.role === 'patient');
            patientsBody.innerHTML = patients.map(patient => `
                <tr>
                    <td>${escapeHtml(patient.name)}</td>
                    <td>${escapeHtml(patient.email)}</td>
                    <td><span class="status-badge status-${patient.status}">${capitalize(patient.status)}</span></td>
                    <td>${formatDate(patient.createdAt)}</td>
                </tr>
            `).join('');
        }
        
        // Update doctors table
        const doctorsBody = document.getElementById('doctorsTableBody');
        if (doctorsBody) {
            const doctors = users.filter(u => u.role === 'doctor');
            doctorsBody.innerHTML = doctors.map(doctor => `
                <tr>
                    <td>${escapeHtml(doctor.name)}</td>
                    <td>${escapeHtml(doctor.email)}</td>
                    <td><span class="status-badge status-${doctor.status}">${capitalize(doctor.status)}</span></td>
                    <td>${Math.floor(Math.random() * 20)} patients</td>
                </tr>
            `).join('');
        }
    }

    function updateStatisticsCards() {
        const stats = {
            totalPatients: usersData.filter(u => u.role === 'patient').length,
            totalDoctors: usersData.filter(u => u.role === 'doctor').length,
            activeUsers: usersData.filter(u => u.status === 'active').length,
            completionRate: Math.round((usersData.filter(u => u.profileComplete).length / usersData.length) * 100) || 0
        };
        
        updateStatsUI(stats);
    }

    function updateStatsUI(stats) {
        const elements = {
            totalPatients: document.getElementById('totalPatients'),
            totalDoctors: document.getElementById('totalDoctors'),
            activeUsers: document.getElementById('activeUsers'),
            completionRate: document.getElementById('completionRate')
        };
        
        if (elements.totalPatients) animateNumber(elements.totalPatients, elements.totalPatients.innerText, stats.totalPatients);
        if (elements.totalDoctors) animateNumber(elements.totalDoctors, elements.totalDoctors.innerText, stats.totalDoctors);
        if (elements.activeUsers) animateNumber(elements.activeUsers, elements.activeUsers.innerText, stats.activeUsers);
        if (elements.completionRate) elements.completionRate.innerText = `${stats.completionRate}%`;
    }

    function renderActivities(activities) {
        const container = document.getElementById('recentActivities');
        if (!container) return;
        
        container.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon ${activity.type}">
                    <i class="fas ${getActivityIcon(activity.type)}"></i>
                </div>
                <div class="activity-content">
                    <p>${escapeHtml(activity.action)}</p>
                    <small>${timeAgo(activity.timestamp)}</small>
                </div>
            </div>
        `).join('');
    }

    // ==================== CHARTS INITIALIZATION ====================
    function initializeCharts() {
        // User Growth Chart
        const userGrowthCtx = document.getElementById('userGrowthChart')?.getContext('2d');
        if (userGrowthCtx) {
            charts.userGrowth = new Chart(userGrowthCtx, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                    datasets: [{
                        label: 'Patients',
                        data: [12, 19, 15, 17, 24, 23],
                        borderColor: '#1a7f9e',
                        backgroundColor: 'rgba(26, 127, 158, 0.1)',
                        tension: 0.4,
                        fill: true
                    }, {
                        label: 'Doctors',
                        data: [5, 7, 6, 8, 9, 11],
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { position: 'top' },
                        tooltip: { backgroundColor: '#1e293b' }
                    }
                }
            });
        }
        
        // Role Distribution Chart
        const roleDistCtx = document.getElementById('roleDistributionChart')?.getContext('2d');
        if (roleDistCtx) {
            charts.roleDistribution = new Chart(roleDistCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Patients', 'Doctors', 'Admins'],
                    datasets: [{
                        data: [65, 28, 7],
                        backgroundColor: ['#1a7f9e', '#10b981', '#f59e0b'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' }
                    }
                }
            });
        }
        
        // Monthly Report Chart
        const monthlyCtx = document.getElementById('monthlyReportChart')?.getContext('2d');
        if (monthlyCtx) {
            const gradient = monthlyCtx.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, 'rgba(26, 127, 158, 0.5)');
            gradient.addColorStop(1, 'rgba(26, 127, 158, 0.02)');
            
            charts.monthly = new Chart(monthlyCtx, {
                type: 'line',
                data: {
                    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                    datasets: [{
                        label: 'Patient Visits',
                        data: [45, 52, 48, 61],
                        borderColor: '#1a7f9e',
                        backgroundColor: gradient,
                        fill: true,
                        borderWidth: 3,
                        tension: 0.4,
                        pointRadius: 5,
                        pointHoverRadius: 7
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'top' } }
                }
            });
        }
    }

    // ==================== USER MANAGEMENT CRUD OPERATIONS ====================
    window.editUser = async function(userId) {
        const user = usersData.find(u => u.id === userId);
        if (!user) return;
        
        const modal = createEditModal(user);
        document.body.appendChild(modal);
        
        const form = modal.querySelector('#editUserForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const updatedData = {
                name: form.querySelector('#editName').value,
                phone: form.querySelector('#editPhone').value,
                role: form.querySelector('#editRole').value,
                status: form.querySelector('#editStatus').value
            };
            
            try {
                await firebase.database().ref(`users/${userId}`).update(updatedData);
                
                // Update local data
                Object.assign(user, updatedData);
                renderUsersTable();
                updateStatisticsCards();
                
                showNotification('User updated successfully', 'success');
                modal.remove();
                
            } catch (error) {
                showNotification('Failed to update user', 'error');
            }
        });
        
        const closeBtn = modal.querySelector('.close-modal');
        closeBtn.addEventListener('click', () => modal.remove());
    };
    
    window.viewUser = function(userId) {
        const user = usersData.find(u => u.id === userId);
        if (!user) return;
        
        const modal = createViewModal(user);
        document.body.appendChild(modal);
        
        const closeBtn = modal.querySelector('.close-modal');
        closeBtn.addEventListener('click', () => modal.remove());
    };
    
    window.deleteUser = async function(userId) {
        const user = usersData.find(u => u.id === userId);
        if (!user) return;
        
        const confirmed = confirm(`Are you sure you want to delete ${user.name}? This action cannot be undone.`);
        if (!confirmed) return;
        
        try {
            await firebase.database().ref(`users/${userId}`).remove();
            usersData = usersData.filter(u => u.id !== userId);
            renderUsersTable();
            updateStatisticsCards();
            showNotification('User deleted successfully', 'success');
            
        } catch (error) {
            showNotification('Failed to delete user', 'error');
        }
    };
    
    window.toggleUserStatus = async function(userId) {
        const user = usersData.find(u => u.id === userId);
        if (!user) return;
        
        const newStatus = user.status === 'active' ? 'inactive' : 'active';
        
        try {
            await firebase.database().ref(`users/${userId}/status`).set(newStatus);
            user.status = newStatus;
            renderUsersTable();
            updateStatisticsCards();
            showNotification(`User ${newStatus === 'active' ? 'activated' : 'deactivated'}`, 'success');
            
        } catch (error) {
            showNotification('Failed to change user status', 'error');
        }
    };

    // ==================== ADD NEW USER ====================
    async function addNewUser(userData) {
        try {
            // Create auth user
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(userData.email, userData.password);
            const user = userCredential.user;
            
            // Update profile
            await user.updateProfile({ displayName: userData.name });
            
            // Save to database
            await firebase.database().ref(`users/${user.uid}`).set({
                name: userData.name,
                email: userData.email,
                role: userData.role,
                phone: userData.phone || '',
                status: 'active',
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                profileComplete: true
            });
            
            // Add to local data
            usersData.push({
                id: user.uid,
                name: userData.name,
                email: userData.email,
                role: userData.role,
                phone: userData.phone || '',
                status: 'active',
                createdAt: Date.now(),
                profileComplete: true
            });
            
            renderUsersTable();
            updateStatisticsCards();
            showNotification(`User ${userData.name} created successfully`, 'success');
            return true;
            
        } catch (error) {
            console.error('Add user error:', error);
            showNotification(error.message, 'error');
            return false;
        }
    }
    
    document.getElementById('addUserForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const userData = {
            name: document.getElementById('newName')?.value,
            email: document.getElementById('newEmail')?.value,
            password: document.getElementById('newPassword')?.value,
            role: document.getElementById('newRole')?.value,
            phone: document.getElementById('newPhone')?.value || ''
        };
        
        if (!userData.name || !userData.email || !userData.password) {
            showNotification('Please fill all required fields', 'error');
            return;
        }
        
        if (userData.password.length < 6) {
            showNotification('Password must be at least 6 characters', 'error');
            return;
        }
        
        const addBtn = e.target.querySelector('button[type="submit"]');
        const originalText = addBtn.innerHTML;
        addBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        addBtn.disabled = true;
        
        await addNewUser(userData);
        
        addBtn.innerHTML = originalText;
        addBtn.disabled = false;
        e.target.reset();
    });

    // ==================== SEARCH & FILTERS ====================
    function setupSearchAndFilters() {
        const searchInput = document.getElementById('globalSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                currentSearchTerm = e.target.value.toLowerCase();
                renderUsersTable();
            });
        }
        
        const filterBtn = document.getElementById('filterBtn');
        const filterDropdown = document.getElementById('filterDropdown');
        
        if (filterBtn && filterDropdown) {
            filterBtn.addEventListener('click', () => {
                filterDropdown.classList.toggle('active');
            });
        }
        
        const applyFilter = document.getElementById('applyFilter');
        if (applyFilter) {
            applyFilter.addEventListener('click', () => {
                currentFilter = document.getElementById('filterRole')?.value || 'all';
                renderUsersTable();
                filterDropdown?.classList.remove('active');
                showNotification('Filters applied', 'success');
            });
        }
        
        const resetFilter = document.getElementById('resetFilter');
        if (resetFilter) {
            resetFilter.addEventListener('click', () => {
                currentFilter = 'all';
                currentSearchTerm = '';
                if (searchInput) searchInput.value = '';
                if (document.getElementById('filterRole')) document.getElementById('filterRole').value = 'all';
                renderUsersTable();
                filterDropdown?.classList.remove('active');
                showNotification('Filters reset', 'success');
            });
        }
    }

    // ==================== EXPORT FUNCTIONS ====================
    function exportToPDF() {
        showNotification('Generating PDF report...', 'info');
        
        setTimeout(() => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('landscape');
            
            // Header
            doc.setFontSize(24);
            doc.setTextColor(26, 127, 158);
            doc.text('Care Sync - User Management Report', 14, 20);
            
            doc.setFontSize(12);
            doc.setTextColor(100, 100, 100);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
            
            // Summary
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.text('Summary Statistics', 14, 45);
            
            const stats = {
                'Total Users': usersData.length,
                'Patients': usersData.filter(u => u.role === 'patient').length,
                'Doctors': usersData.filter(u => u.role === 'doctor').length,
                'Active Users': usersData.filter(u => u.status === 'active').length
            };
            
            let yPos = 55;
            Object.entries(stats).forEach(([label, value]) => {
                doc.setFontSize(11);
                doc.text(`${label}: ${value}`, 14, yPos);
                yPos += 7;
            });
            
            // Table
            const tableData = usersData.map(user => [
                user.name,
                user.email,
                capitalize(user.role),
                capitalize(user.status),
                user.phone || 'N/A'
            ]);
            
            doc.autoTable({
                startY: yPos + 5,
                head: [['Name', 'Email', 'Role', 'Status', 'Phone']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [26, 127, 158], textColor: 255, fontSize: 12 },
                styles: { fontSize: 10, cellPadding: 4 },
                columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 60 } }
            });
            
            doc.save('user_management_report.pdf');
            showNotification('PDF report generated successfully', 'success');
        }, 500);
    }
    
    function exportToCSV() {
        const headers = ['Name', 'Email', 'Role', 'Status', 'Phone', 'Created At'];
        const rows = usersData.map(user => [
            user.name,
            user.email,
            user.role,
            user.status,
            user.phone || '',
            new Date(user.createdAt).toLocaleDateString()
        ]);
        
        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'users_export.csv';
        a.click();
        URL.revokeObjectURL(url);
        
        showNotification('CSV export completed', 'success');
    }
    
    document.getElementById('exportBtn')?.addEventListener('click', exportToPDF);
    document.getElementById('exportCSVBtn')?.addEventListener('click', exportToCSV);
    
    document.getElementById('exportReportBtn')?.addEventListener('click', () => {
        const { jsPDF } = window.jspdf;
        const canvas = document.getElementById('monthlyReportChart');
        if (canvas) {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('landscape');
            pdf.setFontSize(18);
            pdf.text('Monthly Analytics Report', 14, 15);
            pdf.addImage(imgData, 'PNG', 10, 25, 270, 120);
            pdf.save('analytics_report.pdf');
            showNotification('Report exported successfully', 'success');
        }
    });

    // ==================== SETTINGS MANAGEMENT ====================
    document.getElementById('saveSettings')?.addEventListener('click', async () => {
        const settings = {
            hospitalName: document.getElementById('hospitalName')?.value,
            notificationEmail: document.getElementById('notificationEmail')?.value,
            language: document.getElementById('language')?.value,
            timezone: document.getElementById('timezone')?.value,
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        };
        
        try {
            await firebase.database().ref('systemSettings').set(settings);
            showNotification('Settings saved successfully', 'success');
        } catch (error) {
            showNotification('Failed to save settings', 'error');
        }
    });
    
    async function loadSettings() {
        try {
            const snapshot = await firebase.database().ref('systemSettings').once('value');
            const settings = snapshot.val();
            
            if (settings) {
                if (document.getElementById('hospitalName')) document.getElementById('hospitalName').value = settings.hospitalName || '';
                if (document.getElementById('notificationEmail')) document.getElementById('notificationEmail').value = settings.notificationEmail || '';
                if (document.getElementById('language')) document.getElementById('language').value = settings.language || 'en';
                if (document.getElementById('timezone')) document.getElementById('timezone').value = settings.timezone || 'UTC';
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    // ==================== REALTIME LISTENERS ====================
    function setupRealtimeListeners() {
        const usersRef = firebase.database().ref('users');
        
        const listener = usersRef.on('value', (snapshot) => {
            const users = snapshot.val();
            if (users) {
                usersData = Object.entries(users).map(([id, data]) => ({
                    id: id,
                    name: data.name || 'Not specified',
                    email: data.email || 'Not specified',
                    role: data.role || 'patient',
                    status: data.status || 'active',
                    phone: data.phone || '',
                    createdAt: data.createdAt || Date.now(),
                    lastLogin: data.lastLogin || null,
                    profileComplete: data.profileComplete || false
                }));
                renderUsersTable();
                updateStatisticsCards();
            }
        });
        
        realtimeListeners.push({ ref: usersRef, listener });
    }
    
    function cleanupRealtimeListeners() {
        realtimeListeners.forEach(({ ref, listener }) => {
            ref.off('value', listener);
        });
    }

    // ==================== UI HELPER FUNCTIONS ====================
    function createEditModal(user) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-user-edit"></i> Edit User</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <form id="editUserForm">
                    <div class="form-group">
                        <label>Full Name</label>
                        <input type="text" id="editName" class="form-control" value="${escapeHtml(user.name)}" required>
                    </div>
                    <div class="form-group">
                        <label>Phone Number</label>
                        <input type="tel" id="editPhone" class="form-control" value="${escapeHtml(user.phone || '')}">
                    </div>
                    <div class="form-group">
                        <label>Role</label>
                        <select id="editRole" class="form-control">
                            <option value="patient" ${user.role === 'patient' ? 'selected' : ''}>Patient</option>
                            <option value="doctor" ${user.role === 'doctor' ? 'selected' : ''}>Doctor</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Status</label>
                        <select id="editStatus" class="form-control">
                            <option value="active" ${user.status === 'active' ? 'selected' : ''}>Active</option>
                            <option value="inactive" ${user.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                        </select>
                    </div>
                    <div class="modal-buttons">
                        <button type="submit" class="btn-login">Save Changes</button>
                        <button type="button" class="btn-secondary close-modal">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        return modal;
    }
    
    function createViewModal(user) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-user-circle"></i> User Details</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="user-details">
                    <div class="detail-row">
                        <span class="detail-label">Name:</span>
                        <span class="detail-value">${escapeHtml(user.name)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Email:</span>
                        <span class="detail-value">${escapeHtml(user.email)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Role:</span>
                        <span class="detail-value">${capitalize(user.role)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Status:</span>
                        <span class="detail-value status-${user.status}">${capitalize(user.status)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Phone:</span>
                        <span class="detail-value">${user.phone || 'Not provided'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Joined:</span>
                        <span class="detail-value">${formatDate(user.createdAt)}</span>
                    </div>
                </div>
            </div>
        `;
        return modal;
    }
    
    function showNotification(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) {
            // Create container if it doesn't exist
            const newContainer = document.createElement('div');
            newContainer.id = 'toastContainer';
            newContainer.className = 'toast-container';
            document.body.appendChild(newContainer);
        }
        
        const toast = document.createElement('div');
        toast.className = `toast-message toast-${type}`;
        
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        toast.innerHTML = `${icons[type] || 'ℹ️'} ${message}`;
        
        document.getElementById('toastContainer').appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
    
    function animateNumber(element, start, end, duration = 1000) {
        let startTimestamp = null;
        const startNum = parseInt(start) || 0;
        const endNum = parseInt(end) || 0;
        
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            element.innerText = Math.floor(progress * (endNum - startNum) + startNum);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }
    
    // ==================== UTILITY FUNCTIONS ====================
    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }
    
    function formatDate(timestamp) {
        if (!timestamp) return 'N/A';
        return new Date(timestamp).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    
    function timeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} minutes ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} hours ago`;
        const days = Math.floor(hours / 24);
        return `${days} days ago`;
    }
    
    function getAvatarColor(role) {
        const colors = {
            admin: '#1a7f9e',
            doctor: '#10b981',
            patient: '#f59e0b'
        };
        return colors[role] || '#6b7280';
    }
    
    function getRoleIcon(role) {
        const icons = {
            admin: 'fa-crown',
            doctor: 'fa-user-md',
            patient: 'fa-user'
        };
        return icons[role] || 'fa-user';
    }
    
    function getActivityIcon(type) {
        const icons = {
            create: 'fa-plus-circle',
            update: 'fa-edit',
            delete: 'fa-trash',
            system: 'fa-server'
        };
        return icons[type] || 'fa-info-circle';
    }

    // ==================== SIDEBAR & NAVIGATION ====================
    function setupSidebar() {
        const sidebar = document.getElementById('sidebar');
        const collapseBtn = document.getElementById('collapseSidebar');
        
        if (collapseBtn && sidebar) {
            collapseBtn.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                const icon = collapseBtn.querySelector('i');
                if (icon) {
                    icon.className = sidebar.classList.contains('collapsed') ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
                }
            });
        }
        
        const menuItems = document.querySelectorAll('.menu-item');
        const pages = document.querySelectorAll('.page-section');
        
        function showPage(pageId) {
            pages.forEach(p => p.classList.remove('active'));
            const activePage = document.getElementById(pageId + 'Page');
            if (activePage) activePage.classList.add('active');
        }
        
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                menuItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                const page = item.dataset.page;
                if (page) showPage(page);
            });
        });
        
        // Setup logout button
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
        
        const sidebarFooter = document.querySelector('.sidebar-footer');
        if (sidebarFooter && !document.querySelector('.sidebar-footer .menu-item:last-child i.fa-sign-out-alt')) {
            sidebarFooter.appendChild(logoutBtn);
        }
    }

    // ==================== EVENT LISTENERS SETUP ====================
    function setupEventListeners() {
        setupSearchAndFilters();
        setupSidebar();
        
        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                const root = document.documentElement;
                const current = root.getAttribute('data-theme');
                const newTheme = current === 'light' ? 'dark' : 'light';
                root.setAttribute('data-theme', newTheme);
                themeToggle.innerHTML = newTheme === 'light' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
                showNotification(`${newTheme === 'dark' ? 'Dark mode' : 'Light mode'} activated`, 'info');
            });
        }
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            const filterDropdown = document.getElementById('filterDropdown');
            const filterBtn = document.getElementById('filterBtn');
            if (filterDropdown && filterBtn && !filterDropdown.contains(e.target) && !filterBtn.contains(e.target)) {
                filterDropdown.classList.remove('active');
            }
        });
    }

    // ==================== INITIALIZATION ====================
    (async function() {
        await initializeAdminPanel();
        await loadSettings();
        setupEventListeners();
        
        // Expose necessary functions globally
        window.editUser = editUser;
        window.viewUser = viewUser;
        window.deleteUser = deleteUser;
        window.toggleUserStatus = toggleUserStatus;
        window.showNotification = showNotification;
        
        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            cleanupRealtimeListeners();
        });
    })();
    
})();
