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
  slowdown:   1.05
};

/**
 * Builds the video filter chain (brightness, contrast, saturation, vibrance, sharpness, slowdown)
 * @param {object} opts - Enhancement parameters
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

  // Color & Contrast Adjustments
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
