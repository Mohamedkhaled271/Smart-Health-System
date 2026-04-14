// ==================== MAIN SCRIPT ==================== 
(function() {
  // Preloader fade out
  window.addEventListener('load', () => {
    document.getElementById('preloader').classList.add('fade-out');
  });

  // Toggle password
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', function() {
      const target = document.getElementById(this.dataset.target);
      if (target.type === 'password') {
        target.type = 'text';
        this.classList.replace('fa-eye', 'fa-eye-slash');
      } else {
        target.type = 'password';
        this.classList.replace('fa-eye-slash', 'fa-eye');
      }
    });
  });

  // Tab switching
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  loginTab.addEventListener('click', () => {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
  });
  registerTab.addEventListener('click', () => {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  });

  // Toast function
  function showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.style.background = type === 'error' ? '#ef4444' : (type === 'success' ? '#10b981' : 'var(--toast-bg)');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }

  // Profile image preview
  document.getElementById('profileUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(ev) {
        document.getElementById('profilePreview').src = ev.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  // Password strength
  const regPass = document.getElementById('regPassword');
  const strengthFill = document.getElementById('strengthFill');
  const strengthLabel = document.getElementById('strengthLabel');
  regPass.addEventListener('input', function() {
    const pwd = this.value;
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;
    let width = 0, text = 'Weak', color = '#ef4444';
    if (score <= 2) { width = 30; text = 'Weak'; }
    else if (score <= 4) { width = 70; text = 'Medium'; color = '#f59e0b'; }
    else { width = 100; text = 'Strong'; color = '#10b981'; }
    strengthFill.style.width = width + '%';
    strengthFill.style.background = color;
    strengthLabel.innerText = text;
  });

  // Email hint
  document.getElementById('regEmail').addEventListener('input', function() {
    const email = this.value;
    const hint = document.getElementById('emailHint');
    if (email && !/^\S+@\S+\.\S+$/.test(email)) hint.innerText = '✗ Invalid format';
    else hint.innerText = '';
  });

  // Confirm password hint
  const regConfirm = document.getElementById('regConfirm');
  function checkMatch() {
    const hint = document.getElementById('registerError');
    if (regConfirm.value && regConfirm.value !== regPass.value) {
      document.getElementById('registerError').innerText = 'Passwords do not match';
    } else {
      document.getElementById('registerError').innerText = '';
    }
  }
  regConfirm.addEventListener('input', checkMatch);
  regPass.addEventListener('input', checkMatch);

  // ==================== EMAIL/PASSWORD LOGIN ====================
  document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginBtn');
    const original = btn.innerHTML;

    if (!email || !password) {
      showToast('Please enter email and password', 'error');
      return;
    }

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
    btn.disabled = true;

    try {
      const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
      const user = userCredential.user;
      const snapshot = await firebase.database().ref(`users/${user.uid}/role`).once('value');
      const role = snapshot.val();

      if (!role) {
        showToast('User role not found. Contact admin.', 'error');
        btn.innerHTML = original;
        btn.disabled = false;
        return;
      }

      if (role === 'doctor') window.location.href = 'doctor.html';
      else if (role === 'patient') window.location.href = 'patient.html';
      else if (role === 'admin') window.location.href = 'admin.html';
      else {
        showToast('Invalid role assigned', 'error');
        btn.innerHTML = original;
        btn.disabled = false;
      }
    } catch (error) {
      console.error('Login error:', error);
      let errorMsg = 'Login failed. ';
      switch (error.code) {
        case 'auth/user-not-found':
          errorMsg += 'User not found.';
          break;
        case 'auth/wrong-password':
          errorMsg += 'Wrong password.';
          break;
        case 'auth/invalid-email':
          errorMsg += 'Invalid email format.';
          break;
        case 'auth/user-disabled':
          errorMsg += 'Account disabled.';
          break;
        default:
          errorMsg += error.message;
      }
      showToast(errorMsg, 'error');
      btn.innerHTML = original;
      btn.disabled = false;
    }
  });

  // ==================== EMAIL/PASSWORD REGISTRATION ====================
  document.getElementById('registerForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    if (!document.getElementById('termsCheck').checked) {
      showToast('You must accept terms and conditions', 'error');
      return;
    }

    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regConfirm').value;
    const role = document.getElementById('regRole').value;

    if (!name || !email || !password || !confirm || !role) {
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

    const btn = document.getElementById('registerBtn');
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    btn.disabled = true;

    try {
      const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      await firebase.database().ref(`users/${user.uid}`).set({
        name: name,
        email: email,
        role: role,
        createdAt: firebase.database.ServerValue.TIMESTAMP
      });

      // Optional: upload profile picture (to be implemented)
      const profileFile = document.getElementById('profileUpload').files[0];
      if (profileFile) {
        console.log('Profile picture would be uploaded to Storage');
      }

      showToast('Account created successfully! Redirecting...', 'success');
      setTimeout(() => {
        if (role === 'doctor') window.location.href = 'doctor.html';
        else if (role === 'patient') window.location.href = 'patient.html';
        else if (role === 'admin') window.location.href = 'admin.html';
        else window.location.href = 'index.html';
      }, 1500);

    } catch (error) {
      console.error('Registration error:', error);
      let errorMsg = 'Registration failed. ';
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMsg += 'Email already registered.';
          break;
        case 'auth/invalid-email':
          errorMsg += 'Invalid email format.';
          break;
        case 'auth/weak-password':
          errorMsg += 'Password too weak.';
          break;
        default:
          errorMsg += error.message;
      }
      showToast(errorMsg, 'error');
      btn.innerHTML = original;
      btn.disabled = false;
    }
  });

  // ==================== SOCIAL LOGIN ====================

  // Helper function to show role selection modal
  function showRoleSelectionModal(user) {
    return new Promise((resolve, reject) => {
      const modal = document.createElement('div');
      modal.className = 'role-modal';
      modal.style.position = 'fixed';
      modal.style.top = '0';
      modal.style.left = '0';
      modal.style.width = '100%';
      modal.style.height = '100%';
      modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
      modal.style.display = 'flex';
      modal.style.alignItems = 'center';
      modal.style.justifyContent = 'center';
      modal.style.zIndex = '9999';

      const content = document.createElement('div');
      content.style.backgroundColor = 'var(--card-bg, #fff)';
      content.style.padding = '2rem';
      content.style.borderRadius = '1rem';
      content.style.maxWidth = '400px';
      content.style.width = '90%';
      content.style.boxShadow = '0 20px 25px -5px rgba(0,0,0,0.1)';
      content.style.textAlign = 'center';

      content.innerHTML = `
        <h3 style="margin-top:0; color:var(--text-primary)">Welcome, ${user.displayName || user.email}!</h3>
        <p style="margin:1rem 0; color:var(--text-secondary)">Please select your role to continue:</p>
        <select id="roleSelect" style="width:100%; padding:0.75rem; border-radius:0.5rem; border:1px solid #ccc; margin-bottom:1rem;">
          <option value="patient">Patient</option>
          <option value="doctor">Doctor</option>
          <option value="admin">Admin</option>
        </select>
        <button id="confirmRoleBtn" style="background:#2563eb; color:white; border:none; padding:0.75rem 1.5rem; border-radius:0.5rem; cursor:pointer; width:100%;">Continue</button>
      `;

      modal.appendChild(content);
      document.body.appendChild(modal);

      const confirmBtn = content.querySelector('#confirmRoleBtn');
      const roleSelect = content.querySelector('#roleSelect');
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

  // Google Sign-In
  const googleBtn = document.getElementById('googleBtn');
  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      try {
        const result = await firebase.auth().signInWithPopup(provider);
        const user = result.user;

        const snapshot = await firebase.database().ref(`users/${user.uid}`).once('value');
        if (!snapshot.exists()) {
          const selectedRole = await showRoleSelectionModal(user);
          await firebase.database().ref(`users/${user.uid}`).set({
            name: user.displayName || user.email,
            email: user.email,
            role: selectedRole,
            createdAt: firebase.database.ServerValue.TIMESTAMP
          });
          showToast(`Welcome! Redirecting to ${selectedRole} dashboard...`, 'success');
          if (selectedRole === 'doctor') window.location.href = 'doctor.html';
          else if (selectedRole === 'admin') window.location.href = 'admin.html';
          else window.location.href = 'patient.html';
        } else {
          const role = snapshot.val().role;
          showToast(`Welcome back! Redirecting...`, 'success');
          if (role === 'doctor') window.location.href = 'doctor.html';
          else if (role === 'admin') window.location.href = 'admin.html';
          else window.location.href = 'patient.html';
        }
      } catch (error) {
        console.error('Google sign-in error:', error);
        showToast(error.message, 'error');
      }
    });
  }

  // Microsoft Sign-In
  const microsoftBtn = document.getElementById('microsoftBtn');
  if (microsoftBtn) {
    microsoftBtn.addEventListener('click', async () => {
      const provider = new firebase.auth.OAuthProvider('microsoft.com');
      try {
        const result = await firebase.auth().signInWithPopup(provider);
        const user = result.user;

        const snapshot = await firebase.database().ref(`users/${user.uid}`).once('value');
        if (!snapshot.exists()) {
          const selectedRole = await showRoleSelectionModal(user);
          await firebase.database().ref(`users/${user.uid}`).set({
            name: user.displayName || user.email,
            email: user.email,
            role: selectedRole,
            createdAt: firebase.database.ServerValue.TIMESTAMP
          });
          showToast(`Welcome! Redirecting to ${selectedRole} dashboard...`, 'success');
          if (selectedRole === 'doctor') window.location.href = 'doctor.html';
          else if (selectedRole === 'admin') window.location.href = 'admin.html';
          else window.location.href = 'patient.html';
        } else {
          const role = snapshot.val().role;
          showToast(`Welcome back! Redirecting...`, 'success');
          if (role === 'doctor') window.location.href = 'doctor.html';
          else if (role === 'admin') window.location.href = 'admin.html';
          else window.location.href = 'patient.html';
        }
      } catch (error) {
        console.error('Microsoft sign-in error:', error);
        showToast(error.message, 'error');
      }
    });
  }

  // Apple Sign-In (requires additional configuration)
  const appleBtn = document.getElementById('appleBtn');
  if (appleBtn) {
    appleBtn.addEventListener('click', () => {
      showToast('Apple Sign-In requires additional configuration. Please use Google or Microsoft.', 'info');
    });
  }

  // Forgot password
  document.getElementById('forgotPassword').addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    if (!email) {
      showToast('Please enter your email first', 'error');
      return;
    }
    try {
      await firebase.auth().sendPasswordResetEmail(email);
      showToast('Password reset email sent', 'success');
    } catch (error) {
      showToast('Failed to send reset email: ' + error.message, 'error');
    }
  });

  // AI Assistant
  const aiBtn = document.getElementById('aiBtn');
  const aiPopup = document.getElementById('aiPopup');
  aiBtn.addEventListener('click', () => {
    aiPopup.classList.toggle('show');
  });

  // ReCaptcha fake
  document.querySelector('.fake-recaptcha').addEventListener('click', function() {
    this.innerHTML = '<i class="fas fa-check-circle"></i> Verified';
    this.style.background = '#10b981';
    this.style.color = 'white';
  });

  // micro-interactions: pulse on login btn
  document.querySelector('.btn-login').classList.add('pulse-once');
})();
