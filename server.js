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

// Serve all files in project root (css, js, lib, assets, pdfs)
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
    }
  }
}));

// SPA routing: Redirect all other requests to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Listen on Azure port
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`🚀 Helios frontend running on port ${port}`);
});
