/**
 * In-Memory Job State Management & Cleanup Service
 */

const fs   = require('node:fs/promises');
const path = require('node:path');

const jobs = new Map();
const JOB_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Periodically purge expired jobs and their files from memory/disk
 */
setInterval(async () => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > JOB_TTL_MS && job.status !== 'processing') {
      if (job.inputPath)  { try { await fs.unlink(job.inputPath);  } catch {} }
      if (job.outputPath) { try { await fs.unlink(job.outputPath); } catch {} }
      if (job.watermarkPath) { try { await fs.unlink(job.watermarkPath); } catch {} }
      jobs.delete(id);
    }
  }
}, 15 * 60 * 1000);

/**
 * Creates a public view object of a job without internal file paths
 * @param {object} job 
 * @returns {object}
 */
function jobView(job) {
  if (!job) return null;
  const view = {
    id:           job.id,
    status:       job.status,
    progress:     job.progress,
    originalName: job.originalName,
    inputUrl:     job.inputUrl,
    outputUrl:    job.outputUrl
  };
  if (job.stats) view.stats = job.stats;
  if (job.error) view.error = job.error;
  return view;
}

/**
 * Safely parse numbers with fallback
 */
function parseNum(raw, fallback) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

module.exports = {
  jobs,
  jobView,
  parseNum
};
