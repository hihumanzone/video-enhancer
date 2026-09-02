/**
 * Video Enhancement & Multi-Codec Compression Engine (v3.0 - Refactored)
 *
 * Applies subtle, non-destructive visual polish and smart compression.
 * Supports H.264 (universal) and H.265/HEVC (maximum compression).
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const ffmpegPath = require('ffmpeg-static');

const { getImageAspect } = require('./lib/ffmpeg/imageProbe');
const { probeVideoInfo } = require('./lib/ffmpeg/videoProbe');
const { DEFAULTS, buildFilterGraph, buildWatermarkFilterGraph } = require('./lib/ffmpeg/filterBuilder');

// Ensure ffmpeg-static binary is executable (Vercel serverless / Linux)
if (ffmpegPath && fs.existsSync(ffmpegPath)) {
  try {
    fs.chmodSync(ffmpegPath, 0o755);
  } catch {
    /* Ignore permissions error on Windows / read-only FS */
  }
}

// Cap thread allocation to 16 for libx265 frame-thread safety
const DETECTED_CORES = typeof os.availableParallelism === 'function'
  ? os.availableParallelism()
  : os.cpus().length;
const CPU_CORES = Math.min(16, DETECTED_CORES);

/**
 * Enhances and compresses a video file.
 * @param {object}   options    - { input, output, codec, crf, preset, brightness, slowdown, ... }
 * @param {function} onProgress - Optional callback receiving progress percentage (0-100)
 * @returns {Promise<object>}   - Resolves with { outputPath, elapsed, inMB, outMB, savingsPct, codec }
 */
function enhanceVideo(options = {}, onProgress = null) {
  return new Promise(async (resolve, reject) => {
    // Validate ffmpeg binary
    if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
      return reject(new Error('ffmpeg-static binary not found. Run: npm install'));
    }

    if (!options.input) {
      return reject(new Error('Input video path (-i) is required.'));
    }

    const inputPath = path.resolve(options.input);
    if (!fs.existsSync(inputPath)) {
      return reject(new Error(`Input file "${inputPath}" does not exist.`));
    }

    // Resolve output path
    let outputPath = options.output;
    if (!outputPath) {
      const ext = path.extname(inputPath);
      const basename = path.basename(inputPath, ext);
      outputPath = path.join(path.dirname(inputPath), `${basename}_enhanced${ext}`);
    }
    outputPath = path.resolve(outputPath);

    // Prevent self-overwrite
    if (path.normalize(inputPath) === path.normalize(outputPath)) {
      return reject(new Error('Output path must differ from input to prevent data loss.'));
    }

    const videoInfo = await probeVideoInfo(inputPath);
    const videoDims = { width: videoInfo.width, height: videoInfo.height };
    const hasAudio  = videoInfo.hasAudio;

    const slowdown = options.slowdown !== undefined
      ? Number(options.slowdown)
      : (options.speed !== undefined && Number(options.speed) > 0 ? 1 / Number(options.speed) : DEFAULTS.slowdown);

    // Check if watermark is provided and exists
    const hasWatermark = Boolean(options.watermark && fs.existsSync(options.watermark));

    const baseFilterString = buildFilterGraph({ ...options, slowdown }, videoDims);
    const speedPreset = options.preset || 'fast';

    // Codec selection
    const codecChoice = (options.codec || 'h265').toLowerCase();
    const isH265 = codecChoice === 'h265' || codecChoice === 'hevc' || codecChoice === 'libx265';
    const videoCodec = isH265 ? 'libx265' : 'libx264';

    const defaultCrf = isH265 ? 24 : 20;
    const crf = options.crf !== undefined ? options.crf : defaultCrf;

    // Build FFmpeg arguments
    const args = [
      '-y',
      '-hide_banner',
      '-loglevel', 'info',
      '-i', inputPath
    ];

    if (hasWatermark) {
      const watermarkPath = path.resolve(options.watermark);
      args.push('-i', watermarkPath);

      const logoAspect = getImageAspect(watermarkPath);
      const filterComplex = buildWatermarkFilterGraph(options, baseFilterString, videoDims, logoAspect);

      args.push('-filter_complex', filterComplex);
      args.push('-map', '[outv]');
      if (slowdown && slowdown !== 1 && hasAudio) {
        args.push('-map', '0:a?');
        const atempoVal = (1 / slowdown).toFixed(6);
        args.push('-af', `atempo=${atempoVal}`);
        args.push('-c:a', 'aac', '-b:a', '192k');
      } else if (hasAudio) {
        args.push('-map', '0:a?');
        args.push('-c:a', 'copy');
      }
    } else {
      args.push('-vf', baseFilterString);
      if (slowdown && slowdown !== 1 && hasAudio) {
        const atempoVal = (1 / slowdown).toFixed(6);
        args.push('-af', `atempo=${atempoVal}`);
        args.push('-c:a', 'aac', '-b:a', '192k');
      } else if (hasAudio) {
        args.push('-c:a', 'copy');
      } else {
        args.push('-an');
      }
    }

    args.push(
      '-c:v', videoCodec,
      '-preset', speedPreset,
      '-crf', String(crf),
      '-threads', String(CPU_CORES),
      '-pix_fmt', 'yuv420p',
      '-colorspace', 'bt709',
      '-color_primaries', 'bt709',
      '-color_trc', 'bt709',
      '-map_metadata', '-1',
      '-map_chapters', '-1',
      '-fflags', '+bitexact',
      '-flags:v', '+bitexact',
      '-flags:a', '+bitexact',
      '-movflags', '+faststart'
    );

    if (isH265) {
      args.push('-tag:v', 'hvc1'); // Apple/Safari/Chrome HTML5 video compatibility
    } else {
      args.push('-tune', 'film');
    }

    args.push(outputPath);

    console.log('--------------------------------------------------');
    console.log(`  Enhancer & Compressor (${videoCodec.toUpperCase()})`);
    console.log('--------------------------------------------------');
    console.log(`  Input:     ${inputPath}`);
    if (hasWatermark) {
      console.log(`  Watermark: ${options.watermark}`);
    }
    console.log(`  Output:    ${outputPath}`);
    console.log(`  Codec:     ${isH265 ? 'H.265 / HEVC' : 'H.264 / AVC'}`);
    console.log(`  CRF:       ${crf}`);
    console.log(`  Slowdown:  ${slowdown}x (${(1/slowdown).toFixed(3)}x speed)`);
    console.log(`  Metadata:  Stripped (Minimal required stream data)`);
    console.log(`  Threads:   ${CPU_CORES}`);
    console.log('--------------------------------------------------');

    const startTime = Date.now();
    let totalDurationSec = 0;

    const ffmpegProc = spawn(ffmpegPath, args);

    ffmpegProc.stderr.on('data', (data) => {
      const str = data.toString();

      // Parse total duration
      if (!totalDurationSec) {
        const match = str.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
        if (match) {
          totalDurationSec = parseFloat(match[1]) * 3600 + parseFloat(match[2]) * 60 + parseFloat(match[3]);
        }
      }

      // Parse current encoding time
      const timeMatch = str.match(/time=\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (timeMatch && totalDurationSec > 0) {
        const currentSec = parseFloat(timeMatch[1]) * 3600 + parseFloat(timeMatch[2]) * 60 + parseFloat(timeMatch[3]);
        const progressPct = Math.min(99, Math.round((currentSec / totalDurationSec) * 100));

        if (onProgress) {
          onProgress(progressPct);
        } else {
          process.stdout.write(`\rProgress: ${progressPct}%`);
        }
      }
    });

    ffmpegProc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`FFmpeg exited with code ${code}`));
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      const inSize  = fs.statSync(inputPath).size;
      const outSize = fs.statSync(outputPath).size;
      const inMB  = (inSize  / (1024 * 1024)).toFixed(2);
      const outMB = (outSize / (1024 * 1024)).toFixed(2);
      const savingsPct = (((inSize - outSize) / inSize) * 100).toFixed(1);

      console.log(`\nDone in ${elapsed}s — ${inMB} MB -> ${outMB} MB (${savingsPct >= 0 ? savingsPct + '% reduced' : 'optimized'})`);

      if (onProgress) onProgress(100);
      resolve({ outputPath, elapsed, inMB, outMB, savingsPct, codec: videoCodec });
    });

    ffmpegProc.on('error', reject);
  });
}

// ── CLI Execution ─────────────────────────────────────────────────────────────

if (require.main === module) {
  const argv = process.argv.slice(2);
  const opts = { codec: 'h265', preset: 'fast' };

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '-i' || flag === '--input')      opts.input      = argv[++i];
    else if (flag === '-o' || flag === '--output') opts.output     = argv[++i];
    else if (flag === '--codec')                   opts.codec      = argv[++i];
    else if (flag === '--brightness')              opts.brightness = parseFloat(argv[++i]);
    else if (flag === '--contrast')                opts.contrast   = parseFloat(argv[++i]);
    else if (flag === '--saturation')              opts.saturation = parseFloat(argv[++i]);
    else if (flag === '--vibrance')                opts.vibrance   = parseFloat(argv[++i]);
    else if (flag === '--sharpness')               opts.sharpness  = parseFloat(argv[++i]);
    else if (flag === '--highlights')              opts.highlights = parseFloat(argv[++i]);
    else if (flag === '--slowdown')                opts.slowdown   = parseFloat(argv[++i]);
    else if (flag === '--speed')                   opts.speed      = parseFloat(argv[++i]);
    else if (flag === '--crf')                     opts.crf        = parseInt(argv[++i], 10);
    else if (flag === '--preset')                  opts.preset     = argv[++i];
    else if (flag === '--remove-synthid')          opts.removeSynthid = true;
    else if (flag === '--synthid-strength')        opts.synthidStrength = parseFloat(argv[++i]);
    else if (flag === '--remove-watermark')        opts.removeWatermark = true;
    else if (flag === '--watermark-type')          opts.watermarkType = argv[++i];
    else if (flag === '--watermark-rect')          opts.watermarkRect = argv[++i];
    else if (flag === '--watermark')               opts.watermark  = argv[++i];
    else if (flag === '--watermark-position')      opts.watermarkPosition = argv[++i];
    else if (flag === '--watermark-size')          opts.watermarkSize = parseFloat(argv[++i]);
    else if (flag === '--watermark-opacity')       opts.watermarkOpacity = parseFloat(argv[++i]);
    else if (flag === '--watermark-padding')       opts.watermarkPadding = parseFloat(argv[++i]);
    else if (flag === '--watermark-x')             opts.watermarkXPct = parseFloat(argv[++i]);
    else if (flag === '--watermark-y')             opts.watermarkYPct = parseFloat(argv[++i]);
  }

  if (!opts.input) {
    console.log(`
Usage: node enhance_video.js -i <input.mp4> [-o <output.mp4>] [options]

Options:
  --codec <h264|h265>        Video codec (default: h265)
  --crf <value>              Quality factor (default: 24 for H.265, 20 for H.264)
  --preset <preset>          Speed: ultrafast, fast, medium (default: fast)
  --remove-synthid           Scrub invisible SynthID watermark (frequency perturbation)
  --synthid-strength <val>   SynthID scrub strength 0.05 to 0.20 (default: 0.10)
  --remove-watermark         Remove visible AI watermark (Gemini / Veo / NotebookLM)
  --watermark-type <type>    Type: gemini, veo, notebooklm (default: gemini)
  --watermark-rect <x,y,w,h> Custom bounding box for watermark removal
  --brightness <val>         Exposure adjustment (default: ${DEFAULTS.brightness})
  --contrast <val>           Contrast multiplier (default: ${DEFAULTS.contrast})
  --saturation <val>         Saturation multiplier (default: ${DEFAULTS.saturation})
  --vibrance <val>           Vibrance intensity (default: ${DEFAULTS.vibrance})
  --sharpness <val>          Sharpness amount (default: ${DEFAULTS.sharpness})
  --highlights <val>         Highlight rolloff (default: ${DEFAULTS.highlights})
  --watermark <path>         Path to channel logo overlay image (PNG/JPG/WEBP)
  --watermark-position <pos> Position: bottom-right, bottom-left, top-right, top-left, center, custom
  --watermark-size <pct>     Size relative to video width % (default: 15)
  --watermark-opacity <val>  Opacity 0.1 to 1.0 (default: 0.9)
  --watermark-padding <px>   Margin padding in px (default: 70)
  --watermark-x <pct>        Custom X percentage 0 to 100
  --watermark-y <pct>        Custom Y percentage 0 to 100
    `);
    process.exit(0);
  }

  enhanceVideo(opts).catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}

module.exports = { enhanceVideo, buildFilterGraph, DEFAULTS };
