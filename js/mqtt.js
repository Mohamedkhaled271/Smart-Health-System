// mqtt.js - (Firebase Realtime Sync Edition)
// هذا الملف الآن يربط الموقع بقاعدة البيانات مباشرة لضمان استقرار 100%

function startLiveSync() {
    console.log("🔗 Connecting to Helios Cloud Database...");

    // التأكد من أن Firebase تم تعريفه في ملف الـ HTML أولاً
    if (typeof firebase === 'undefined') {
        console.error("❌ Firebase SDK is missing! Check your HTML file.");
        return;
    }

    // المرجع الخاص بالبيانات الحيوية (مطابق لكود الـ ESP32)
    const vitalsRef = firebase.database().ref('/HELIOS_DATA_LIVE/Vitals');

    // التنصت على أي تغيير في البيانات فور حدوثه
    vitalsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        
        if (data) {
            console.log("📥 New Data Received from Cloud:", data);
            
            // 1. تحديث نبض القلب
            updateUI('heartValue', data.HeartRate, 'bpm');

            // 2. تحديث نسبة الأكسجين
            updateUI('spo2Value', data.SpO2, '%');

            // 3. تحديث حرارة الجسم
            updateUI('tempValue', data.BodyTemp ? data.BodyTemp.toFixed(1) : "--", '°C');

            // 4. تحديث الرسوم البيانية (Charts)
            if (typeof window.updateCharts === 'function') {
                window.updateCharts(data.HeartRate || 0, data.SpO2 || 0, data.BodyTemp || 0);
            }
        }
    }, (error) => {
        console.error("❌ Database Read Error:", error);
    });
}

// دالة مساعدة لتحديث العناصر في الموقع بلمسة جمالية
function updateUI(id, value, unit) {
    const elem = document.getElementById(id);
    if (elem && value !== undefined) {
        elem.innerHTML = `${value} <span>${unit}</span>`;
        
        // تأثير وميض (Pulse) بسيط عند التحديث
        elem.style.transition = "0.3s";
        elem.style.color = "#00ffcc"; // لون التنبيه
        setTimeout(() => {
            elem.style.color = ""; // العودة للون الأصلي
        }, 500);
    }
}

// تشغيل المزامنة فور تحميل الملف
startLiveSync();
