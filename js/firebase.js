// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDy29ivSun9rqvqTlYhgBI8PBGJhnLJSc0",
    authDomain: "smart-health-monitoring-f97fb.firebaseapp.com",
    databaseURL: "https://smart-health-monitoring-f97fb-default-rtdb.firebaseio.com/", // أضفنا / في النهاية
    projectId: "smart-health-monitoring-f97fb",
    storageBucket: "smart-health-monitoring-f97fb.appspot.com",
    messagingSenderId: "756575586382",
    appId: "1:756575586382:web:020a0bfb90f2117126db1f",
    measurementId: "G-7BP1801HHC"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();
const auth = firebase.auth();

// تصدير الكائنات للنافذة العامة لضمان وصول الملفات الأخرى لها
window.db = db;
window.auth = auth;

console.log("✅ Firebase Initialized & Ready");
