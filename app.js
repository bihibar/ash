const $ = (id) => document.getElementById(id);

const controls = {
  imageInput: $("imageInput"),
  sourcePreview: $("sourcePreview"),
  sampler: $("sampler"),
  svgMount: $("svgMount"),
  outputFrame: $("outputFrame"),
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
  image: null,
  imageUrl: "",
  naturalWidth: 1280,
  naturalHeight: 780,
  cells: [],
  asciiText: "",
  svg: "",
};

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
    state.image = image;
    state.naturalWidth = image.naturalWidth;
    state.naturalHeight = image.naturalHeight;
    controls.sourcePreview.src = src;
    render();
  };
  image.src = src;
}

function sampleImage(config) {
  const image = state.image;
  const canvas = controls.sampler;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const ratio = image.naturalHeight / image.naturalWidth;
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
  if (!state.image) return;
  controls.clipboardBuffer.classList.remove("ready");
  updateReadouts();
  const config = settings();
  const grid = sampleImage(config);
  const svg = buildSvg(config, grid);
  document.documentElement.style.setProperty("--paper", config.paper);
  controls.svgMount.innerHTML = svg;
  controls.sampleCount.textContent = `${grid.visibleCount.toLocaleString()} marks`;
  setStatus(`${grid.columns} x ${grid.rows} samples. Transparent pixels are removed from the SVG.`);
}

function download(filename, href) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = href;
  link.click();
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
  const blob = new Blob([state.svg], { type: "image/svg+xml" });
  download("pattern-field.svg", URL.createObjectURL(blob));
}

async function saveRaster(type, filename) {
  const blob = await rasterBlob(type);
  download(filename, URL.createObjectURL(blob));
}

function bindEvents() {
  document.addEventListener("input", (event) => {
    if (event.target.matches("input[type='range'], select, input[type='checkbox'], input[type='color']")) {
      render();
    }
  });

  controls.imageInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      state.imageUrl = reader.result;
      loadImage(state.imageUrl);
    };
    reader.readAsDataURL(file);
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
}

function init() {
  bindEvents();
  state.imageUrl = createDemoImage();
  loadImage(state.imageUrl);
}

init();
