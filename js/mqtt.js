// mqtt.js - (Firebase Realtime Sync Edition)
function startLiveSync() {
    console.log("🔗 Connecting to Helios Cloud Database...");

    if (typeof window.db === 'undefined') {
        console.error("❌ Firebase Database is not initialized! Check firebase.js");
        return;
    }

    // المرجع مطابق لكود الـ ESP32: /HELIOS_DATA_LIVE/Vitals
    const vitalsRef = window.db.ref('/HELIOS_DATA_LIVE/Vitals');

    vitalsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        
        if (data) {
            console.log("📥 Data from Cloud:", data);
            
            // 1. تحديث نبض القلب (لاحظ أن H و R كابيتال كما في الـ ESP32)
            updateUI('heartValue', data.HeartRate, 'bpm');

            // 2. تحديث نسبة الأكسجين (S و O كابيتال)
            updateUI('spo2Value', data.SpO2, '%');

            // 3. تحديث حرارة الجسم (B و T كابيتال)
            updateUI('tempValue', data.BodyTemp ? data.BodyTemp.toFixed(1) : "--", '°C');

            // 4. تحديث الرسوم البيانية
            if (typeof window.updateCharts === 'function') {
                window.updateCharts(data.HeartRate || 0, data.SpO2 || 0, data.BodyTemp || 0);
            }
        } else {
            console.warn("⚠️ No data found at path: /HELIOS_DATA_LIVE/Vitals");
        }
    }, (error) => {
        console.error("❌ Database Read Error:", error);
    });
}

function updateUI(id, value, unit) {
    const elem = document.getElementById(id);
    if (elem && value !== undefined) {
        elem.innerHTML = `${value} <span>${unit}</span>`;
        
        // تأثير وميض عند التحديث
        elem.style.color = "#00ffcc";
        setTimeout(() => { elem.style.color = ""; }, 500);
    }
}

// البدء عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', startLiveSync);
