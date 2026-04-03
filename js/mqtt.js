// mqtt.js - (Firebase Realtime Sync Edition for Helios Medical)
function startLiveSync() {
    console.log("🔗 Connecting to Live Stream...");

    if (typeof window.db === 'undefined') {
        console.error("❌ Firebase DB not found! Check firebase.js");
        return;
    }

    // المرجع مطابق لكود الـ ESP32: /HELIOS_DATA_LIVE/Vitals
    // ملحوظة: الـ ESP32 بيستخدم updateNode بداخلها Vitals
    const vitalsRef = window.db.ref('/HELIOS_DATA_LIVE/Vitals');

    vitalsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        
        if (data) {
            console.log("📥 New Vitals Received:", data);
            
            // 1. تحديث نبض القلب (HeartRate)
            updateUI('heartValue', data.HeartRate, 'bpm');

            // 2. تحديث نسبة الأكسجين (SpO2)
            updateUI('spo2Value', data.SpO2, '%');

            // 3. تحديث حرارة الجسم (BodyTemp)
            const temp = data.BodyTemp ? parseFloat(data.BodyTemp).toFixed(1) : "--";
            updateUI('tempValue', temp, '°C');

            // 4. تحديث الرسوم البيانية (Charts)
            if (typeof window.updateCharts === 'function') {
                window.updateCharts(data.HeartRate || 0, data.SpO2 || 0, data.BodyTemp || 0);
            }

            // تحديث حالة النظام في الـ Dashboard
            const alertElem = document.getElementById('activeAlertsCount');
            if (alertElem) alertElem.innerText = "0"; // أو برمج منطق الإنذار هنا
            
        } else {
            console.warn("⚠️ Waiting for ESP32 data at path: /HELIOS_DATA_LIVE/Vitals");
        }
    }, (error) => {
        console.error("❌ Connection Error:", error);
    });
}

function updateUI(id, value, unit) {
    const elem = document.getElementById(id);
    if (elem && value !== undefined && value !== null) {
        // تحديث الرقم مع الـ Unit
        elem.innerHTML = `${value} <small>${unit}</small>`;
        
        // تأثير بصري (وميض خفيف عند وصول بيانات جديدة)
        elem.classList.add('data-update-pulse');
        setTimeout(() => elem.classList.remove('data-update-pulse'), 500);
    }
}

// البدء عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', startLiveSync);
