/**
 * Enhancement API Integration & Status Polling Module
 */

import { appState } from '../state.js';

export function initEnhancerApi(dom) {
  const {
    codecH264,
    codecH265,
    crfCompact,
    crfMax,
    sliders,
    btnProcess,
    renderOverlay,
    renderBar,
    renderPct,
    renderMsg,
    videoEnhanced,
    downloadCard,
    dStats,
    btnDownload
  } = dom;

  function updateCrf() {
    const isMaxQuality = crfMax.classList.contains('active');
    appState.selectedCrf = appState.selectedCodec === 'h265'
      ? (isMaxQuality ? 20 : 24)
      : (isMaxQuality ? 18 : 20);
  }

  codecH264.addEventListener('click', () => {
    appState.selectedCodec = 'h264';
    codecH264.classList.add('active');
    codecH265.classList.remove('active');
    updateCrf();
  });

  codecH265.addEventListener('click', () => {
    appState.selectedCodec = 'h265';
    codecH265.classList.add('active');
    codecH264.classList.remove('active');
    updateCrf();
  });

  crfCompact.addEventListener('click', () => {
    crfCompact.classList.add('active');
    crfMax.classList.remove('active');
    updateCrf();
  });

  crfMax.addEventListener('click', () => {
    crfMax.classList.add('active');
    crfCompact.classList.remove('active');
    updateCrf();
  });

  btnProcess.addEventListener('click', async () => {
    if (!appState.currentFile) return;

    renderOverlay.classList.remove('hidden');
    renderBar.style.width = '0%';
    renderPct.textContent = '0%';
    renderMsg.textContent = 'Initializing...';
    btnProcess.disabled = true;

    const formData = new FormData();
    formData.append('video', appState.currentFile);
    formData.append('codec', appState.selectedCodec);
    formData.append('crf', appState.selectedCrf);
    formData.append('brightness', sliders.brightness.value);
    formData.append('contrast',   sliders.contrast.value);
    formData.append('highlights', sliders.highlights.value);
    formData.append('saturation', sliders.saturation.value);
    formData.append('sharpness',  sliders.sharpness.value);

    const wm = appState.watermark;
    if (wm.enabled && wm.file) {
      formData.append('watermark', wm.file);
      formData.append('hasWatermark', 'true');
      formData.append('watermarkPosition', wm.position);
      formData.append('watermarkSize', wm.sizePct);
      formData.append('watermarkOpacity', wm.opacity);
      formData.append('watermarkPadding', wm.paddingPx);
      formData.append('watermarkXPct', wm.xPct);
      formData.append('watermarkYPct', wm.yPct);
    }

    try {
      const res = await fetch('/api/enhance', { method: 'POST', body: formData });
      if (!res.ok) {
        if (res.status === 413) {
          throw new Error('File exceeds Vercel 4.5MB serverless upload limit. Please upload a smaller video or run locally for files up to 1GB.');
        }
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error (${res.status})`);
      }
      const data = await res.json();
      
      if (data.status === 'completed') {
        onJobCompleted(data);
      } else {
        pollStatus(data.id);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
      renderOverlay.classList.add('hidden');
      btnProcess.disabled = false;
    }
  });

  function onJobCompleted(job) {
    renderBar.style.width = '100%';
    renderPct.textContent = '100%';
    renderMsg.textContent = 'Complete!';

    setTimeout(() => {
      renderOverlay.classList.add('hidden');
      videoEnhanced.style.filter = 'none';
      videoEnhanced.src = job.outputUrl;
      videoEnhanced.play();
      btnProcess.disabled = false;

      if (job.stats) {
        const s = job.stats;
        dStats.textContent = `${appState.selectedCodec.toUpperCase()} | ${s.inMB} MB \u2192 ${s.outMB} MB (${s.savingsPct >= 0 ? s.savingsPct + '% smaller' : 'optimized'}) in ${s.elapsed}s`;
      }

      btnDownload.href = `/api/download/${job.id}`;
      downloadCard.classList.remove('hidden');

      // Trigger automatic file download
      triggerAutomaticDownload(`/api/download/${job.id}`, `enhanced_${job.originalName || 'video.mp4'}`);
    }, 400);
  }

  function triggerAutomaticDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function pollStatus(jobId) {
    let errorCount = 0;
    const MAX_ERRORS = 10;

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/job/${jobId}`);
        if (!res.ok) throw new Error('Poll failed');
        const job = await res.json();
        errorCount = 0;

        if (job.status === 'processing') {
          const pct = job.progress || 0;
          renderBar.style.width = `${pct}%`;
          renderPct.textContent = `${pct}%`;
          renderMsg.textContent = `Enhancing (${pct}%)...`;
        } else if (job.status === 'completed') {
          clearInterval(timer);
          onJobCompleted(job);
        } else if (job.status === 'error') {
          clearInterval(timer);
          alert(`Error: ${job.error}`);
          renderOverlay.classList.add('hidden');
          btnProcess.disabled = false;
        }
      } catch (err) {
        errorCount++;
        console.error(`Poll error (${errorCount}/${MAX_ERRORS}):`, err);
        if (errorCount >= MAX_ERRORS) {
          clearInterval(timer);
          alert('Lost connection to server.');
          renderOverlay.classList.add('hidden');
          btnProcess.disabled = false;
        }
      }
    }, 750);
  }
}
