/**
 * FFmpeg Video Filter Graph Construction Module
 */

/** Default subtle enhancement & watermark removal parameters */
const DEFAULTS = {
  brightness: -0.015,
  contrast:   1.05,
  saturation: 1.07,
  vibrance:   0.12,
  sharpness:  0.35,
  highlights: 0.96,
  slowdown:   1.05,
  removeSynthid: false,
  synthidStrength: 0.10, // Validated default strength in froggeric/gemini-watermark-and-synthid-remover
  removeWatermark: false,
  watermarkType: 'gemini'
};

/**
 * Calculates visible watermark bounding box for removal (delogo)
 * Based on froggeric/gemini-watermark-and-synthid-remover geometry presets
 */
function getWatermarkDelogoBox(videoDims = { width: 1920, height: 1080 }, type = 'gemini', customRect = null) {
  if (customRect && typeof customRect === 'string') {
    const parts = customRect.split(',').map(n => parseInt(n.trim(), 10));
    if (parts.length === 4 && parts.every(n => !isNaN(n))) {
      return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
    }
  }

  const w = videoDims.width || 1920;
  const h = videoDims.height || 1080;
  const shortSide = Math.min(w, h);

  let bw, bh, marginRight, marginBottom;

  if (type === 'veo') {
    bw = shortSide >= 1080 ? 99 : 68;
    bh = shortSide >= 1080 ? 43 : 30;
    marginRight = 40;
    marginBottom = 40;
  } else if (type === 'notebooklm') {
    bw = Math.round(w * 0.18);
    bh = Math.round(bw * 0.35);
    marginRight = 40;
    marginBottom = 40;
  } else {
    // Gemini (default)
    bw = shortSide > 1024 ? 96 : 48;
    bh = bw;
    marginRight = shortSide > 1024 ? 60 : 30;
    marginBottom = shortSide > 1024 ? 60 : 30;
  }

  const x = Math.max(0, w - bw - marginRight);
  const y = Math.max(0, h - bh - marginBottom);

  return { x, y, w: bw, h: bh };
}

/**
 * Builds the video filter chain (watermark removal, SynthID frequency scrubbing, brightness, contrast, saturation, vibrance, sharpness, slowdown)
 * @param {object} opts - Enhancement & removal parameters
 * @param {{width: number, height: number}} videoDims - Input video dimensions
 * @returns {string} Comma-separated FFmpeg filter chain
 */
function buildFilterGraph(opts = {}, videoDims = { width: 1920, height: 1080 }) {
  const val = (key) => opts[key] !== undefined ? opts[key] : DEFAULTS[key];

  const brightness = val('brightness');
  const contrast   = val('contrast');
  const saturation = val('saturation');
  const vibrance   = val('vibrance');
  const sharpness  = val('sharpness');
  const slowdown   = opts.slowdown !== undefined
    ? Number(opts.slowdown)
    : (opts.speed !== undefined && Number(opts.speed) > 0 ? 1 / Number(opts.speed) : DEFAULTS.slowdown);

  const filters = [];

  // 1. Visible Watermark Removal (delogo interpolation)
  if (opts.removeWatermark) {
    const box = getWatermarkDelogoBox(videoDims, opts.watermarkType || 'gemini', opts.watermarkRect);
    filters.push(`delogo=x=${box.x}:y=${box.y}:w=${box.w}:h=${box.h}`);
  }

  // 2. Invisible SynthID Watermark Scrubbing (Spatial/Frequency Lossy Perturbation)
  // Method matches froggeric/gemini-watermark-and-synthid-remover frequency scrubbing approach
  if (opts.removeSynthid) {
    const strength = Number(opts.synthidStrength !== undefined ? opts.synthidStrength : DEFAULTS.synthidStrength);
    const noiseAmp = (strength * 25).toFixed(2);
    
    // Controlled spatial noise injection + 3D spatio-temporal dequantization + micro-sharpening
    filters.push(`noise=alls=${noiseAmp}:allf=t+u`);
    filters.push(`hqdn3d=1.2:1.2:3:3`);
    filters.push(`unsharp=luma_msize_x=3:luma_msize_y=3:luma_amount=0.15`);
  }

  // 3. Color & Contrast Adjustments
  filters.push(`eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}`);

  if (vibrance && vibrance !== 0) {
    filters.push(`vibrance=intensity=${vibrance}`);
  }

  if (sharpness && sharpness > 0) {
    filters.push(`unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=${sharpness}`);
  }

  if (slowdown && slowdown !== 1) {
    filters.push(`setpts=${slowdown}*PTS`);
  }

  filters.push('format=yuv420p');

  return filters.join(',');
}

/**
 * Builds complex filter graph for video enhancement + scaled/positioned watermark overlay
 * @param {object} opts - Enhancement and watermark options
 * @param {string} baseFilterString - Base visual enhancement filter chain
 * @param {{width: number, height: number}} videoDims - Input video dimensions
 * @param {number} logoAspect - Logo image aspect ratio
 * @returns {string} FFmpeg filter_complex parameter string
 */
function buildWatermarkFilterGraph(opts, baseFilterString, videoDims, logoAspect) {
  const sizeRatio = (opts.watermarkSize !== undefined ? Number(opts.watermarkSize) : 15) / 100;
  const opacity   = opts.watermarkOpacity !== undefined ? Number(opts.watermarkOpacity) : 0.9;
  const padding   = opts.watermarkPadding !== undefined ? Number(opts.watermarkPadding) : 70;
  const pos       = opts.watermarkPosition || 'bottom-right';

  // Compute logo pixel dimensions relative to video width
  const logoW = Math.round(videoDims.width * sizeRatio);
  const logoH = Math.round(logoW / logoAspect);

  let xExpr = `main_w-overlay_w-${padding}`;
  let yExpr = `main_h-overlay_h-${padding}`;

  if (pos === 'bottom-left') {
    xExpr = `${padding}`;
    yExpr = `main_h-overlay_h-${padding}`;
  } else if (pos === 'top-right') {
    xExpr = `main_w-overlay_w-${padding}`;
    yExpr = `${padding}`;
  } else if (pos === 'top-left') {
    xExpr = `${padding}`;
    yExpr = `${padding}`;
  } else if (pos === 'center') {
    xExpr = `(main_w-overlay_w)/2`;
    yExpr = `(main_h-overlay_h)/2`;
  } else if (pos === 'custom') {
    const xPct = opts.watermarkXPct !== undefined ? Number(opts.watermarkXPct) : 100;
    const yPct = opts.watermarkYPct !== undefined ? Number(opts.watermarkYPct) : 100;
    xExpr = `(main_w-overlay_w)*${xPct}/100`;
    yExpr = `(main_h-overlay_h)*${yPct}/100`;
  }

  return [
    `[0:v]${baseFilterString},format=rgba[vid_rgba]`,
    `[1:v]format=rgba,scale=${logoW}:${logoH}[wm_scaled]`,
    `[wm_scaled]colorchannelmixer=aa=${opacity}[wm_alpha]`,
    `[vid_rgba][wm_alpha]overlay=x='${xExpr}':y='${yExpr}'[out_rgba]`,
    `[out_rgba]format=yuv420p[outv]`
  ].join(';');
}

module.exports = {
  DEFAULTS,
  getWatermarkDelogoBox,
  buildFilterGraph,
  buildWatermarkFilterGraph
};
