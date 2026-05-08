// server.js - Helios Frontend for Azure App Service
const express = require('express');
const path = require('path');
const app = express();

// Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// CORS middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// ========== 1. خدمة الملفات الثابتة (الأولوية القصوى) ==========
// هذا السطر هو الحل الكامل للمشكلة
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

// ========== 2. SPA Routing: إرسال index.html فقط للطلبات التي ليست ملفات ==========
// هذا الـ middleware سيتعامل مع أي طلب لم تتم خدمته بواسطة express.static
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Listen on Azure port
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`🚀 Helios frontend running on port ${port}`);
});
