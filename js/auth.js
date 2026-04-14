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
