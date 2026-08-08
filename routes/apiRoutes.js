/**
 * Express API Routes for Video Enhancer
 */

const express    = require('express');
const path       = require('node:path');
const fs         = require('node:fs');
const fsPromises = require('node:fs/promises');

const { isVercel, uploadsDir, outputDir, upload } = require('../lib/storage');
const { jobs, jobView, parseNum } = require('../lib/jobManager');
const { enhanceVideo, DEFAULTS }  = require('../enhance_video');

const router = express.Router();

// ── Explicit File Serving Routes (Handles Vercel/Temp Storage) ────────────────

router.get('/outputs/:filename', async (req, res) => {
  const safeName = path.basename(req.params.filename);
  const filePath = path.join(outputDir, safeName);
  try {
    await fsPromises.access(filePath);
    return res.sendFile(filePath);
  } catch {
    return res.status(404).json({ error: 'Output file not found' });
  }
});

router.get('/uploads/:filename', async (req, res) => {
  const safeName = path.basename(req.params.filename);
  const filePath = path.join(uploadsDir, safeName);
  try {
    await fsPromises.access(filePath);
    return res.sendFile(filePath);
  } catch {
    return res.status(404).json({ error: 'Upload file not found' });
  }
});

// ── Enhancement Processing Endpoint ──────────────────────────────────────────

router.post('/api/enhance', upload.fields([{ name: 'video', maxCount: 1 }, { name: 'watermark', maxCount: 1 }]), async (req, res) => {
  const videoFile = req.files?.video?.[0];
  if (!videoFile) {
    return res.status(400).json({ error: 'No video file uploaded.' });
  }

  const watermarkFile = req.files?.watermark?.[0];
  const jobId         = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const inputPath     = videoFile.path;
  const outputName    = `enhanced-${jobId}.mp4`;
  const outputPath    = path.join(outputDir, outputName);
  const codec         = req.body.codec || 'h265';

  const options = {
    input:      inputPath,
    output:     outputPath,
    codec,
    brightness: parseNum(req.body.brightness, DEFAULTS.brightness),
    contrast:   parseNum(req.body.contrast,   DEFAULTS.contrast),
    highlights: parseNum(req.body.highlights, DEFAULTS.highlights),
    saturation: parseNum(req.body.saturation, DEFAULTS.saturation),
    vibrance:   parseNum(req.body.vibrance,   DEFAULTS.vibrance),
    sharpness:  parseNum(req.body.sharpness,  DEFAULTS.sharpness),
    crf:        parseNum(req.body.crf, codec === 'h265' ? 24 : 20),
    preset:     'fast'
  };

  if (watermarkFile && req.body.hasWatermark !== 'false') {
    options.watermark         = watermarkFile.path;
    options.watermarkPosition = req.body.watermarkPosition || 'bottom-right';
    options.watermarkSize     = parseNum(req.body.watermarkSize, 15);
    options.watermarkOpacity  = parseNum(req.body.watermarkOpacity, 0.9);
    options.watermarkPadding  = parseNum(req.body.watermarkPadding, 70);
    if (req.body.watermarkXPct !== undefined && req.body.watermarkXPct !== '') {
      options.watermarkXPct = parseNum(req.body.watermarkXPct, 100);
    }
    if (req.body.watermarkYPct !== undefined && req.body.watermarkYPct !== '') {
      options.watermarkYPct = parseNum(req.body.watermarkYPct, 100);
    }

    try {
      const latestPath = path.join(uploadsDir, 'latest_logo.png');
      await fsPromises.copyFile(watermarkFile.path, latestPath);
    } catch (e) {
      console.warn('Failed to update latest_logo.png:', e.message);
    }
  }

  const job = {
    id:           jobId,
    status:       'processing',
    progress:     0,
    originalName: videoFile.originalname,
    inputPath,
    outputPath,
    watermarkPath: watermarkFile ? watermarkFile.path : null,
    inputUrl:     `/uploads/${path.basename(inputPath)}`,
    outputUrl:    `/outputs/${outputName}`,
    createdAt:    Date.now()
  };
  jobs.set(jobId, job);

  // In Vercel serverless environment, await processing before responding
  if (isVercel) {
    try {
      const result = await enhanceVideo(options, (pct) => {
        job.progress = pct;
      });
      job.status   = 'completed';
      job.progress = 100;
      job.stats    = {
        inMB:       result.inMB,
        outMB:      result.outMB,
        savingsPct: result.savingsPct,
        codec:      result.codec,
        elapsed:    result.elapsed
      };
      return res.json(jobView(job));
    } catch (err) {
      console.error(`Job ${jobId} failed:`, err.message);
      job.status = 'error';
      job.error  = err.message;
      return res.status(500).json(jobView(job));
    }
  }

  // Local mode: respond immediately and process in background
  res.json(jobView(job));

  try {
    const result = await enhanceVideo(options, (pct) => {
      job.progress = pct;
    });
    job.status   = 'completed';
    job.progress = 100;
    job.stats    = {
      inMB:       result.inMB,
      outMB:      result.outMB,
      savingsPct: result.savingsPct,
      codec:      result.codec,
      elapsed:    result.elapsed
    };
  } catch (err) {
    console.error(`Job ${jobId} failed:`, err.message);
    job.status = 'error';
    job.error  = err.message;
  }
});

// ── Job Status & Polling ──────────────────────────────────────────────────────

router.get('/api/job/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  res.json(jobView(job));
});

// ── Latest Watermark Fallback ─────────────────────────────────────────────────

router.get('/api/latest-watermark', async (_req, res) => {
  const latestPath = path.join(uploadsDir, 'latest_logo.png');
  try {
    await fsPromises.access(latestPath);
    return res.json({
      hasWatermark: true,
      url: '/uploads/latest_logo.png',
      filename: 'watermark.png'
    });
  } catch {}

  try {
    const files = await fsPromises.readdir(uploadsDir);
    const logoFiles = files.filter(f => f.startsWith('logo-') && /\.(png|jpg|jpeg|webp)$/i.test(f));
    if (logoFiles.length > 0) {
      const statsPromises = logoFiles.map(async (file) => {
        const fullPath = path.join(uploadsDir, file);
        const stat = await fsPromises.stat(fullPath);
        return { file, mtime: stat.mtimeMs };
      });
      const logoStats = await Promise.all(statsPromises);
      logoStats.sort((a, b) => b.mtime - a.mtime);

      const latestLogoPath = path.join(uploadsDir, logoStats[0].file);
      await fsPromises.copyFile(latestLogoPath, latestPath);
      return res.json({
        hasWatermark: true,
        url: '/uploads/latest_logo.png',
        filename: 'watermark.png'
      });
    }
  } catch {}

  res.json({ hasWatermark: false });
});

// ── Download File Endpoint ────────────────────────────────────────────────────

router.get('/api/download/:id', async (req, res) => {
  const jobId = req.params.id;
  const job = jobs.get(jobId);
  
  let filePath = job?.outputPath;
  let downloadName = job ? `enhanced_${job.originalName}` : `enhanced_${jobId}.mp4`;

  if (!filePath) {
    // Fallback for stateless Vercel invocations: check outputDir directly
    const candidatePath = path.join(outputDir, `enhanced-${jobId}.mp4`);
    try {
      await fsPromises.access(candidatePath);
      filePath = candidatePath;
    } catch {
      const rawPath = path.join(outputDir, jobId);
      try {
        await fsPromises.access(rawPath);
        filePath = rawPath;
        downloadName = jobId;
      } catch {}
    }
  }

  if (!filePath) {
    return res.status(404).json({ error: 'Enhanced video file not found.' });
  }

  res.download(filePath, downloadName, (err) => {
    if (err && !res.headersSent) {
      res.status(500).json({ error: 'Download failed.' });
    }
  });
});

module.exports = router;
