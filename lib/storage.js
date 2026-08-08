/**
 * Storage & File Upload Configuration
 */

const multer = require('multer');
const path   = require('node:path');
const fs     = require('node:fs');
const os     = require('node:os');

const isVercel   = Boolean(process.env.VERCEL);
const rootDir    = path.join(__dirname, '..');
const uploadsDir = isVercel ? path.join(os.tmpdir(), 'uploads') : path.join(rootDir, 'uploads');
const outputDir  = isVercel ? path.join(os.tmpdir(), 'outputs') : path.join(rootDir, 'outputs');

try {
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(outputDir,  { recursive: true });
} catch {
  /* Directories already exist or created on demand */
}

const ALLOWED_VIDEO_EXT = new Set(['.mp4', '.mov', '.webm', '.mkv', '.avi']);
const ALLOWED_IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uid = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    const prefix = file.fieldname === 'watermark' ? 'logo' : 'input';
    cb(null, `${prefix}-${uid}${ext || (file.fieldname === 'watermark' ? '.png' : '.mp4')}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1 GB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === 'watermark') {
      if (!ALLOWED_IMAGE_EXT.has(ext)) {
        return cb(new Error(`Unsupported logo image format: ${ext}`));
      }
    } else {
      if (!ALLOWED_VIDEO_EXT.has(ext)) {
        return cb(new Error(`Unsupported video format: ${ext}`));
      }
    }
    cb(null, true);
  }
});

module.exports = {
  isVercel,
  uploadsDir,
  outputDir,
  upload,
  ALLOWED_VIDEO_EXT,
  ALLOWED_IMAGE_EXT
};
