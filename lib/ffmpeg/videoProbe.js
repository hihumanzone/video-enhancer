/**
 * FFmpeg Video Dimension Probe Module
 */

const fs = require('node:fs');
const { spawn } = require('node:child_process');
const ffmpegPath = require('ffmpeg-static');

// Ensure ffmpeg-static binary is executable (Vercel serverless / Linux)
if (ffmpegPath && fs.existsSync(ffmpegPath)) {
  try {
    fs.chmodSync(ffmpegPath, 0o755);
  } catch {
    /* Ignore permissions error on Windows / read-only FS */
  }
}

/**
 * Probes video file to extract width, height, and audio presence.
 * @param {string} filePath - Absolute path to video file
 * @returns {Promise<{width: number, height: number, hasAudio: boolean}>}
 */
function probeVideoInfo(filePath) {
  return probeWithFfmpeg(filePath);
}

/**
 * Probes video file to extract width and height.
 * @param {string} filePath - Absolute path to video file
 * @returns {Promise<{width: number, height: number}>}
 */
function probeVideoDimensions(filePath) {
  return probeVideoInfo(filePath).then(info => ({ width: info.width, height: info.height }));
}

function probeWithFfmpeg(filePath) {
  return new Promise((resolve) => {
    const proc = spawn(ffmpegPath, ['-i', filePath, '-f', 'null', '-']);
    let stderr = '';
    proc.stderr.on('data', d => stderr += d.toString());
    proc.on('close', () => {
      const match = stderr.match(/(\d{2,5})x(\d{2,5})/);
      const hasAudio = /Stream #.*: Audio:/.test(stderr);
      resolve({
        width: match ? parseInt(match[1], 10) : 1920,
        height: match ? parseInt(match[2], 10) : 1080,
        hasAudio
      });
    });
    proc.on('error', () => {
      resolve({ width: 1920, height: 1080, hasAudio: true });
    });
  });
}

module.exports = { probeVideoDimensions, probeVideoInfo };
