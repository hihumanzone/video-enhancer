/**
 * Video Enhancer — Main Client Application Entrypoint
 */

import { appState } from './state.js';
import { initPlayerControls } from './modules/player.js';
import { initSplitView } from './modules/splitView.js';
import { initWatermark } from './modules/watermark.js';
import { initEnhancerApi } from './modules/enhancerApi.js';

document.addEventListener('DOMContentLoaded', () => {

  // ── DOM References Cache ──────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  const dom = {
    dropzone:       $('dropzone'),
    fileInput:      $('file-input'),
    uploadPrompt:   $('upload-prompt'),
    fileInfo:       $('file-info'),
    fileName:       $('file-name'),
    fileMeta:       $('file-meta'),
    btnChangeFile:  $('btn-change-file'),
    settingsCard:   $('settings-card'),
    codecH264:      $('codec-h264'),
    codecH265:      $('codec-h265'),
    crfCompact:     $('crf-compact'),
    crfMax:         $('crf-max'),
    sliders: {
      brightness: $('slider-brightness'),
      contrast:   $('slider-contrast'),
      highlights: $('slider-highlights'),
      saturation: $('slider-saturation'),
      sharpness:  $('slider-sharpness'),
      slowdown:   $('slider-slowdown')
    },
    labels: {
      brightness: $('val-brightness'),
      contrast:   $('val-contrast'),
      highlights: $('val-highlights'),
      saturation: $('val-saturation'),
      sharpness:  $('val-sharpness'),
      slowdown:   $('val-slowdown')
    },
    btnProcess:     $('btn-process'),
    viewportBox:    $('viewport-box'),
    emptyState:     $('empty-state'),
    activeViewport: $('active-viewport'),
    videoOriginal:  $('video-original'),
    videoEnhanced:  $('video-enhanced'),
    enhancedOverlay: $('enhanced-overlay'),
    splitHandle:    $('split-handle'),
    btnPlayPause:   $('btn-play-pause'),
    btnMute:        $('btn-mute'),
    tFill:          $('t-fill'),
    tTime:          $('t-time'),
    tProgress:      $('t-progress'),
    modeSplit:      $('mode-split'),
    modeEnhanced:   $('mode-enhanced'),
    modeOriginal:   $('mode-original'),
    renderOverlay:  $('render-overlay'),
    renderBar:      $('render-bar'),
    renderPct:      $('render-pct'),
    renderMsg:      $('render-msg'),
    downloadCard:   $('download-card'),
    dStats:         $('d-stats'),
    btnDownload:    $('btn-download'),
    aspectBadge:    $('aspect-badge'),

    // Watermark DOM
    watermarkToggle: $('watermark-toggle'),
    wmControlsBody:  $('wm-controls-body'),
    wmDropzone:      $('wm-dropzone'),
    wmFileInput:     $('wm-file-input'),
    wmDropPrompt:    $('wm-drop-prompt'),
    wmLogoPreview:   $('wm-logo-preview'),
    wmThumbImg:      $('wm-thumb-img'),
    wmLogoName:      $('wm-logo-name'),
    btnRemoveLogo:   $('btn-remove-logo'),
    wmPresetBtns:    document.querySelectorAll('.wm-preset-btn'),
    sliderWmSize:    $('slider-wm-size'),
    valWmSize:       $('val-wm-size'),
    sliderWmOpacity: $('slider-wm-opacity'),
    valWmOpacity:    $('val-wm-opacity'),
    sliderWmPadding: $('slider-wm-padding'),
    valWmPadding:    $('val-wm-padding'),
    watermarkViewportOverlay: $('watermark-viewport-overlay'),
    wmOverlayBox:    $('wm-overlay-box'),
    wmViewportImg:   $('wm-viewport-img'),

    // SynthID & AI Watermark Remover DOM
    toggleSynthid:            $('toggle-synthid'),
    synthidOptions:           $('synthid-options'),
    synthidStrengthLight:     $('synthid-strength-light'),
    synthidStrengthValidated: $('synthid-strength-validated'),
    synthidStrengthHigh:      $('synthid-strength-high'),
    toggleAiWatermark:        $('toggle-ai-watermark'),
    aiWatermarkOptions:       $('ai-watermark-options'),
    wmTypeGemini:             $('wm-type-gemini'),
    wmTypeVeo:                $('wm-type-veo'),
    wmTypeNotebooklm:         $('wm-type-notebooklm')
  };

  // ── SynthID & AI Watermark Event Handlers ────────────────────────────────
  if (dom.toggleSynthid) {
    dom.toggleSynthid.addEventListener('change', (e) => {
      appState.synthid.enabled = e.target.checked;
      if (dom.synthidOptions) {
        dom.synthidOptions.classList.toggle('hidden', !e.target.checked);
      }
    });
  }

  const synthidStrengthBtns = [
    dom.synthidStrengthLight,
    dom.synthidStrengthValidated,
    dom.synthidStrengthHigh
  ].filter(Boolean);

  synthidStrengthBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      synthidStrengthBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      appState.synthid.strength = parseFloat(btn.dataset.val);
    });
  });

  if (dom.toggleAiWatermark) {
    dom.toggleAiWatermark.addEventListener('change', (e) => {
      appState.aiWatermark.enabled = e.target.checked;
      if (dom.aiWatermarkOptions) {
        dom.aiWatermarkOptions.classList.toggle('hidden', !e.target.checked);
      }
    });
  }

  const aiWmTypeBtns = [
    dom.wmTypeGemini,
    dom.wmTypeVeo,
    dom.wmTypeNotebooklm
  ].filter(Boolean);

  aiWmTypeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      aiWmTypeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      appState.aiWatermark.type = btn.dataset.type;
    });
  });

  // ── Initialize Submodules ─────────────────────────────────────────────────
  const watermarkCtrl = initWatermark(dom);
  const playerCtrl    = initPlayerControls(dom, watermarkCtrl);
  initSplitView(dom);
  initEnhancerApi(dom);

  // ── Main Video File Upload Handlers ───────────────────────────────────────
  dom.dropzone.addEventListener('click', (e) => {
    if (e.target.closest('#btn-change-file')) return;
    dom.fileInput.click();
  });

  dom.dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dom.dropzone.classList.add('drag-over');
  });

  dom.dropzone.addEventListener('dragleave', () => dom.dropzone.classList.remove('drag-over'));

  dom.dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dom.dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files?.[0]) handleVideoFile(e.dataTransfer.files[0]);
  });

  dom.fileInput.addEventListener('change', (e) => {
    if (e.target.files?.[0]) handleVideoFile(e.target.files[0]);
  });

  dom.btnChangeFile.addEventListener('click', (e) => {
    e.stopPropagation();
    dom.fileInput.click();
  });

  function handleVideoFile(file) {
    if (!file.type.startsWith('video/')) {
      alert('Please upload a video file.');
      return;
    }

    appState.currentFile = file;
    dom.fileName.textContent = file.name;
    dom.fileMeta.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

    dom.uploadPrompt.classList.add('hidden');
    dom.fileInfo.classList.remove('hidden');
    dom.settingsCard.classList.remove('disabled');
    dom.btnProcess.disabled = false;

    if (appState.videoUrl) URL.revokeObjectURL(appState.videoUrl);
    appState.videoUrl = URL.createObjectURL(file);

    dom.viewportBox.style.width = '100%';
    dom.viewportBox.style.height = 'auto';
    dom.viewportBox.style.aspectRatio = '16 / 9';
    if (dom.aspectBadge) dom.aspectBadge.classList.add('hidden');

    dom.videoOriginal.src = appState.videoUrl;
    dom.videoEnhanced.src = appState.videoUrl;

    dom.emptyState.classList.add('hidden');
    dom.activeViewport.classList.remove('hidden');
    dom.downloadCard.classList.add('hidden');

    dom.videoOriginal.play();
    dom.videoEnhanced.play();
    playerCtrl.updatePlayIcon(true);
    playerCtrl.applyPreview();

    watermarkCtrl.updateWatermarkOverlay();
  }

  // Initialize Lucide icons
  if (window.lucide) window.lucide.createIcons();
});
