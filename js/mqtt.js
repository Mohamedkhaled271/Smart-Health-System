// mqtt.js – النسخة النهائية المتوافقة مع كود ESP32
class MQTTClient {
    constructor() {
        this.client = null;
        this.connected = false;
        // تخزين القيم الحالية لضمان تحديث الرسوم البيانية بشكل متزامن
        this.currentVitals = {
            heart: 0,
            spo2: 0,
            temp: 0
        };
    }

    connect() {
        // الربط مع HiveMQ عبر WebSockets المشفرة (المنفذ 8884 ضروري لعمل Azure HTTPS)
        const brokerUrl = "wss://broker.hivemq.com:8884/mqtt"; 
        
        const options = {
            clientId: "helios_monitor_web_" + Math.random().toString(16).substr(2, 8),
            keepalive: 60,
            clean: true,
            reconnectPeriod: 5000,
        };

        console.log('⏳ جاري الاتصال بـ MQTT Broker...');
        this.client = mqtt.connect(brokerUrl, options);
        
        this.client.on('connect', () => {
            console.log('✅ تم الاتصال بنجاح بـ HiveMQ');
            this.connected = true;
            
            // الاشتراك في العناوين التي يرسلها الـ ESP32 بالضبط
            const topics = [
                'health/patient/heartrate',
                'health/patient/spo2',
                'health/patient/bodytemp'
            ];

            topics.forEach(t => {
                this.client.subscribe(t, (err) => {
                    if (!err) console.log(`📡 مشترك الآن في: ${t}`);
                });
            });
        });
        
        this.client.on('message', (topic, message) => {
            const data = message.toString();
            console.log(`📥 بيانات مستلمة: [${topic}] -> ${data}`);
            
            // تمرير البيانات لمعالجتها وتحديث الواجهة
            this.processIncomingData(topic, data);
        });

        this.client.on('error', (err) => console.error('❌ MQTT Error:', err));
        this.client.on('close', () => {
            console.warn('⚠️ انقطع الاتصال بـ MQTT، جاري المحاولة مرة أخرى...');
            this.connected = false;
        });
    }

    processIncomingData(topic, data) {
        const val = parseFloat(data);
        if (isNaN(val)) return;

        // مطابقة العنوان مع العنصر المطلوب تحديثه في صفحة الـ Dashboard
        switch(topic) {
            case 'health/patient/heartrate':
                this.updateElement('heartValue', Math.round(val) + ' <span>bpm</span>');
                this.currentVitals.heart = val;
                this.syncToFirebase('HeartRate', val);
                break;
                
            case 'health/patient/spo2':
                this.updateElement('spo2Value', Math.round(val) + ' <span>%</span>');
                this.currentVitals.spo2 = val;
                this.syncToFirebase('SpO2', val);
                break;
                
            case 'health/patient/bodytemp':
                this.updateElement('tempValue', val.toFixed(1) + ' <span>°C</span>');
                this.currentVitals.temp = val;
                this.syncToFirebase('BodyTemp', val);
                break;
        }

        // تحديث الرسوم البيانية الحية (Charts)
        if (typeof window.updateCharts === 'function') {
            window.updateCharts(this.currentVitals.heart, this.currentVitals.spo2, this.currentVitals.temp);
        }
    }

    // دالة تحديث العناصر في الـ HTML
    updateElement(id, html) {
        const elem = document.getElementById(id);
        if (elem) {
            elem.innerHTML = html;
            // إضافة تأثير نبض (Pulse) بسيط عند وصول بيانات جديدة
            elem.style.animation = "none";
            setTimeout(() => elem.style.animation = "pulse 0.5s", 10);
        }
    }

    // مزامنة اختيارية مع Firebase لضمان تحديث قاعدة البيانات من جهة الموقع أيضاً
    syncToFirebase(key, value) {
        if (window.db) {
            window.db.ref(`HELIOS_DATA_LIVE/Vitals/${key}`).set(value);
        }
    }
}

// تشغيل النظام
window.mqttClient = new MQTTClient();
window.mqttClient.connect();
