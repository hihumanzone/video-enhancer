/**
 * Image Header Aspect Ratio Decoder (PNG, JPG, WEBP)
 */

const fs = require('node:fs');

/**
 * Extracts width/height aspect ratio from image headers
 * @param {string} filePath - Path to image file
 * @returns {number} Aspect ratio (width / height)
 */
function getImageAspect(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    if (!buf || buf.length < 24) return 1.0;

    // PNG Header
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
      const w = buf.readUInt32BE(16);
      const h = buf.readUInt32BE(20);
      if (w && h) return w / h;
    }

    // JPEG Header
    if (buf[0] === 0xFF && buf[1] === 0xD8) {
      let offset = 2;
      while (offset < buf.length - 8) {
        const marker = buf.readUInt16BE(offset);
        if (marker >= 0xFFC0 && marker <= 0xFFC3) {
          const h = buf.readUInt16BE(offset + 5);
          const w = buf.readUInt16BE(offset + 7);
          if (w && h) return w / h;
        }
        const len = buf.readUInt16BE(offset + 2);
        if (len <= 0) break;
        offset += 2 + len;
      }
    }

    // WEBP Header
    if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
      const format = buf.toString('ascii', 12, 16);
      if (format === 'VP8 ' && buf.length >= 30) {
        const w = buf.readUInt16LE(26) & 0x3fff;
        const h = buf.readUInt16LE(28) & 0x3fff;
        if (w && h) return w / h;
      }
      if (format === 'VP8L' && buf.length >= 25) {
        const b0 = buf[21], b1 = buf[22], b2 = buf[23], b3 = buf[24];
        const w = 1 + (((b1 & 0x3f) << 8) | b0);
        const h = 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
        if (w && h) return w / h;
      }
    }
  } catch {
    /* Fallback to 1:1 ratio if image reading or parsing fails */
  }
  return 1.0;
}

module.exports = { getImageAspect };
