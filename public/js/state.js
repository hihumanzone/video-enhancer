/**
 * Centralized Application State
 */

export const appState = {
  currentFile: null,
  videoUrl: null,
  isDraggingSplit: false,
  selectedCodec: 'h265',
  selectedCrf: 24,
  viewMode: 'split',
  
  sliders: {
    brightness: -0.015,
    contrast: 1.05,
    highlights: 0.96,
    saturation: 1.07,
    sharpness: 0.35
  },

  watermark: {
    file: null,
    enabled: true,
    position: 'bottom-right',
    sizePct: 15,
    opacity: 0.9,
    paddingPx: 70,
    xPct: 100,
    yPct: 100,
    logoUrl: null,
    aspectRatio: 1.0
  }
};
