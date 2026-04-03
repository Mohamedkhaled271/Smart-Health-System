// mqtt.js – Professional IoT Integration for Helios Medical
class MQTTClient {
    constructor() {
        this.client = null;
        this.connected = false;
        // تخزين القيم الحالية لتحديث الرسوم البيانية بشكل صحيح
        this.currentVitals = {
            heart: 0,
            spo2: 0,
            temp: 0
        };
    }

    connect() {
        // الاتصال الآمن بـ HiveMQ (متوافق مع Azure HTTPS)
        const brokerUrl = "wss://broker.hivemq.com:8884/mqtt"; 
        
        const options = {
            clientId: "helios_monitor_" + Math.random().toString(16).substr(2, 8),
            keepalive: 60,
            clean: true,
            reconnectPeriod: 5000,
        };

        this.client = mqtt.connect(brokerUrl, options);
        
        this.client.on('connect', () => {
            console.log('✅ Connected to HiveMQ Broker');
            this.connected = true;
            // الاشتراك في كل ما يخص مشروع HELIOS
            this.client.subscribe('HELIOS_DATA_LIVE/#', (err) => {
                if (!err) console.log('📡 Subscribed to HELIOS_DATA_LIVE Topics');
            });
        });
        
        this.client.on('message', (topic, message) => {
            const data = message.toString();
            console.log(`📥 Data Received: [${topic}] -> ${data}`);
            
            // تمرير البيانات للموقع مباشرة
            this.processIncomingData(topic, data);
        });

        this.client.on('error', (err) => console.error('❌ MQTT Error:', err));
    }

    processIncomingData(topic, data) {
        const val = parseFloat(data);
        if (isNaN(val)) return;

        // تحديث العناصر في الواجهة (UI) وتخزينها في Firebase
        switch(topic) {
            case 'HELIOS_DATA_LIVE/BPM':
                this.updateElement('heartValue', val + ' <span>bpm</span>');
                this.currentVitals.heart = val;
                this.syncToFirebase('BPM', val);
                break;
                
            case 'HELIOS_DATA_LIVE/SPO2':
                this.updateElement('spo2Value', val + ' <span>%</span>');
                this.currentVitals.heart = val;
                this.syncToFirebase('SPO2', val);
                break;
                
            case 'HELIOS_DATA_LIVE/Temp':
                this.updateElement('tempValue', val.toFixed(1) + ' <span>°C</span>');
                this.currentVitals.temp = val;
                this.syncToFirebase('Temp', val);
                break;

            case 'HELIOS_DATA_LIVE/Room':
                this.updateElement('roomTempValue', val.toFixed(1) + ' <span>°C</span>');
                break;
        }

        // تحديث الرسوم البيانية فوراً
        if (typeof window.updateCharts === 'function') {
            window.updateCharts(this.currentVitals.heart, this.currentVitals.spo2, this.currentVitals.temp);
        }
    }

    // دالة لتحديث واجهة المستخدم
    updateElement(id, html) {
        const elem = document.getElementById(id);
        if (elem) {
            elem.innerHTML = html;
            // إضافة تأثير وميض بسيط عند التحديث ليعرف الدكتور أن البيانات حية
            elem.style.animation = "none";
            setTimeout(() => elem.style.animation = "pulse 0.5s", 10);
        }
    }

    // دالة لمزامنة البيانات مع Firebase (اختياري للـ History)
    syncToFirebase(key, value) {
        if (window.db) {
            window.db.ref(`LiveStatus/${key}`).set({
                value: value,
                lastUpdate: Date.now()
            });
        }
    }
}

// تشغيل العميل
window.mqttClient = new MQTTClient();
window.mqttClient.connect();
