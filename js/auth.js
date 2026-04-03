// ====================================================
// CARE SYNC - PROFESSIONAL AUTHENTICATION SYSTEM
// ====================================================

(function() {
    "use strict";

    // Toast Notification Helper
    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast-message toast-${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        toast.innerHTML = `${icons[type] || 'ℹ️'} ${message}`;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // Role-based redirection
    function redirectToDashboard(role) {
        const routes = {
            'admin': 'admin.html',
            'doctor': 'doctor.html',
            'patient': 'patient.html'
        };
        
        const targetPage = routes[role];
        if (targetPage) {
            window.location.href = targetPage;
        } else {
            console.error('Unknown role:', role);
            window.location.href = 'index.html';
        }
    }

    // Save user session
    function saveUserSession(user, role, name, email) {
        const sessionData = {
            uid: user.uid,
            email: email || user.email,
            name: name || user.displayName || email?.split('@')[0],
            role: role,
            lastLogin: new Date().toISOString(),
            timestamp: Date.now()
        };
        
        localStorage.setItem('careSyncSession', JSON.stringify(sessionData));
        sessionStorage.setItem('careSyncActive', 'true');
    }

    // Clear user session
    function clearUserSession() {
        localStorage.removeItem('careSyncSession');
        sessionStorage.removeItem('careSyncActive');
    }

    // Get current session
    window.getCurrentSession = function() {
        const session = localStorage.getItem('careSyncSession');
        return session ? JSON.parse(session) : null;
    };

    // Check if user is logged in
    window.isUserLoggedIn = function() {
        return sessionStorage.getItem('careSyncActive') === 'true';
    };

    // Show role selection modal for social login
    function showRoleSelectionModal(user) {
        return new Promise((resolve, reject) => {
            const modal = document.createElement('div');
            modal.className = 'role-modal';
            modal.innerHTML = `
                <div class="role-modal-content">
                    <i class="fas fa-user-circle" style="font-size: 48px; color: var(--accent-primary); margin-bottom: 16px;"></i>
                    <h3>Welcome ${user.displayName || user.email}!</h3>
                    <p style="margin: 16px 0;">Please select your account role to continue</p>
                    <select id="roleSelect" class="form-control" style="margin-bottom: 16px;">
                        <option value="patient">🧑 Patient</option>
                        <option value="doctor">👨‍⚕️ Doctor</option>
                        <option value="admin">👑 Admin</option>
                    </select>
                    <button id="confirmRoleBtn" class="btn-login" style="width: 100%;">Continue</button>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            const confirmBtn = modal.querySelector('#confirmRoleBtn');
            const roleSelect = modal.querySelector('#roleSelect');
            
            confirmBtn.addEventListener('click', () => {
                const role = roleSelect.value;
                modal.remove();
                resolve(role);
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                    reject(new Error('Role selection cancelled'));
                }
            });
        });
    }

    // ==================== EMAIL/PASSWORD LOGIN ====================
    window.loginWithEmail = async function(email, password) {
        try {
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Get user role from database
            const snapshot = await firebase.database().ref(`users/${user.uid}/role`).once('value');
            const role = snapshot.val();
            
            if (!role) {
                throw new Error('User role not found');
            }
            
            // Get user name
            const nameSnapshot = await firebase.database().ref(`users/${user.uid}/name`).once('value');
            const name = nameSnapshot.val();
            
            // Save session
            saveUserSession(user, role, name, email);
            
            return { success: true, role: role };
            
        } catch (error) {
            console.error('Login error:', error);
            let errorMessage = 'Login failed';
            
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'Email not registered';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Incorrect password';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email format';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'Account disabled. Contact support';
                    break;
                default:
                    errorMessage = error.message;
            }
            
            return { success: false, error: errorMessage };
        }
    };

    // ==================== EMAIL/PASSWORD REGISTRATION ====================
    window.registerWithEmail = async function(name, email, password, role) {
        try {
            // Create user
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Update profile
            await user.updateProfile({
                displayName: name
            });
            
            // Save user data to database
            await firebase.database().ref(`users/${user.uid}`).set({
                name: name,
                email: email,
                role: role,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                status: 'active',
                profileComplete: true
            });
            
            // Save session
            saveUserSession(user, role, name, email);
            
            return { success: true, role: role };
            
        } catch (error) {
            console.error('Registration error:', error);
            let errorMessage = 'Registration failed';
            
            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'Email already registered';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email format';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'Password is too weak';
                    break;
                default:
                    errorMessage = error.message;
            }
            
            return { success: false, error: errorMessage };
        }
    };

    // ==================== SOCIAL LOGIN ====================
    window.socialLogin = async function(providerType) {
        try {
            let provider;
            
            switch (providerType) {
                case 'google':
                    provider = new firebase.auth.GoogleAuthProvider();
                    break;
                case 'microsoft':
                    provider = new firebase.auth.OAuthProvider('microsoft.com');
                    break;
                case 'apple':
                    provider = new firebase.auth.OAuthProvider('apple.com');
                    break;
                default:
                    throw new Error('Unsupported provider');
            }
            
            const result = await firebase.auth().signInWithPopup(provider);
            const user = result.user;
            
            // Check if user exists in database
            const snapshot = await firebase.database().ref(`users/${user.uid}`).once('value');
            
            let role;
            if (!snapshot.exists()) {
                // New user - show role selection
                role = await showRoleSelectionModal(user);
                
                // Save user to database
                await firebase.database().ref(`users/${user.uid}`).set({
                    name: user.displayName || user.email,
                    email: user.email,
                    role: role,
                    createdAt: firebase.database.ServerValue.TIMESTAMP,
                    status: 'active',
                    profileComplete: true
                });
            } else {
                role = snapshot.val().role;
            }
            
            // Save session
            saveUserSession(user, role, user.displayName, user.email);
            
            return { success: true, role: role };
            
        } catch (error) {
            console.error('Social login error:', error);
            return { success: false, error: error.message };
        }
    };

    // ==================== LOGOUT ====================
    window.logoutUser = async function() {
        try {
            await firebase.auth().signOut();
            clearUserSession();
            window.location.href = 'index.html';
            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);
            return { success: false, error: error.message };
        }
    };

    // ==================== PASSWORD RESET ====================
    window.resetPassword = async function(email) {
        try {
            await firebase.auth().sendPasswordResetEmail(email);
            return { success: true };
        } catch (error) {
            console.error('Password reset error:', error);
            let errorMessage = 'Failed to send reset email';
            
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'Email not registered';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email format';
                    break;
                default:
                    errorMessage = error.message;
            }
            
            return { success: false, error: errorMessage };
        }
    };

    // ==================== AUTH STATE OBSERVER ====================
    firebase.auth().onAuthStateChanged((user) => {
        const currentPath = window.location.pathname.split('/').pop();
        const publicPages = ['index.html', ''];
        
        if (!user) {
            // User is logged out
            clearUserSession();
            
            // Redirect to login if on protected page
            if (!publicPages.includes(currentPath) && currentPath !== '') {
                window.location.href = 'index.html';
            }
        } else {
            // User is logged in
            const session = getCurrentSession();
            
            // Redirect if on login page
            if (publicPages.includes(currentPath)) {
                if (session && session.role) {
                    redirectToDashboard(session.role);
                } else {
                    // Fetch role from database
                    firebase.database().ref(`users/${user.uid}/role`).once('value').then((snapshot) => {
                        const role = snapshot.val();
                        if (role) {
                            redirectToDashboard(role);
                        }
                    });
                }
            }
        }
    });

    // Export functions to global scope
    window.showToast = showToast;
    window.redirectToDashboard = redirectToDashboard;
})();
