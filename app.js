const $ = (id) => document.getElementById(id);

const controls = {
  imageInput: $("imageInput"),
  sourcePreview: $("sourcePreview"),
  sourceVideo: $("sourceVideo"),
  sampler: $("sampler"),
  svgMount: $("svgMount"),
  outputFrame: $("outputFrame"),
  outputCanvas: $("outputCanvas"),
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
  cells: [],
  asciiText: "",
  svg: "",
  exporting: false,
  previewLoopActive: false,
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
    transparentPaper: controls.transparentPaper.checked,
    photoBackdrop: controls.photoBackdrop.checked,
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

function loadImage(src) {
  const image = new Image();
  image.onload = () => {
    teardownVideo();
    state.sourceType = "image";
    state.media = image;
    state.image = image;
    state.naturalWidth = image.naturalWidth;
    state.naturalHeight = image.naturalHeight;
    state.imageUrl = src;
    showSource("image");
    showOutput("svg");
    controls.sourcePreview.src = src;
    render();
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
  state.naturalWidth = video.videoWidth;
  state.naturalHeight = video.videoHeight;
  showSource("video");
  sizeOutputCanvas();
  await seekVideo(0);
  showOutput("svg");
  render();
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

// The faint source backdrop embeds a data URL in the SVG. For video that has to
// be the current frame, so capture a downscaled snapshot on demand.
function refreshVideoBackdrop(config) {
  if (state.sourceType !== "video" || !config.photoBackdrop) return;
  const maxDim = 640;
  const scale = Math.min(1, maxDim / Math.max(state.naturalWidth, state.naturalHeight));
  const w = Math.max(1, Math.round(state.naturalWidth * scale));
  const h = Math.max(1, Math.round(state.naturalHeight * scale));
  backdropCanvas.width = w;
  backdropCanvas.height = h;
  const ctx = backdropCanvas.getContext("2d");
  ctx.drawImage(state.media, 0, 0, w, h);
  state.imageUrl = backdropCanvas.toDataURL("image/jpeg", 0.6);
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
  ctx.drawImage(image, 0, 0, columns, rows);

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
  const ink = esc(cell.color);
  const base = Math.min(cell.w, cell.h) * config.density * (0.16 + cell.mark * 0.84);
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
    const length = Math.max(width, height) * (0.72 + cell.mark * 0.8);
    const stroke = Math.max(0.65, Math.min(cell.w, cell.h) * 0.06 * config.density * (0.48 + cell.mark));
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
function drawCellOnCanvas(ctx, cell, config) {
  if (!cell.visible) return;
  const pos = jittered(cell, config);
  const opacity = clamp((0.22 + cell.mark * 0.86) * cell.alpha);
  if (opacity <= 0.001) return;
  const color = cell.color;
  const base = Math.min(cell.w, cell.h) * config.density * (0.16 + cell.mark * 0.84);
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
    const length = Math.max(width, height) * (0.72 + cell.mark * 0.8);
    const stroke = Math.max(0.65, Math.min(cell.w, cell.h) * 0.06 * config.density * (0.48 + cell.mark));
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
    ctx.globalAlpha = 0.18;
    ctx.drawImage(state.media, 0, 0, targetW, targetH);
    ctx.globalAlpha = 1;
  }
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const cells = state.cells;
  for (let i = 0; i < cells.length; i += 1) {
    drawCellOnCanvas(ctx, cells[i], config);
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
  const marks = state.cells.map((cell) => renderCell(cell, config)).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width)}" height="${Math.round(height)}" viewBox="0 0 ${Math.round(width)} ${Math.round(height)}" role="img" aria-label="Generated vector pattern">
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
  refreshVideoBackdrop(config);
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
  refreshVideoBackdrop(config);
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

async function pickH264Codec(width, height, fps) {
  const candidates = [
    "avc1.640028", "avc1.4d0028", "avc1.42e01f",
    "avc1.640020", "avc1.4d401f", "avc1.42001f",
  ];
  for (const codec of candidates) {
    try {
      const support = await VideoEncoder.isConfigSupported({
        codec, width, height, bitrate: 8_000_000, framerate: fps,
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
  const maxDim = 1280;
  const scale = Math.min(1, maxDim / Math.max(state.naturalWidth, state.naturalHeight));
  // H.264 requires even dimensions.
  const outW = Math.max(2, Math.round(state.naturalWidth * scale) & ~1);
  const outH = Math.max(2, Math.round(state.naturalHeight * scale) & ~1);

  const codec = await pickH264Codec(outW, outH, fps);
  if (!codec) {
    setStatus("No supported H.264 configuration for this video size.");
    return;
  }

  state.exporting = true;
  const wasPaused = video.paused;
  video.pause();
  setExportingUi(true);
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
  encoder.configure({ codec, width: outW, height: outH, bitrate: 8_000_000, framerate: fps });

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
  }
}

function bindEvents() {
  document.addEventListener("input", (event) => {
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
    const [file] = event.target.files;
    if (!file) return;
    if (file.type.startsWith("video/")) {
      loadVideo(URL.createObjectURL(file));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      state.imageUrl = reader.result;
      loadImage(state.imageUrl);
    };
    reader.readAsDataURL(file);
  });

  // Playing -> smooth canvas loop. Pausing/scrubbing -> crisp SVG of that frame.
  controls.sourceVideo.addEventListener("play", () => {
    if (state.sourceType === "video" && !state.exporting) startPlaybackLoop();
  });
  controls.sourceVideo.addEventListener("pause", () => {
    if (state.sourceType === "video" && !state.exporting) {
      state.previewLoopActive = false;
      showOutput("svg");
      render();
    }
  });
  controls.sourceVideo.addEventListener("seeked", () => {
    if (state.sourceType === "video" && !state.exporting && controls.sourceVideo.paused) {
      showOutput("svg");
      render();
    }
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
  state.imageUrl = createDemoImage();
  loadImage(state.imageUrl);
}

init();
