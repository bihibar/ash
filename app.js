const $ = (id) => document.getElementById(id);

const controls = {
  imageInput: $("imageInput"),
  sourcePreview: $("sourcePreview"),
  sourceVideo: $("sourceVideo"),
  sampler: $("sampler"),
  svgMount: $("svgMount"),
  outputFrame: $("outputFrame"),
  outputCanvas: $("outputCanvas"),
  playOverlay: $("playOverlay"),
  status: $("status"),
  sampleCount: $("sampleCount"),
  mode: $("mode"),
  charset: $("charset"),
  resolution: $("resolution"),
  brightness: $("brightness"),
  contrast: $("contrast"),
  gamma: $("gamma"),
  cutoff: $("cutoff"),
  alphaCutoff: $("alphaCutoff"),
  density: $("density"),
  xScale: $("xScale"),
  yScale: $("yScale"),
  rotation: $("rotation"),
  jitter: $("jitter"),
  roundness: $("roundness"),
  inkColor: $("inkColor"),
  paperColor: $("paperColor"),
  sampleColors: $("sampleColors"),
  invert: $("invert"),
  transparentPaper: $("transparentPaper"),
  photoBackdrop: $("photoBackdrop"),
  copySvg: $("copySvg"),
  copyPng: $("copyPng"),
  saveSvg: $("saveSvg"),
  savePng: $("savePng"),
  saveJpg: $("saveJpg"),
  saveMp4: $("saveMp4"),
  exportMenu: document.querySelector(".export-menu"),
  clipboardBuffer: $("clipboardBuffer"),
  useGradient: $("useGradient"),
  gradientBlock: $("gradientBlock"),
  gradientEditor: $("gradientEditor"),
  gradientBar: $("gradientBar"),
  gradientAngle: $("gradientAngle"),
  gradientAngleValue: $("gradientAngleValue"),
  gradientReverse: $("gradientReverse"),
  gradientAddStop: $("gradientAddStop"),
  gradientStops: $("gradientStops"),
  uniformSize: $("uniformSize"),
  cropToggle: $("cropToggle"),
  sourceFrame: $("sourceFrame"),
  cropOverlay: $("cropOverlay"),
  cropBox: $("cropBox"),
  cropActions: $("cropActions"),
  cropApply: $("cropApply"),
  cropReset: $("cropReset"),
  cropCancel: $("cropCancel"),
};

const readouts = {
  resolution: $("resolutionValue"),
  brightness: $("brightnessValue"),
  contrast: $("contrastValue"),
  gamma: $("gammaValue"),
  cutoff: $("cutoffValue"),
  alphaCutoff: $("alphaCutoffValue"),
  density: $("densityValue"),
  xScale: $("xScaleValue"),
  yScale: $("yScaleValue"),
  rotation: $("rotationValue"),
  jitter: $("jitterValue"),
  roundness: $("roundnessValue"),
};

const charsets = {
  dotted: " .,;:oO8@",
  type: " .:-=+*#%@",
  binary: " 001101",
  minimal: " .:+#",
  dense: " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
};

const state = {
  media: null,
  sourceType: "image",
  image: null,
  video: null,
  imageUrl: "",
  videoObjectUrl: "",
  naturalWidth: 1280,
  naturalHeight: 780,
  mediaWidth: 1280,
  mediaHeight: 780,
  // Crop as fractions (0..1) of the full media. naturalWidth/Height track the
  // cropped region so all downstream output sizing stays correct.
  crop: { x: 0, y: 0, w: 1, h: 1 },
  cropping: false,
  cells: [],
  asciiText: "",
  svg: "",
  exporting: false,
  previewLoopActive: false,
  gradient: {
    enabled: false,
    angle: 90,
    stops: [
      { color: "#d9d9d9", opacity: 1, pos: 0 },
      { color: "#737373", opacity: 1, pos: 1 },
    ],
    selected: 0,
  },
};

const backdropCanvas = document.createElement("canvas");
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
let outputCtx = null;

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function hash2(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

const GRADIENT_ID = "inkGradient";

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  const full = value.length === 3
    ? value.split("").map((c) => c + c).join("")
    : value;
  const int = parseInt(full, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function rgbaString(hex, opacity) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// A gradient should read across the whole image (Figma-style fill over a
// selection), so the vector spans the bounding box and an angle rotates it
// about the centre. 0deg = left→right, 90deg = top→bottom.
function gradientVector(angle, width, height) {
  const rad = angle * DEG;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const half = (Math.abs(dx) * width + Math.abs(dy) * height) / 2;
  const cx = width / 2;
  const cy = height / 2;
  return {
    x1: cx - dx * half,
    y1: cy - dy * half,
    x2: cx + dx * half,
    y2: cy + dy * half,
  };
}

// True only when the gradient fill should replace the solid ink. Sampling image
// colours always wins, matching the per-cell rgb() path.
function gradientActive(config) {
  return config.gradient.enabled && !config.sampleColors && config.gradient.stops.length > 0;
}

function buildGradientDefs(config) {
  if (!gradientActive(config)) return "";
  const { x1, y1, x2, y2 } = gradientVector(config.gradient.angle, state.naturalWidth, state.naturalHeight);
  const stops = config.gradient.stops
    .map((stop) => `<stop offset="${(clamp(stop.pos) * 100).toFixed(2)}%" stop-color="${esc(stop.color)}" stop-opacity="${clamp(stop.opacity).toFixed(3)}"/>`)
    .join("");
  return `<defs><linearGradient id="${GRADIENT_ID}" gradientUnits="userSpaceOnUse" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}">${stops}</linearGradient></defs>`;
}

// Canvas twin of the SVG gradient, built in source-pixel space so it lines up
// with the scaled cell geometry.
function buildCanvasGradient(ctx, config) {
  if (!gradientActive(config)) return null;
  const { x1, y1, x2, y2 } = gradientVector(config.gradient.angle, state.naturalWidth, state.naturalHeight);
  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
  for (const stop of config.gradient.stops) {
    gradient.addColorStop(clamp(stop.pos), rgbaString(stop.color, clamp(stop.opacity)));
  }
  return gradient;
}

function settings() {
  return {
    mode: controls.mode.value,
    charset: charsets[controls.charset.value],
    columns: Number(controls.resolution.value),
    brightness: Number(controls.brightness.value) / 100,
    contrast: Number(controls.contrast.value) / 100,
    gamma: Number(controls.gamma.value) / 100,
    cutoff: Number(controls.cutoff.value) / 100,
    alphaCutoff: Number(controls.alphaCutoff.value) / 100,
    density: Number(controls.density.value) / 100,
    xScale: Number(controls.xScale.value) / 100,
    yScale: Number(controls.yScale.value) / 100,
    rotation: Number(controls.rotation.value),
    jitter: Number(controls.jitter.value) / 100,
    roundness: Number(controls.roundness.value) / 100,
    ink: controls.inkColor.value,
    paper: controls.paperColor.value,
    sampleColors: controls.sampleColors.checked,
    invert: controls.invert.checked,
    uniformSize: controls.uniformSize.checked,
    transparentPaper: controls.transparentPaper.checked,
    photoBackdrop: controls.photoBackdrop.checked,
    gradient: {
      enabled: state.gradient.enabled,
      angle: state.gradient.angle,
      // Sorted, immutable snapshot so SVG and canvas read identical stops.
      stops: [...state.gradient.stops].sort((a, b) => a.pos - b.pos),
    },
  };
}

function updateReadouts() {
  readouts.resolution.value = controls.resolution.value;
  readouts.brightness.value = controls.brightness.value;
  readouts.contrast.value = (Number(controls.contrast.value) / 100).toFixed(2);
  readouts.gamma.value = (Number(controls.gamma.value) / 100).toFixed(2);
  readouts.cutoff.value = `${controls.cutoff.value}%`;
  readouts.alphaCutoff.value = `${controls.alphaCutoff.value}%`;
  readouts.density.value = `${controls.density.value}%`;
  readouts.xScale.value = `${controls.xScale.value}%`;
  readouts.yScale.value = `${controls.yScale.value}%`;
  readouts.rotation.value = `${controls.rotation.value}deg`;
  readouts.jitter.value = `${controls.jitter.value}%`;
  readouts.roundness.value = `${controls.roundness.value}%`;
}

function setStatus(message) {
  controls.status.textContent = message;
}

function createDemoImage() {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 1280;
  canvas.height = 780;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const sky = ctx.createLinearGradient(0, 0, 0, 430);
  sky.addColorStop(0, "#93b8da");
  sky.addColorStop(1, "#e1dfd0");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#586879";
  ctx.beginPath();
  ctx.moveTo(0, 360);
  for (let x = 0; x <= canvas.width; x += 80) {
    ctx.lineTo(x, 285 + Math.sin(x * 0.013) * 45 + Math.cos(x * 0.021) * 22);
  }
  ctx.lineTo(canvas.width, 470);
  ctx.lineTo(0, 470);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#c2a77e";
  for (let i = 0; i < 42; i += 1) {
    const x = (i * 89) % canvas.width;
    const y = 330 + ((i * 37) % 118);
    const w = 36 + ((i * 17) % 72);
    const h = 34 + ((i * 13) % 86);
    ctx.fillRect(x, y, w, h);
  }

  ctx.fillStyle = "#24272d";
  ctx.beginPath();
  ctx.moveTo(380, 780);
  ctx.lineTo(570, 440);
  ctx.lineTo(710, 440);
  ctx.lineTo(940, 780);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#f5f5eb";
  ctx.lineWidth = 5;
  for (let x = 510; x <= 820; x += 82) {
    ctx.beginPath();
    ctx.moveTo(x, 780);
    ctx.lineTo(635 + (x - 660) * 0.12, 450);
    ctx.stroke();
  }

  ctx.fillStyle = "#1d3428";
  for (let i = 0; i < 86; i += 1) {
    const x = (i * 73) % canvas.width;
    const y = 430 + ((i * 41) % 295);
    ctx.beginPath();
    ctx.arc(x, y, 8 + ((i * 11) % 25), 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas.toDataURL("image/png");
}

// naturalWidth/Height track the cropped region; mediaWidth/Height stay the full
// source. Call after a load or whenever the crop rect changes.
function applyCropDims() {
  state.naturalWidth = Math.max(1, Math.round(state.mediaWidth * state.crop.w));
  state.naturalHeight = Math.max(1, Math.round(state.mediaHeight * state.crop.h));
}

function resetCrop() {
  state.crop = { x: 0, y: 0, w: 1, h: 1 };
}

function loadImage(src) {
  const image = new Image();
  image.onload = () => {
    teardownVideo();
    state.sourceType = "image";
    state.media = image;
    state.image = image;
    state.mediaWidth = image.naturalWidth;
    state.mediaHeight = image.naturalHeight;
    resetCrop();
    applyCropDims();
    closeCropUi();
    state.imageUrl = src;
    showSource("image");
    showOutput("svg");
    controls.sourcePreview.src = src;
    render();
    updatePlayOverlay();
  };
  image.src = src;
}

function showSource(type) {
  const isVideo = type === "video";
  controls.sourcePreview.hidden = isVideo;
  controls.sourceVideo.hidden = !isVideo;
}

function teardownVideo() {
  const video = controls.sourceVideo;
  state.previewLoopActive = false;
  if (!video.paused) video.pause();
  if (state.videoObjectUrl) {
    URL.revokeObjectURL(state.videoObjectUrl);
    state.videoObjectUrl = "";
  }
}

function loadVideo(url) {
  teardownVideo();
  const video = controls.sourceVideo;
  state.videoObjectUrl = url;
  video.src = url;
  video.addEventListener("loadeddata", onVideoReady, { once: true });
  video.load();
}

async function onVideoReady() {
  const video = controls.sourceVideo;
  state.sourceType = "video";
  state.media = video;
  state.video = video;
  state.mediaWidth = video.videoWidth;
  state.mediaHeight = video.videoHeight;
  resetCrop();
  applyCropDims();
  closeCropUi();
  showSource("video");
  sizeOutputCanvas();
  await seekVideo(0);
  showOutput("svg");
  render();
  updatePlayOverlay();
}

function seekVideo(time) {
  const video = controls.sourceVideo;
  const max = Math.max(0, (video.duration || 0) - 0.001);
  const target = Math.min(Math.max(0, time), max);
  return new Promise((resolve) => {
    if (video.readyState >= 2 && Math.abs(video.currentTime - target) < 1e-4) {
      resolve();
      return;
    }
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
    };
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, 3000);
    video.addEventListener("seeked", onSeeked);
    video.currentTime = target;
  });
}

function showOutput(kind) {
  const canvas = kind === "canvas";
  controls.svgMount.hidden = canvas;
  controls.outputCanvas.hidden = !canvas;
}

// Clicking (or pressing space on) the preview toggles playback for a video.
function togglePlayback() {
  if (state.sourceType !== "video" || state.exporting) return;
  const video = controls.sourceVideo;
  if (video.paused) video.play().catch(() => {});
  else video.pause();
}

function updatePlayOverlay() {
  const isVideo = state.sourceType === "video";
  const showPlay = isVideo && controls.sourceVideo.paused && !state.exporting;
  controls.playOverlay.hidden = !showPlay;
  controls.outputFrame.classList.toggle("has-video", isVideo);
}

// Shared by the file input and drag-and-drop.
function handleMediaFile(file) {
  if (!file) return;
  if (file.type.startsWith("video/")) {
    loadVideo(URL.createObjectURL(file));
  } else if (file.type.startsWith("image/")) {
    const reader = new FileReader();
    reader.onload = () => {
      state.imageUrl = reader.result;
      loadImage(state.imageUrl);
    };
    reader.readAsDataURL(file);
  }
}

// The preview canvas is sized to the source (capped) so the per-cell geometry,
// which is computed in source pixels, maps over with a single ctx.scale.
function sizeOutputCanvas() {
  const cap = 1280;
  const scale = Math.min(1, cap / Math.max(state.naturalWidth, state.naturalHeight));
  const w = Math.max(2, Math.round(state.naturalWidth * scale));
  const h = Math.max(2, Math.round(state.naturalHeight * scale));
  const canvas = controls.outputCanvas;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  outputCtx = canvas.getContext("2d");
}

function drawVideoPreviewFrame() {
  const canvas = controls.outputCanvas;
  const config = settings();
  updateReadouts();
  const grid = drawToCanvas(config, outputCtx, canvas.width, canvas.height);
  controls.sampleCount.textContent = `${grid.visibleCount.toLocaleString()} marks`;
}

// Silky playback: draw straight to the canvas each presented frame instead of
// rebuilding an SVG string + reparsing it through innerHTML. requestVideoFrameCallback
// only fires for real frames, so the loop self-stops the moment the clip pauses.
function startPlaybackLoop() {
  const video = controls.sourceVideo;
  if (state.previewLoopActive) return;
  state.previewLoopActive = true;
  showOutput("canvas");
  const useRvfc = typeof video.requestVideoFrameCallback === "function";
  const step = () => {
    if (state.sourceType !== "video" || state.exporting || video.paused) {
      state.previewLoopActive = false;
      return;
    }
    drawVideoPreviewFrame();
    if (useRvfc) video.requestVideoFrameCallback(step);
    else requestAnimationFrame(step);
  };
  if (useRvfc) video.requestVideoFrameCallback(step);
  else requestAnimationFrame(step);
}

// The faint source backdrop embeds a data URL in the SVG. It must reflect the
// current crop (and, for video, the current frame), so snapshot the cropped
// region on demand whenever the backdrop is enabled.
function refreshBackdrop(config) {
  if (!config.photoBackdrop || !state.media) return;
  const cr = state.crop;
  const cropW = cr.w * state.mediaWidth;
  const cropH = cr.h * state.mediaHeight;
  const maxDim = 720;
  const scale = Math.min(1, maxDim / Math.max(cropW, cropH));
  const w = Math.max(1, Math.round(cropW * scale));
  const h = Math.max(1, Math.round(cropH * scale));
  backdropCanvas.width = w;
  backdropCanvas.height = h;
  const ctx = backdropCanvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(state.media, cr.x * state.mediaWidth, cr.y * state.mediaHeight, cropW, cropH, 0, 0, w, h);
  state.imageUrl = backdropCanvas.toDataURL(state.sourceType === "video" ? "image/jpeg" : "image/png", 0.85);
}

function sampleImage(config) {
  const image = state.media;
  const canvas = controls.sampler;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const ratio = state.naturalHeight / state.naturalWidth;
  const columns = config.columns;
  const rows = Math.max(8, Math.round(columns * ratio * 0.56));
  const cellW = state.naturalWidth / columns;
  const cellH = state.naturalHeight / rows;

  canvas.width = columns;
  canvas.height = rows;
  ctx.clearRect(0, 0, columns, rows);
  const cr = state.crop;
  ctx.drawImage(
    image,
    cr.x * state.mediaWidth, cr.y * state.mediaHeight,
    cr.w * state.mediaWidth, cr.h * state.mediaHeight,
    0, 0, columns, rows,
  );

  const pixels = ctx.getImageData(0, 0, columns, rows).data;
  const cells = [];
  const textRows = [];
  const chars = config.charset;
  let visibleCount = 0;

  for (let y = 0; y < rows; y += 1) {
    let line = "";
    for (let x = 0; x < columns; x += 1) {
      const index = (y * columns + x) * 4;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const alpha = pixels[index + 3] / 255;
      let light = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      light = (light - 0.5) * config.contrast + 0.5 + config.brightness;
      light = Math.pow(clamp(light), 1 / config.gamma);
      if (config.invert) light = 1 - light;

      const mark = clamp(1 - light);
      const visible = alpha > 0.001 && alpha >= config.alphaCutoff && mark >= config.cutoff;
      const charIndex = Math.round(mark * (chars.length - 1));
      const char = visible ? chars[charIndex] : " ";
      if (visible) visibleCount += 1;

      cells.push({
        x,
        y,
        cx: x * cellW + cellW / 2,
        cy: y * cellH + cellH / 2,
        w: cellW,
        h: cellH,
        r,
        g,
        b,
        alpha,
        light,
        mark,
        visible,
        char,
        color: config.sampleColors ? `rgb(${r} ${g} ${b})` : config.ink,
      });
      line += char;
    }
    textRows.push(line.replace(/\s+$/, ""));
  }

  state.cells = cells;
  state.asciiText = textRows.join("\n");
  return { columns, rows, cellW, cellH, visibleCount };
}

function jittered(cell, config) {
  if (!config.jitter) return { x: cell.cx, y: cell.cy, rotation: config.rotation };
  const amount = Math.min(cell.w, cell.h) * config.jitter * 0.42;
  const jx = (hash2(cell.x, cell.y) - 0.5) * amount;
  const jy = (hash2(cell.x + 19, cell.y + 31) - 0.5) * amount;
  const jr = (hash2(cell.x + 5, cell.y + 11) - 0.5) * config.jitter * 50;
  return { x: cell.cx + jx, y: cell.cy + jy, rotation: config.rotation + jr };
}

function lineMark(x, y, length, angle, stroke, ink, opacity) {
  const radians = (angle * Math.PI) / 180;
  const dx = Math.cos(radians) * length * 0.5;
  const dy = Math.sin(radians) * length * 0.5;
  return `<line x1="${(x - dx).toFixed(2)}" y1="${(y - dy).toFixed(2)}" x2="${(x + dx).toFixed(2)}" y2="${(y + dy).toFixed(2)}" stroke="${ink}" stroke-width="${stroke.toFixed(2)}" stroke-linecap="round" opacity="${opacity.toFixed(3)}"/>`;
}

function polygon(points, x, y, width, height, rotation) {
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return points
    .map(([px, py]) => {
      const sx = px * width * 0.5;
      const sy = py * height * 0.5;
      return `${(x + sx * cos - sy * sin).toFixed(2)},${(y + sx * sin + sy * cos).toFixed(2)}`;
    })
    .join(" ");
}

function renderCell(cell, config) {
  if (!cell.visible) return "";

  const pos = jittered(cell, config);
  const opacity = clamp((0.22 + cell.mark * 0.86) * cell.alpha);
  if (opacity <= 0.001) return "";
  const ink = gradientActive(config) ? `url(#${GRADIENT_ID})` : esc(cell.color);
  // Uniform size ignores per-cell tone so every mark is the same dimension.
  const sizeMark = config.uniformSize ? 1 : cell.mark;
  const base = Math.min(cell.w, cell.h) * config.density * (0.16 + sizeMark * 0.84);
  const width = base * config.xScale;
  const height = base * config.yScale;

  if (config.mode === "dots") {
    return `<circle cx="${pos.x.toFixed(2)}" cy="${pos.y.toFixed(2)}" r="${(Math.min(width, height) * 0.5).toFixed(2)}" fill="${ink}" opacity="${opacity.toFixed(3)}"/>`;
  }

  if (config.mode === "rings") {
    const stroke = Math.max(0.65, Math.min(cell.w, cell.h) * 0.055 * config.density);
    return `<circle cx="${pos.x.toFixed(2)}" cy="${pos.y.toFixed(2)}" r="${(Math.min(width, height) * 0.5).toFixed(2)}" fill="none" stroke="${ink}" stroke-width="${stroke.toFixed(2)}" opacity="${opacity.toFixed(3)}"/>`;
  }

  if (config.mode === "squares" || config.mode === "rectangles") {
    const rectW = config.mode === "squares" ? Math.min(width, height) : width;
    const rectH = config.mode === "squares" ? Math.min(width, height) : height;
    const rx = Math.min(rectW, rectH) * config.roundness * 0.35;
    return `<rect x="${(-rectW / 2).toFixed(2)}" y="${(-rectH / 2).toFixed(2)}" width="${rectW.toFixed(2)}" height="${rectH.toFixed(2)}" rx="${rx.toFixed(2)}" fill="${ink}" opacity="${opacity.toFixed(3)}" transform="translate(${pos.x.toFixed(2)} ${pos.y.toFixed(2)}) rotate(${pos.rotation.toFixed(2)})"/>`;
  }

  if (config.mode === "triangles") {
    const points = polygon([[0, -1], [0.92, 0.72], [-0.92, 0.72]], pos.x, pos.y, width, height, pos.rotation);
    return `<polygon points="${points}" fill="${ink}" opacity="${opacity.toFixed(3)}"/>`;
  }

  if (config.mode === "diamonds") {
    const points = polygon([[0, -1], [1, 0], [0, 1], [-1, 0]], pos.x, pos.y, width, height, pos.rotation);
    return `<polygon points="${points}" fill="${ink}" opacity="${opacity.toFixed(3)}"/>`;
  }

  if (config.mode === "hatch" || config.mode === "crosshatch" || config.mode === "waves") {
    const length = Math.max(width, height) * (0.72 + sizeMark * 0.8);
    const stroke = Math.max(0.65, Math.min(cell.w, cell.h) * 0.06 * config.density * (0.48 + sizeMark));
    const wave = config.mode === "waves";
    const angle = config.rotation + (wave ? Math.sin(cell.y * 0.55 + cell.x * 0.17) * 30 : 0);
    const first = lineMark(pos.x, pos.y, length, angle, stroke, ink, opacity);
    const second = config.mode === "crosshatch" && cell.mark > 0.38
      ? lineMark(pos.x, pos.y, length * 0.86, angle + 88, stroke * 0.76, ink, opacity * 0.78)
      : "";
    return first + second;
  }

  const fontSize = Math.max(4, Math.min(cell.w, cell.h) * config.density * 1.28);
  return `<text x="${pos.x.toFixed(2)}" y="${pos.y.toFixed(2)}" text-anchor="middle" dominant-baseline="central" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="${fontSize.toFixed(2)}" fill="${ink}" opacity="${opacity.toFixed(3)}" transform="rotate(${pos.rotation.toFixed(2)} ${pos.x.toFixed(2)} ${pos.y.toFixed(2)})">${esc(cell.char)}</text>`;
}

function strokeLineCanvas(ctx, x, y, length, angle, stroke) {
  const radians = angle * DEG;
  const dx = Math.cos(radians) * length * 0.5;
  const dy = Math.sin(radians) * length * 0.5;
  ctx.lineWidth = stroke;
  ctx.beginPath();
  ctx.moveTo(x - dx, y - dy);
  ctx.lineTo(x + dx, y + dy);
  ctx.stroke();
}

// Canvas twin of renderCell — same geometry, drawn instead of serialized so it
// can run at video frame rates.
function drawCellOnCanvas(ctx, cell, config, fill) {
  if (!cell.visible) return;
  const pos = jittered(cell, config);
  const opacity = clamp((0.22 + cell.mark * 0.86) * cell.alpha);
  if (opacity <= 0.001) return;
  const color = fill || cell.color;
  const sizeMark = config.uniformSize ? 1 : cell.mark;
  const base = Math.min(cell.w, cell.h) * config.density * (0.16 + sizeMark * 0.84);
  const width = base * config.xScale;
  const height = base * config.yScale;
  ctx.globalAlpha = opacity;
  const mode = config.mode;

  if (mode === "dots") {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, Math.min(width, height) * 0.5, 0, TAU);
    ctx.fill();
    return;
  }

  if (mode === "rings") {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.65, Math.min(cell.w, cell.h) * 0.055 * config.density);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, Math.min(width, height) * 0.5, 0, TAU);
    ctx.stroke();
    return;
  }

  if (mode === "squares" || mode === "rectangles") {
    const rectW = mode === "squares" ? Math.min(width, height) : width;
    const rectH = mode === "squares" ? Math.min(width, height) : height;
    const rx = Math.min(rectW, rectH) * config.roundness * 0.35;
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(pos.rotation * DEG);
    ctx.fillStyle = color;
    ctx.beginPath();
    if (rx > 0.01 && ctx.roundRect) ctx.roundRect(-rectW / 2, -rectH / 2, rectW, rectH, rx);
    else ctx.rect(-rectW / 2, -rectH / 2, rectW, rectH);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (mode === "triangles" || mode === "diamonds") {
    const points = mode === "triangles"
      ? [[0, -1], [0.92, 0.72], [-0.92, 0.72]]
      : [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const radians = pos.rotation * DEG;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < points.length; i += 1) {
      const sx = points[i][0] * width * 0.5;
      const sy = points[i][1] * height * 0.5;
      const px = pos.x + sx * cos - sy * sin;
      const py = pos.y + sx * sin + sy * cos;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (mode === "hatch" || mode === "crosshatch" || mode === "waves") {
    const length = Math.max(width, height) * (0.72 + sizeMark * 0.8);
    const stroke = Math.max(0.65, Math.min(cell.w, cell.h) * 0.06 * config.density * (0.48 + sizeMark));
    const wave = mode === "waves";
    const angle = config.rotation + (wave ? Math.sin(cell.y * 0.55 + cell.x * 0.17) * 30 : 0);
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    strokeLineCanvas(ctx, pos.x, pos.y, length, angle, stroke);
    if (mode === "crosshatch" && cell.mark > 0.38) {
      ctx.globalAlpha = opacity * 0.78;
      strokeLineCanvas(ctx, pos.x, pos.y, length * 0.86, angle + 88, stroke * 0.76);
    }
    return;
  }

  const fontSize = Math.max(4, Math.min(cell.w, cell.h) * config.density * 1.28);
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(pos.rotation * DEG);
  ctx.fillStyle = color;
  ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(cell.char, 0, 0);
  ctx.restore();
}

// Samples the current frame and paints every mark to a 2D context. Shared by the
// live preview and the MP4 export so both look identical to the SVG output.
function drawToCanvas(config, ctx, targetW, targetH, backgroundOverride) {
  const grid = sampleImage(config);
  const scale = targetW / state.naturalWidth;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, targetW, targetH);
  const background = backgroundOverride !== undefined
    ? backgroundOverride
    : (config.transparentPaper ? null : config.paper);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, targetW, targetH);
  }
  if (config.photoBackdrop && state.media) {
    const cr = state.crop;
    ctx.globalAlpha = 0.18;
    ctx.drawImage(
      state.media,
      cr.x * state.mediaWidth, cr.y * state.mediaHeight,
      cr.w * state.mediaWidth, cr.h * state.mediaHeight,
      0, 0, targetW, targetH,
    );
    ctx.globalAlpha = 1;
  }
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  // Gradient is built in source-pixel space (same as the cell geometry) so it
  // spans the image consistently under the active transform.
  const fill = buildCanvasGradient(ctx, config);
  const cells = state.cells;
  for (let i = 0; i < cells.length; i += 1) {
    drawCellOnCanvas(ctx, cells[i], config, fill);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  return grid;
}

function buildSvg(config, grid) {
  const width = state.naturalWidth;
  const height = state.naturalHeight;
  const background = config.transparentPaper ? "" : `<rect width="100%" height="100%" fill="${esc(config.paper)}"/>`;
  const backdrop = config.photoBackdrop && state.imageUrl
    ? `<image href="${esc(state.imageUrl)}" width="${width}" height="${height}" opacity="0.18" preserveAspectRatio="none"/>`
    : "";
  const defs = buildGradientDefs(config);
  const marks = state.cells.map((cell) => renderCell(cell, config)).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width)}" height="${Math.round(height)}" viewBox="0 0 ${Math.round(width)} ${Math.round(height)}" role="img" aria-label="Generated vector pattern">
  ${defs}
  ${background}
  ${backdrop}
  <g data-pattern="${esc(config.mode)}" data-columns="${grid.columns}" data-rows="${grid.rows}" data-alpha-aware="true">
    ${marks}
  </g>
</svg>`;
  state.svg = svg;
  return svg;
}

function render() {
  if (!state.media) return;
  controls.clipboardBuffer.classList.remove("ready");
  updateReadouts();
  const config = settings();
  refreshBackdrop(config);
  const grid = sampleImage(config);
  const svg = buildSvg(config, grid);
  document.documentElement.style.setProperty("--paper", config.paper);
  controls.svgMount.innerHTML = svg;
  controls.sampleCount.textContent = `${grid.visibleCount.toLocaleString()} marks`;
  const suffix = state.sourceType === "video"
    ? " Press Save MP4 to render the whole clip."
    : " Transparent pixels are removed from the SVG.";
  setStatus(`${grid.columns} x ${grid.rows} samples.${suffix}`);
}

function download(filename, href) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = href;
  link.click();
}

// The still-image exports read state.svg, which isn't rebuilt during canvas
// playback. Refresh it from the current video frame before they run.
function ensureCurrentSvg() {
  if (state.sourceType !== "video") return;
  const config = settings();
  refreshBackdrop(config);
  const grid = sampleImage(config);
  buildSvg(config, grid);
}

async function writeTextClipboard(text) {
  controls.clipboardBuffer.classList.remove("ready");
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // Keep going to the selection fallback.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

function selectForManualCopy(text) {
  controls.clipboardBuffer.value = text;
  controls.clipboardBuffer.classList.add("ready");
  controls.clipboardBuffer.focus();
  controls.clipboardBuffer.select();
}

async function copySvg() {
  ensureCurrentSvg();
  const copied = await writeTextClipboard(state.svg);
  if (copied) {
    setStatus("SVG copied to clipboard.");
  } else {
    selectForManualCopy(state.svg);
    setStatus("SVG selected in export buffer. Press Cmd+C or Ctrl+C.");
  }
}

function svgToImage() {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(state.svg)}`;
  });
}

async function rasterBlob(type) {
  ensureCurrentSvg();
  const config = settings();
  const image = await svgToImage();
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = state.naturalWidth;
  canvas.height = state.naturalHeight;

  if (type === "image/jpeg" || !config.transparentPaper) {
    ctx.fillStyle = config.transparentPaper && type === "image/jpeg" ? "#ffffff" : config.paper;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(image, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, type, type === "image/jpeg" ? 0.94 : 1));
}

async function copyPng() {
  if (!navigator.clipboard || !window.ClipboardItem) {
    setStatus("PNG clipboard is not available here. Use Save PNG.");
    return;
  }

  try {
    const blob = await rasterBlob("image/png");
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    setStatus("PNG copied to clipboard.");
  } catch (error) {
    setStatus("PNG clipboard was blocked. Use Save PNG.");
  }
}

function saveSvg() {
  ensureCurrentSvg();
  const blob = new Blob([state.svg], { type: "image/svg+xml" });
  download("pattern-field.svg", URL.createObjectURL(blob));
}

async function saveRaster(type, filename) {
  const blob = await rasterBlob(type);
  download(filename, URL.createObjectURL(blob));
}

async function pickH264Codec(width, height, fps, bitrate) {
  const candidates = [
    "avc1.640028", "avc1.4d0028", "avc1.42e01f",
    "avc1.640020", "avc1.4d401f", "avc1.42001f",
  ];
  for (const codec of candidates) {
    try {
      const support = await VideoEncoder.isConfigSupported({
        codec, width, height, bitrate, framerate: fps,
      });
      if (support && support.supported) return codec;
    } catch (error) {
      // Try the next candidate.
    }
  }
  return null;
}

function setExportingUi(active) {
  controls.saveMp4.disabled = active;
  controls.saveMp4.textContent = active ? "Encoding…" : "Save MP4";
}

async function exportMp4() {
  if (state.sourceType !== "video" || !state.video) {
    setStatus("Load a video first, then Save MP4.");
    return;
  }
  if (state.exporting) return;
  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") {
    setStatus("MP4 export needs WebCodecs — use Chrome/Edge or Safari 16.4+, served over http://localhost or https.");
    return;
  }

  let Muxer;
  let ArrayBufferTarget;
  try {
    ({ Muxer, ArrayBufferTarget } = await import("https://cdn.jsdelivr.net/npm/mp4-muxer@5/+esm"));
  } catch (error) {
    setStatus("Could not load the MP4 encoder (are you offline?).");
    return;
  }

  const video = state.video;
  const duration = video.duration;
  if (!isFinite(duration) || duration <= 0) {
    setStatus("Video duration is unknown, so it can't be exported.");
    return;
  }

  const fps = 30;
  const maxDim = 1920;
  const scale = Math.min(1, maxDim / Math.max(state.naturalWidth, state.naturalHeight));
  // H.264 requires even dimensions.
  const outW = Math.max(2, Math.round(state.naturalWidth * scale) & ~1);
  const outH = Math.max(2, Math.round(state.naturalHeight * scale) & ~1);

  // Scale bitrate with the frame size (ASCII edges are detail-heavy). ~8 Mbps at
  // 720p, ~18 Mbps at 1080p, capped at 20 Mbps.
  const bitrate = Math.min(20_000_000, Math.round(outW * outH * fps * 0.3));

  const codec = await pickH264Codec(outW, outH, fps, bitrate);
  if (!codec) {
    setStatus("No supported H.264 configuration for this video size.");
    return;
  }

  state.exporting = true;
  const wasPaused = video.paused;
  video.pause();
  setExportingUi(true);
  updatePlayOverlay();
  setStatus("Preparing MP4 export…");

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width: outW, height: outH },
    fastStart: "in-memory",
  });
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => {
      console.error(error);
      setStatus(`Encoder error: ${error.message}`);
    },
  });
  encoder.configure({ codec, width: outW, height: outH, bitrate, framerate: fps });

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  const config = settings();
  const totalFrames = Math.max(1, Math.floor(duration * fps));

  // H.264 has no alpha, so force an opaque background.
  const background = config.transparentPaper ? "#000000" : config.paper;

  try {
    for (let i = 0; i < totalFrames; i += 1) {
      await seekVideo(i / fps);
      // Same renderer as the live preview, straight onto the export canvas.
      drawToCanvas(config, ctx, outW, outH, background);

      const frame = new VideoFrame(canvas, {
        timestamp: Math.round((i * 1e6) / fps),
        duration: Math.round(1e6 / fps),
      });
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();

      // Let the encoder drain so memory stays bounded.
      while (encoder.encodeQueueSize > 10) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (i % 3 === 0) {
        setStatus(`Encoding MP4… frame ${i + 1} / ${totalFrames}`);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }

    await encoder.flush();
    muxer.finalize();
    const blob = new Blob([muxer.target.buffer], { type: "video/mp4" });
    download("ash-video.mp4", URL.createObjectURL(blob));
    setStatus(`MP4 exported — ${totalFrames} frames at ${fps} fps.`);
  } catch (error) {
    console.error(error);
    setStatus(`MP4 export failed: ${error.message}`);
  } finally {
    if (encoder.state !== "closed") encoder.close();
    state.exporting = false;
    setExportingUi(false);
    if (wasPaused) {
      showOutput("svg");
      render();
    } else {
      video.play().catch(() => {});
    }
    updatePlayOverlay();
  }
}

/* ---------- Gradient editor (Figma-style) ---------- */

// Re-render the output after a gradient edit, mirroring the playback rule used
// elsewhere: while a clip plays, the canvas loop already reads live settings.
function gradientRender() {
  if (state.previewLoopActive) return;
  render();
}

// Repaint the preview bar background and reposition every handle. Cheap enough
// to call on each drag / value tweak without rebuilding the stop rows.
function paintGradientBar() {
  const g = state.gradient;
  const sorted = [...g.stops].sort((a, b) => a.pos - b.pos);
  const css = sorted
    .map((stop) => `${rgbaString(stop.color, clamp(stop.opacity))} ${(clamp(stop.pos) * 100).toFixed(1)}%`)
    .join(", ");
  controls.gradientBar.style.background = `linear-gradient(90deg, ${css})`;
  controls.gradientBar.querySelectorAll(".gradient-handle").forEach((handle) => {
    const index = Number(handle.dataset.index);
    const stop = g.stops[index];
    if (!stop) return;
    handle.style.left = `${clamp(stop.pos) * 100}%`;
    handle.style.setProperty("--swatch", stop.color);
    handle.classList.toggle("selected", index === g.selected);
  });
}

// Full rebuild of handles + rows. Used on structural changes (add / remove /
// select / reverse / enable) — avoided during inline edits so inputs keep focus.
function buildGradientUi() {
  const g = state.gradient;
  controls.gradientAngle.value = g.angle;
  controls.gradientAngleValue.value = `${Math.round(g.angle)}°`;

  const handles = g.stops
    .map((stop, index) => `<button type="button" class="gradient-handle${index === g.selected ? " selected" : ""}" data-index="${index}" style="left:${clamp(stop.pos) * 100}%;--swatch:${esc(stop.color)}" aria-label="Gradient stop"></button>`)
    .join("");
  controls.gradientBar.innerHTML = handles;

  const rows = g.stops
    .map((stop, index) => {
      const hex = stop.color.replace("#", "").toUpperCase();
      return `<div class="gradient-stop-row${index === g.selected ? " selected" : ""}" data-index="${index}">
        <input class="g-pos" type="number" min="0" max="100" value="${Math.round(stop.pos * 100)}" aria-label="Stop position" />
        <span class="g-swatch"><input class="g-color" type="color" value="${esc(stop.color)}" aria-label="Stop color" /></span>
        <input class="g-hex" type="text" maxlength="7" value="${esc(hex)}" aria-label="Stop hex" />
        <input class="g-opacity" type="number" min="0" max="100" value="${Math.round(stop.opacity * 100)}" aria-label="Stop opacity" />
        <button class="g-remove gradient-mini-btn" type="button" ${g.stops.length <= 2 ? "disabled" : ""} aria-label="Remove stop">−</button>
      </div>`;
    })
    .join("");
  controls.gradientStops.innerHTML = rows;
  paintGradientBar();
}

function selectStop(index) {
  state.gradient.selected = index;
  buildGradientUi();
}

function addStopAt(pos) {
  const g = state.gradient;
  const clamped = clamp(pos);
  // Inherit the colour the gradient already shows at this position.
  const sorted = [...g.stops].sort((a, b) => a.pos - b.pos);
  let near = sorted[0];
  for (const stop of sorted) {
    if (stop.pos <= clamped) near = stop;
  }
  g.stops.push({ color: near.color, opacity: near.opacity, pos: clamped });
  g.selected = g.stops.length - 1;
  buildGradientUi();
  gradientRender();
}

function removeStop(index) {
  const g = state.gradient;
  if (g.stops.length <= 2) return;
  g.stops.splice(index, 1);
  g.selected = Math.min(g.selected, g.stops.length - 1);
  buildGradientUi();
  gradientRender();
}

function bindGradientEditor() {
  controls.useGradient.addEventListener("change", () => {
    state.gradient.enabled = controls.useGradient.checked;
    controls.gradientEditor.hidden = !state.gradient.enabled;
    if (state.gradient.enabled) buildGradientUi();
    gradientRender();
  });

  controls.gradientAngle.addEventListener("input", () => {
    state.gradient.angle = Number(controls.gradientAngle.value);
    controls.gradientAngleValue.value = `${Math.round(state.gradient.angle)}°`;
    gradientRender();
  });

  controls.gradientReverse.addEventListener("click", () => {
    state.gradient.stops.forEach((stop) => { stop.pos = clamp(1 - stop.pos); });
    buildGradientUi();
    gradientRender();
  });

  controls.gradientAddStop.addEventListener("click", () => addStopAt(0.5));

  // Click an empty spot on the bar to drop a new stop there.
  controls.gradientBar.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".gradient-handle")) return;
    const rect = controls.gradientBar.getBoundingClientRect();
    addStopAt((event.clientX - rect.left) / rect.width);
  });

  // Drag a handle along the bar to move its stop.
  let dragIndex = -1;
  const onMove = (event) => {
    if (dragIndex < 0) return;
    const rect = controls.gradientBar.getBoundingClientRect();
    const pos = clamp((event.clientX - rect.left) / rect.width);
    state.gradient.stops[dragIndex].pos = pos;
    const row = controls.gradientStops.querySelector(`.gradient-stop-row[data-index="${dragIndex}"] .g-pos`);
    if (row) row.value = Math.round(pos * 100);
    paintGradientBar();
    gradientRender();
  };
  const endDrag = () => {
    dragIndex = -1;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", endDrag);
  };
  controls.gradientBar.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest(".gradient-handle");
    if (!handle) return;
    dragIndex = Number(handle.dataset.index);
    selectStop(dragIndex);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", endDrag);
  });

  // Inline edits on the stop rows.
  controls.gradientStops.addEventListener("input", (event) => {
    const row = event.target.closest(".gradient-stop-row");
    if (!row) return;
    const index = Number(row.dataset.index);
    const stop = state.gradient.stops[index];
    if (!stop) return;

    if (event.target.classList.contains("g-pos")) {
      stop.pos = clamp(Number(event.target.value) / 100);
    } else if (event.target.classList.contains("g-opacity")) {
      stop.opacity = clamp(Number(event.target.value) / 100);
    } else if (event.target.classList.contains("g-color")) {
      stop.color = event.target.value;
      const hex = row.querySelector(".g-hex");
      if (hex) hex.value = stop.color.replace("#", "").toUpperCase();
    } else if (event.target.classList.contains("g-hex")) {
      const normalized = `#${event.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6)}`;
      if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized)) {
        stop.color = normalized;
        const swatch = row.querySelector(".g-color");
        if (swatch) swatch.value = stop.color;
      }
    }
    paintGradientBar();
    gradientRender();
  });

  controls.gradientStops.addEventListener("click", (event) => {
    const row = event.target.closest(".gradient-stop-row");
    if (!row) return;
    const index = Number(row.dataset.index);
    if (event.target.closest(".g-remove")) {
      removeStop(index);
    } else if (!event.target.closest("input")) {
      selectStop(index);
    }
  });
}

// Cmd/Ctrl+V anywhere on the page loads a pasted image (or video) from the
// clipboard, the same path as the file picker and drag-and-drop.
function bindPaste() {
  window.addEventListener("paste", (event) => {
    const items = event.clipboardData && event.clipboardData.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === "file" && (item.type.startsWith("image/") || item.type.startsWith("video/"))) {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          handleMediaFile(file);
          setStatus("Pasted from clipboard.");
        }
        return;
      }
    }
  });
}

/* ---------- Crop tool ---------- */

let cropDraft = { x: 0, y: 0, w: 1, h: 1 };
let cropBackup = null;
let cropDrag = null;
const MIN_CROP = 0.05;

function activeMediaEl() {
  return state.sourceType === "video" ? controls.sourceVideo : controls.sourcePreview;
}

// The on-screen rectangle the source image actually occupies inside the frame
// (object-fit: contain letterboxes it), in coordinates relative to the frame.
function contentRect() {
  const frame = controls.sourceFrame.getBoundingClientRect();
  const box = activeMediaEl().getBoundingClientRect();
  const natRatio = state.mediaWidth / state.mediaHeight;
  let cw = box.width;
  let ch = box.height;
  if (box.width / box.height > natRatio) {
    ch = box.height;
    cw = ch * natRatio;
  } else {
    cw = box.width;
    ch = cw / natRatio;
  }
  return {
    left: box.left - frame.left + (box.width - cw) / 2,
    top: box.top - frame.top + (box.height - ch) / 2,
    width: cw,
    height: ch,
  };
}

function positionCropBox() {
  const rect = contentRect();
  const d = cropDraft;
  controls.cropBox.style.left = `${rect.left + d.x * rect.width}px`;
  controls.cropBox.style.top = `${rect.top + d.y * rect.height}px`;
  controls.cropBox.style.width = `${d.w * rect.width}px`;
  controls.cropBox.style.height = `${d.h * rect.height}px`;
}

function cropLiveRender() {
  state.crop = { ...cropDraft };
  applyCropDims();
  if (!state.previewLoopActive) render();
}

function enterCrop() {
  if (!state.media) return;
  state.cropping = true;
  cropBackup = { ...state.crop };
  cropDraft = { ...state.crop };
  controls.cropOverlay.hidden = false;
  controls.cropActions.hidden = false;
  controls.cropToggle.classList.add("active");
  positionCropBox();
}

function exitCrop(commit) {
  state.cropping = false;
  controls.cropOverlay.hidden = true;
  controls.cropActions.hidden = true;
  controls.cropToggle.classList.remove("active");
  if (!commit && cropBackup) {
    state.crop = cropBackup;
    applyCropDims();
    if (!state.previewLoopActive) render();
  }
  cropBackup = null;
  cropDrag = null;
}

function pointerFraction(event, rect) {
  const frame = controls.sourceFrame.getBoundingClientRect();
  const px = event.clientX - frame.left - rect.left;
  const py = event.clientY - frame.top - rect.top;
  return { fx: clamp(px / rect.width), fy: clamp(py / rect.height) };
}

function startCropDrag(event) {
  const rect = contentRect();
  const handle = event.target.closest(".crop-handle");
  const inBox = event.target.closest("#cropBox");
  let mode = "draw";
  if (handle) mode = handle.dataset.h;
  else if (inBox) mode = "move";

  cropDrag = { mode, rect, startX: event.clientX, startY: event.clientY, orig: { ...cropDraft } };

  // Clicking empty space begins a brand-new selection anchored at that point.
  if (mode === "draw") {
    const { fx, fy } = pointerFraction(event, rect);
    cropDrag.anchorX = fx;
    cropDrag.anchorY = fy;
    cropDraft = { x: fx, y: fy, w: 0, h: 0 };
  }

  event.preventDefault();
  window.addEventListener("pointermove", onCropMove);
  window.addEventListener("pointerup", endCropDrag);
}

function onCropMove(event) {
  if (!cropDrag) return;
  const r = cropDrag.rect;
  const o = cropDrag.orig;
  const dx = (event.clientX - cropDrag.startX) / r.width;
  const dy = (event.clientY - cropDrag.startY) / r.height;
  const mode = cropDrag.mode;

  if (mode === "move") {
    cropDraft = {
      x: clamp(o.x + dx, 0, 1 - o.w),
      y: clamp(o.y + dy, 0, 1 - o.h),
      w: o.w,
      h: o.h,
    };
  } else if (mode === "draw") {
    const { fx, fy } = pointerFraction(event, r);
    const x = Math.min(cropDrag.anchorX, fx);
    const y = Math.min(cropDrag.anchorY, fy);
    cropDraft = {
      x,
      y,
      w: Math.min(Math.max(MIN_CROP, Math.abs(fx - cropDrag.anchorX)), 1 - x),
      h: Math.min(Math.max(MIN_CROP, Math.abs(fy - cropDrag.anchorY)), 1 - y),
    };
  } else {
    let left = o.x;
    let top = o.y;
    let right = o.x + o.w;
    let bottom = o.y + o.h;
    if (mode.includes("w")) left = clamp(o.x + dx, 0, right - MIN_CROP);
    if (mode.includes("e")) right = clamp(o.x + o.w + dx, left + MIN_CROP, 1);
    if (mode.includes("n")) top = clamp(o.y + dy, 0, bottom - MIN_CROP);
    if (mode.includes("s")) bottom = clamp(o.y + o.h + dy, top + MIN_CROP, 1);
    cropDraft = { x: left, y: top, w: right - left, h: bottom - top };
  }

  positionCropBox();
  cropLiveRender();
}

function endCropDrag() {
  cropDrag = null;
  window.removeEventListener("pointermove", onCropMove);
  window.removeEventListener("pointerup", endCropDrag);
}

// Dismiss the crop UI without restoring a backup — used when fresh media loads
// (which resets the crop on its own).
function closeCropUi() {
  state.cropping = false;
  controls.cropOverlay.hidden = true;
  controls.cropActions.hidden = true;
  controls.cropToggle.classList.remove("active");
  cropBackup = null;
  cropDrag = null;
}

function bindCropTool() {
  controls.cropToggle.addEventListener("click", () => {
    if (state.cropping) exitCrop(false);
    else enterCrop();
  });
  controls.cropOverlay.addEventListener("pointerdown", startCropDrag);
  controls.cropApply.addEventListener("click", () => exitCrop(true));
  controls.cropCancel.addEventListener("click", () => exitCrop(false));
  controls.cropReset.addEventListener("click", () => {
    cropDraft = { x: 0, y: 0, w: 1, h: 1 };
    positionCropBox();
    cropLiveRender();
  });
  window.addEventListener("resize", () => {
    if (state.cropping) positionCropBox();
  });
}

function bindEvents() {
  document.addEventListener("input", (event) => {
    // The gradient editor manages its own state and re-render.
    if (event.target.closest("#gradientBlock")) return;
    if (event.target.matches("input[type='range'], select, input[type='checkbox'], input[type='color']")) {
      // While the clip plays, the canvas loop already reflects live settings.
      if (state.previewLoopActive) {
        updateReadouts();
        return;
      }
      render();
    }
  });

  controls.imageInput.addEventListener("change", (event) => {
    handleMediaFile(event.target.files[0]);
  });

  // Playing -> smooth canvas loop. Pausing/scrubbing -> crisp SVG of that frame.
  controls.sourceVideo.addEventListener("play", () => {
    if (state.sourceType === "video" && !state.exporting) startPlaybackLoop();
    updatePlayOverlay();
  });
  controls.sourceVideo.addEventListener("pause", () => {
    if (state.sourceType === "video" && !state.exporting) {
      state.previewLoopActive = false;
      showOutput("svg");
      render();
    }
    updatePlayOverlay();
  });
  controls.sourceVideo.addEventListener("seeked", () => {
    if (state.sourceType === "video" && !state.exporting && controls.sourceVideo.paused) {
      showOutput("svg");
      render();
    }
  });

  // Click the preview to play/pause; space does the same when not in a control.
  controls.outputFrame.addEventListener("click", togglePlayback);
  document.addEventListener("keydown", (event) => {
    if (event.code !== "Space" || state.sourceType !== "video") return;
    if (event.target.closest("input, select, textarea, button, summary, [contenteditable]")) return;
    event.preventDefault();
    togglePlayback();
  });

  // Drag and drop media anywhere over the preview.
  const dragArea = controls.outputFrame;
  ["dragenter", "dragover"].forEach((type) => {
    dragArea.addEventListener(type, (event) => {
      event.preventDefault();
      dragArea.classList.add("drag-over");
    });
  });
  ["dragleave", "drop"].forEach((type) => {
    dragArea.addEventListener(type, (event) => {
      event.preventDefault();
      if (type === "dragleave" && dragArea.contains(event.relatedTarget)) return;
      dragArea.classList.remove("drag-over");
    });
  });
  dragArea.addEventListener("drop", (event) => {
    const file = event.dataTransfer && event.dataTransfer.files[0];
    if (file) handleMediaFile(file);
  });

  controls.copySvg.addEventListener("click", () => copySvg().catch(() => setStatus("SVG copy failed.")));
  controls.copyPng.addEventListener("click", () => {
    controls.exportMenu.open = false;
    copyPng();
  });
  controls.saveSvg.addEventListener("click", () => {
    controls.exportMenu.open = false;
    saveSvg();
  });
  controls.savePng.addEventListener("click", () => {
    controls.exportMenu.open = false;
    saveRaster("image/png", "pattern-field.png");
  });
  controls.saveJpg.addEventListener("click", () => {
    controls.exportMenu.open = false;
    saveRaster("image/jpeg", "pattern-field.jpg");
  });
  controls.saveMp4.addEventListener("click", () => {
    controls.exportMenu.open = false;
    exportMp4();
  });
}

function init() {
  bindEvents();
  bindGradientEditor();
  bindPaste();
  bindCropTool();
  buildGradientUi();
  state.imageUrl = createDemoImage();
  loadImage(state.imageUrl);
}

init();
