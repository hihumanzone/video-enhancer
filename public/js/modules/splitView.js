/**
 * Split View & Comparison Slider Module
 */

import { appState } from '../state.js';

export function initSplitView(dom) {
  const {
    viewportBox,
    splitHandle,
    enhancedOverlay,
    modeSplit,
    modeEnhanced,
    modeOriginal
  } = dom;

  function setSplit(pct) {
    const val = Math.max(0, Math.min(100, pct));
    splitHandle.style.left = `${val}%`;
    enhancedOverlay.style.clipPath = `polygon(${val}% 0, 100% 0, 100% 100%, ${val}% 100%)`;
  }

  function setMode(mode) {
    appState.viewMode = mode;
    modeSplit.classList.toggle('active',    mode === 'split');
    modeEnhanced.classList.toggle('active', mode === 'enhanced');
    modeOriginal.classList.toggle('active', mode === 'original');
  }

  // Mouse Dragging
  splitHandle.addEventListener('mousedown', (e) => {
    appState.isDraggingSplit = true;
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!appState.isDraggingSplit) return;
    const rect = viewportBox.getBoundingClientRect();
    setSplit(((e.clientX - rect.left) / rect.width) * 100);
  });

  window.addEventListener('mouseup', () => {
    appState.isDraggingSplit = false;
  });

  // Touch Dragging
  splitHandle.addEventListener('touchstart', (e) => {
    appState.isDraggingSplit = true;
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (!appState.isDraggingSplit) return;
    const rect = viewportBox.getBoundingClientRect();
    const touch = e.touches[0];
    setSplit(((touch.clientX - rect.left) / rect.width) * 100);
  }, { passive: true });

  window.addEventListener('touchend', () => {
    appState.isDraggingSplit = false;
  });

  // Mode Toggles
  modeSplit.addEventListener('click',    () => { setMode('split');    setSplit(50);  });
  modeEnhanced.addEventListener('click', () => { setMode('enhanced'); setSplit(0);   });
  modeOriginal.addEventListener('click', () => { setMode('original'); setSplit(100); });

  return {
    setSplit,
    setMode
  };
}
