/**
 * Video Player & Viewport Control Module
 */

import { appState } from '../state.js';

export function initPlayerControls(dom, { updateWatermarkOverlay }) {
  const {
    viewportBox,
    videoOriginal,
    videoEnhanced,
    btnPlayPause,
    btnMute,
    tFill,
    tTime,
    tProgress,
    aspectBadge,
    sliders,
    labels
  } = dom;

  // Real-time CSS Filter & Speed Preview on Enhanced Video element
  function applyPreview() {
    const br = parseFloat(sliders.brightness.value);
    const ct = parseFloat(sliders.contrast.value);
    const hl = parseFloat(sliders.highlights.value);
    const st = parseFloat(sliders.saturation.value);
    const sh = parseFloat(sliders.sharpness.value);
    const sd = parseFloat(sliders.slowdown ? sliders.slowdown.value : 1.05);

    appState.sliders.brightness = br;
    appState.sliders.contrast   = ct;
    appState.sliders.highlights = hl;
    appState.sliders.saturation = st;
    appState.sliders.sharpness  = sh;
    appState.sliders.slowdown   = sd;

    labels.brightness.textContent = `${(br * 100).toFixed(1)}%`;
    labels.contrast.textContent   = `+${((ct - 1) * 100).toFixed(0)}%`;
    labels.highlights.textContent = `${((hl - 1) * 100).toFixed(0)}%`;
    labels.saturation.textContent = `+${((st - 1) * 100).toFixed(0)}%`;
    labels.sharpness.textContent  = sh.toFixed(2);
    if (labels.slowdown) {
      labels.slowdown.textContent = `${sd.toFixed(2)}x`;
    }

    let filter = `brightness(${1 + br}) contrast(${ct}) saturate(${st})`;
    if (sh > 0.2) filter += ` contrast(${ct + 0.015})`;

    videoEnhanced.style.filter = filter;
    if (sd > 0 && videoEnhanced) {
      videoEnhanced.playbackRate = 1 / sd;
    }
  }

  Object.values(sliders).forEach(sl => sl.addEventListener('input', applyPreview));

  // Dynamic Viewport Bounds Fitting
  function updateViewportDimensions() {
    if (!videoOriginal.videoWidth || !videoOriginal.videoHeight) {
      viewportBox.style.width = '100%';
      viewportBox.style.height = 'auto';
      viewportBox.style.aspectRatio = '16 / 9';
      return;
    }

    const w = videoOriginal.videoWidth;
    const h = videoOriginal.videoHeight;
    const ratio = w / h;

    const container = viewportBox.parentElement;
    const availWidth = (container ? container.clientWidth : 800) - 40;
    const isMobile = window.innerWidth <= 600;
    const maxHeight = isMobile 
      ? Math.min(window.innerHeight * 0.5, 420) 
      : Math.min(window.innerHeight * 0.65, 540);

    let targetWidth = availWidth;
    let targetHeight = targetWidth / ratio;

    if (targetHeight > maxHeight) {
      targetHeight = maxHeight;
      targetWidth = targetHeight * ratio;
    }

    targetWidth = Math.min(targetWidth, availWidth);

    viewportBox.style.width = `${targetWidth}px`;
    viewportBox.style.height = `${targetHeight}px`;
    viewportBox.style.aspectRatio = `${w} / ${h}`;

    let label = `${w}x${h}`;
    if (Math.abs(ratio - (16 / 9)) < 0.05)       label = '16:9 Landscape';
    else if (Math.abs(ratio - (9 / 16)) < 0.05) label = '9:16 Vertical';
    else if (Math.abs(ratio - 1) < 0.05)        label = '1:1 Square';
    else if (Math.abs(ratio - (4 / 3)) < 0.05)  label = '4:3 Standard';
    else if (Math.abs(ratio - (21 / 9)) < 0.05) label = '21:9 Ultrawide';
    else label = `${w}x${h} (${ratio.toFixed(2)})`;

    if (aspectBadge) {
      aspectBadge.textContent = label;
      aspectBadge.classList.remove('hidden');
    }

    setTimeout(() => {
      updateWatermarkOverlay();
    }, 250);
  }

  videoOriginal.addEventListener('loadedmetadata', updateViewportDimensions);
  window.addEventListener('resize', updateViewportDimensions);

  // Timeline Synchronization
  videoOriginal.addEventListener('timeupdate', () => {
    if (Math.abs(videoOriginal.currentTime - videoEnhanced.currentTime) > 0.15) {
      videoEnhanced.currentTime = videoOriginal.currentTime;
    }
    if (videoOriginal.duration) {
      tFill.style.width = `${(videoOriginal.currentTime / videoOriginal.duration) * 100}%`;
      tTime.textContent = formatTime(videoOriginal.currentTime);
    }
  });

  // Play / Pause
  btnPlayPause.addEventListener('click', () => {
    const paused = videoOriginal.paused;
    if (paused) { videoOriginal.play(); videoEnhanced.play(); }
    else        { videoOriginal.pause(); videoEnhanced.pause(); }
    updatePlayIcon(paused);
  });

  function updatePlayIcon(isPlaying) {
    btnPlayPause.innerHTML = isPlaying ? '<i data-lucide="pause"></i>' : '<i data-lucide="play"></i>';
    if (window.lucide) window.lucide.createIcons();
  }

  // Mute
  btnMute.addEventListener('click', () => {
    videoOriginal.muted = !videoOriginal.muted;
    videoEnhanced.muted = videoOriginal.muted;
    btnMute.innerHTML = videoOriginal.muted ? '<i data-lucide="volume-x"></i>' : '<i data-lucide="volume-2"></i>';
    if (window.lucide) window.lucide.createIcons();
  });

  // Timeline Seek
  tProgress.addEventListener('click', (e) => {
    const rect = tProgress.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    if (videoOriginal.duration) {
      const t = pos * videoOriginal.duration;
      videoOriginal.currentTime = t;
      videoEnhanced.currentTime = t;
    }
  });

  function formatTime(s) {
    const m   = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  return {
    applyPreview,
    updateViewportDimensions,
    updatePlayIcon
  };
}
