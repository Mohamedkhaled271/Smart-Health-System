// firebase.js - Configuration for Helios Medical
const firebaseConfig = {
    apiKey: "AIzaSyDy29ivSun9rqvqTlYhgBI8PBGJhnLJSc0",
    authDomain: "smart-health-monitoring-f97fb.firebaseapp.com",
    databaseURL: "https://smart-health-monitoring-f97fb-default-rtdb.firebaseio.com",
    projectId: "smart-health-monitoring-f97fb",
    storageBucket: "smart-health-monitoring-f97fb.appspot.com",
    messagingSenderId: "756575586382",
    appId: "1:756575586382:web:020a0bfb90f2117126db1f"
};

// Initialize Firebase if not already initialized
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();
const auth = firebase.auth();

// تصدير الكائنات للنافذة العامة لسهولة الوصول من ملفات أخرى
window.db = db;
window.auth = auth;

console.log("🔥 Helios Cloud: Firebase Connected.");
