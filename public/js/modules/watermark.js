/**
 * Channel Watermark Management & Interactive Overlay Module
 */

import { appState } from '../state.js';

const STORAGE_KEY_DATA = 've_watermark_data';
const STORAGE_KEY_SETTINGS = 've_watermark_settings';

export function initWatermark(dom) {
  const {
    watermarkToggle,
    wmControlsBody,
    wmDropzone,
    wmFileInput,
    wmDropPrompt,
    wmLogoPreview,
    wmThumbImg,
    wmLogoName,
    btnRemoveLogo,
    wmPresetBtns,
    sliderWmSize,
    valWmSize,
    sliderWmOpacity,
    valWmOpacity,
    sliderWmPadding,
    valWmPadding,
    watermarkViewportOverlay,
    wmOverlayBox,
    wmViewportImg,
    viewportBox,
    videoOriginal
  } = dom;

  let isWmDragging = false;
  let isWmResizing = false;
  let wmDragOffset = { x: 0, y: 0 };
  let wmResizeStart = { width: 0, mouseX: 0 };

  const wmState = appState.watermark;

  function saveWatermarkSettings() {
    try {
      const settings = {
        position: wmState.position,
        sizePct: wmState.sizePct,
        opacity: wmState.opacity,
        paddingPx: wmState.paddingPx,
        xPct: wmState.xPct,
        yPct: wmState.yPct
      };
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save watermark settings:', e);
    }
  }

  function saveWatermarkFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = {
          name: file.name,
          type: file.type,
          dataUrl: reader.result
        };
        localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(payload));
      } catch (e) {
        console.warn('Failed to save watermark image to LocalStorage:', e);
      }
    };
    reader.readAsDataURL(file);
  }

  function restoreWatermarkFromStorage() {
    try {
      wmState.position = 'bottom-right';
      wmState.sizePct = 15;
      wmState.opacity = 0.9;
      wmState.paddingPx = 70;
      wmState.xPct = 100;
      wmState.yPct = 100;

      sliderWmSize.value = 15;
      valWmSize.textContent = '15%';
      sliderWmOpacity.value = 90;
      valWmOpacity.textContent = '90%';
      sliderWmPadding.value = 70;
      valWmPadding.textContent = '70px';

      wmPresetBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.pos === 'bottom-right');
      });

      saveWatermarkSettings();

      const savedData = localStorage.getItem(STORAGE_KEY_DATA);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        if (parsed.dataUrl && parsed.name && parsed.type) {
          const arr = parsed.dataUrl.split(',');
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          const file = new File([u8arr], parsed.name, { type: parsed.type });
          handleWatermarkFile(file, false);
        }
      }

      if (!wmState.file) {
        fetch('/api/latest-watermark')
          .then(res => res.json())
          .then(data => {
            if (data.hasWatermark && data.url) {
              fetch(data.url)
                .then(r => r.blob())
                .then(blob => {
                  const file = new File([blob], 'channel_logo.png', { type: blob.type || 'image/png' });
                  handleWatermarkFile(file, false);
                });
            }
          })
          .catch(e => console.warn('Failed to load server watermark fallback:', e));
      }
    } catch (e) {
      console.warn('Failed to restore watermark from storage:', e);
    }
  }

  // Watermark is permanently enabled
  if (watermarkToggle) {
    watermarkToggle.checked = true;
    watermarkToggle.disabled = true;
  }
  wmControlsBody.classList.remove('hidden');

  // File Dropzone Event Handlers
  wmDropzone.addEventListener('click', (e) => {
    if (e.target.closest('#btn-remove-logo')) return;
    wmFileInput.click();
  });

  wmDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    wmDropzone.classList.add('drag-over');
  });

  wmDropzone.addEventListener('dragleave', () => wmDropzone.classList.remove('drag-over'));

  wmDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    wmDropzone.classList.remove('drag-over');
    if (e.dataTransfer.files?.[0]) handleWatermarkFile(e.dataTransfer.files[0]);
  });

  wmFileInput.addEventListener('change', (e) => {
    if (e.target.files?.[0]) handleWatermarkFile(e.target.files[0]);
  });

  btnRemoveLogo.addEventListener('click', (e) => {
    e.stopPropagation();
    removeChannelWatermarkLogo();
  });

  function handleWatermarkFile(file, saveToStorage = true) {
    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (PNG, JPG, WEBP, SVG).');
      return;
    }

    wmState.file = file;
    wmState.enabled = true;

    if (saveToStorage) {
      saveWatermarkFile(file);
      saveWatermarkSettings();
    }

    if (wmState.logoUrl && !wmState.logoUrl.startsWith('data:')) {
      URL.revokeObjectURL(wmState.logoUrl);
    }
    wmState.logoUrl = URL.createObjectURL(file);

    const img = new Image();
    img.onload = () => {
      if (img.width && img.height) {
        wmState.aspectRatio = img.width / img.height;
      }
      updateWatermarkOverlay();

      setTimeout(() => {
        wmState.position = 'bottom-right';
        wmState.xPct = 100;
        wmState.yPct = 100;
        wmPresetBtns.forEach(btn => {
          btn.classList.toggle('active', btn.dataset.pos === 'bottom-right');
        });
        saveWatermarkSettings();
        updateWatermarkOverlay();
      }, 200);
    };
    img.src = wmState.logoUrl;

    wmThumbImg.src = wmState.logoUrl;
    wmViewportImg.src = wmState.logoUrl;
    wmLogoName.textContent = file.name;

    wmDropPrompt.classList.add('hidden');
    wmLogoPreview.classList.remove('hidden');

    updateWatermarkOverlay();
  }

  function removeChannelWatermarkLogo() {
    wmState.file = null;
    if (wmState.logoUrl && !wmState.logoUrl.startsWith('data:')) {
      URL.revokeObjectURL(wmState.logoUrl);
      wmState.logoUrl = null;
    }
    try {
      localStorage.removeItem(STORAGE_KEY_DATA);
    } catch {}
    wmThumbImg.src = '';
    wmViewportImg.src = '';
    wmFileInput.value = '';
    wmLogoPreview.classList.add('hidden');
    wmDropPrompt.classList.remove('hidden');
    updateWatermarkOverlay();
  }

  // Preset Buttons
  wmPresetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      wmPresetBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      wmState.position = btn.dataset.pos;
      if (wmState.position === 'bottom-right') { wmState.xPct = 100; wmState.yPct = 100; }
      else if (wmState.position === 'bottom-left') { wmState.xPct = 0; wmState.yPct = 100; }
      else if (wmState.position === 'top-right') { wmState.xPct = 100; wmState.yPct = 0; }
      else if (wmState.position === 'top-left') { wmState.xPct = 0; wmState.yPct = 0; }
      else if (wmState.position === 'center') { wmState.xPct = 50; wmState.yPct = 50; }
      saveWatermarkSettings();
      updateWatermarkOverlay();
    });
  });

  // Sliders
  sliderWmSize.addEventListener('input', () => {
    wmState.sizePct = parseInt(sliderWmSize.value, 10);
    valWmSize.textContent = `${wmState.sizePct}%`;
    saveWatermarkSettings();
    updateWatermarkOverlay();
  });

  sliderWmOpacity.addEventListener('input', () => {
    wmState.opacity = parseInt(sliderWmOpacity.value, 10) / 100;
    valWmOpacity.textContent = `${parseInt(sliderWmOpacity.value, 10)}%`;
    saveWatermarkSettings();
    updateWatermarkOverlay();
  });

  sliderWmPadding.addEventListener('input', () => {
    wmState.paddingPx = parseInt(sliderWmPadding.value, 10);
    valWmPadding.textContent = `${wmState.paddingPx}px`;
    saveWatermarkSettings();
    updateWatermarkOverlay();
  });

  // Viewport Overlay Positioning & Scale
  function updateWatermarkOverlay() {
    if (!wmState.enabled || !wmState.file || !appState.currentFile) {
      watermarkViewportOverlay.classList.add('hidden');
      return;
    }

    watermarkViewportOverlay.classList.remove('hidden');
    wmOverlayBox.style.opacity = wmState.opacity;

    const parentW = watermarkViewportOverlay.clientWidth || viewportBox.clientWidth;
    const parentH = watermarkViewportOverlay.clientHeight || viewportBox.clientHeight;
    const aspect = wmState.aspectRatio || (wmViewportImg.naturalWidth && wmViewportImg.naturalHeight ? wmViewportImg.naturalWidth / wmViewportImg.naturalHeight : 1);

    const videoW = videoOriginal.videoWidth || viewportBox.clientWidth;
    const videoH = videoOriginal.videoHeight || viewportBox.clientHeight;
    const scaleFactor = parentW / videoW;

    const logoW_real = videoW * (wmState.sizePct / 100);
    const logoH_real = logoW_real / aspect;

    const logoW = logoW_real * scaleFactor;
    const logoH = logoH_real * scaleFactor;

    wmOverlayBox.style.width = `${logoW}px`;
    wmOverlayBox.style.height = `${logoH}px`;
    wmOverlayBox.style.aspectRatio = `${aspect}`;

    const pos = wmState.position;
    const pad = wmState.paddingPx * scaleFactor;

    wmOverlayBox.style.left = 'auto';
    wmOverlayBox.style.right = 'auto';
    wmOverlayBox.style.top = 'auto';
    wmOverlayBox.style.bottom = 'auto';
    wmOverlayBox.style.transform = 'none';

    if (pos === 'bottom-right') {
      wmOverlayBox.style.right = `${pad}px`;
      wmOverlayBox.style.bottom = `${pad}px`;
    } else if (pos === 'bottom-left') {
      wmOverlayBox.style.left = `${pad}px`;
      wmOverlayBox.style.bottom = `${pad}px`;
    } else if (pos === 'top-right') {
      wmOverlayBox.style.right = `${pad}px`;
      wmOverlayBox.style.top = `${pad}px`;
    } else if (pos === 'top-left') {
      wmOverlayBox.style.left = `${pad}px`;
      wmOverlayBox.style.top = `${pad}px`;
    } else if (pos === 'center') {
      wmOverlayBox.style.left = '50%';
      wmOverlayBox.style.top = '50%';
      wmOverlayBox.style.transform = 'translate(-50%, -50%)';
    } else if (pos === 'custom') {
      const availW = Math.max(1, parentW - logoW);
      const availH = Math.max(1, parentH - logoH);
      const leftPx = (availW * wmState.xPct) / 100;
      const topPx = (availH * wmState.yPct) / 100;

      wmOverlayBox.style.left = `${leftPx}px`;
      wmOverlayBox.style.top = `${topPx}px`;
    }
  }

  // Interactive Viewport Mouse Drag & Resize
  wmOverlayBox.addEventListener('mousedown', (e) => {
    const handle = e.target.closest('.wm-resize-handle');
    if (handle) {
      isWmResizing = true;
      wmResizeStart.width = wmOverlayBox.offsetWidth;
      wmResizeStart.mouseX = e.clientX;
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    isWmDragging = true;
    wmOverlayBox.classList.add('active-dragging');
    const boxRect = wmOverlayBox.getBoundingClientRect();
    wmDragOffset.x = e.clientX - boxRect.left;
    wmDragOffset.y = e.clientY - boxRect.top;
    e.stopPropagation();
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (isWmResizing) {
      const parentRect = watermarkViewportOverlay.getBoundingClientRect();
      const dx = e.clientX - wmResizeStart.mouseX;
      const newWidthPx = Math.max(20, wmResizeStart.width + dx);
      let newPct = Math.round((newWidthPx / parentRect.width) * 100);
      newPct = Math.max(5, Math.min(50, newPct));

      wmState.sizePct = newPct;
      sliderWmSize.value = newPct;
      valWmSize.textContent = `${newPct}%`;
      updateWatermarkOverlay();
      return;
    }

    if (isWmDragging) {
      const parentRect = watermarkViewportOverlay.getBoundingClientRect();
      const boxW = wmOverlayBox.offsetWidth;
      const boxH = wmOverlayBox.offsetHeight;

      const leftPx = e.clientX - parentRect.left - wmDragOffset.x;
      const topPx = e.clientY - parentRect.top - wmDragOffset.y;

      const availW = Math.max(1, parentRect.width - boxW);
      const availH = Math.max(1, parentRect.height - boxH);

      let xPct = (leftPx / availW) * 100;
      let yPct = (topPx / availH) * 100;

      xPct = Math.max(0, Math.min(100, xPct));
      yPct = Math.max(0, Math.min(100, yPct));

      wmState.position = 'custom';
      wmState.xPct = xPct;
      wmState.yPct = yPct;

      wmPresetBtns.forEach((b) => b.classList.remove('active'));
      updateWatermarkOverlay();
    }
  });

  window.addEventListener('mouseup', () => {
    if (isWmDragging || isWmResizing) {
      saveWatermarkSettings();
    }
    if (isWmDragging) {
      isWmDragging = false;
      wmOverlayBox.classList.remove('active-dragging');
    }
    if (isWmResizing) {
      isWmResizing = false;
    }
  });

  // Touch Drag & Resize
  wmOverlayBox.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    const handle = e.target.closest('.wm-resize-handle');
    if (handle) {
      isWmResizing = true;
      wmResizeStart.width = wmOverlayBox.offsetWidth;
      wmResizeStart.mouseX = touch.clientX;
      e.stopPropagation();
      return;
    }

    isWmDragging = true;
    wmOverlayBox.classList.add('active-dragging');
    const boxRect = wmOverlayBox.getBoundingClientRect();
    wmDragOffset.x = touch.clientX - boxRect.left;
    wmDragOffset.y = touch.clientY - boxRect.top;
    e.stopPropagation();
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!isWmDragging && !isWmResizing) return;
    const touch = e.touches[0];

    if (isWmResizing) {
      const parentRect = watermarkViewportOverlay.getBoundingClientRect();
      const dx = touch.clientX - wmResizeStart.mouseX;
      const newWidthPx = Math.max(20, wmResizeStart.width + dx);
      let newPct = Math.round((newWidthPx / parentRect.width) * 100);
      newPct = Math.max(5, Math.min(50, newPct));

      wmState.sizePct = newPct;
      sliderWmSize.value = newPct;
      valWmSize.textContent = `${newPct}%`;
      updateWatermarkOverlay();
      return;
    }

    if (isWmDragging) {
      const parentRect = watermarkViewportOverlay.getBoundingClientRect();
      const boxW = wmOverlayBox.offsetWidth;
      const boxH = wmOverlayBox.offsetHeight;

      const leftPx = touch.clientX - parentRect.left - wmDragOffset.x;
      const topPx = touch.clientY - parentRect.top - wmDragOffset.y;

      const availW = Math.max(1, parentRect.width - boxW);
      const availH = Math.max(1, parentRect.height - boxH);

      let xPct = (leftPx / availW) * 100;
      let yPct = (topPx / availH) * 100;

      xPct = Math.max(0, Math.min(100, xPct));
      yPct = Math.max(0, Math.min(100, yPct));

      wmState.position = 'custom';
      wmState.xPct = xPct;
      wmState.yPct = yPct;

      wmPresetBtns.forEach((b) => b.classList.remove('active'));
      updateWatermarkOverlay();
    }
  }, { passive: true });

  window.addEventListener('touchend', () => {
    isWmDragging = false;
    isWmResizing = false;
    wmOverlayBox.classList.remove('active-dragging');
  });

  restoreWatermarkFromStorage();

  return {
    updateWatermarkOverlay,
    handleWatermarkFile,
    removeChannelWatermarkLogo
  };
}
