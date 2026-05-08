// server.js - Helios Frontend for Azure App Service
const express = require('express');
const path = require('path');
const app = express();

// Optional: Log requests (for debugging)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Optional: Allow CORS for external API calls
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// ========== الحل الأساسي ==========
// خدمة الملفات الثابتة (الصور، CSS، JS، إلخ)
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
    }
  }
}));

// ========== التعديل المهم هنا ==========
// أي طلب لملف موجود بالفعل - يخدمه مباشرة
// أي طلب تاني (مش ملف) - يروح لـ index.html
app.get(/\.(png|jpg|jpeg|gif|svg|css|js|json|pdf|ico|webp)$/, (req, res, next) => {
  // الملفات دي خلاص اتعاملت معاها من express.static
  next();
});

// SPA routing: فقط اللي مش ملف ثابت يروح لـ index.html
app.get('*', (req, res) => {
  // لو الطلب لأي ملف موجود - نخدمه مباشرة
  const filePath = path.join(__dirname, req.path);
  res.sendFile(filePath, err => {
    if (err) {
      res.sendFile(path.join(__dirname, 'index.html'));
    }
  });
});

// Listen on Azure port
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`🚀 Helios frontend running on port ${port}`);
});
