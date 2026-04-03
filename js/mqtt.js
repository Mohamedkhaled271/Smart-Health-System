// mqtt.js – Real MQTT Client with WebSocket (Updated for HiveMQ)
class MQTTClient {
    constructor() {
        this.client = null;
        this.listeners = {};
        this.connected = false;
        this.reconnectAttempts = 0;
        this.currentHeart = null;
        this.currentSpo2 = null;
        this.currentTemp = null;
    }

    connect() {
        // --- التعديل هنا ---
        // HiveMQ Public Broker WebSocket URL
        // نستخدم المنفذ 8884 للاتصال الآمن عبر المتصفح
        const brokerUrl = "wss://broker.hivemq.com:8884/mqtt"; 
        
        const options = {
            clientId: "web_patient_monitor_" + Math.random().toString(16).substr(2, 8),
            keepalive: 60,
            clean: true,
            reconnectPeriod: 5000,
            connectTimeout: 30 * 1000,
        };
        // ------------------

        this.client = mqtt.connect(brokerUrl, options);
        
        this.client.on('connect', () => {
            console.log('Connected to HiveMQ Broker');
            this.connected = true;
            this.reconnectAttempts = 0;
            this.subscribeToTopics();
        });
        
        this.client.on('message', (topic, message) => {
            const data = message.toString();
            console.log(`MQTT message on ${topic}: ${data}`);
            
            if (this.listeners[topic]) {
                this.listeners[topic].forEach(cb => cb(data));
            }
            if (this.listeners['#']) {
                this.listeners['#'].forEach(cb => cb(topic, data));
            }
        });
        
        this.client.on('error', (err) => {
            console.error('MQTT error:', err);
        });
        
        this.client.on('reconnect', () => {
            console.log('MQTT reconnecting to HiveMQ...');
        });
    }
    
    subscribe(topic, callback) {
        if (!this.client) {
            console.warn('MQTT client not connected');
            return () => {};
        }
        this.client.subscribe(topic, (err) => {
            if (err) console.error(`Subscribe error to ${topic}:`, err);
            else console.log(`Subscribed to ${topic}`);
        });
        if (!this.listeners[topic]) this.listeners[topic] = [];
        this.listeners[topic].push(callback);
        
        return () => {
            this.listeners[topic] = this.listeners[topic].filter(cb => cb !== callback);
        };
    }

    subscribeToTopics() {
        // نفس بقية الوظائف الخاصة بك بدون تغيير
        this.subscribe('health/patient/heartrate', (data) => {
            const heart = parseInt(data);
            if (!isNaN(heart)) {
                this.currentHeart = heart;
                const heartElem = document.getElementById('heartValue');
                if (heartElem) heartElem.innerHTML = heart + ' <span>bpm</span>';
                if (typeof updateCharts === 'function') {
                    updateCharts(heart, this.currentSpo2, this.currentTemp);
                }
                if (window.db) {
                    window.db.ref('SensorReadings/heartrate').push({
                        value: heart,
                        timestamp: firebase.database.ServerValue.TIMESTAMP
                    });
                }
            }
        });

        this.subscribe('health/patient/spo2', (data) => {
            const spo2 = parseInt(data);
            if (!isNaN(spo2)) {
                this.currentSpo2 = spo2;
                const spo2Elem = document.getElementById('spo2Value');
                if (spo2Elem) spo2Elem.innerHTML = spo2 + ' <span>%</span>';
                if (typeof updateCharts === 'function') {
                    updateCharts(this.currentHeart, spo2, this.currentTemp);
                }
            }
        });

        this.subscribe('health/patient/bodytemp', (data) => {
            const temp = parseFloat(data);
            if (!isNaN(temp)) {
                this.currentTemp = temp;
                const tempElem = document.getElementById('tempValue');
                if (tempElem) tempElem.innerHTML = temp.toFixed(1) + ' <span>°C</span>';
                if (typeof updateCharts === 'function') {
                    updateCharts(this.currentHeart, this.currentSpo2, temp);
                }
            }
        });

        this.subscribe('health/room/temp', (data) => {
            const roomTemp = parseFloat(data);
            const elem = document.getElementById('roomTempValue');
            if (elem && !isNaN(roomTemp)) elem.innerHTML = roomTemp.toFixed(1) + ' <span>°C</span>';
        });

        this.subscribe('health/room/humidity', (data) => {
            const humidity = parseInt(data);
            const elem = document.getElementById('humidityValue');
            if (elem && !isNaN(humidity)) elem.innerHTML = humidity + ' <span>%</span>';
        });

        this.subscribe('health/patient/position', (data) => {
            const elem = document.getElementById('positionValue');
            if (elem) elem.innerText = data;
        });

        this.subscribe('alert', (data) => {
            console.warn('Alert:', data);
            const alertsList = document.getElementById('alertsList');
            if (alertsList) {
                const alertDiv = document.createElement('div');
                alertDiv.className = 'alert-item';
                alertDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i><div class="alert-content"><div class="alert-title">${data}</div><div class="alert-time">${new Date().toLocaleTimeString()}</div></div>`;
                alertsList.prepend(alertDiv);
                if (alertsList.children.length > 10) alertsList.removeChild(alertsList.lastChild);
            }
            if (typeof alertSound === 'function') alertSound('danger');
        });
    }
}

// Create the global object and start connection
window.mqttClient = new MQTTClient();
window.mqttClient.connect();
