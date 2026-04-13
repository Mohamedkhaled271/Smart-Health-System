// ==================== AUTH.JS - المعدل بالكامل ====================

// متغير لمنع إعادة التوجيه أثناء Logout
let logoutInProgress = false;

// تسجيل الخروج
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Are you sure you want to logout?')) {
            logoutInProgress = true;
            // حفظ فلاج في sessionStorage عشان نتذكره
            sessionStorage.setItem('logout_in_progress', 'true');
            localStorage.setItem('logout_in_progress', 'true');
            
            firebase.auth().signOut().then(() => {
                console.log("✅ Logout successful");
                window.location.replace('index.html?logout=true');
            }).catch((error) => {
                console.error("Logout error:", error);
                window.location.replace('index.html?logout=true');
            });
        }
    });
}

// التحقق من حالة تسجيل الدخول (معدل)
firebase.auth().onAuthStateChanged((user) => {
    // منع إعادة التوجيه أثناء عملية Logout
    const isLogoutFlag = sessionStorage.getItem('logout_in_progress') === 'true' || 
                         localStorage.getItem('logout_in_progress') === 'true';
    
    if (logoutInProgress || isLogoutFlag) {
        console.log("⏸️ Logout in progress - ignoring auth change");
        return;
    }
    
    const path = window.location.pathname.split('/').pop();
    const currentPage = path === '' ? 'index.html' : path;
    
    // إذا كان المستخدم غير مسجل دخول وهو في صفحة داخلية → روح لـ index.html
    if (!user && currentPage !== 'index.html') {
        console.log("🚫 No user, redirecting to index.html");
        window.location.href = 'index.html';
        return;
    }
    
    // إذا كان المستخدم مسجل دخول وهو في index.html → روح للصفحة المناسبة
    if (user && currentPage === 'index.html') {
        console.log("👤 User logged in on index, checking role...");
        
        // تأخير بسيط للتأكد من عدم وجود Logout قيد التنفيذ
        setTimeout(() => {
            if (logoutInProgress || sessionStorage.getItem('logout_in_progress') === 'true') {
                console.log("⏸️ Logout detected during redirect, cancelling");
                return;
            }
            
            firebase.database().ref('users/' + user.uid).once('value').then((snap) => {
                const role = snap.val()?.role;
                console.log("📌 User role:", role);
                
                if (role === 'patient') {
                    window.location.href = 'patient.html';
                } else if (role === 'doctor') {
                    window.location.href = 'doctor.html';
                } else if (role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    console.warn("⚠️ Unknown role:", role);
                }
            }).catch((err) => {
                console.error("Error fetching role:", err);
            });
        }, 100);
    }
});

// عند تحميل الصفحة، امسح فلاج logout إذا كان في index.html
if (window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname === '') {
    // مسح فلاج logout بعد 2 ثانية
    setTimeout(() => {
        sessionStorage.removeItem('logout_in_progress');
        localStorage.removeItem('logout_in_progress');
        logoutInProgress = false;
    }, 2000);
}
