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
