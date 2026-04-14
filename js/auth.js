// Logout
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        firebase.auth().signOut().then(() => {
            window.location.href = 'index.html';
        }).catch(() => {
            window.location.href = 'index.html';
        });
    });
}

// Auth state observer
firebase.auth().onAuthStateChanged((user) => {
    const path = window.location.pathname.split('/').pop();
    if (!user && path !== 'index.html' && path !== '') {
        window.location.href = 'index.html';
    } else if (user && path === 'index.html') {
        // Redirect based on role
        firebase.database().ref('users/' + user.uid).once('value').then((snap) => {
            const role = snap.val()?.role;
            if (role === 'patient') window.location.href = 'patient.html';
            else if (role === 'doctor') window.location.href = 'doctor.html';
            else if (role === 'admin') window.location.href = 'admin.html';
        });
    }
});
// ========== TOAST FUNCTION ==========
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.innerHTML = message;
    toast.className = `toast show ${type}`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ========== LOADING FUNCTION ==========
function setButtonLoading(button, isLoading, originalText) {
    if (isLoading) {
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        button.disabled = true;
    } else {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

// ========== CAPTCHA VALIDATION ==========
function isCaptchaValid() {
    const captcha = document.getElementById('captcha');
    return captcha ? captcha.checked : true;
}

// ========== GUEST MODE ==========
const guestBtn = document.getElementById('guestBtn');
if (guestBtn) {
    guestBtn.addEventListener('click', () => {
        showToast('Entering guest mode...', 'info');
        setTimeout(() => {
            window.location.href = 'patient.html?guest=true';
        }, 1000);
    });
}

// ========== IMPROVED LOGIN WITH LOADING ==========
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');

if (loginForm && loginBtn) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!isCaptchaValid()) {
            showToast('Please verify you are not a robot', 'warning');
            return;
        }
        
        const email = document.getElementById('loginEmail')?.value;
        const password = document.getElementById('loginPassword')?.value;
        
        if (!email || !password) {
            showToast('Please fill all fields', 'error');
            return;
        }
        
        const originalText = loginBtn.innerHTML;
        setButtonLoading(loginBtn, true, originalText);
        
        try {
            // محاكاة تسجيل الدخول (استبدلها بـ Firebase الفعلي)
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            localStorage.setItem('lastEmail', email);
            showToast('Login successful! Redirecting...', 'success');
            
            setTimeout(() => {
                // window.location.href = 'patient.html';
                console.log('Redirect to dashboard');
            }, 1000);
            
        } catch (error) {
            showToast(error.message || 'Login failed', 'error');
        } finally {
            setButtonLoading(loginBtn, false, originalText);
        }
    });
}

// ========== WELCOME BACK MESSAGE ==========
const lastEmail = localStorage.getItem('lastEmail');
if (lastEmail) {
    const emailInput = document.getElementById('loginEmail');
    if (emailInput) {
        emailInput.value = lastEmail;
        setTimeout(() => {
            showToast(`Welcome back! 👋`, 'info');
        }, 500);
    }
}

// ========== IMPROVED TOGGLE PASSWORD ==========
document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', function() {
        const targetId = this.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (input) {
            const type = input.type === 'password' ? 'text' : 'password';
            input.type = type;
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        }
    });
});

// ========== SOCIAL LOGIN BUTTONS ==========
document.getElementById('googleBtn')?.addEventListener('click', () => {
    showToast('Google login coming soon', 'info');
});
document.getElementById('appleBtn')?.addEventListener('click', () => {
    showToast('Apple login coming soon', 'info');
});
document.getElementById('microsoftBtn')?.addEventListener('click', () => {
    showToast('Microsoft login coming soon', 'info');
});

// ========== FORGOT PASSWORD ==========
document.getElementById('forgotPassword')?.addEventListener('click', (e) => {
    e.preventDefault();
    showToast('Password reset link sent to your email', 'info');
});

console.log('✅ Login page enhanced successfully');
// ========== TOAST FUNCTION ==========
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerHTML = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

// ========== LOADING FUNCTION ==========
function setButtonLoading(button, isLoading, originalText) {
    if (isLoading) {
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        button.disabled = true;
    } else {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

// ========== CAPTCHA VALIDATION ==========
function isCaptchaValid() {
    const captcha = document.getElementById('captcha');
    return captcha ? captcha.checked : true;
}

// ========== GUEST MODE ==========
const guestBtn = document.getElementById('guestBtn');
if (guestBtn) {
    guestBtn.addEventListener('click', () => {
        showToast('Entering guest mode...', 'info');
        setTimeout(() => { window.location.href = 'patient.html?guest=true'; }, 1000);
    });
}

// ========== IMPROVED LOGIN WITH LOADING ==========
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');

if (loginForm && loginBtn) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!isCaptchaValid()) {
            showToast('Please verify you are not a robot', 'warning');
            return;
        }
        
        const email = document.getElementById('loginEmail')?.value;
        const password = document.getElementById('loginPassword')?.value;
        
        if (!email || !password) {
            showToast('Please fill all fields', 'error');
            return;
        }
        
        const originalText = loginBtn.innerHTML;
        setButtonLoading(loginBtn, true, originalText);
        
        try {
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            const snapshot = await firebase.database().ref('users/' + user.uid).once('value');
            const role = snapshot.val()?.role || 'patient';
            
            localStorage.setItem('lastEmail', email);
            showToast('Login successful! Redirecting...', 'success');
            
            setTimeout(() => {
                if (role === 'patient') window.location.href = 'patient.html';
                else if (role === 'doctor') window.location.href = 'doctor.html';
                else if (role === 'admin') window.location.href = 'admin.html';
                else window.location.href = 'patient.html';
            }, 1000);
            
        } catch (error) {
            let errorMsg = 'Login failed';
            if (error.code === 'auth/user-not-found') errorMsg = 'Email not found';
            else if (error.code === 'auth/wrong-password') errorMsg = 'Incorrect password';
            else if (error.code === 'auth/invalid-email') errorMsg = 'Invalid email format';
            showToast(errorMsg, 'error');
        } finally {
            setButtonLoading(loginBtn, false, originalText);
        }
    });
}

// ========== WELCOME BACK MESSAGE ==========
const lastEmail = localStorage.getItem('lastEmail');
if (lastEmail) {
    const emailInput = document.getElementById('loginEmail');
    if (emailInput) {
        emailInput.value = lastEmail;
        setTimeout(() => { showToast(`Welcome back! 👋`, 'info'); }, 500);
    }
}

// ========== IMPROVED TOGGLE PASSWORD ==========
document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', function() {
        const targetId = this.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (input) {
            const type = input.type === 'password' ? 'text' : 'password';
            input.type = type;
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        }
    });
});

// ========== GOOGLE LOGIN (شغال فعلاً) ==========
document.getElementById('googleBtn')?.addEventListener('click', async () => {
    try {
        showToast('Connecting to Google...', 'info');
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await firebase.auth().signInWithPopup(provider);
        const user = result.user;
        
        const snapshot = await firebase.database().ref('users/' + user.uid).once('value');
        let role = snapshot.val()?.role;
        
        if (!role) {
            role = 'patient';
            await firebase.database().ref('users/' + user.uid).set({
                email: user.email,
                name: user.displayName,
                role: role,
                photoURL: user.photoURL,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });
        }
        
        localStorage.setItem('lastEmail', user.email);
        showToast(`Welcome ${user.displayName || user.email}!`, 'success');
        setTimeout(() => { window.location.href = role === 'doctor' ? 'doctor.html' : 'patient.html'; }, 1000);
        
    } catch (error) {
        console.error("Google login error:", error);
        showToast(error.message || 'Google login failed', 'error');
    }
});

// ========== MICROSOFT LOGIN (شغال فعلاً) ==========
document.getElementById('microsoftBtn')?.addEventListener('click', async () => {
    try {
        showToast('Connecting to Microsoft...', 'info');
        const provider = new firebase.auth.OAuthProvider('microsoft.com');
        provider.addScope('mail.read');
        provider.addScope('openid');
        provider.addScope('profile');
        
        const result = await firebase.auth().signInWithPopup(provider);
        const user = result.user;
        
        const snapshot = await firebase.database().ref('users/' + user.uid).once('value');
        let role = snapshot.val()?.role;
        
        if (!role) {
            role = 'patient';
            await firebase.database().ref('users/' + user.uid).set({
                email: user.email,
                name: user.displayName || user.email,
                role: role,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });
        }
        
        localStorage.setItem('lastEmail', user.email);
        showToast(`Welcome ${user.displayName || user.email}!`, 'success');
        setTimeout(() => { window.location.href = role === 'doctor' ? 'doctor.html' : 'patient.html'; }, 1000);
        
    } catch (error) {
        console.error("Microsoft login error:", error);
        showToast(error.message || 'Microsoft login failed', 'error');
    }
});

// ========== APPLE LOGIN (يتطلب إعدادات إضافية) ==========
document.getElementById('appleBtn')?.addEventListener('click', async () => {
    try {
        showToast('Connecting to Apple...', 'info');
        const provider = new firebase.auth.OAuthProvider('apple.com');
        provider.addScope('email');
        provider.addScope('name');
        
        const result = await firebase.auth().signInWithPopup(provider);
        const user = result.user;
        
        const snapshot = await firebase.database().ref('users/' + user.uid).once('value');
        let role = snapshot.val()?.role;
        
        if (!role) {
            role = 'patient';
            await firebase.database().ref('users/' + user.uid).set({
                email: user.email,
                name: user.displayName || user.email || 'Apple User',
                role: role,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });
        }
        
        localStorage.setItem('lastEmail', user.email);
        showToast(`Welcome ${user.displayName || user.email || 'Apple User'}!`, 'success');
        setTimeout(() => { window.location.href = role === 'doctor' ? 'doctor.html' : 'patient.html'; }, 1000);
        
    } catch (error) {
        console.error("Apple login error:", error);
        showToast(error.message || 'Apple login failed (requires Apple Developer account)', 'error');
    }
});

// ========== FORGOT PASSWORD ==========
document.getElementById('forgotPassword')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail')?.value;
    if (!email) {
        showToast('Please enter your email address first', 'warning');
        return;
    }
    try {
        await firebase.auth().sendPasswordResetEmail(email);
        showToast('Password reset link sent to your email', 'success');
    } catch (error) {
        showToast('Email not found or invalid', 'error');
    }
});

console.log('✅ Login page enhanced with Google, Microsoft & Apple login');
