/**
 * Express 5 Video Enhancement Server (v3.0 - Refactored)
 */

const express = require('express');
const path    = require('node:path');
const { isVercel, uploadsDir, outputDir } = require('./lib/storage');
const apiRoutes = require('./routes/apiRoutes');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Global Middleware ────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));
app.use('/outputs', express.static(outputDir));

// ── Mount API Routes ────────────────────────────────────────────────────────
app.use('/', apiRoutes);

// ── Global Error Handler ───────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Express Error:', err.message || err);
  const status = err.status || err.statusCode || 500;
  const msg = err.code === 'LIMIT_FILE_SIZE'
    ? 'File size exceeds maximum upload limit (4.5MB on Vercel serverless).'
    : (err.message || 'An internal server error occurred.');
  res.status(status).json({ error: msg });
});

// ── Start Server Listener ───────────────────────────────────────────────────
if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`\n  Video Enhancement Server running on http://localhost:${PORT}\n`);
  });
}

module.exports = app;
