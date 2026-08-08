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
 * Probes video file to extract width and height.
 * @param {string} filePath - Absolute path to video file
 * @returns {Promise<{width: number, height: number}>}
 */
function probeVideoDimensions(filePath) {
  return new Promise((resolve, reject) => {
    const args = ['-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', filePath];
    const ffprobePath = ffmpegPath ? ffmpegPath.replace(/ffmpeg(\.exe)?$/, 'ffprobe$1') : null;

    if (ffprobePath && fs.existsSync(ffprobePath)) {
      const proc = spawn(ffprobePath, args);
      let stdout = '';
      proc.stdout.on('data', d => stdout += d.toString());
      proc.on('close', (code) => {
        const parts = stdout.trim().split('x').map(Number);
        if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
          resolve({ width: parts[0], height: parts[1] });
        } else {
          probeWithFfmpeg(filePath).then(resolve).catch(reject);
        }
      });
      proc.on('error', () => {
        probeWithFfmpeg(filePath).then(resolve).catch(reject);
      });
    } else {
      probeWithFfmpeg(filePath).then(resolve).catch(reject);
    }
  });
}

function probeWithFfmpeg(filePath) {
  return new Promise((resolve) => {
    const proc = spawn(ffmpegPath, ['-i', filePath, '-f', 'null', '-']);
    let stderr = '';
    proc.stderr.on('data', d => stderr += d.toString());
    proc.on('close', () => {
      const match = stderr.match(/(\d{2,5})x(\d{2,5})/);
      if (match) {
        resolve({ width: parseInt(match[1], 10), height: parseInt(match[2], 10) });
      } else {
        resolve({ width: 1920, height: 1080 }); // Safe fallback
      }
    });
    proc.on('error', () => {
      resolve({ width: 1920, height: 1080 });
    });
  });
}

module.exports = { probeVideoDimensions };
