// ====================================================
// CARE SYNC - MAIN PAGE CONTROLLER
// ====================================================

(function() {
    "use strict";

    // DOM Elements
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const forgotPassword = document.getElementById('forgotPassword');
    const googleBtn = document.getElementById('googleBtn');
    const microsoftBtn = document.getElementById('microsoftBtn');
    const appleBtn = document.getElementById('appleBtn');
    
    // Tab switching
    function switchTab(tab) {
        if (tab === 'login') {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
        } else {
            registerTab.classList.add('active');
            loginTab.classList.remove('active');
            registerForm.classList.remove('hidden');
            loginForm.classList.add('hidden');
        }
    }
    
    loginTab?.addEventListener('click', () => switchTab('login'));
    registerTab?.addEventListener('click', () => switchTab('register'));
    
    // Toggle password visibility
    document.querySelectorAll('.toggle-password').forEach(icon => {
        icon.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (input.type === 'password') {
                input.type = 'text';
                this.classList.remove('fa-eye');
                this.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                this.classList.remove('fa-eye-slash');
                this.classList.add('fa-eye');
            }
        });
    });
    
    // Password strength meter
    const regPassword = document.getElementById('regPassword');
    const strengthFill = document.getElementById('strengthFill');
    const strengthLabel = document.getElementById('strengthLabel');
    
    function checkPasswordStrength(password) {
        let score = 0;
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;
        
        if (score <= 2) return { width: 30, text: 'Weak', color: '#ef4444' };
        if (score <= 4) return { width: 70, text: 'Medium', color: '#f59e0b' };
        return { width: 100, text: 'Strong', color: '#10b981' };
    }
    
    regPassword?.addEventListener('input', function() {
        const result = checkPasswordStrength(this.value);
        strengthFill.style.width = result.width + '%';
        strengthFill.style.background = result.color;
        strengthLabel.innerText = result.text;
    });
    
    // Password confirmation check
    const regConfirm = document.getElementById('regConfirm');
    
    function checkPasswordMatch() {
        const password = regPassword?.value;
        const confirm = regConfirm?.value;
        const errorDiv = document.getElementById('registerError');
        
        if (confirm && password !== confirm) {
            errorDiv.innerText = 'Passwords do not match';
            return false;
        } else {
            errorDiv.innerText = '';
            return true;
        }
    }
    
    regConfirm?.addEventListener('input', checkPasswordMatch);
    regPassword?.addEventListener('input', checkPasswordMatch);
    
    // Email validation hint
    const regEmail = document.getElementById('regEmail');
    const emailHint = document.getElementById('emailHint');
    
    regEmail?.addEventListener('input', function() {
        const email = this.value;
        const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        
        if (email && !isValid) {
            emailHint.innerHTML = '<i class="fas fa-exclamation-circle"></i> Invalid email format';
            emailHint.style.color = '#ef4444';
        } else if (email && isValid) {
            emailHint.innerHTML = '<i class="fas fa-check-circle"></i> Valid email format';
            emailHint.style.color = '#10b981';
        } else {
            emailHint.innerHTML = '';
        }
    });
    
    // Profile picture upload
    const profileUpload = document.getElementById('profileUpload');
    const profilePreview = document.getElementById('profilePreview');
    const fileLabelTrigger = document.getElementById('fileLabelTrigger');
    
    fileLabelTrigger?.addEventListener('click', () => profileUpload?.click());
    
    profileUpload?.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (profilePreview) profilePreview.src = ev.target.result;
            };
            reader.readAsDataURL(e.target.files[0]);
            showToast('Profile picture updated', 'success');
        }
    });
    
    // ==================== LOGIN HANDLER ====================
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail')?.value.trim();
        const password = document.getElementById('loginPassword')?.value;
        const rememberMe = document.getElementById('rememberMe')?.checked;
        
        if (!email || !password) {
            showToast('Please enter email and password', 'error');
            return;
        }
        
        // Show loading state
        const originalText = loginBtn.innerHTML;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
        loginBtn.disabled = true;
        
        const result = await window.loginWithEmail(email, password);
        
        if (result.success) {
            showToast(`Welcome back! Redirecting...`, 'success');
            
            // Save remember me preference
            if (rememberMe) {
                localStorage.setItem('rememberedEmail', email);
            } else {
                localStorage.removeItem('rememberedEmail');
            }
            
            // Redirect after short delay
            setTimeout(() => {
                window.redirectToDashboard(result.role);
            }, 1000);
            
        } else {
            showToast(result.error, 'error');
            loginBtn.innerHTML = originalText;
            loginBtn.disabled = false;
        }
    });
    
    // ==================== REGISTER HANDLER ====================
    registerForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('regName')?.value.trim();
        const email = document.getElementById('regEmail')?.value.trim();
        const password = document.getElementById('regPassword')?.value;
        const confirm = document.getElementById('regConfirm')?.value;
        const role = document.getElementById('regRole')?.value;
        const terms = document.getElementById('termsCheck')?.checked;
        
        // Validation
        if (!name || !email || !password || !confirm) {
            showToast('Please fill all required fields', 'error');
            return;
        }
        
        if (password !== confirm) {
            showToast('Passwords do not match', 'error');
            return;
        }
        
        if (password.length < 6) {
            showToast('Password must be at least 6 characters', 'error');
            return;
        }
        
        if (!terms) {
            showToast('Please accept the Terms and Conditions', 'warning');
            return;
        }
        
        // Show loading state
        const originalText = registerBtn.innerHTML;
        registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';
        registerBtn.disabled = true;
        
        const result = await window.registerWithEmail(name, email, password, role);
        
        if (result.success) {
            showToast(`Welcome ${name}! Account created successfully`, 'success');
            
            setTimeout(() => {
                window.redirectToDashboard(result.role);
            }, 1500);
            
        } else {
            showToast(result.error, 'error');
            registerBtn.innerHTML = originalText;
            registerBtn.disabled = false;
        }
    });
    
    // ==================== FORGOT PASSWORD ====================
    forgotPassword?.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail')?.value.trim();
        
        if (!email) {
            showToast('Please enter your email address first', 'warning');
            return;
        }
        
        const result = await window.resetPassword(email);
        
        if (result.success) {
            showToast('Password reset link sent to your email', 'success');
        } else {
            showToast(result.error, 'error');
        }
    });
    
    // ==================== SOCIAL LOGIN ====================
    async function handleSocialLogin(provider) {
        const result = await window.socialLogin(provider);
        
        if (result.success) {
            showToast('Login successful! Redirecting...', 'success');
            
            setTimeout(() => {
                window.redirectToDashboard(result.role);
            }, 1000);
        } else {
            showToast(result.error, 'error');
        }
    }
    
    googleBtn?.addEventListener('click', () => handleSocialLogin('google'));
    microsoftBtn?.addEventListener('click', () => handleSocialLogin('microsoft'));
    appleBtn?.addEventListener('click', () => handleSocialLogin('apple'));
    
    // Load remembered email
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    if (rememberedEmail) {
        const emailInput = document.getElementById('loginEmail');
        if (emailInput) emailInput.value = rememberedEmail;
        const rememberCheck = document.getElementById('rememberMe');
        if (rememberCheck) rememberCheck.checked = true;
    }
    
    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    const root = document.documentElement;
    
    themeToggle?.addEventListener('click', () => {
        const current = root.getAttribute('data-theme');
        const newTheme = current === 'light' ? 'dark' : 'light';
        root.setAttribute('data-theme', newTheme);
        themeToggle.innerHTML = newTheme === 'light' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
        showToast(`${newTheme === 'dark' ? 'Dark mode' : 'Light mode'} activated`, 'info');
    });
    
    // Initial notification
    setTimeout(() => {
        showToast('🔐 Welcome to Care Sync - Intelligent Health Platform', 'success');
    }, 500);
    
})();
