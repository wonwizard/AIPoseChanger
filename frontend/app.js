(() => {
  const canvas       = document.getElementById('pose-canvas');
  const dropzone     = document.getElementById('dropzone');
  const fileInput    = document.getElementById('file-input');
  const promptTA     = document.getElementById('prompt-textarea');
  const generateBtn  = document.getElementById('generate-btn');
  const downloadBtn  = document.getElementById('download-btn');
  const resultImg    = document.getElementById('result-image');
  const resultPH     = document.getElementById('result-placeholder');
  const analyzeStatus  = document.getElementById('analyze-status');
  const generateStatus = document.getElementById('generate-status');

  const editor = new SkeletonEditor(canvas);

  let uploadedFile = null; // original File object

  // ── Upload / drag-and-drop ─────────────────────────────────────────────────

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', e => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });

  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));

  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  fileInput.addEventListener('change', e => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });

  function handleFile(file) {
    if (!file.type.startsWith('image/')) return;
    uploadedFile = file;

    // Show thumbnail in dropzone
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('dropzone-preview').src = e.target.result;
      dropzone.classList.add('has-image');
      editor.setBackground(e.target.result);
    };
    reader.readAsDataURL(file);

    analyzeImage(file);
  }

  // ── Analyze (pose detection + prompt extraction) ──────────────────────────

  async function analyzeImage(file) {
    setAnalyzeStatus('Analyzing image…');

    const fd = new FormData();
    fd.append('image', file);

    try {
      const res = await fetch('/api/analyze', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();

      editor.setKeypoints(data.keypoints);
      promptTA.value = data.prompt;
      setAnalyzeStatus('');
    } catch (err) {
      setAnalyzeStatus('Analysis failed: ' + err.message, true);
    }
  }

  // ── Generate ──────────────────────────────────────────────────────────────

  generateBtn.addEventListener('click', async () => {
    const prompt = promptTA.value.trim();
    if (!prompt) {
      setGenerateStatus('Please enter a prompt.', true);
      return;
    }

    setGenerating(true);
    setGenerateStatus('Generating…');

    const skeletonBlob = dataURLtoBlob(editor.getSkeletonImageDataURL());

    const fd = new FormData();
    fd.append('prompt', prompt);
    fd.append('skeleton_image', skeletonBlob, 'skeleton.png');
    if (uploadedFile) fd.append('original_image', uploadedFile);

    try {
      const res = await fetch('/api/generate', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || res.statusText);
      }
      const data = await res.json();
      showResult('data:image/png;base64,' + data.image_base64);
      setGenerateStatus('');
    } catch (err) {
      setGenerateStatus('Generation failed: ' + err.message, true);
    } finally {
      setGenerating(false);
    }
  });

  // ── Result display + download ──────────────────────────────────────────────

  function showResult(src) {
    resultImg.src = src;
    resultImg.style.display = 'block';
    resultPH.style.display = 'none';
    downloadBtn.classList.remove('hidden');
  }

  downloadBtn.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = resultImg.src;
    a.download = 'ai-pose-result.png';
    a.click();
  });

  // ── Helpers ───────────────────────────────────────────────────────────────

  function dataURLtoBlob(dataURL) {
    const [header, b64] = dataURL.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const binary = atob(b64);
    const buf = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
    return new Blob([buf], { type: mime });
  }

  function setAnalyzeStatus(msg, isError = false) {
    analyzeStatus.textContent = msg;
    analyzeStatus.className = 'status-text' + (isError ? ' error' : '');
  }

  function setGenerateStatus(msg, isError = false) {
    generateStatus.textContent = msg;
    generateStatus.className = 'status-text' + (isError ? ' error' : '');
  }

  function setGenerating(on) {
    generateBtn.disabled = on;
    generateBtn.textContent = on ? 'Generating…' : 'Generate New Image';
  }
})();
