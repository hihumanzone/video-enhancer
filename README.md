# Subtle Video Polish

A focused video enhancement and smart compression platform with optional channel watermark overlay, built with Node.js, Express, and FFmpeg.

## Features

- **Subtle Visual Enhancement**: Exposure adjustment, contrast boost, vibrance/saturation boost, unsharp masking, highlight rolloff, and smooth speed adjustment.
- **Smart Compression**: Multi-codec support (H.265 / HEVC for maximum compression, H.264 / AVC for universal playback) with tuned CRF presets.
- **Channel Watermark Overlay**: Add a custom channel logo with position, size, opacity, and padding controls.
- **Interactive Watermark Overlay**: Drag-and-drop, corner-resize, opacity control, and position presets for custom channel logos.
- **Web UI & Live Split-Screen Viewport**: Interactive comparison slider with instant CSS preview filter synchronization.

## Screenshots

### Web UI Dashboard
![Web UI Dashboard](screenshots/web-ui-overview.png)

### Real-Time Split-Screen Comparison
![Live Split-Screen Comparison](screenshots/split-screen-comparison.png)

### Channel Watermark Controls & Settings
![Channel Watermark Controls](screenshots/watermark-controls.png)

## Quick Start

### 1. Installation

```bash
npm install
```

### 2. Run Web Server

```bash
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Command Line Interface (CLI)

```bash
# Basic video polish and H.265 compression
node enhance_video.js -i input.mp4 -o clean.mp4

node enhance_video.js -i input.mp4 -o polished.mp4 --watermark logo.png --watermark-position bottom-right --watermark-size 15 --watermark-opacity 0.9

# Full CLI Options
node enhance_video.js --help
```

## CLI Options

| Flag | Description |
|---|---|
| `-i, --input <file>` | Path to input video file (Required) |
| `-o, --output <file>` | Path to output video file |
| `--codec <h264\|h265>` | Video codec (Default: `h265`) |
| `--crf <value>` | Quality factor (Default: `24` for H.265, `20` for H.264) |
| `--watermark <path>` | Path to channel overlay logo image |
| `--watermark-position <pos>`| Position (`bottom-right`, `bottom-left`, `top-right`, `top-left`, `center`, `custom`) |

## License

MIT
