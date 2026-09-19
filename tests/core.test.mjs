import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIRECTORY = path.dirname(TEST_DIRECTORY);
const APP_PATH = path.join(PROJECT_DIRECTORY, "app.js");
const INDEX_PATH = path.join(PROJECT_DIRECTORY, "index.html");
const STYLE_PATH = path.join(PROJECT_DIRECTORY, "style.css");

function cssRuleBody(source, selector) {
  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].split(",").map((value) => value.trim());
    if (selectors.includes(selector)) return match[2];
  }
  assert.fail(`Missing CSS rule for ${selector}`);
}

function cssMediaBlock(source, maxWidth) {
  const opener = new RegExp(`@media\\s*\\(max-width:\\s*${maxWidth}px\\)\\s*\\{`, "i").exec(source);
  assert.ok(opener, `Missing max-width:${maxWidth}px media query`);
  const start = opener.index + opener[0].length;
  let depth = 1;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index);
  }
  assert.fail(`Unclosed max-width:${maxWidth}px media query`);
}

function loadPureApi() {
  const source = readFileSync(APP_PATH, "utf8");
  const context = vm.createContext({
    document: {
      readyState: "loading",
      addEventListener() {},
    },
  });
  new vm.Script(source, { filename: APP_PATH }).runInContext(context);
  assert.ok(context.__IMAGE_TOOL_TEST__, "app.js must expose __IMAGE_TOOL_TEST__");
  return context.__IMAGE_TOOL_TEST__;
}

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }

  toggle(name, force) {
    const shouldAdd = force === undefined ? !this.values.has(name) : Boolean(force);
    if (shouldAdd) this.values.add(name);
    else this.values.delete(name);
    return shouldAdd;
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.value = "";
    this.checked = false;
    this.disabled = false;
    this.hidden = false;
    this.textContent = "";
    this.className = "";
    this.classList = new FakeClassList();
    this.dataset = {};
    this.style = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.children = [];
    this.parentElement = null;
    this.offsetHeight = 40;
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  dispatchEvent(event) {
    for (const listener of this.listeners.get(event.type) || []) listener.call(this, event);
    return true;
  }

  append(...children) {
    for (const child of children) {
      if (child && typeof child === "object") child.parentElement = this;
      this.children.push(child);
    }
  }

  replaceChildren(...children) {
    this.children = [];
    this.textContent = "";
    this.append(...children);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  querySelector() {
    return null;
  }

  querySelectorAll() {
    return [];
  }

  closest() {
    return null;
  }

  getBoundingClientRect() {
    return { top: 0, left: 0, width: 100, height: 40 };
  }

  focus() {}
  click() {}
  remove() {}
  setPointerCapture() {}
  releasePointerCapture() {}
  hasPointerCapture() { return false; }
}

function loadActionApi(overrides = {}) {
  const original = readFileSync(APP_PATH, "utf8");
  const extraExports = [
    "getCombineOptions",
    "normalizeCombineControls",
    "getProcessedDimensions",
    "getOrientedDimensions",
    "normalizedCrop",
    "fitCropToRatio",
    "resizeCrop",
    "rotatedRatioLabel",
    "renderImageList",
    "renderCanvasLayerList",
    "updateEmptyState",
    "updateActionAvailability",
    "rotateSelected",
    "toggleSelectedFlip",
    "applySelectedCropToAll",
    "applySelectedResizeToAll",
    "applyCenteredRatioToAll",
    "applyResizePresetToAll",
    "apply1920WidthToAll",
    "updateCropFromNumbers",
    "updateResizeFromNumbers",
    "resetRecord",
    "assertExportSize",
    "canvasToBlob",
    "fileStem",
    "numberValue",
    "addFiles",
    "cancelPendingLoads",
    "clearAll",
    "isSupportedImageFile",
    "setSelectedResize",
    "exportCurrentMode",
    "exportCombined",
    "exportAllEdited",
    "snapshotRecord",
    "requireCanvasContext",
    "getSelectedCanvasLayer",
    "mutateSelectedCanvasLayer",
    "commitCanvasMutation",
    "rotateCanvasLayer",
    "handleCanvasKeyboard",
    "beginCanvasPointerGesture",
    "beginCanvasSelectionGesture",
    "moveCanvasPointerGesture",
    "endCanvasPointerGesture",
    "cancelCanvasGesture",
    "resetCanvasLayer",
    "resetCurrent",
    "resetAllEdits",
  ];
  const marker = "globalThis.__IMAGE_TOOL_TEST__ = {";
  assert.ok(original.includes(marker), "Could not instrument the app.js test API");
  const source = original.replace(marker, `${marker}\n    ${extraExports.join(",\n    ")},`);
  const idsBlock = original.match(/const ids = \[([\s\S]*?)\];/);
  assert.ok(idsBlock, "Could not find app.js ids contract");
  const ids = Array.from(idsBlock[1].matchAll(/"([A-Za-z][A-Za-z0-9]*)"/g), (match) => match[1]);
  ids.push("previewDimensions");
  const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement(id)]));
  const body = new FakeElement("body");
  const document = {
    readyState: "complete",
    activeElement: null,
    body,
    getElementById(id) {
      return elements[id] || null;
    },
    createElement(tagName) {
      return overrides.createElement?.(tagName) || new FakeElement();
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
  };
  let animationFrame = 0;
  const context = vm.createContext({
    document,
    window: { addEventListener() {}, devicePixelRatio: 1 },
    console: { error() {}, warn() {}, log() {} },
    requestAnimationFrame() { animationFrame += 1; return animationFrame; },
    cancelAnimationFrame() {},
    setTimeout: overrides.setTimeout || setTimeout,
    clearTimeout: overrides.clearTimeout || clearTimeout,
    CSS: { escape: (value) => String(value) },
    Image: overrides.Image,
    URL: overrides.URL,
    localStorage: overrides.localStorage,
    Blob, File, TextEncoder, TextDecoder, btoa, atob,
  });
  new vm.Script(source, { filename: APP_PATH }).runInContext(context);
  return { api: context.__IMAGE_TOOL_TEST__, elements, document, body, context };
}

function record(name, width, height, overrides = {}) {
  return {
    name,
    originalWidth: width,
    originalHeight: height,
    crop: { x: 0, y: 0, width, height },
    cropRatio: "free",
    resize: { width: null, height: null, keepAspect: true },
    rotation: 0,
    flipX: false,
    flipY: false,
    ...overrides,
  };
}

function stateRecord(id, width, height, overrides = {}) {
  return record(id, width, height, {
    id,
    fileName: `${id}.png`,
    objectUrl: `blob:${id}`,
    ...overrides,
  });
}

function forgetImageHistory(api) {
  api.state.imageHistory.past = [];
  api.state.imageHistory.future = [];
  api.state.imageHistory.current = api.snapshotImageWorkspace();
  api.sweepImageSourceUrls();
  api.sweepFinishSourceUrls();
}

function canvasLayer(id, overrides = {}) {
  return {
    id,
    name: `${id}.png`,
    file: imageFile(`${id}.png`),
    objectUrl: `blob:${id}`,
    image: { id: `${id}-image` },
    naturalWidth: 200,
    naturalHeight: 100,
    x: 100,
    y: 100,
    width: 200,
    height: 100,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    flipX: false,
    flipY: false,
    keepAspect: true,
    zIndex: 0,
    ...overrides,
  };
}

function finishLayer(id, overrides = {}) {
  return {
    id,
    name: `${id}.png`,
    file: imageFile(`${id}.png`),
    objectUrl: `blob:${id}`,
    image: { id: `${id}-image`, naturalWidth: 100, naturalHeight: 50 },
    naturalWidth: 100,
    naturalHeight: 50,
    visible: true,
    xRatio: 0,
    yRatio: 0,
    widthRatio: 1,
    heightRatio: 1,
    keepAspect: true,
    rotation: 0,
    opacity: 1,
    blendMode: "normal",
    placement: "front",
    fitMode: "stretch",
    isFrame: false,
    manualGeometry: null,
    ...overrides,
  };
}

function hasClass(element, className) {
  return element?.classList?.contains?.(className)
    || String(element?.className || "").split(/\s+/).includes(className);
}

function finishListToken(row) {
  if (row?.dataset?.finishLayerId) return row.dataset.finishLayerId;
  return hasClass(row, "filter-finish-base-row") ? "__processed_image__" : null;
}

function elementText(element) {
  return `${element?.textContent || ""}${Array.from(element?.children || []).map(elementText).join("")}`;
}

function compactCanvasLayer(layer) {
  return plain({
    id: layer.id,
    name: layer.name,
    x: layer.x,
    y: layer.y,
    width: layer.width,
    height: layer.height,
    rotation: layer.rotation,
    opacity: layer.opacity,
    visible: layer.visible,
    locked: layer.locked,
    flipX: layer.flipX,
    flipY: layer.flipY,
    keepAspect: layer.keepAspect,
    zIndex: layer.zIndex,
  });
}

function assertPointClose(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual.x - expected.x) <= tolerance, `x: expected ${expected.x}, got ${actual.x}`);
  assert.ok(Math.abs(actual.y - expected.y) <= tolerance, `y: expected ${expected.y}, got ${actual.y}`);
}

function createRecordingCanvasContext() {
  const calls = [];
  let globalAlpha = 1;
  let fillStyle = "";
  const context = {
    calls,
    imageSmoothingEnabled: false,
    imageSmoothingQuality: "low",
    save() { calls.push(["save"]); },
    restore() { calls.push(["restore"]); },
    clearRect(...args) { calls.push(["clearRect", ...args]); },
    fillRect(...args) { calls.push(["fillRect", ...args]); },
    translate(...args) { calls.push(["translate", ...args]); },
    rotate(...args) { calls.push(["rotate", ...args]); },
    scale(...args) { calls.push(["scale", ...args]); },
    drawImage(...args) { calls.push(["drawImage", ...args]); },
    setTransform(...args) { calls.push(["setTransform", ...args]); },
    beginPath() { calls.push(["beginPath"]); },
    rect(...args) { calls.push(["rect", ...args]); },
    clip() { calls.push(["clip"]); },
    get globalAlpha() { return globalAlpha; },
    set globalAlpha(value) { globalAlpha = value; calls.push(["globalAlpha", value]); },
    get fillStyle() { return fillStyle; },
    set fillStyle(value) { fillStyle = value; calls.push(["fillStyle", value]); },
  };
  return context;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function createStorageHarness(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

async function flushMicrotasks(turns = 8) {
  for (let index = 0; index < turns; index += 1) await Promise.resolve();
}

function imageFile(name, type = "image/png") {
  return { name, type };
}

function filterImageData(width, height, rgba) {
  return { width, height, data: new Uint8ClampedArray(rgba) };
}

function createLoadHarness() {
  const instances = [];
  const created = [];
  const revoked = [];
  let serial = 0;

  class ControlledImage {
    constructor() {
      this.onload = null;
      this.onerror = null;
      this.naturalWidth = 0;
      this.naturalHeight = 0;
      this.decoding = "";
      this._src = "";
      instances.push(this);
    }

    set src(value) {
      this._src = value;
    }

    get src() {
      return this._src;
    }

    succeed(width, height) {
      this.naturalWidth = width;
      this.naturalHeight = height;
      this.onload?.();
    }

    fail() {
      this.onerror?.();
    }
  }

  const URL = {
    createObjectURL(value) {
      const url = `blob:load-${++serial}-${value?.name || "value"}`;
      created.push({ url, value });
      return url;
    },
    revokeObjectURL(url) {
      revoked.push(url);
    },
  };

  return { Image: ControlledImage, URL, instances, created, revoked };
}

function createExportHarness() {
  const canvases = [];
  const pendingEncodes = [];
  const downloads = [];
  const objectUrls = [];
  const revoked = [];
  let urlSerial = 0;

  function createContext(canvas) {
    let fillStyle = "#000000";
    let globalAlpha = 1;
    let globalCompositeOperation = "source-over";
    const stack = [];
    const calls = [];
    return {
      calls,
      save() { stack.push({ fillStyle, globalAlpha, globalCompositeOperation }); },
      restore() {
        const saved = stack.pop();
        if (saved) ({ fillStyle, globalAlpha, globalCompositeOperation } = saved);
      },
      clearRect() {},
      fillRect(...args) {
        calls.push(["fillRect", fillStyle, ...args]);
        const length = Math.max(0, canvas.width * canvas.height * 4);
        const data = canvas.pixelData || new Uint8ClampedArray(length);
        const color = fillStyle === "#ffffff" ? [255, 255, 255] : [0, 0, 0];
        for (let index = 0; index < length; index += 4) {
          if (globalCompositeOperation === "destination-over") {
            const alpha = data[index + 3] / 255;
            data[index] = Math.round(data[index] * alpha + color[0] * (1 - alpha));
            data[index + 1] = Math.round(data[index + 1] * alpha + color[1] * (1 - alpha));
            data[index + 2] = Math.round(data[index + 2] * alpha + color[2] * (1 - alpha));
            data[index + 3] = 255;
          } else {
            data.set([...color, Math.round(255 * globalAlpha)], index);
          }
        }
        canvas.pixelData = data;
      },
      beginPath() {},
      rect() {},
      clip() {},
      translate() {},
      scale() {},
      rotate() {},
      drawImage(image, ...args) {
        calls.push(["drawImage", image, ...args]);
        const length = Math.max(0, canvas.width * canvas.height * 4);
        const source = image?.pixels || image?.pixelData;
        canvas.pixelData = source && source.length >= length
          ? new Uint8ClampedArray(source.slice(0, length))
          : new Uint8ClampedArray(length);
      },
      getImageData(_x, _y, width, height) {
        const length = width * height * 4;
        const source = canvas.pixelData || new Uint8ClampedArray(length);
        return { width, height, data: new Uint8ClampedArray(source.slice(0, length)) };
      },
      putImageData(imageData) {
        canvas.pixelData = new Uint8ClampedArray(imageData.data);
        canvas.lastImageData = {
          width: imageData.width,
          height: imageData.height,
          data: new Uint8ClampedArray(imageData.data),
        };
      },
      setTransform() {},
      get fillStyle() { return fillStyle; },
      set fillStyle(value) { fillStyle = value; },
      get globalAlpha() { return globalAlpha; },
      set globalAlpha(value) { globalAlpha = value; },
      get globalCompositeOperation() { return globalCompositeOperation; },
      set globalCompositeOperation(value) { globalCompositeOperation = value; },
    };
  }

  function createElement(tagName) {
    if (tagName === "canvas") {
      const canvas = new FakeElement();
      canvas.width = 0;
      canvas.height = 0;
      canvas.context = createContext(canvas);
      canvas.getContext = () => canvas.context;
      canvas.toBlob = (callback, mime, quality) => {
        pendingEncodes.push({
          canvas,
          callback,
          mime,
          quality,
          width: canvas.width,
          height: canvas.height,
          data: new Uint8ClampedArray(canvas.pixelData || []),
        });
      };
      canvases.push(canvas);
      return canvas;
    }
    if (tagName === "a") {
      const anchor = new FakeElement();
      anchor.click = () => downloads.push({ href: anchor.href, download: anchor.download });
      return anchor;
    }
    return new FakeElement();
  }

  const URL = {
    createObjectURL(value) {
      const url = `blob:export-${++urlSerial}`;
      objectUrls.push({ url, value });
      return url;
    },
    revokeObjectURL(url) {
      revoked.push(url);
    },
  };

  function resolveEncode(index = 0) {
    const pending = pendingEncodes[index];
    assert.ok(pending, `Missing pending encode at index ${index}`);
    pending.callback(new Blob(["encoded"], { type: pending.mime }));
  }

  return {
    canvases,
    pendingEncodes,
    downloads,
    objectUrls,
    revoked,
    createElement,
    URL,
    setTimeout(callback) {
      queueMicrotask(callback);
      return 1;
    },
    clearTimeout() {},
    resolveEncode,
  };
}

function createTiledFilterHarness({ sourcePixels = null, canvasRoles = [], failStage = null } = {}) {
  const canvases = [];
  const writes = [];
  const calls = [];
  let roleIndex = 0;

  function ensurePixelBuffer(canvas) {
    const length = Math.max(0, canvas.width * canvas.height * 4);
    if (!canvas.pixelData || canvas.pixelData.length !== length) {
      canvas.pixelData = new Uint8ClampedArray(length);
    }
    return canvas.pixelData;
  }

  function createContext(canvas) {
    let fillStyle = "#000000";
    let globalAlpha = 1;
    let globalCompositeOperation = "source-over";
    let transform = { x: 0, y: 0, rotation: 0 };
    const stack = [];

    function blendPixel(destination, index, source, sourceIndex) {
      const sourceAlpha = source[sourceIndex + 3] / 255 * globalAlpha;
      const destinationAlpha = destination[index + 3] / 255;
      if (globalCompositeOperation === "destination-over") {
        const outputAlpha = destinationAlpha + sourceAlpha * (1 - destinationAlpha);
        if (outputAlpha <= 0) {
          destination.fill(0, index, index + 4);
          return;
        }
        for (let channel = 0; channel < 3; channel += 1) {
          destination[index + channel] = Math.round((
            destination[index + channel] * destinationAlpha
            + source[sourceIndex + channel] * sourceAlpha * (1 - destinationAlpha)
          ) / outputAlpha);
        }
        destination[index + 3] = Math.round(outputAlpha * 255);
        return;
      }
      const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
      if (outputAlpha <= 0) {
        destination.fill(0, index, index + 4);
        return;
      }
      for (let channel = 0; channel < 3; channel += 1) {
        const sourceChannel = source[sourceIndex + channel];
        const destinationChannel = destination[index + channel];
        let blended = sourceChannel;
        if (globalCompositeOperation === "multiply") blended = sourceChannel * destinationChannel / 255;
        else if (globalCompositeOperation === "screen") {
          blended = 255 - (255 - sourceChannel) * (255 - destinationChannel) / 255;
        } else if (globalCompositeOperation === "overlay") {
          blended = destinationChannel <= 127.5
            ? 2 * sourceChannel * destinationChannel / 255
            : 255 - 2 * (255 - sourceChannel) * (255 - destinationChannel) / 255;
        }
        const premultiplied = (
          (1 - sourceAlpha) * destinationAlpha * destinationChannel
          + (1 - destinationAlpha) * sourceAlpha * sourceChannel
          + sourceAlpha * destinationAlpha * blended
        );
        destination[index + channel] = Math.round(premultiplied / outputAlpha);
      }
      destination[index + 3] = Math.round(outputAlpha * 255);
    }

    return {
      clearRect() {
        ensurePixelBuffer(canvas).fill(0);
        calls.push({ role: canvas.role, type: "clearRect" });
      },
      fillRect(x, y, width, height) {
        const data = ensurePixelBuffer(canvas);
        const rgba = fillStyle === "#ffffff" ? [255, 255, 255, 255] : [0, 0, 0, 255];
        for (let row = y; row < y + height; row += 1) {
          for (let column = x; column < x + width; column += 1) {
            const index = (row * canvas.width + column) * 4;
            if (globalCompositeOperation === "destination-over") {
              const alpha = data[index + 3] / 255;
              data[index] = Math.round(data[index] * alpha + rgba[0] * (1 - alpha));
              data[index + 1] = Math.round(data[index + 1] * alpha + rgba[1] * (1 - alpha));
              data[index + 2] = Math.round(data[index + 2] * alpha + rgba[2] * (1 - alpha));
              data[index + 3] = 255;
            } else {
              data.set(rgba, index);
            }
          }
        }
        calls.push({ role: canvas.role, type: "fillRect", x, y, width, height, fillStyle });
      },
      save() {
        stack.push({ fillStyle, globalAlpha, globalCompositeOperation, transform: { ...transform } });
        calls.push({ role: canvas.role, type: "save" });
      },
      restore() {
        const saved = stack.pop();
        if (saved) {
          ({ fillStyle, globalAlpha, globalCompositeOperation } = saved);
          transform = saved.transform;
        }
        calls.push({ role: canvas.role, type: "restore" });
      },
      translate(x, y) {
        transform.x += x;
        transform.y += y;
        calls.push({ role: canvas.role, type: "translate", x, y });
      },
      rotate(value) {
        transform.rotation += value;
        calls.push({ role: canvas.role, type: "rotate", value });
      },
      scale() {},
      beginPath() {},
      rect() {},
      clip() {},
      drawImage(image, ...args) {
        if (canvas.role === "source" && failStage === "drawImage") throw new Error("synthetic drawImage failure");
        const destination = ensurePixelBuffer(canvas);
        const pixels = image?.pixels || image?.pixelData || (args.length === 4 ? null : sourcePixels);
        calls.push({ role: canvas.role, type: "drawImage", image: image?.id, args: [...args] });
        if (!pixels) return;
        if (![2, 4, 8].includes(args.length) || Math.abs(transform.rotation) > 1e-12) {
          destination.set(pixels.subarray ? pixels.subarray(0, destination.length) : pixels.slice(0, destination.length));
          return;
        }
        let sourceX = 0;
        let sourceY = 0;
        let sourceWidth;
        let sourceHeight;
        let localX;
        let localY;
        let drawWidth;
        let drawHeight;
        if (args.length === 8) {
          [sourceX, sourceY, sourceWidth, sourceHeight, localX, localY, drawWidth, drawHeight] = args;
        } else if (args.length === 4) {
          [localX, localY, drawWidth, drawHeight] = args;
          sourceWidth = Math.max(1, Math.round(numberValueForTest(image?.naturalWidth ?? image?.width, drawWidth)));
          sourceHeight = Math.max(1, Math.round(numberValueForTest(image?.naturalHeight ?? image?.height, drawHeight)));
        } else {
          [localX, localY] = args;
          sourceWidth = Math.max(1, Math.round(numberValueForTest(image?.naturalWidth ?? image?.width, canvas.width)));
          sourceHeight = Math.max(1, Math.round(numberValueForTest(image?.naturalHeight ?? image?.height, canvas.height)));
          drawWidth = sourceWidth;
          drawHeight = sourceHeight;
        }
        const destinationX = Math.round(transform.x + localX);
        const destinationY = Math.round(transform.y + localY);
        const imageWidth = Math.max(1, Math.round(numberValueForTest(image?.naturalWidth ?? image?.width, sourceWidth)));
        const imageHeight = Math.max(1, Math.round(numberValueForTest(image?.naturalHeight ?? image?.height, sourceHeight)));
        const pixelWidth = Math.max(1, Math.round(drawWidth));
        const pixelHeight = Math.max(1, Math.round(drawHeight));
        for (let row = 0; row < pixelHeight; row += 1) {
          const targetY = destinationY + row;
          if (targetY < 0 || targetY >= canvas.height) continue;
          const sampledY = Math.min(imageHeight - 1, Math.max(0, Math.floor(sourceY + row * sourceHeight / pixelHeight)));
          for (let column = 0; column < pixelWidth; column += 1) {
            const targetX = destinationX + column;
            if (targetX < 0 || targetX >= canvas.width) continue;
            const sampledX = Math.min(imageWidth - 1, Math.max(0, Math.floor(sourceX + column * sourceWidth / pixelWidth)));
            blendPixel(
              destination,
              (targetY * canvas.width + targetX) * 4,
              pixels,
              (sampledY * imageWidth + sampledX) * 4,
            );
          }
        }
      },
      getImageData(x, y, width, height) {
        if (canvas.role === "source" && failStage === "getImageData") {
          throw new Error("synthetic getImageData failure");
        }
        const source = ensurePixelBuffer(canvas);
        const data = new Uint8ClampedArray(width * height * 4);
        for (let row = 0; row < height; row += 1) {
          const sourceStart = ((y + row) * canvas.width + x) * 4;
          const targetStart = row * width * 4;
          data.set(source.subarray(sourceStart, sourceStart + width * 4), targetStart);
        }
        return { width, height, data };
      },
      putImageData(imageData, dx, dy, dirtyX = 0, dirtyY = 0, dirtyWidth = imageData.width, dirtyHeight = imageData.height) {
        const destination = ensurePixelBuffer(canvas);
        for (let row = 0; row < dirtyHeight; row += 1) {
          const sourceStart = ((dirtyY + row) * imageData.width + dirtyX) * 4;
          const targetStart = ((dy + dirtyY + row) * canvas.width + dx + dirtyX) * 4;
          destination.set(imageData.data.subarray(sourceStart, sourceStart + dirtyWidth * 4), targetStart);
        }
        writes.push({
          role: canvas.role,
          dx,
          dy,
          dirtyX,
          dirtyY,
          dirtyWidth,
          dirtyHeight,
          imageWidth: imageData.width,
          imageHeight: imageData.height,
        });
        calls.push({ role: canvas.role, type: "putImageData", dirtyWidth, dirtyHeight });
      },
      get fillStyle() {
        return fillStyle;
      },
      set fillStyle(value) {
        fillStyle = value;
      },
      get globalAlpha() {
        return globalAlpha;
      },
      set globalAlpha(value) {
        globalAlpha = value;
      },
      get globalCompositeOperation() {
        return globalCompositeOperation;
      },
      set globalCompositeOperation(value) {
        globalCompositeOperation = value;
      },
    };
  }

  function makeCanvas(role = "canvas") {
    const canvas = new FakeElement();
    canvas.role = role;
    canvas.width = 0;
    canvas.height = 0;
    canvas.context = createContext(canvas);
    canvas.getContext = () => canvas.context;
    canvas.toBlob = (callback, mime) => callback(new Blob(["encoded"], { type: mime }));
    canvases.push(canvas);
    return canvas;
  }

  function createElement(tagName) {
    if (tagName === "canvas") return makeCanvas(canvasRoles[roleIndex++] || "canvas");
    return new FakeElement();
  }

  return { canvases, writes, calls, makeCanvas, createElement };
}

function numberValueForTest(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function compactLayout(layout) {
  return JSON.parse(JSON.stringify({
    width: layout.width,
    height: layout.height,
    placements: layout.placements.map(({ record: item, x, y, width, height }) => ({
      name: item.name,
      x,
      y,
      width,
      height,
    })),
  }));
}

function options(direction, overrides = {}) {
  return {
    direction,
    columns: 2,
    sizing: "original",
    targetWidth: 50,
    targetHeight: 50,
    gap: 1,
    padding: 2,
    ...overrides,
  };
}

test("app.js parses and exposes pure verification helpers without booting the DOM", () => {
  const api = loadPureApi();
  assert.equal(typeof api.calculateCombineLayout, "function");
  assert.equal(typeof api.normalizeGridColumns, "function");
  assert.equal(typeof api.calculateSplitRegions, "function");
  assert.equal(typeof api.normalizeSplitAxisCount, "function");
  assert.equal(typeof api.splitOutputFileName, "function");
  assert.equal(typeof api.largestCenteredCrop, "function");
  assert.equal(typeof api.ratioNumber, "function");
  assert.equal(typeof api.normalizeRotation, "function");
  assert.equal(typeof api.clampCrop, "function");
  assert.deepEqual(Array.from(api.state.images), []);
  assert.equal(api.state.mode, "combine");
});

test("filter mode exposes a sanitized, deeply independent non-destructive state contract", () => {
  const api = loadPureApi();
  for (const helper of [
    "createDefaultFilterState",
    "sanitizeFilterState",
    "cloneFilterState",
    "clampFilterByte",
    "mixFilterPixel",
    "applyTonePixel",
    "applyTimePresetPixel",
    "quantizeChannel",
    "createEdgeMap",
    "applyPosterize",
    "applyOilPaint",
    "applyFilterPipeline",
    "isFilterStateNeutral",
    "calculateFilterPreviewSize",
    "filterOutputFileName",
    "makeTimeVariantJobs",
    "assertFilterExportSize",
    "filterProcessingHalo",
    "flattenCanvasToWhite",
    "renderFilteredRecordToCanvas",
    "renderFilteredRecordToCanvasTiled",
    "encodeFilteredRecord",
  ]) {
    assert.equal(typeof api[helper], "function", `${helper} must be exposed`);
  }
  const defaults = plain(api.createDefaultFilterState());
  assert.deepEqual(defaults, {
    timePreset: "none",
    effectPreset: "none",
    strength: 0.7,
    adjustments: {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      temperature: 0,
      tint: 0,
      highlights: 0,
      shadows: 0,
    },
    oil: { color: 70, brush: 8, edge: 35 },
    poster: { levels: 6, edge: 40 },
  });

  const sanitized = api.sanitizeFilterState({
    time: "morning",
    effect: "poster",
    intensity: 140,
    adjustments: {
      brightness: -200,
      contrast: 200,
      saturation: "",
      temperature: Number.NaN,
      tint: 25,
      highlights: -30,
      shadows: 40,
    },
    oil: { colors: -5, brush: 99, edge: 101 },
    poster: { levels: 99, edge: -1 },
  });
  assert.deepEqual(plain(sanitized), {
    timePreset: "morning",
    effectPreset: "poster",
    strength: 1,
    adjustments: {
      brightness: -100,
      contrast: 100,
      saturation: 0,
      temperature: 0,
      tint: 25,
      highlights: -30,
      shadows: 40,
    },
    oil: { color: 0, brush: 20, edge: 100 },
    poster: { levels: 16, edge: 0 },
  });
  assert.deepEqual(plain(api.sanitizeFilterState({ timePreset: "unknown", effectPreset: "unknown", strength: -2 })), {
    ...defaults,
    strength: 0,
  });

  const clone = api.cloneFilterState(sanitized);
  clone.adjustments.brightness = 12;
  clone.oil.color = 88;
  clone.poster.levels = 2;
  assert.equal(sanitized.adjustments.brightness, -100);
  assert.equal(sanitized.oil.color, 0);
  assert.equal(sanitized.poster.levels, 16);
});

test("finish layers expose sanitized independent state while sharing immutable image sources", () => {
  const api = loadPureApi();
  for (const helper of [
    "createFinishLayerState",
    "sanitizeFinishLayerState",
    "cloneFinishLayerState",
    "snapshotFinishLayers",
    "finishGeometryToPixels",
    "finishGeometryFromPixels",
    "calculateFinishFrameRect",
    "resolveFinishLayerGeometry",
    "finishLayerLocalToOutput",
    "outputToFinishLayerLocal",
    "getFinishLayerCorners",
    "getFinishLayerAabb",
    "hitTestFinishLayers",
    "resizeFinishLayerFromHandle",
    "calculateFinishLayerRotation",
    "calculateFinishLayerFit",
    "reorderFinishLayers",
    "finishBlendOperation",
    "getFinishDrawLayers",
    "buildFinishDrawPlan",
    "drawFinishLayers",
    "addFinishFiles",
    "cancelFinishLoads",
    "sweepFinishSourceUrls",
    "applySelectedFinishToAll",
    "applySelectedFilterAndFinishToAll",
  ]) {
    assert.equal(typeof api[helper], "function", `${helper} must be exposed`);
  }

  const source = {
    file: imageFile("flower.png"),
    fileName: "flower.png",
    objectUrl: "blob:flower",
    image: { id: "flower-image", naturalWidth: 100, naturalHeight: 50 },
    naturalWidth: 100,
    naturalHeight: 50,
  };
  const created = api.createFinishLayerState(source, { width: 400, height: 200 });
  assert.deepEqual(plain({
    name: created.name,
    xRatio: created.xRatio,
    yRatio: created.yRatio,
    widthRatio: created.widthRatio,
    heightRatio: created.heightRatio,
    keepAspect: created.keepAspect,
    visible: created.visible,
    opacity: created.opacity,
    rotation: created.rotation,
    blendMode: created.blendMode,
    placement: created.placement,
    fitMode: created.fitMode,
    isFrame: created.isFrame,
  }), {
    name: "flower.png",
    xRatio: 0.375,
    yRatio: 0.375,
    widthRatio: 0.25,
    heightRatio: 0.25,
    keepAspect: true,
    visible: true,
    opacity: 1,
    rotation: 0,
    blendMode: "normal",
    placement: "front",
    fitMode: "stretch",
    isFrame: false,
  });
  assert.strictEqual(created.image, source.image);
  assert.strictEqual(created.file, source.file);

  const sanitized = api.sanitizeFinishLayerState({
    ...created,
    name: "  decorated frame  ",
    xRatio: 99,
    yRatio: -99,
    widthRatio: 0,
    heightRatio: Number.POSITIVE_INFINITY,
    rotation: -90,
    opacity: 4,
    blendMode: "unsafe-mode",
    placement: "unsafe-placement",
    fitMode: "unknown-fit",
    manualGeometry: { xRatio: 20, yRatio: -20, widthRatio: 0, heightRatio: 2, keepAspect: false },
  });
  assert.deepEqual(plain({
    name: sanitized.name,
    xRatio: sanitized.xRatio,
    yRatio: sanitized.yRatio,
    widthRatio: sanitized.widthRatio,
    heightRatio: sanitized.heightRatio,
    rotation: sanitized.rotation,
    opacity: sanitized.opacity,
    blendMode: sanitized.blendMode,
    placement: sanitized.placement,
    fitMode: sanitized.fitMode,
    manualGeometry: sanitized.manualGeometry,
  }), {
    name: "decorated frame",
    xRatio: 5,
    yRatio: -5,
    widthRatio: 0.0001,
    heightRatio: 1,
    rotation: 270,
    opacity: 1,
    blendMode: "normal",
    placement: "front",
    fitMode: "stretch",
    manualGeometry: { xRatio: 5, yRatio: -5, widthRatio: 0.0001, heightRatio: 2, keepAspect: false, rotation: 0 },
  });

  const behind = api.sanitizeFinishLayerState({ ...sanitized, placement: "behind" });
  assert.equal(behind.placement, "behind");
  const clone = api.cloneFinishLayerState(behind, { newId: true });
  assert.notEqual(clone.id, behind.id);
  assert.equal(clone.placement, "behind");
  assert.strictEqual(clone.image, behind.image);
  assert.strictEqual(clone.file, behind.file);
  assert.equal(clone.objectUrl, behind.objectUrl);
  assert.notStrictEqual(clone.manualGeometry, behind.manualGeometry);
  clone.manualGeometry.xRatio = 0.5;
  assert.equal(behind.manualGeometry.xRatio, 5);
});

test("finish relative geometry, frame modes, fits, rotated corners, and hit tests are exact", () => {
  const api = loadPureApi();
  const relative = finishLayer("relative", {
    naturalWidth: 100,
    naturalHeight: 100,
    xRatio: 0.1,
    yRatio: 0.2,
    widthRatio: 0.25,
    heightRatio: 0.5,
  });
  const pixels = api.finishGeometryToPixels(relative, 400, 200);
  assert.deepEqual(plain({ x: pixels.x, y: pixels.y, width: pixels.width, height: pixels.height }), {
    x: 40,
    y: 40,
    width: 100,
    height: 100,
  });
  const large = api.finishGeometryToPixels(relative, 1600, 900);
  assert.deepEqual(plain({ x: large.x, y: large.y, width: large.width, height: large.height }), {
    x: 160,
    y: 180,
    width: 400,
    height: 450,
  });
  const roundTrip = api.finishGeometryFromPixels(relative, pixels, 400, 200);
  assert.deepEqual(
    plain({ x: roundTrip.xRatio, y: roundTrip.yRatio, width: roundTrip.widthRatio, height: roundTrip.heightRatio }),
    { x: 0.1, y: 0.2, width: 0.25, height: 0.5 },
  );

  const frame = { ...relative, isFrame: true };
  for (const [fitMode, expected] of [
    ["stretch", { x: 0, y: 0, width: 400, height: 200 }],
    ["center", { x: 150, y: 50, width: 100, height: 100 }],
    ["cover", { x: 0, y: -100, width: 400, height: 400 }],
    ["contain", { x: 100, y: 0, width: 200, height: 200 }],
  ]) {
    const actual = api.calculateFinishFrameRect({ ...frame, fitMode }, 400, 200);
    assert.deepEqual(plain({ x: actual.x, y: actual.y, width: actual.width, height: actual.height }), expected, fitMode);
  }
  const oversizedCenter = api.calculateFinishFrameRect({
    ...frame,
    fitMode: "center",
    naturalWidth: 800,
    naturalHeight: 400,
  }, 400, 200);
  assert.deepEqual(plain({
    x: oversizedCenter.x,
    y: oversizedCenter.y,
    width: oversizedCenter.width,
    height: oversizedCenter.height,
  }), { x: 0, y: 0, width: 400, height: 200 });

  assert.deepEqual(plain(api.calculateFinishLayerFit(relative, { width: 400, height: 200 }, "width")), {
    x: 0,
    y: -100,
    width: 400,
    height: 400,
  });
  assert.deepEqual(plain(api.calculateFinishLayerFit(relative, { width: 400, height: 200 }, "height")), {
    x: 100,
    y: 0,
    width: 200,
    height: 200,
  });
  assert.deepEqual(plain(api.calculateFinishLayerFit(relative, { width: 400, height: 200 }, "stretch")), {
    x: 0,
    y: 0,
    width: 400,
    height: 200,
  });

  const rotated = { ...relative, xRatio: 0.1, yRatio: 0.2, widthRatio: 0.25, heightRatio: 0.25, rotation: 90 };
  const corners = api.getFinishLayerCorners(rotated, 400, 200);
  [
    { x: 115, y: 15 },
    { x: 115, y: 115 },
    { x: 65, y: 115 },
    { x: 65, y: 15 },
  ].forEach((expected, index) => assertPointClose(corners[index], expected));
  const aabb = api.getFinishLayerAabb(rotated, 400, 200);
  assert.ok(Math.abs(aabb.left - 65) < 1e-9);
  assert.ok(Math.abs(aabb.top - 15) < 1e-9);
  assert.ok(Math.abs(aabb.right - 115) < 1e-9);
  assert.ok(Math.abs(aabb.bottom - 115) < 1e-9);
  const background = finishLayer("background", { xRatio: 0, yRatio: 0, widthRatio: 1, heightRatio: 1, isFrame: true });
  const foreground = finishLayer("foreground", { xRatio: 0.1, yRatio: 0.2, widthRatio: 0.25, heightRatio: 0.5 });
  assert.equal(api.hitTestFinishLayers([background, foreground], { x: 90, y: 90 }, 400, 200).id, "foreground");
  assert.equal(api.hitTestFinishLayers([background, foreground], { x: 350, y: 150 }, 400, 200).id, "background");
  assert.equal(api.hitTestFinishLayers([background, foreground], { x: 350, y: 150 }, 400, 200, { includeFrames: false }), null);
});

test("finish move coordinates, corner resize, and rotation share processed output space", () => {
  const api = loadPureApi();
  const layer = finishLayer("transform", {
    naturalWidth: 100,
    naturalHeight: 100,
    xRatio: 0.1,
    yRatio: 0.2,
    widthRatio: 0.25,
    heightRatio: 0.5,
  });
  assertPointClose(
    api.finishPointFromClient(110, 70, { left: 10, top: 20, width: 200, height: 100 }, 400, 200),
    { x: 200, y: 100 },
  );
  const resized = api.resizeFinishLayerFromHandle(layer, "se", { x: 160, y: 160 }, 400, 200);
  const geometry = api.finishGeometryToPixels(resized, 400, 200);
  assert.deepEqual(plain({ x: geometry.x, y: geometry.y, width: geometry.width, height: geometry.height }), {
    x: 40,
    y: 40,
    width: 120,
    height: 120,
  });
  const frozenFrame = api.resizeFinishLayerFromHandle({ ...layer, isFrame: true }, "se", { x: 300, y: 190 }, 400, 200);
  assert.deepEqual(plain({
    xRatio: frozenFrame.xRatio,
    yRatio: frozenFrame.yRatio,
    widthRatio: frozenFrame.widthRatio,
    heightRatio: frozenFrame.heightRatio,
  }), { xRatio: 0.1, yRatio: 0.2, widthRatio: 0.25, heightRatio: 0.5 });
  assert.equal(api.calculateFinishLayerRotation(layer, { x: 140, y: 90 }, { x: 90, y: 140 }, 400, 200), 90);
  assert.equal(api.calculateFinishLayerRotation(layer, { x: 140, y: 90 }, { x: 90, y: 140 }, 400, 200, true), 90);
});

test("finish pointer move commits on pointerup and rolls back exactly on pointercancel", () => {
  const { api, elements } = loadActionApi();
  const layer = finishLayer("gesture", {
    xRatio: 0.1,
    yRatio: 0.2,
    widthRatio: 0.25,
    heightRatio: 0.5,
  });
  const item = stateRecord("base", 400, 200, { finishLayers: [layer] });
  api.state.images = [item];
  api.state.selectedId = item.id;
  api.state.mode = "filter";
  api.state.filter.selectedFinishLayerId = layer.id;
  elements.filterPreviewCanvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 200 });
  const pointer = (type, x, y) => ({
    type,
    button: 0,
    pointerId: 17,
    clientX: x,
    clientY: y,
    target: elements.filterFinishSelectionBox,
    currentTarget: elements.filterFinishSelectionBox,
    preventDefault() {},
    stopPropagation() {},
  });

  api.beginFinishSelectionGesture(pointer("pointerdown", 40, 40));
  api.moveFinishGesture(pointer("pointermove", 60, 50));
  assert.ok(Math.abs(item.finishLayers[0].xRatio - 0.15) < 1e-12);
  assert.ok(Math.abs(item.finishLayers[0].yRatio - 0.25) < 1e-12);
  api.cancelFinishGesture();
  assert.ok(Math.abs(item.finishLayers[0].xRatio - 0.1) < 1e-12);
  assert.ok(Math.abs(item.finishLayers[0].yRatio - 0.2) < 1e-12);
  assert.equal(api.state.filter.finishGesture, null);

  api.beginFinishSelectionGesture(pointer("pointerdown", 40, 40));
  api.moveFinishGesture(pointer("pointermove", 60, 50));
  api.endFinishGesture(pointer("pointerup", 60, 50));
  assert.ok(Math.abs(item.finishLayers[0].xRatio - 0.15) < 1e-12);
  assert.ok(Math.abs(item.finishLayers[0].yRatio - 0.25) < 1e-12);
  assert.equal(api.state.filter.finishGesture, null);

  elements.filterFinishRotation.value = "45";
  elements.filterFinishRotation.dispatchEvent({ type: "change" });
  api.toggleFinishLayerFrame();
  assert.equal(item.finishLayers[0].isFrame, true);
  assert.equal(item.finishLayers[0].rotation, 0);
  assert.equal(item.finishLayers[0].manualGeometry.rotation, 45);
  assert.equal(elements.filterFinishRotation.disabled, true);
  elements.filterFinishRotation.value = "90";
  elements.filterFinishRotation.dispatchEvent({ type: "change" });
  assert.equal(item.finishLayers[0].rotation, 0, "a frame must stay unrotated even if a disabled input dispatches");
  api.beginFinishSelectionGesture({
    ...pointer("pointerdown", 200, 0),
    target: { closest: () => ({ dataset: { finishHandle: "rotate" } }) },
  });
  assert.equal(api.state.filter.finishGesture, null, "frame rotation handles must not start a gesture");
  api.toggleFinishLayerFrame();
  assert.equal(item.finishLayers[0].rotation, 45);
});

test("finish order, visibility, opacity, and blend plans follow back-to-front storage", () => {
  const api = loadPureApi();
  const paper = finishLayer("paper", { opacity: 0.2, blendMode: "multiply" });
  const frame = finishLayer("frame", { visible: false });
  const light = finishLayer("light", { opacity: 0.5, blendMode: "screen" });
  const reordered = api.reorderFinishLayers([paper, frame, light], "light", "frame", true);
  assert.deepEqual(Array.from(reordered, ({ id }) => id), ["paper", "light", "frame"]);
  assert.deepEqual([paper.id, frame.id, light.id], ["paper", "frame", "light"], "pure reorder must not mutate input");
  assert.equal(api.finishBlendOperation("normal"), "source-over");
  assert.equal(api.finishBlendOperation("multiply"), "multiply");
  assert.equal(api.finishBlendOperation("screen"), "screen");
  assert.equal(api.finishBlendOperation("overlay"), "overlay");
  assert.equal(api.finishBlendOperation("invalid"), "source-over");
  assert.deepEqual(Array.from(api.getFinishDrawLayers([paper, frame, light]), ({ id }) => id), ["paper", "light"]);

  const calls = [];
  let globalAlpha = 1;
  let globalCompositeOperation = "source-over";
  const context = {
    save() { calls.push(["save"]); },
    restore() { calls.push(["restore"]); },
    translate(...args) { calls.push(["translate", ...args]); },
    rotate(...args) { calls.push(["rotate", ...args]); },
    drawImage(image, ...args) { calls.push(["drawImage", image.id, ...args]); },
    get globalAlpha() { return globalAlpha; },
    set globalAlpha(value) { globalAlpha = value; calls.push(["alpha", value]); },
    get globalCompositeOperation() { return globalCompositeOperation; },
    set globalCompositeOperation(value) { globalCompositeOperation = value; calls.push(["composite", value]); },
  };
  api.drawFinishLayers(context, [paper, frame, light], 400, 200);
  assert.deepEqual(calls.filter(([name]) => name === "drawImage").map((call) => call[1]), ["paper-image", "light-image"]);
  assert.deepEqual(calls.filter(([name]) => name === "alpha").map((call) => call[1]), [0.2, 0.5]);
  assert.deepEqual(calls.filter(([name]) => name === "composite").map((call) => call[1]), ["multiply", "screen"]);
});

test("finish controls edit, place, frame, reorder, hide, and delete the selected layer", () => {
  const { api, elements } = loadActionApi();
  const layers = [finishLayer("back"), finishLayer("subject", {
    naturalWidth: 100,
    naturalHeight: 100,
    xRatio: 0.1,
    yRatio: 0.2,
    widthRatio: 0.25,
    heightRatio: 0.5,
  }), finishLayer("front")];
  const item = stateRecord("base", 400, 200, { finishLayers: layers });
  api.state.images = [item];
  api.state.selectedId = item.id;
  api.state.mode = "filter";
  api.state.filter.selectedFinishLayerId = "subject";
  api.syncFinishControls();
  const current = () => item.finishLayers.find(({ id }) => id === "subject");
  assert.deepEqual(
    [elements.filterFinishX.value, elements.filterFinishY.value, elements.filterFinishWidth.value, elements.filterFinishHeight.value],
    ["10", "20", "25", "50"],
  );
  assert.equal(elements.filterFinishPlacement.value, "front");

  elements.filterFinishPlacement.value = "behind";
  elements.filterFinishPlacement.dispatchEvent({ type: "change" });
  assert.equal(current().placement, "behind");
  assert.equal(elements.filterFinishPlacement.value, "behind");
  elements.filterFinishPlacement.value = "front";
  elements.filterFinishPlacement.dispatchEvent({ type: "change" });
  assert.equal(current().placement, "front");

  elements.filterFinishKeepAspect.checked = false;
  elements.filterFinishKeepAspect.dispatchEvent({ type: "change" });
  elements.filterFinishX.value = "20";
  elements.filterFinishX.dispatchEvent({ type: "change" });
  elements.filterFinishY.value = "30";
  elements.filterFinishY.dispatchEvent({ type: "change" });
  elements.filterFinishWidth.value = "40";
  elements.filterFinishWidth.dispatchEvent({ type: "change" });
  elements.filterFinishHeight.value = "60";
  elements.filterFinishHeight.dispatchEvent({ type: "change" });
  elements.filterFinishOpacity.value = "40";
  elements.filterFinishOpacity.dispatchEvent({ type: "input" });
  elements.filterFinishBlendMode.value = "overlay";
  elements.filterFinishBlendMode.dispatchEvent({ type: "change" });
  assert.deepEqual(plain({
    xRatio: current().xRatio,
    yRatio: current().yRatio,
    widthRatio: current().widthRatio,
    heightRatio: current().heightRatio,
    keepAspect: current().keepAspect,
    opacity: current().opacity,
    blendMode: current().blendMode,
  }), {
    xRatio: 0.2,
    yRatio: 0.3,
    widthRatio: 0.4,
    heightRatio: 0.6,
    keepAspect: false,
    opacity: 0.4,
    blendMode: "overlay",
  });
  assert.equal(elements.filterFinishOpacityValue.textContent, "40%");

  elements.filterFinishVisibilityBtn.dispatchEvent({ type: "click" });
  assert.equal(current().visible, false);
  assert.equal(elements.filterFinishVisibilityBtn.getAttribute("aria-pressed"), "false");
  elements.filterFinishVisibilityBtn.dispatchEvent({ type: "click" });
  assert.equal(current().visible, true);

  elements.filterFinishRotation.value = "37";
  elements.filterFinishRotation.dispatchEvent({ type: "change" });
  assert.equal(current().rotation, 37);

  const manual = plain({
    xRatio: current().xRatio,
    yRatio: current().yRatio,
    widthRatio: current().widthRatio,
    heightRatio: current().heightRatio,
    keepAspect: current().keepAspect,
    rotation: current().rotation,
  });
  elements.filterFinishFrameBtn.dispatchEvent({ type: "click" });
  assert.equal(current().isFrame, true);
  assert.equal(current().rotation, 0);
  assert.equal(elements.filterFinishFrameBtn.getAttribute("aria-pressed"), "true");
  assert.deepEqual(plain(current().manualGeometry), manual);
  assert.equal(elements.filterFinishX.disabled, true);
  assert.equal(elements.filterFinishRotation.disabled, true);
  elements.filterFinishFitMode.value = "contain";
  elements.filterFinishFitMode.dispatchEvent({ type: "change" });
  const frameRect = api.resolveFinishLayerGeometry(current(), 400, 200);
  assert.deepEqual(plain({ x: frameRect.x, y: frameRect.y, width: frameRect.width, height: frameRect.height }), {
    x: 100,
    y: 0,
    width: 200,
    height: 200,
  });
  elements.filterFinishFrameBtn.dispatchEvent({ type: "click" });
  assert.equal(current().isFrame, false);
  assert.deepEqual(plain({
    xRatio: current().xRatio,
    yRatio: current().yRatio,
    widthRatio: current().widthRatio,
    heightRatio: current().heightRatio,
    keepAspect: current().keepAspect,
    rotation: current().rotation,
  }), manual);

  elements.filterFinishFitCanvasBtn.dispatchEvent({ type: "click" });
  assert.deepEqual(plain({
    xRatio: current().xRatio,
    yRatio: current().yRatio,
    widthRatio: current().widthRatio,
    heightRatio: current().heightRatio,
    keepAspect: current().keepAspect,
  }), { xRatio: 0, yRatio: 0, widthRatio: 1, heightRatio: 1, keepAspect: false });
  elements.filterFinishBackwardBtn.dispatchEvent({ type: "click" });
  assert.deepEqual(Array.from(item.finishLayers, ({ id }) => id), ["subject", "back", "front"]);
  elements.filterFinishBringFrontBtn.dispatchEvent({ type: "click" });
  assert.deepEqual(Array.from(item.finishLayers, ({ id }) => id), ["back", "front", "subject"]);
  elements.filterFinishDeleteBtn.dispatchEvent({ type: "click" });
  assert.deepEqual(Array.from(item.finishLayers, ({ id }) => id), ["back", "front"]);
});

test("finish layer rows render front group, fixed processed-image boundary, then behind group", () => {
  const { api, elements } = loadActionApi();
  const item = stateRecord("base", 400, 200, {
    finishLayers: [
      finishLayer("behind-back", { placement: "behind" }),
      finishLayer("front-back"),
      finishLayer("behind-front", { placement: "behind" }),
      finishLayer("middle", { visible: false }),
      finishLayer("front", { isFrame: true }),
    ],
  });
  api.state.images = [item];
  api.state.selectedId = item.id;
  api.state.mode = "filter";
  api.state.filter.selectedFinishLayerId = "front";
  api.renderFinishLayerList();

  assert.deepEqual(elements.filterFinishLayerList.children.map(finishListToken), [
    "front",
    "middle",
    "front-back",
    "__processed_image__",
    "behind-front",
    "behind-back",
  ]);
  assert.ok(elements.filterFinishLayerList.children.every((row) => row.getAttribute("role") === "listitem"));
  assert.equal(elements.filterFinishLayerList.children[0].getAttribute("aria-current"), "true");
  const hiddenRow = elements.filterFinishLayerList.children.find(({ dataset }) => dataset.finishLayerId === "middle");
  assert.equal(hiddenRow.classList.contains("is-hidden-layer"), true);
  assert.equal(hiddenRow.children[0].getAttribute("aria-pressed"), "false");
  const baseRow = elements.filterFinishLayerList.children.find((row) => finishListToken(row) === "__processed_image__");
  assert.ok(baseRow, "the processed image must be represented as a fixed layer boundary");
  assert.match(elementText(baseRow), /加工画像/);
  assert.notEqual(baseRow.draggable, true);
  assert.equal(elements.filterFinishLayerCount.textContent, "5層");

  let row = elements.filterFinishLayerList.children.find(({ dataset }) => dataset.finishLayerId === "middle");
  const reorderEvent = {
    type: "keydown",
    key: "ArrowUp",
    altKey: true,
    target: row,
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() {},
  };
  row.dispatchEvent(reorderEvent);
  assert.equal(reorderEvent.defaultPrevented, true);
  assert.deepEqual(Array.from(item.finishLayers, ({ id }) => id), [
    "behind-back",
    "behind-front",
    "front-back",
    "front",
    "middle",
  ]);

  api.renderFinishLayerList();
  row = elements.filterFinishLayerList.children.find(({ dataset }) => dataset.finishLayerId === "middle");
  const deleteEvent = {
    type: "keydown",
    key: "Delete",
    altKey: false,
    target: row,
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() {},
  };
  row.dispatchEvent(deleteEvent);
  assert.equal(deleteEvent.defaultPrevented, true);
  assert.deepEqual(Array.from(item.finishLayers, ({ id }) => id), ["behind-back", "behind-front", "front-back", "front"]);
});

test("finish multi-load preserves FileList and invocation order despite out-of-order decoding", async () => {
  const harness = createLoadHarness();
  const { api, elements } = loadActionApi({ Image: harness.Image, URL: harness.URL });
  const item = stateRecord("base", 400, 200, { finishLayers: [] });
  api.state.images = [item];
  api.state.selectedId = item.id;
  api.state.mode = "filter";

  const loading = api.addFinishFiles([
    imageFile("a.png"),
    imageFile("b.webp", "image/webp"),
    imageFile("unsupported.gif", "image/gif"),
    imageFile("c.jpg", "image/jpeg"),
  ]);
  assert.equal(api.state.filter.queuedFinishLoadCount, 1);
  assert.equal(elements.exportBtn.disabled, true);
  await flushMicrotasks();
  assert.equal(harness.instances.length, 3);
  harness.instances[2].succeed(120, 60);
  harness.instances[1].succeed(80, 80);
  harness.instances[0].succeed(100, 50);
  const loaded = await loading;
  assert.deepEqual(Array.from(loaded, ({ name }) => name), ["a.png", "b.webp", "c.jpg"]);
  assert.deepEqual(item.finishLayers.map(({ name }) => name), ["a.png", "b.webp", "c.jpg"]);
  assert.equal(api.state.filter.selectedFinishLayerId, item.finishLayers[2].id);
  assert.equal(elements.filterFinishLayerCount.textContent, "3層");
  assert.deepEqual(elements.filterFinishLayerList.children.map(finishListToken), [
    item.finishLayers[2].id,
    item.finishLayers[1].id,
    item.finishLayers[0].id,
    "__processed_image__",
  ]);

  const fourth = api.addFinishFiles([imageFile("d.png")]);
  const fifth = api.addFinishFiles([imageFile("e.png")]);
  await flushMicrotasks();
  assert.equal(harness.instances.length, 4, "the next invocation must wait for the prior decode");
  harness.instances[3].succeed(40, 20);
  await fourth;
  await flushMicrotasks();
  assert.equal(harness.instances.length, 5);
  harness.instances[4].succeed(50, 25);
  await fifth;
  assert.deepEqual(item.finishLayers.map(({ name }) => name), ["a.png", "b.webp", "c.jpg", "d.png", "e.png"]);
  api.clearAll();
  assert.equal(harness.revoked.length, 0, "cleared materials remain available for undo");
  forgetImageHistory(api);
  for (const { url } of harness.created) {
    assert.equal(harness.revoked.filter((value) => value === url).length, 1, `${url} must be revoked exactly once`);
  }
});

test("clearing during pending finish loads cancels queued work and prevents stale resurrection", async () => {
  const harness = createLoadHarness();
  const { api, elements } = loadActionApi({ Image: harness.Image, URL: harness.URL });
  const item = stateRecord("base", 400, 200, { finishLayers: [] });
  api.state.images = [item];
  api.state.selectedId = item.id;
  api.state.mode = "filter";

  const first = api.addFinishFiles([imageFile("pending.png")]);
  const queued = api.addFinishFiles([imageFile("never-started.png")]);
  await flushMicrotasks();
  assert.equal(harness.instances.length, 1);
  assert.equal(api.state.filter.pendingFinishLoads.size, 1);
  assert.equal(elements.clearAllBtn.disabled, false);
  api.clearAll();
  harness.instances[0].succeed(100, 50);
  await Promise.all([first, queued]);
  await flushMicrotasks();
  assert.equal(api.state.images.length, 0);
  assert.equal(item.finishLayers.length, 0);
  assert.equal(harness.instances.length, 1, "the queued stale decode must never start");
  assert.equal(api.state.filter.pendingFinishLoads.size, 0);
  assert.equal(api.state.filter.finishSourceUrls.size, 0);
  assert.equal(harness.revoked.filter((url) => url === harness.created[0].url).length, 1);
});

test("finish-only and combined batch copies stay independent while sharing source URLs until the last reference", () => {
  const harness = createLoadHarness();
  const { api } = loadActionApi({ URL: harness.URL });
  const texture = finishLayer("texture", {
    placement: "behind",
    opacity: 0.2,
    blendMode: "multiply",
    xRatio: 0.1,
    yRatio: 0.2,
    widthRatio: 0.25,
    heightRatio: 0.5,
    manualGeometry: { xRatio: 0.1, yRatio: 0.2, widthRatio: 0.25, heightRatio: 0.5, keepAspect: true },
  });
  const frame = finishLayer("frame", {
    naturalWidth: 100,
    naturalHeight: 100,
    isFrame: true,
    fitMode: "stretch",
  });
  const source = stateRecord("source", 400, 200, {
    filter: api.sanitizeFilterState({ timePreset: "night", strength: 0.7, adjustments: { saturation: -10 } }),
    finishLayers: [texture, frame],
  });
  const old = finishLayer("old-target");
  const target = stateRecord("target", 1600, 900, {
    filter: api.sanitizeFilterState({ timePreset: "morning", strength: 0.4 }),
    finishLayers: [old],
  });
  const third = stateRecord("third", 800, 800, {
    filter: api.sanitizeFilterState({ timePreset: "day", strength: 0.2 }),
    finishLayers: [],
  });
  api.state.images = [source, target, third];
  api.state.selectedId = source.id;
  api.state.mode = "filter";
  [texture.objectUrl, frame.objectUrl, old.objectUrl].forEach((url) => api.state.filter.finishSourceUrls.add(url));
  const targetFilterBefore = plain(target.filter);

  assert.equal(api.applySelectedFinishToAll(), true);
  assert.deepEqual(plain(target.filter), targetFilterBefore, "finish-only batch must not replace filters");
  for (const copiedRecord of [target, third]) {
    assert.equal(copiedRecord.finishLayers.length, 2);
    assert.notEqual(copiedRecord.finishLayers[0].id, texture.id);
    assert.notEqual(copiedRecord.finishLayers[1].id, frame.id);
    assert.strictEqual(copiedRecord.finishLayers[0].image, texture.image);
    assert.strictEqual(copiedRecord.finishLayers[0].file, texture.file);
    assert.equal(copiedRecord.finishLayers[0].objectUrl, texture.objectUrl);
    assert.equal(copiedRecord.finishLayers[0].placement, "behind");
    assert.equal(copiedRecord.finishLayers[1].placement, "front");
    assert.notStrictEqual(copiedRecord.finishLayers[0].manualGeometry, texture.manualGeometry);
  }
  assert.notEqual(target.finishLayers[0].id, third.finishLayers[0].id);
  assert.equal(harness.revoked.filter((url) => url === old.objectUrl).length, 1, "replaced orphan sources must be released");
  assert.equal(harness.revoked.includes(texture.objectUrl), false);
  assert.deepEqual(
    plain(api.resolveFinishLayerGeometry(target.finishLayers[1], 1600, 900)),
    plain({ ...target.finishLayers[1], x: 0, y: 0, width: 1600, height: 900, rotation: 0 }),
  );
  target.finishLayers[0].manualGeometry.xRatio = 0.9;
  target.finishLayers[0].xRatio = 0.9;
  assert.equal(texture.manualGeometry.xRatio, 0.1);
  assert.equal(third.finishLayers[0].xRatio, 0.1);

  target.filter = api.sanitizeFilterState({ timePreset: "morning", strength: 0.1 });
  third.filter = api.sanitizeFilterState({ effectPreset: "sepia", strength: 1 });
  assert.equal(api.applySelectedFilterAndFinishToAll(), true);
  for (const copiedRecord of [target, third]) {
    assert.deepEqual(plain(copiedRecord.filter), plain(source.filter));
    assert.notStrictEqual(copiedRecord.filter, source.filter);
    assert.notStrictEqual(copiedRecord.filter.adjustments, source.filter.adjustments);
    assert.deepEqual(Array.from(copiedRecord.finishLayers, ({ objectUrl }) => objectUrl), [texture.objectUrl, frame.objectUrl]);
    assert.deepEqual(Array.from(copiedRecord.finishLayers, ({ placement }) => placement), ["behind", "front"]);
  }
  target.filter.adjustments.saturation = 77;
  target.finishLayers[0].xRatio = 0.75;
  assert.equal(source.filter.adjustments.saturation, -10);
  assert.equal(third.finishLayers[0].xRatio, 0.1);

  source.finishLayers = source.finishLayers.filter(({ objectUrl }) => objectUrl !== texture.objectUrl);
  api.sweepFinishSourceUrls();
  assert.equal(harness.revoked.includes(texture.objectUrl), false, "shared source must survive while target copies reference it");
  target.finishLayers = target.finishLayers.filter(({ objectUrl }) => objectUrl !== texture.objectUrl);
  third.finishLayers = third.finishLayers.filter(({ objectUrl }) => objectUrl !== texture.objectUrl);
  forgetImageHistory(api);
  api.sweepFinishSourceUrls();
  assert.equal(harness.revoked.filter((url) => url === texture.objectUrl).length, 1);
});

test("filter pixel primitives and four time presets have exact deterministic RGBA behavior", () => {
  const api = loadPureApi();
  assert.equal(api.clampFilterByte(-1), 0);
  assert.equal(api.clampFilterByte(127.5), 128);
  assert.equal(api.clampFilterByte(999), 255);
  assert.deepEqual(Array.from(api.mixFilterPixel([10, 20, 30, 77], [110, 220, 230, 5], 0)), [10, 20, 30, 77]);
  assert.deepEqual(Array.from(api.mixFilterPixel([10, 20, 30, 77], [110, 220, 230, 5], 0.5)), [60, 120, 130, 77]);
  assert.deepEqual(Array.from(api.mixFilterPixel([10, 20, 30, 77], [110, 220, 230, 5], 1)), [110, 220, 230, 77]);

  const pixel = [96, 96, 96, 173];
  const expected = {
    none: [96, 96, 96, 173],
    morning: [122, 113, 104, 173],
    day: [103, 103, 102, 173],
    evening: [114, 86, 64, 173],
    night: [37, 58, 95, 173],
  };
  for (const [preset, rgba] of Object.entries(expected)) {
    assert.deepEqual(Array.from(api.applyTimePresetPixel(pixel, preset)), rgba, preset);
  }
  assert.deepEqual(Array.from(api.applyTonePixel([255, 0, 0, 99], { saturation: -1 })), [54, 54, 54, 99]);
  const red = filterImageData(1, 1, [255, 0, 0, 99]);
  assert.deepEqual(
    Array.from(api.applyFilterPipeline(red, { effectPreset: "monochrome", strength: 1 }).data),
    [54, 54, 54, 99],
  );
  assert.deepEqual(
    Array.from(api.applyFilterPipeline(red, { effectPreset: "sepia", strength: 1 }).data),
    [100, 89, 69, 99],
  );
  assert.deepEqual(
    [0, 42, 43, 127, 128, 212, 213, 255].map((value) => api.quantizeChannel(value, 4)),
    [0, 0, 85, 85, 170, 170, 255, 255],
  );
});

test("the filter pipeline is source-safe, alpha-safe, strength-bounded, and ordered time-tone-special", () => {
  const api = loadPureApi();
  const source = filterImageData(2, 1, [96, 96, 96, 0, 200, 80, 20, 129]);
  const original = Array.from(source.data);
  const settings = api.createDefaultFilterState();
  Object.assign(settings, { timePreset: "evening", effectPreset: "poster", strength: 1 });
  Object.assign(settings.adjustments, { brightness: 10, temperature: -20, saturation: 15 });
  Object.assign(settings.poster, { levels: 4, edge: 0 });

  const full = api.applyFilterPipeline(source, settings);
  assert.deepEqual(Array.from(source.data), original, "the source buffer must stay immutable");
  assert.notStrictEqual(full.data, source.data);
  assert.deepEqual([full.data[3], full.data[7]], [0, 129]);

  const staged = [];
  for (let index = 0; index < source.data.length; index += 4) {
    const time = api.applyTimePresetPixel(Array.from(source.data.slice(index, index + 4)), "evening");
    staged.push(...api.applyTonePixel(time, { brightness: 0.1, temperature: -0.2, saturation: 0.15 }));
  }
  const expectedFull = api.applyPosterize(filterImageData(2, 1, staged), { levels: 4, edge: 0 });
  assert.deepEqual(Array.from(full.data), Array.from(expectedFull.data));

  const zero = api.applyFilterPipeline(source, { ...settings, strength: 0 });
  assert.deepEqual(Array.from(zero.data), original);
  const half = api.applyFilterPipeline(source, { ...settings, strength: 0.5 });
  for (let index = 0; index < original.length; index += 4) {
    assert.deepEqual(
      Array.from(half.data.slice(index, index + 4)),
      Array.from(api.mixFilterPixel(original.slice(index, index + 4), full.data.slice(index, index + 4), 0.5)),
    );
  }
  assert.deepEqual(Array.from(api.applyFilterPipeline(source, settings).data), Array.from(full.data));
});

test("poster and oil effects quantize deterministically without changing alpha or input buffers", () => {
  const api = loadPureApi();
  const steps = [0, 42, 43, 127, 128, 212, 213, 255];
  const posterSource = filterImageData(8, 1, steps.flatMap((value, index) => [value, value, value, index * 31]));
  const posterBefore = Array.from(posterSource.data);
  const poster = api.applyPosterize(posterSource, { levels: 4, edge: 0 });
  const quantized = [0, 0, 85, 85, 170, 170, 255, 255];
  assert.deepEqual(
    Array.from(poster.data),
    quantized.flatMap((value, index) => [value, value, value, index * 31]),
  );
  assert.deepEqual(Array.from(posterSource.data), posterBefore);

  const edgeFixture = filterImageData(3, 3, [
    0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255,
    0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255,
    0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255,
  ]);
  const edges = api.createEdgeMap(edgeFixture);
  assert.equal(edges.length, 9);
  assert.equal(edges[4], 204);
  assert.deepEqual([edges[0], edges[1], edges[2], edges[3], edges[5], edges[6], edges[7], edges[8]], [0, 0, 0, 0, 0, 0, 0, 0]);

  const uniform = filterImageData(3, 3, Array.from({ length: 9 }, (_, index) => [123, 130, 250, index * 28]).flat());
  const oil = api.applyOilPaint(uniform, { colors: 4, brush: 0, edge: 0 });
  for (let index = 0; index < oil.data.length; index += 4) {
    const expectedRgb = uniform.data[index + 3] === 0 ? [123, 130, 250] : [85, 170, 255];
    assert.deepEqual(Array.from(oil.data.slice(index, index + 4)), [...expectedRgb, uniform.data[index + 3]]);
  }
  assert.deepEqual(Array.from(uniform.data.slice(0, 4)), [123, 130, 250, 0]);

  const impulse = filterImageData(3, 3, Array.from({ length: 9 }, (_, index) => (
    index === 4 ? [255, 255, 255, 255] : [0, 0, 0, 255]
  )).flat());
  const smoothed = api.applyOilPaint(impulse, { colors: 4, brush: 20, edge: 0 });
  assert.deepEqual(Array.from(smoothed.data.slice(16, 20)), [0, 0, 0, 255]);
  assert.deepEqual(Array.from(api.applyOilPaint(impulse, { colors: 4, brush: 20, edge: 0 }).data), Array.from(smoothed.data));
});

test("oil smoothing weights partially transparent matte colors by alpha before touching opaque neighbors", () => {
  const api = loadPureApi();
  const source = filterImageData(3, 1, [
    255, 0, 0, 255,
    0, 0, 255, 1,
    255, 0, 0, 255,
  ]);
  const output = api.applyOilPaint(source, { colors: 32, brush: 4, edge: 0 });

  assert.deepEqual(Array.from(output.data.slice(0, 4)), [255, 0, 0, 255]);
  assert.deepEqual(Array.from(output.data.slice(8, 12)), [255, 0, 0, 255]);
  assert.deepEqual([output.data[3], output.data[7], output.data[11]], [255, 1, 255]);
});

test("tiled filter rendering matches the full pipeline across the nonuniform 512/513 boundary", async () => {
  const width = 513;
  const height = 7;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      pixels[index] = (x * 37 + y * 17 + (x === 512 ? 91 : 0)) % 256;
      pixels[index + 1] = (x * 11 + y * 73 + (x === 511 ? 143 : 0)) % 256;
      pixels[index + 2] = (x * 97 + y * 19 + ((x + y) % 5) * 29) % 256;
      pixels[index + 3] = (x + y) % 7 === 0 ? 47 : (x + y) % 11 === 0 ? 173 : 255;
    }
  }
  const harness = createTiledFilterHarness({ sourcePixels: pixels, canvasRoles: ["source"] });
  const outputCanvas = harness.makeCanvas("output");
  const { api } = loadActionApi({
    createElement: harness.createElement,
    setTimeout(callback) { queueMicrotask(callback); return 1; },
    clearTimeout() {},
  });
  const filter = api.sanitizeFilterState({
    timePreset: "evening",
    effectPreset: "oil",
    strength: 0.83,
    adjustments: { brightness: 7, contrast: 16, saturation: -11, temperature: 23, tint: -9 },
    oil: { color: 13, brush: 12, edge: 65 },
  });
  const item = stateRecord("tile-boundary", width, height, {
    image: { pixels },
    filter,
  });
  const expected = api.applyFilterPipeline(filterImageData(width, height, pixels), filter);

  await api.renderFilteredRecordToCanvasTiled(item, "png", outputCanvas);

  assert.deepEqual([outputCanvas.width, outputCanvas.height], [width, height]);
  assert.deepEqual(Array.from(outputCanvas.pixelData), Array.from(expected.data));
  const outputWrites = harness.writes.filter(({ role }) => role === "output");
  assert.equal(outputWrites.length, 2);
  assert.deepEqual(
    outputWrites.map(({ dx, dirtyX, dirtyWidth, dirtyHeight, imageWidth }) => (
      { dx, dirtyX, dirtyWidth, dirtyHeight, imageWidth }
    )),
    [
      { dx: 0, dirtyX: 0, dirtyWidth: 512, dirtyHeight: height, imageWidth: 513 },
      { dx: 509, dirtyX: 3, dirtyWidth: 1, dirtyHeight: height, imageWidth: 4 },
    ],
  );
  assert.equal(outputWrites.reduce((total, write) => total + write.dirtyWidth * write.dirtyHeight, 0), width * height);
  const sourceCanvas = harness.canvases.find(({ role }) => role === "source");
  assert.ok(sourceCanvas);
  assert.deepEqual([sourceCanvas.width, sourceCanvas.height], [1, 1]);
});

test("a finish layer crossing x=512 matches full rendering and is drawn once after every tiled core", async () => {
  const width = 513;
  const height = 5;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      pixels[index] = (x * 29 + y * 43) % 256;
      pixels[index + 1] = (x * 71 + y * 13) % 256;
      pixels[index + 2] = (x * 17 + y * 101) % 256;
      pixels[index + 3] = (x + y) % 9 === 0 ? 91 : 255;
    }
  }
  const overlayPixels = new Uint8ClampedArray(3 * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < 3; x += 1) {
      const index = (y * 3 + x) * 4;
      overlayPixels.set([220 - x * 40, 30 + y * 25, 180, 64 + x * 64], index);
    }
  }
  const backdropPixels = new Uint8ClampedArray(Array.from({ length: width * height }, () => [12, 180, 90, 255]).flat());
  const harness = createTiledFilterHarness({ sourcePixels: pixels, canvasRoles: ["source"] });
  const fullCanvas = harness.makeCanvas("full-output");
  const tiledCanvas = harness.makeCanvas("tiled-output");
  const { api } = loadActionApi({
    createElement: harness.createElement,
    setTimeout(callback) { queueMicrotask(callback); return 1; },
    clearTimeout() {},
  });
  const item = stateRecord("finish-seam", width, height, {
    image: { id: "base", pixels },
    filter: api.sanitizeFilterState({
      timePreset: "evening",
      effectPreset: "oil",
      strength: 0.8,
      oil: { color: 13, brush: 12, edge: 55 },
    }),
    finishLayers: [
      finishLayer("backdrop", {
        placement: "behind",
        image: {
          id: "backdrop-image",
          pixels: backdropPixels,
          naturalWidth: width,
          naturalHeight: height,
        },
        naturalWidth: width,
        naturalHeight: height,
      }),
      finishLayer("seam-overlay", {
        image: {
          id: "seam-overlay-image",
          pixels: overlayPixels,
          naturalWidth: 3,
          naturalHeight: height,
        },
        naturalWidth: 3,
        naturalHeight: height,
        xRatio: 511 / width,
        yRatio: 0,
        widthRatio: 3 / width,
        heightRatio: 1,
        keepAspect: false,
        opacity: 0.75,
      }),
    ],
  });

  api.renderFilteredRecordToCanvas(item, "png", fullCanvas);
  await api.renderFilteredRecordToCanvasTiled(item, "png", tiledCanvas);

  assert.deepEqual(Array.from(tiledCanvas.pixelData), Array.from(fullCanvas.pixelData));
  const tiledCalls = harness.calls.filter(({ role }) => role === "tiled-output");
  const outputCoreWrites = tiledCalls.filter(({ type }) => type === "putImageData");
  const scratchCoreWrites = harness.writes.filter(({ role }) => role === "canvas");
  const outputCoreDraws = tiledCalls.filter(({ type, image }) => type === "drawImage" && !image);
  const finishDraws = tiledCalls.filter(({ type, image }) => type === "drawImage" && image === "seam-overlay-image");
  const backdropDraws = tiledCalls.filter(({ type, image }) => type === "drawImage" && image === "backdrop-image");
  assert.equal(outputCoreWrites.length, 0, "filtered RGBA must not overwrite transparent backdrop pixels directly");
  assert.deepEqual(scratchCoreWrites.map(({ dirtyWidth }) => dirtyWidth), [512, 1]);
  assert.equal(outputCoreDraws.length, 2);
  assert.equal(finishDraws.length, 1);
  assert.equal(backdropDraws.length, 1);
  assert.ok(tiledCalls.indexOf(backdropDraws[0]) < tiledCalls.indexOf(outputCoreDraws[0]));
  assert.ok(tiledCalls.lastIndexOf(finishDraws[0]) > tiledCalls.lastIndexOf(outputCoreDraws[1]));
  assert.equal(
    harness.calls.some(({ role, type, image }) => role === "source" && type === "drawImage" && image === "seam-overlay-image"),
    false,
    "finish pixels must not enter the filter source tiles",
  );
  assert.equal(
    harness.calls.some(({ role, type, image }) => role === "source" && type === "drawImage" && image === "backdrop-image"),
    false,
    "behind finish pixels must not enter the filter source tiles",
  );
});

test("tiled filter export releases both full-size canvases when rendering or pixel reads fail", async () => {
  for (const failStage of ["drawImage", "getImageData"]) {
    const harness = createTiledFilterHarness({ canvasRoles: ["output", "source"], failStage });
    const { api } = loadActionApi({ createElement: harness.createElement });
    const item = stateRecord(`failure-${failStage}`, 513, 513, {
      image: {},
      filter: api.sanitizeFilterState({ timePreset: "morning", strength: 1 }),
    });

    await assert.rejects(
      api.encodeFilteredRecord(item, "png", 0.9),
      new RegExp(`synthetic ${failStage} failure`),
    );
    assert.deepEqual(harness.canvases.map(({ role }) => role), ["output", "source"]);
    for (const canvas of harness.canvases) {
      assert.deepEqual([canvas.width, canvas.height], [1, 1], `${failStage}: ${canvas.role} canvas must be released`);
    }
  }
});

test("filter preview sizing, filenames, export snapshots, and time-variant jobs are exact", () => {
  const api = loadPureApi();
  assert.deepEqual(plain(api.calculateFilterPreviewSize(6000, 4000)), { width: 1200, height: 800, scale: 0.2 });
  assert.deepEqual(plain(api.calculateFilterPreviewSize(4000, 6000)), { width: 800, height: 1200, scale: 0.2 });
  assert.deepEqual(plain(api.calculateFilterPreviewSize(800, 600)), { width: 800, height: 600, scale: 1 });
  assert.deepEqual(plain(api.calculateFilterPreviewSize(1, 10_000)), { width: 1, height: 1200, scale: 0.12 });
  assert.equal(api.filterOutputFileName("forest.scene.webp", "filtered", "jpeg"), "forest.scene_filtered.jpg");
  assert.equal(api.filterVariantFileName("forest.scene.webp", "noon", "png"), "forest.scene_day.png");

  const record = stateRecord("forest.scene", 403, 227, {
    fileName: "forest.scene.webp",
    filter: api.sanitizeFilterState({
      timePreset: "night",
      effectPreset: "poster",
      strength: 0.85,
      adjustments: { brightness: 12 },
      poster: { levels: 4, edge: 20 },
    }),
  });
  const jobs = api.makeTimeVariantJobs(record, "png");
  assert.deepEqual(Array.from(jobs, (job) => job.timePreset), ["morning", "day", "evening", "night"]);
  assert.deepEqual(Array.from(jobs, (job) => job.fileName), [
    "forest.scene_morning.png",
    "forest.scene_day.png",
    "forest.scene_evening.png",
    "forest.scene_night.png",
  ]);
  assert.deepEqual(Array.from(jobs, (job) => job.record.filter.timePreset), ["morning", "day", "evening", "night"]);
  jobs[0].record.filter.adjustments.brightness = -99;
  jobs[0].record.filter.poster.levels = 16;
  assert.equal(jobs[1].record.filter.adjustments.brightness, 12);
  assert.equal(jobs[1].record.filter.poster.levels, 4);
  assert.equal(record.filter.adjustments.brightness, 12);

  const snapshot = api.snapshotFilterExport([record], { format: "webp", quality: 0.42 });
  record.filter.adjustments.brightness = 77;
  assert.equal(snapshot.format, "webp");
  assert.equal(snapshot.quality, 0.42);
  assert.equal(snapshot.records[0].filter.adjustments.brightness, 12);
});

test("filter export and four time jobs deep-snapshot edits plus finish state while sharing render sources", () => {
  const api = loadPureApi();
  const sourceLayer = finishLayer("gothic-frame", {
    placement: "behind",
    xRatio: 0.1,
    yRatio: 0.2,
    widthRatio: 0.8,
    heightRatio: 0.6,
    opacity: 0.75,
    blendMode: "overlay",
    manualGeometry: { xRatio: 0.1, yRatio: 0.2, widthRatio: 0.8, heightRatio: 0.6, keepAspect: true },
  });
  const item = stateRecord("scene", 400, 200, {
    fileName: "scene.webp",
    crop: { x: 20, y: 10, width: 200, height: 100 },
    resize: { width: 80, height: 40, keepAspect: false },
    flipX: true,
    filter: api.sanitizeFilterState({ timePreset: "night", strength: 0.7, adjustments: { saturation: -10 } }),
    finishLayers: [sourceLayer],
  });
  const snapshot = api.snapshotFilterExport([item], { format: "webp", quality: 0.42 });
  const jobs = api.makeTimeVariantJobs(item, "png");

  item.crop.x = 99;
  item.resize.width = 999;
  item.filter.adjustments.saturation = 88;
  item.finishLayers[0].xRatio = 0.9;
  item.finishLayers[0].manualGeometry.xRatio = 0.9;
  item.finishLayers[0].opacity = 0.1;
  item.finishLayers[0].placement = "front";

  assert.deepEqual(plain(snapshot.records[0].crop), { x: 20, y: 10, width: 200, height: 100 });
  assert.deepEqual(plain(snapshot.records[0].resize), { width: 80, height: 40, keepAspect: false });
  assert.equal(snapshot.records[0].filter.adjustments.saturation, -10);
  assert.equal(snapshot.records[0].finishLayers[0].xRatio, 0.1);
  assert.equal(snapshot.records[0].finishLayers[0].manualGeometry.xRatio, 0.1);
  assert.equal(snapshot.records[0].finishLayers[0].opacity, 0.75);
  assert.equal(snapshot.records[0].finishLayers[0].placement, "behind");
  assert.equal(snapshot.format, "webp");
  assert.equal(snapshot.quality, 0.42);

  assert.deepEqual(Array.from(jobs, ({ timePreset }) => timePreset), ["morning", "day", "evening", "night"]);
  assert.deepEqual(Array.from(jobs, ({ fileName }) => fileName), [
    "scene_morning.png",
    "scene_day.png",
    "scene_evening.png",
    "scene_night.png",
  ]);
  for (let index = 0; index < jobs.length; index += 1) {
    const layer = jobs[index].record.finishLayers[0];
    assert.equal(layer.xRatio, 0.1);
    assert.equal(layer.opacity, 0.75);
    assert.equal(layer.placement, "behind");
    assert.strictEqual(layer.image, sourceLayer.image);
    assert.strictEqual(layer.file, sourceLayer.file);
    if (index > 0) {
      assert.notStrictEqual(layer, jobs[0].record.finishLayers[0]);
      assert.notStrictEqual(layer.manualGeometry, jobs[0].record.finishLayers[0].manualGeometry);
    }
  }
  jobs[0].record.finishLayers[0].xRatio = -0.5;
  jobs[0].record.finishLayers[0].manualGeometry.xRatio = -0.5;
  assert.equal(jobs[1].record.finishLayers[0].xRatio, 0.1);
  assert.equal(jobs[1].record.finishLayers[0].manualGeometry.xRatio, 0.1);
});

test("batch filter application deep-copies settings and comparison remains transient", () => {
  const { api, elements } = loadActionApi();
  const first = stateRecord("first", 20, 10, {
    filter: api.sanitizeFilterState({
      timePreset: "evening",
      effectPreset: "oil",
      strength: 0.8,
      adjustments: { temperature: 35, shadows: -20 },
      oil: { color: 30, brush: 12, edge: 60 },
    }),
  });
  const second = stateRecord("second", 30, 15, { crop: { x: 2, y: 1, width: 20, height: 10 } });
  const third = stateRecord("third", 40, 20);
  api.state.images = [first, second, third];
  api.state.selectedId = first.id;
  api.state.mode = "filter";

  api.applySelectedFilterToAll();
  assert.deepEqual(plain(second.filter), plain(first.filter));
  assert.deepEqual(plain(third.filter), plain(first.filter));
  assert.notStrictEqual(second.filter, first.filter);
  assert.notStrictEqual(second.filter.adjustments, first.filter.adjustments);
  assert.notStrictEqual(second.filter.oil, third.filter.oil);
  second.filter.adjustments.temperature = -99;
  second.filter.oil.brush = 1;
  assert.equal(first.filter.adjustments.temperature, 35);
  assert.equal(third.filter.oil.brush, 12);
  assert.deepEqual(plain(second.crop), { x: 2, y: 1, width: 20, height: 10 });

  api.setFilterCompareActive(true);
  assert.equal(api.state.filter.comparingOriginal, true);
  assert.equal(elements.filterCompareBtn.getAttribute("aria-pressed"), "true");
  assert.deepEqual(plain(first.filter), plain(api.sanitizeFilterState(first.filter)));
  api.setFilterCompareActive(false);
  assert.equal(api.state.filter.comparingOriginal, false);
  assert.equal(elements.filterCompareBtn.getAttribute("aria-pressed"), "false");
});

test("filter controls map UI presets and bounded ranges into one selected record and reset cleanly", () => {
  const { api, elements } = loadActionApi();
  const item = stateRecord("subject", 40, 20, { filter: api.createDefaultFilterState() });
  api.state.images = [item];
  api.state.selectedId = item.id;
  api.state.mode = "filter";

  elements.filterTimeMorningBtn.dispatchEvent({ type: "click" });
  elements.filterEffectPosterBtn.dispatchEvent({ type: "click" });
  assert.equal(item.filter.timePreset, "morning");
  assert.equal(item.filter.effectPreset, "poster");
  assert.equal(elements.filterTimeMorningBtn.getAttribute("aria-pressed"), "true");
  assert.equal(elements.filterEffectPosterBtn.getAttribute("aria-pressed"), "true");
  assert.equal(elements.filterPosterSettings.hidden, false);
  assert.equal(elements.filterOilSettings.hidden, true);

  Object.assign(elements.filterIntensity, { value: "100" });
  Object.assign(elements.filterBrightness, { value: "-120" });
  Object.assign(elements.filterContrast, { value: "120" });
  Object.assign(elements.filterSaturation, { value: "25" });
  Object.assign(elements.filterTemperature, { value: "35" });
  Object.assign(elements.filterTint, { value: "-45" });
  Object.assign(elements.filterHighlights, { value: "55" });
  Object.assign(elements.filterShadows, { value: "-65" });
  Object.assign(elements.filterOilColor, { value: "30" });
  Object.assign(elements.filterOilBrush, { value: "12" });
  Object.assign(elements.filterOilEdge, { value: "80" });
  Object.assign(elements.filterPosterLevels, { value: "99" });
  Object.assign(elements.filterPosterEdge, { value: "75" });
  elements.filterIntensity.dispatchEvent({ type: "input" });

  assert.deepEqual(plain(item.filter), {
    timePreset: "morning",
    effectPreset: "poster",
    strength: 1,
    adjustments: {
      brightness: -100,
      contrast: 100,
      saturation: 25,
      temperature: 35,
      tint: -45,
      highlights: 55,
      shadows: -65,
    },
    oil: { color: 30, brush: 12, edge: 80 },
    poster: { levels: 16, edge: 75 },
  });
  assert.equal(elements.filterIntensityValue.textContent, "100%");
  assert.equal(elements.filterBrightnessValue.textContent, "-100");
  assert.equal(elements.filterContrastValue.textContent, "+100");
  assert.equal(elements.filterPosterLevelsValue.textContent, "16段階");

  api.resetCurrent();
  assert.deepEqual(plain(item.filter), plain(api.createDefaultFilterState()));
});

test("the image-processing mode switch exposes filter panels with exclusive pressed state", () => {
  const { api, elements } = loadActionApi();
  elements.modeFilterBtn.dispatchEvent({ type: "click" });
  assert.equal(api.state.mode, "filter");
  assert.equal(elements.modeFilterBtn.getAttribute("aria-pressed"), "true");
  for (const button of [elements.modeCombineBtn, elements.modeSplitBtn, elements.modeEditBtn, elements.modeCanvasBtn]) {
    assert.equal(button.getAttribute("aria-pressed"), "false");
  }
  assert.equal(elements.standardAssetPanel.hidden, false);
  assert.equal(elements.filterSettings.hidden, false);
  assert.equal(elements.canvasLayerPanel.hidden, true);
  assert.equal(elements.canvasSettings.hidden, true);
});

test("filter comparison supports pointer and keyboard hold semantics without changing settings", () => {
  const { api, elements } = loadActionApi();
  const item = stateRecord("subject", 40, 20, {
    filter: api.sanitizeFilterState({ timePreset: "night", strength: 0.9 }),
  });
  api.state.images = [item];
  api.state.selectedId = item.id;
  api.state.mode = "filter";
  api.updateActionAvailability();
  const before = plain(item.filter);

  let pointerPrevented = false;
  elements.filterCompareBtn.dispatchEvent({
    type: "pointerdown",
    pointerId: 8,
    preventDefault() { pointerPrevented = true; },
  });
  assert.equal(pointerPrevented, true);
  assert.equal(api.state.filter.comparingOriginal, true);
  elements.filterCompareBtn.dispatchEvent({ type: "pointerup", pointerId: 8 });
  assert.equal(api.state.filter.comparingOriginal, false);

  let keyPrevented = false;
  elements.filterCompareBtn.dispatchEvent({
    type: "keydown",
    key: " ",
    repeat: false,
    preventDefault() { keyPrevented = true; },
  });
  assert.equal(keyPrevented, true);
  assert.equal(api.state.filter.comparingOriginal, true);
  elements.filterCompareBtn.dispatchEvent({ type: "keyup", key: " ", preventDefault() {} });
  assert.equal(api.state.filter.comparingOriginal, false);
  assert.deepEqual(plain(item.filter), before);
});

test("filter preview uses a bounded canvas while comparison bypasses pixel processing", () => {
  const { api, elements } = loadActionApi();
  const item = stateRecord("large", 60, 40, {
    image: { id: "source-image" },
    filter: api.sanitizeFilterState({ timePreset: "evening", strength: 1 }),
  });
  api.state.images = [item];
  api.state.selectedId = item.id;
  api.state.mode = "filter";
  elements.filterPreviewCanvas.parentElement = { clientWidth: 46, clientHeight: 46 };
  const calls = [];
  const context = {
    clearRect(...args) { calls.push(["clearRect", ...args]); },
    drawImage(...args) { calls.push(["drawImage", ...args]); },
    getImageData(_x, _y, width, height) {
      calls.push(["getImageData", width, height]);
      return filterImageData(width, height, Array.from({ length: width * height }, () => [96, 96, 96, 173]).flat());
    },
    putImageData(imageData) { calls.push(["putImageData", ...Array.from(imageData.data.slice(0, 4))]); },
  };
  elements.filterPreviewCanvas.getContext = () => context;

  api.renderFilterPreview();
  assert.deepEqual([elements.filterPreviewCanvas.width, elements.filterPreviewCanvas.height], [10, 7]);
  assert.equal(elements.filterPreviewCanvas.dataset.outputSize, "60×40");
  assert.deepEqual(calls.find(([name]) => name === "drawImage").slice(-4), [0, 0, 10, 7]);
  assert.deepEqual(calls.find(([name]) => name === "putImageData").slice(1), [114, 86, 64, 173]);

  const putsBefore = calls.filter(([name]) => name === "putImageData").length;
  api.setFilterCompareActive(true);
  api.renderFilterPreview();
  assert.equal(calls.filter(([name]) => name === "putImageData").length, putsBefore);
  assert.equal(calls.filter(([name]) => name === "drawImage").length, 2);
});

test("finish preview scales natural-size frames and comparison shows only the processed original", () => {
  const { api, elements } = loadActionApi();
  const frame = finishLayer("natural-frame", {
    image: { id: "natural-frame-image", naturalWidth: 100, naturalHeight: 100 },
    naturalWidth: 100,
    naturalHeight: 100,
    isFrame: true,
    fitMode: "center",
  });
  const item = stateRecord("large-finish", 6000, 4000, {
    image: { id: "processed-base-image" },
    filter: api.createDefaultFilterState(),
    finishLayers: [frame],
  });
  api.state.images = [item];
  api.state.selectedId = item.id;
  api.state.mode = "filter";
  api.state.filter.selectedFinishLayerId = frame.id;
  elements.filterPreviewCanvas.parentElement = { clientWidth: 1236, clientHeight: 836 };
  const calls = [];
  let globalAlpha = 1;
  let globalCompositeOperation = "source-over";
  const context = {
    clearRect(...args) { calls.push(["clearRect", ...args]); },
    save() { calls.push(["save"]); },
    restore() { calls.push(["restore"]); },
    translate(...args) { calls.push(["translate", ...args]); },
    rotate(...args) { calls.push(["rotate", ...args]); },
    drawImage(image, ...args) { calls.push(["drawImage", image.id, ...args]); },
    getImageData(_x, _y, width, height) {
      calls.push(["getImageData", width, height]);
      return filterImageData(width, height, new Uint8ClampedArray(width * height * 4).fill(96));
    },
    putImageData(imageData) { calls.push(["putImageData", ...Array.from(imageData.data.slice(0, 4))]); },
    get globalAlpha() { return globalAlpha; },
    set globalAlpha(value) { globalAlpha = value; calls.push(["alpha", value]); },
    get globalCompositeOperation() { return globalCompositeOperation; },
    set globalCompositeOperation(value) { globalCompositeOperation = value; calls.push(["composite", value]); },
  };
  elements.filterPreviewCanvas.getContext = () => context;

  api.renderFilterPreview();
  assert.deepEqual([elements.filterPreviewCanvas.width, elements.filterPreviewCanvas.height], [1200, 800]);
  assert.equal(elements.filterPreviewCanvas.dataset.outputSize, "6000×4000");
  const finishDraw = calls.find((call) => call[0] === "drawImage" && call[1] === "natural-frame-image");
  assert.deepEqual(finishDraw.slice(-4), [-10, -10, 20, 20], "natural 100px frame must scale to 20px in a 20% preview");
  assert.ok(calls.some((call) => call[0] === "translate" && call[1] === 600 && call[2] === 400));
  assert.equal(elements.filterFinishSelectionBox.hidden, false);

  const readsBefore = calls.filter(([name]) => name === "getImageData").length;
  const finishDrawsBefore = calls.filter((call) => call[0] === "drawImage" && call[1] === "natural-frame-image").length;
  api.setFilterCompareActive(true);
  api.renderFilterPreview();
  assert.equal(calls.filter(([name]) => name === "getImageData").length, readsBefore);
  assert.equal(
    calls.filter((call) => call[0] === "drawImage" && call[1] === "natural-frame-image").length,
    finishDrawsBefore,
  );
  assert.equal(calls.filter((call) => call[0] === "drawImage" && call[1] === "processed-base-image").length, 2);
  assert.equal(elements.filterFinishSelectionBox.hidden, true);
});

test("filter rendering applies processed crop, rotation, flip, and resize before pixels and finish layers", () => {
  const api = loadPureApi();
  const calls = [];
  let globalAlpha = 1;
  let globalCompositeOperation = "source-over";
  const context = {
    clearRect(...args) { calls.push(["clearRect", ...args]); },
    save() { calls.push(["save"]); },
    restore() { calls.push(["restore"]); },
    beginPath() { calls.push(["beginPath"]); },
    rect(...args) { calls.push(["rect", ...args]); },
    clip() { calls.push(["clip"]); },
    translate(...args) { calls.push(["translate", ...args]); },
    scale(...args) { calls.push(["scale", ...args]); },
    rotate(...args) { calls.push(["rotate", ...args]); },
    drawImage(image, ...args) { calls.push(["drawImage", image.id, ...args]); },
    getImageData(_x, _y, width, height) {
      calls.push(["getImageData", width, height]);
      return filterImageData(width, height, Array.from({ length: width * height }, () => [96, 96, 96, 255]).flat());
    },
    putImageData(imageData) { calls.push(["putImageData", ...Array.from(imageData.data.slice(0, 4))]); },
    get globalAlpha() { return globalAlpha; },
    set globalAlpha(value) { globalAlpha = value; calls.push(["alpha", value]); },
    get globalCompositeOperation() { return globalCompositeOperation; },
    set globalCompositeOperation(value) { globalCompositeOperation = value; calls.push(["composite", value]); },
  };
  const canvas = { width: 0, height: 0, getContext: () => context };
  const item = stateRecord("processed", 400, 200, {
    image: { id: "base-image" },
    crop: { x: 20, y: 40, width: 160, height: 320 },
    resize: { width: 80, height: 160, keepAspect: false },
    rotation: 90,
    flipX: true,
    filter: api.sanitizeFilterState({ timePreset: "evening", strength: 1 }),
    finishLayers: [finishLayer("finish", {
      image: { id: "finish-image" },
      xRatio: 0.5,
      yRatio: 0.5,
      widthRatio: 0.5,
      heightRatio: 0.5,
    })],
  });

  api.renderFilteredRecordToCanvas(item, "png", canvas);

  assert.deepEqual([canvas.width, canvas.height], [80, 160]);
  const baseDraw = calls.findIndex((call) => call[0] === "drawImage" && call[1] === "base-image");
  const read = calls.findIndex((call) => call[0] === "getImageData");
  const write = calls.findIndex((call) => call[0] === "putImageData");
  const finishDraw = calls.findIndex((call) => call[0] === "drawImage" && call[1] === "finish-image");
  assert.ok(baseDraw >= 0 && baseDraw < read && read < write && write < finishDraw);
  assert.deepEqual(calls[write].slice(1), [114, 86, 64, 255]);
  assert.ok(calls.some((call) => call[0] === "rotate" && Math.abs(call[1] - Math.PI / 2) < 1e-12));
  assert.ok(calls.some((call) => call[0] === "scale" && call[1] === -1 && call[2] === 1));
});

test("filtered export keeps processed dimensions, alpha rules, format snapshots, and duplicate locking", async () => {
  const harness = createExportHarness();
  const { api, elements } = loadActionApi({
    createElement: harness.createElement,
    URL: harness.URL,
    setTimeout: harness.setTimeout,
    clearTimeout: harness.clearTimeout,
  });
  const pixels = new Uint8ClampedArray([
    100, 150, 200, 128,
    10, 20, 30, 0,
    255, 0, 0, 255,
    0, 255, 0, 64,
  ]);
  const item = stateRecord("alpha-source", 2, 2, {
    fileName: "alpha.source.webp",
    image: { pixels },
    filter: api.sanitizeFilterState({ strength: 0 }),
  });
  api.state.images = [item];
  api.state.selectedId = item.id;
  api.state.mode = "filter";
  elements.outputQuality.value = "80";

  const cases = [
    ["png", "image/png", "alpha.source_filtered.png", Array.from(pixels)],
    ["jpeg", "image/jpeg", "alpha.source_filtered.jpg", [
      177, 202, 227, 255,
      255, 255, 255, 255,
      255, 0, 0, 255,
      191, 255, 191, 255,
    ]],
    ["webp", "image/webp", "alpha.source_filtered.webp", Array.from(pixels)],
  ];
  for (const [format, mime, fileName, expectedPixels] of cases) {
    elements.outputFormat.value = format;
    api.updateActionAvailability();
    const encodeIndex = harness.pendingEncodes.length;
    const canvasCount = harness.canvases.length;
    const exporting = api.exportCurrentMode();
    const duplicate = api.exportCurrentMode();
    await flushMicrotasks();

    assert.equal(harness.canvases.length, canvasCount + 1);
    assert.equal(harness.pendingEncodes.length, encodeIndex + 1, "the duplicate request must not encode again");
    const pending = harness.pendingEncodes[encodeIndex];
    assert.deepEqual([pending.width, pending.height], [2, 2]);
    assert.equal(pending.mime, mime);
    assert.equal(pending.quality, 0.8);
    assert.deepEqual(Array.from(pending.data), expectedPixels);

    elements.outputFormat.value = format === "png" ? "webp" : "png";
    item.filter = api.sanitizeFilterState({ timePreset: "night", strength: 1 });
    await duplicate;
    harness.resolveEncode(encodeIndex);
    await exporting;
    await flushMicrotasks();
    assert.equal(harness.downloads.at(-1).download, fileName);
    assert.equal(api.state.exporting, false);
    item.filter = api.sanitizeFilterState({ strength: 0 });
  }
  assert.equal(harness.downloads.length, 3);
  assert.deepEqual(harness.revoked, harness.objectUrls.map(({ url }) => url));

  const flattened = filterImageData(1, 1, [100, 150, 200, 128]);
  assert.deepEqual(Array.from(api.flattenFilterImageDataToWhite(flattened).data), [177, 202, 227, 255]);
});

test("PNG, WebP, and JPEG compose visible finish pixels after filtering with the correct alpha backdrop", () => {
  const basePixels = new Uint8ClampedArray(Array.from({ length: 4 }, () => [0, 0, 255, 0]).flat());
  const finishPixels = new Uint8ClampedArray(Array.from({ length: 4 }, () => [255, 0, 0, 128]).flat());
  const harness = createTiledFilterHarness({ sourcePixels: basePixels });
  const { api } = loadActionApi({ createElement: harness.createElement });
  const item = stateRecord("transparent", 2, 2, {
    image: { id: "transparent-base", pixels: basePixels },
    filter: api.createDefaultFilterState(),
    finishLayers: [finishLayer("red-finish", {
      image: { id: "red-finish-image", pixels: finishPixels, naturalWidth: 2, naturalHeight: 2 },
      naturalWidth: 2,
      naturalHeight: 2,
    })],
  });
  const outputs = {};
  for (const format of ["png", "webp", "jpeg"]) {
    const canvas = harness.makeCanvas(`${format}-output`);
    api.renderFilteredRecordToCanvas(item, format, canvas);
    outputs[format] = Array.from(canvas.pixelData);
  }

  const transparentRed = Array.from({ length: 4 }, () => [255, 0, 0, 128]).flat();
  const whiteBackedRed = Array.from({ length: 4 }, () => [255, 127, 127, 255]).flat();
  assert.deepEqual(outputs.png, transparentRed);
  assert.deepEqual(outputs.webp, transparentRed);
  assert.deepEqual(outputs.jpeg, whiteBackedRed);
  for (const format of ["png", "webp", "jpeg"]) {
    assert.equal(
      harness.calls.filter(({ role, type, image }) => role === `${format}-output` && type === "drawImage" && image === "red-finish-image").length,
      1,
    );
  }
});

test("finish placement composes behind, processed image, then front through transparent pixels", () => {
  const behindPixels = new Uint8ClampedArray([255, 0, 0, 255]);
  const basePixels = new Uint8ClampedArray([0, 0, 255, 128]);
  const frontPixels = new Uint8ClampedArray([0, 255, 0, 128]);
  const harness = createTiledFilterHarness({ sourcePixels: basePixels });
  const { api } = loadActionApi({ createElement: harness.createElement });
  const canvas = harness.makeCanvas("placement-output");
  const item = stateRecord("placement", 1, 1, {
    image: { id: "processed-image", pixels: basePixels, naturalWidth: 1, naturalHeight: 1 },
    filter: api.createDefaultFilterState(),
    finishLayers: [
      finishLayer("behind", {
        placement: "behind",
        image: { id: "behind-image", pixels: behindPixels, naturalWidth: 1, naturalHeight: 1 },
        naturalWidth: 1,
        naturalHeight: 1,
      }),
      finishLayer("front", {
        placement: "front",
        image: { id: "front-image", pixels: frontPixels, naturalWidth: 1, naturalHeight: 1 },
        naturalWidth: 1,
        naturalHeight: 1,
      }),
    ],
  });

  api.renderFilteredRecordToCanvas(item, "png", canvas);

  assert.deepEqual(Array.from(canvas.pixelData), [63, 128, 64, 255]);
  assert.notDeepEqual(Array.from(canvas.pixelData), [127, 128, 0, 255], "behind material must not be drawn over the base");
});

test("four time variants freeze one selected snapshot, exact names, order, pixels, and explicit links", async () => {
  const harness = createExportHarness();
  const { api, elements, body } = loadActionApi({
    createElement: harness.createElement,
    URL: harness.URL,
    setTimeout: harness.setTimeout,
    clearTimeout: harness.clearTimeout,
  });
  const item = stateRecord("forest", 1, 1, {
    fileName: "forest.scene.webp",
    image: { pixels: new Uint8ClampedArray([96, 96, 96, 173]) },
    filter: api.sanitizeFilterState({ timePreset: "night", strength: 1 }),
  });
  api.state.images = [item];
  api.state.selectedId = item.id;
  api.state.mode = "filter";
  elements.outputFormat.value = "png";
  elements.outputQuality.value = "90";
  api.updateActionAvailability();

  const workflow = api.exportFilterVariantsWorkflow();
  const duplicate = api.exportFilterVariantsWorkflow();
  await flushMicrotasks();
  assert.equal(harness.pendingEncodes.length, 1);
  assert.equal(api.state.exporting, true);
  item.filter = api.sanitizeFilterState({ timePreset: "morning", effectPreset: "poster", strength: 0 });
  elements.outputFormat.value = "webp";
  await duplicate;

  const expectedPixels = [
    [122, 113, 104, 173],
    [103, 103, 102, 173],
    [114, 86, 64, 173],
    [37, 58, 95, 173],
  ];
  for (let index = 0; index < 4; index += 1) {
    await flushMicrotasks(12);
    assert.equal(harness.pendingEncodes.length, index + 1);
    const pending = harness.pendingEncodes[index];
    assert.equal(pending.mime, "image/png");
    assert.deepEqual([pending.width, pending.height], [1, 1]);
    assert.deepEqual(Array.from(pending.data), expectedPixels[index]);
    harness.resolveEncode(index);
  }
  await workflow;
  await flushMicrotasks();
  assert.equal(api.state.exporting, false);
  assert.equal(harness.canvases.length, 4);
  assert.equal(harness.downloads.length, 0, "four generated files must wait for explicit link activation");

  const descendants = (node) => node.children.flatMap((child) => [child, ...descendants(child)]);
  const links = descendants(body).filter((node) => typeof node.download === "string");
  assert.deepEqual(links.map((link) => link.download), [
    "forest.scene_morning.png",
    "forest.scene_day.png",
    "forest.scene_evening.png",
    "forest.scene_night.png",
  ]);
  assert.equal(harness.objectUrls.length, 4);
  links[0].click();
  assert.deepEqual(harness.downloads, [{ href: links[0].href, download: "forest.scene_morning.png" }]);
  const close = descendants(body).find((node) => node.className.includes("download-dialog__close"));
  assert.ok(close);
  close.dispatchEvent({ type: "click" });
  assert.deepEqual(harness.revoked, harness.objectUrls.map(({ url }) => url));
});

test("filter export and batch actions stay gated throughout queued and pending image decodes", async () => {
  const harness = createLoadHarness();
  const { api, elements } = loadActionApi({ Image: harness.Image, URL: harness.URL });
  const first = stateRecord("first", 20, 10, { filter: api.createDefaultFilterState() });
  const second = stateRecord("second", 20, 10, { filter: api.createDefaultFilterState() });
  api.state.images = [first, second];
  api.state.selectedId = first.id;
  api.state.mode = "filter";
  api.updateActionAvailability();
  assert.equal(elements.exportBtn.disabled, false);
  assert.equal(elements.filterApplyAllBtn.disabled, false);
  assert.equal(elements.filterExportVariantsBtn.disabled, false);

  const loading = api.addFiles([imageFile("pending.png")]);
  for (const button of [elements.exportBtn, elements.filterApplyAllBtn, elements.filterExportVariantsBtn]) {
    assert.equal(button.disabled, true, `${button.id} must close during the queued phase`);
  }
  await flushMicrotasks();
  assert.equal(api.state.pendingLoads.size, 1);
  for (const button of [elements.exportBtn, elements.filterApplyAllBtn, elements.filterExportVariantsBtn]) {
    assert.equal(button.disabled, true, `${button.id} must stay closed during decode`);
  }

  harness.instances[0].succeed(30, 15);
  await loading;
  await flushMicrotasks();
  assert.equal(api.state.images.length, 3);
  assert.deepEqual(plain(api.state.images[2].filter), plain(api.createDefaultFilterState()));
  assert.notStrictEqual(api.state.images[2].filter, first.filter);
  assert.equal(elements.exportBtn.disabled, false);
  assert.equal(elements.filterApplyAllBtn.disabled, false);
  assert.equal(elements.filterExportVariantsBtn.disabled, false);
  api.clearAll();
});

test("filter export and both finish batch actions stay gated throughout finish material decoding", async () => {
  const harness = createLoadHarness();
  const { api, elements } = loadActionApi({ Image: harness.Image, URL: harness.URL });
  const first = stateRecord("first", 400, 200, { finishLayers: [] });
  const second = stateRecord("second", 800, 400, { finishLayers: [] });
  api.state.images = [first, second];
  api.state.selectedId = first.id;
  api.state.mode = "filter";
  api.updateActionAvailability();
  const gated = [
    elements.exportBtn,
    elements.filterApplyAllBtn,
    elements.filterExportVariantsBtn,
    elements.filterApplyFinishAllBtn,
    elements.filterApplyFilterFinishAllBtn,
  ];
  gated.forEach((button) => assert.equal(button.disabled, false, `${button.id} should start enabled`));

  const loading = api.addFinishFiles([imageFile("pending-frame.png")]);
  gated.forEach((button) => assert.equal(button.disabled, true, `${button.id} must close while queued`));
  assert.equal(elements.clearAllBtn.disabled, false);
  await flushMicrotasks();
  assert.equal(api.state.filter.pendingFinishLoads.size, 1);
  gated.forEach((button) => assert.equal(button.disabled, true, `${button.id} must stay closed during decode`));

  harness.instances[0].succeed(100, 50);
  await loading;
  await flushMicrotasks();
  assert.equal(first.finishLayers.length, 1);
  gated.forEach((button) => assert.equal(button.disabled, false, `${button.id} should reopen after decode`));
  api.clearAll();
});

test("canvas mode exposes its deterministic Node verification contract", () => {
  const api = loadPureApi();
  for (const helper of [
    "normalizeCanvasPoint",
    "createCanvasLayerState",
    "canvasPointFromClient",
    "canvasLayerLocalToOutput",
    "outputToCanvasLayerLocal",
    "getCanvasLayerCorners",
    "getCanvasLayerAabb",
    "hitTestCanvasLayers",
    "resizeCanvasLayerFromHandle",
    "calculateCanvasRotation",
    "normalizeCanvasRotation",
    "snapCanvasLayer",
    "calculateCanvasLayerFit",
    "reorderCanvasLayers",
    "getCanvasDrawLayers",
    "resolveCanvasBackground",
    "getCanvasGridLines",
    "drawCanvasScene",
    "snapshotCanvasState",
    "pushCanvasHistory",
    "undoCanvas",
    "constrainCanvasSize",
    "addCanvasFiles",
    "exportCanvasComposition",
  ]) {
    assert.equal(typeof api[helper], "function", `${helper} must be exposed`);
  }
  assert.equal(api.state.canvas.width, 1200);
  assert.equal(api.state.canvas.height, 800);
  assert.deepEqual(Array.from(api.state.canvas.layers), []);
  assert.equal(api.state.canvas.zoom, 1);
});

test("canvas size presets are exact and oversized custom canvases stay within export limits", () => {
  const { api, elements } = loadActionApi();
  const layer = canvasLayer("kept", { x: -25.5, y: 44.25, width: 333, height: 111 });
  api.state.canvas.layers = [layer];
  api.state.canvas.selectedId = layer.id;

  for (const [button, expected] of [
    [elements.canvasPreset800Btn, [800, 600]],
    [elements.canvasPreset1200Btn, [1200, 800]],
    [elements.canvasPreset1920Btn, [1920, 1080]],
    [elements.canvasPresetSquareBtn, [1080, 1080]],
    [elements.canvasPresetPortraitBtn, [1080, 1920]],
  ]) {
    button.dispatchEvent({ type: "click" });
    assert.deepEqual([api.state.canvas.width, api.state.canvas.height], expected);
    assert.deepEqual(
      plain({ x: layer.x, y: layer.y, width: layer.width, height: layer.height }),
      { x: -25.5, y: 44.25, width: 333, height: 111 },
      "changing canvas size must not destructively rescale layers",
    );
  }

  api.setCanvasSize(32767, 32767);
  assert.ok(api.state.canvas.width <= 32767 && api.state.canvas.height <= 32767);
  assert.ok(api.state.canvas.width * api.state.canvas.height <= 120_000_000);
  assert.doesNotThrow(() => api.assertExportSize(api.state.canvas.width, api.state.canvas.height));
});

test("one addFiles call commits records in FileList order despite out-of-order decoding", async () => {
  const harness = createLoadHarness();
  const { api } = loadActionApi({ Image: harness.Image, URL: harness.URL });
  const added = api.addFiles([
    imageFile("first.png"),
    imageFile("second.jpg", "image/jpeg"),
  ]);

  await flushMicrotasks();
  assert.equal(harness.instances.length, 2);
  harness.instances[1].succeed(20, 10);
  await flushMicrotasks();
  assert.deepEqual(Array.from(api.state.images), [], "a later decode must not commit ahead of the first file");

  harness.instances[0].succeed(10, 10);
  await added;
  assert.deepEqual(Array.from(api.state.images, (item) => item.fileName), ["first.png", "second.jpg"]);
  assert.deepEqual(Array.from(api.state.images, (item) => [item.originalWidth, item.originalHeight]), [
    [10, 10],
    [20, 10],
  ]);
});

test("separate addFiles calls are serialized in invocation order", async () => {
  const harness = createLoadHarness();
  const { api } = loadActionApi({ Image: harness.Image, URL: harness.URL });
  const first = api.addFiles([imageFile("first.png")]);
  const second = api.addFiles([imageFile("second.webp", "image/webp")]);

  await flushMicrotasks();
  assert.equal(harness.instances.length, 1, "the second call must wait for the first call to finish");
  harness.instances[0].succeed(12, 8);
  await first;
  await flushMicrotasks();
  assert.equal(harness.instances.length, 2);
  assert.deepEqual(Array.from(api.state.images, (item) => item.fileName), ["first.png"]);

  harness.instances[1].succeed(9, 7);
  await second;
  assert.deepEqual(Array.from(api.state.images, (item) => item.fileName), ["first.png", "second.webp"]);
});

test("clearAll cancels active and queued loads without allowing stale callbacks to resurrect them", async () => {
  const harness = createLoadHarness();
  const { api } = loadActionApi({ Image: harness.Image, URL: harness.URL });
  const first = api.addFiles([imageFile("active.png")]);
  const second = api.addFiles([imageFile("queued.png")]);

  await flushMicrotasks();
  assert.equal(harness.instances.length, 1);
  assert.equal(api.state.pendingLoads.size, 1);
  const staleOnload = harness.instances[0].onload;
  const activeUrl = harness.created[0].url;

  api.clearAll();
  staleOnload?.();
  harness.instances[0].succeed(640, 480);
  await Promise.all([first, second]);
  await flushMicrotasks();

  assert.deepEqual(Array.from(api.state.images), []);
  assert.equal(api.state.selectedId, null);
  assert.equal(api.state.pendingLoads.size, 0);
  assert.equal(harness.created.length, 1, "a queued load from the old generation must never start");
  assert.equal(harness.revoked.filter((url) => url === activeUrl).length, 1);

  const fresh = api.addFiles([imageFile("fresh.png")]);
  await flushMicrotasks();
  assert.equal(harness.instances.length, 2, "new-generation loads must still work after clearAll");
  harness.instances[1].succeed(32, 24);
  await fresh;
  assert.deepEqual(Array.from(api.state.images, (item) => item.fileName), ["fresh.png"]);
});

test("clear-all stays enabled while the first image load is queued or pending", async () => {
  const harness = createLoadHarness();
  const { api, elements } = loadActionApi({ Image: harness.Image, URL: harness.URL });
  assert.equal(elements.clearAllBtn.disabled, true);

  const loading = api.addFiles([imageFile("pending.png")]);
  assert.equal(api.state.queuedLoadCount, 1);
  assert.equal(elements.clearAllBtn.disabled, false, "the queued first load must be cancellable immediately");

  await flushMicrotasks();
  assert.equal(api.state.pendingLoads.size, 1);
  assert.equal(elements.clearAllBtn.disabled, false, "an active decode must keep clear-all enabled");
  elements.clearAllBtn.dispatchEvent({ type: "click" });
  await loading;
  await flushMicrotasks();

  assert.equal(api.state.queuedLoadCount, 0);
  assert.equal(api.state.pendingLoads.size, 0);
  assert.deepEqual(Array.from(api.state.images), []);
  assert.equal(elements.clearAllBtn.disabled, true);
  assert.equal(harness.revoked.length, 1);
});

test("canvas multi-add preserves decode order, drop placement, front order, and independent state", async () => {
  const harness = createLoadHarness();
  const { api } = loadActionApi({ Image: harness.Image, URL: harness.URL });
  const adding = api.addCanvasFiles([
    imageFile("back.png"),
    imageFile("front.webp", "image/webp"),
  ], { x: 400, y: 300 });

  await flushMicrotasks();
  assert.equal(harness.instances.length, 2);
  harness.instances[1].succeed(100, 200);
  await flushMicrotasks();
  assert.deepEqual(Array.from(api.state.canvas.layers), []);
  harness.instances[0].succeed(200, 100);
  await adding;

  assert.deepEqual(Array.from(api.state.canvas.layers, (layer) => layer.name), ["back.png", "front.webp"]);
  assert.deepEqual(Array.from(api.state.canvas.layers, (layer) => layer.zIndex), [0, 1]);
  assert.deepEqual(plain({
    x: api.state.canvas.layers[0].x,
    y: api.state.canvas.layers[0].y,
    width: api.state.canvas.layers[0].width,
    height: api.state.canvas.layers[0].height,
  }), { x: 300, y: 250, width: 200, height: 100 });
  assert.deepEqual(plain({
    x: api.state.canvas.layers[1].x,
    y: api.state.canvas.layers[1].y,
    width: api.state.canvas.layers[1].width,
    height: api.state.canvas.layers[1].height,
  }), { x: 374, y: 224, width: 100, height: 200 });
  assert.equal(api.state.canvas.selectedId, api.state.canvas.layers[1].id);
  assert.equal(api.state.canvas.history.length, 1);

  api.state.canvas.layers[0].x = -10;
  assert.equal(api.state.canvas.layers[1].x, 374);
  api.clearCanvasComposition();
  assert.equal(harness.revoked.length, 0, "clear can be undone");
  api.state.canvas.history = [];
  api.state.canvas.redo = [];
  api.sweepCanvasSourceUrls();
  assert.deepEqual(harness.revoked.sort(), harness.created.map(({ url }) => url).sort());
});

test("canvas background import uses only one file and creates a locked cover layer at the back", async () => {
  const harness = createLoadHarness();
  const { api } = loadActionApi({ Image: harness.Image, URL: harness.URL });
  api.state.canvas.layers = [canvasLayer("foreground", { zIndex: 0 })];
  const adding = api.addCanvasFiles([
    imageFile("background.jpg", "image/jpeg"),
    imageFile("ignored.png"),
  ], { x: 10, y: 10 }, { asBackground: true });

  await flushMicrotasks();
  assert.equal(harness.instances.length, 1);
  harness.instances[0].succeed(400, 200);
  await adding;

  assert.equal(api.state.canvas.layers.length, 2);
  const background = api.state.canvas.layers[0];
  assert.equal(background.name, "背景：background.jpg");
  assert.equal(background.isBackground, true);
  assert.equal(background.locked, true);
  assert.deepEqual(plain({ x: background.x, y: background.y, width: background.width, height: background.height }), {
    x: -200,
    y: 0,
    width: 1600,
    height: 800,
  });
  assert.equal(api.state.canvas.backgroundMode, "image");
  assert.deepEqual(Array.from(api.state.canvas.layers, (layer) => layer.zIndex), [0, 1]);
});

test("canvas coordinate conversion, rotated corners, AABB, and hit-testing share one geometry model", () => {
  const api = loadPureApi();
  assert.deepEqual(plain(api.canvasPointFromClient(
    400,
    250,
    { left: 100, top: 50, width: 600, height: 400 },
    1200,
    800,
  )), { x: 600, y: 400 });

  const rotated = canvasLayer("rotated", { x: 100, y: 50, width: 200, height: 100, rotation: 90 });
  const expectedCorners = [
    { x: 250, y: 0 },
    { x: 250, y: 200 },
    { x: 150, y: 200 },
    { x: 150, y: 0 },
  ];
  api.getCanvasLayerCorners(rotated).forEach((point, index) => assertPointClose(point, expectedCorners[index]));
  const aabb = api.getCanvasLayerAabb(rotated);
  assertPointClose({ x: aabb.left, y: aabb.top }, { x: 150, y: 0 });
  assertPointClose({ x: aabb.width, y: aabb.height }, { x: 100, y: 200 });

  const local = { x: -37.25, y: 11.5 };
  const output = api.canvasLayerLocalToOutput(rotated, local.x, local.y);
  assertPointClose(api.outputToCanvasLayerLocal(rotated, output), local);

  const back = canvasLayer("back", { x: 100, y: 50, width: 200, height: 100, zIndex: 0 });
  const lockedFront = canvasLayer("locked", { x: 100, y: 50, width: 200, height: 100, locked: true, zIndex: 1 });
  const hiddenTop = canvasLayer("hidden", { x: 100, y: 50, width: 200, height: 100, visible: false, zIndex: 2 });
  assert.equal(api.hitTestCanvasLayers([back, lockedFront, hiddenTop], { x: 200, y: 100 }).id, "back");
  assert.equal(api.hitTestCanvasLayers(
    [back, lockedFront, hiddenTop],
    { x: 200, y: 100 },
    { includeLocked: true },
  ).id, "locked");
  assert.equal(api.hitTestCanvasLayers([back], { x: 301, y: 100 }), null);
});

test("a locked front layer remains selectable from the canvas without moving the layer behind it", () => {
  const { api, elements } = loadActionApi();
  const back = canvasLayer("back", { x: 0, y: 0, width: 100, height: 100, zIndex: 0 });
  const lockedFront = canvasLayer("locked-front", {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    locked: true,
    zIndex: 1,
  });
  api.state.mode = "canvas";
  api.state.canvas.width = 100;
  api.state.canvas.height = 100;
  api.state.canvas.layers = [back, lockedFront];
  api.state.canvas.selectedId = null;

  api.beginCanvasPointerGesture({
    button: 0,
    clientX: 50,
    clientY: 20,
    pointerId: 7,
    currentTarget: elements.canvasDisplayCanvas,
    preventDefault() {},
  });

  assert.equal(api.state.canvas.selectedId, lockedFront.id);
  assert.equal(api.state.canvas.gesture, null, "a locked layer must not start a move gesture");
  assert.deepEqual(compactCanvasLayer(api.state.canvas.layers[0]), compactCanvasLayer(back));
});

test("canvas move, resize, and rotation gestures commit one reversible history entry", () => {
  const { api, elements } = loadActionApi();
  const context = createRecordingCanvasContext();
  elements.canvasDisplayCanvas.getContext = () => context;
  api.state.mode = "canvas";
  api.state.canvas.width = 100;
  api.state.canvas.height = 100;
  api.state.canvas.snap = false;
  api.state.canvas.layers = [canvasLayer("gesture", {
    x: 10,
    y: 10,
    width: 20,
    height: 20,
    naturalWidth: 20,
    naturalHeight: 20,
  })];

  const pointer = (clientX, clientY, overrides = {}) => ({
    button: 0,
    pointerId: 17,
    clientX,
    clientY,
    currentTarget: elements.canvasDisplayCanvas,
    target: { closest: () => null },
    preventDefault() {},
    stopPropagation() {},
    shiftKey: false,
    ...overrides,
  });

  api.beginCanvasPointerGesture(pointer(20, 8)); // output point 20,20
  assert.equal(api.state.canvas.gesture.type, "move");
  api.moveCanvasPointerGesture(pointer(30, 12)); // output point 30,30
  assert.deepEqual(plain({ x: api.state.canvas.layers[0].x, y: api.state.canvas.layers[0].y }), { x: 20, y: 20 });
  api.endCanvasPointerGesture(pointer(30, 12));
  assert.equal(api.state.canvas.history.length, 1);
  api.undoCanvas();
  assert.deepEqual(plain({ x: api.state.canvas.layers[0].x, y: api.state.canvas.layers[0].y }), { x: 10, y: 10 });

  const resizeTarget = { closest: () => ({ dataset: { canvasHandle: "se" } }) };
  api.beginCanvasSelectionGesture(pointer(30, 12, {
    currentTarget: elements.canvasSelectionBox,
    target: resizeTarget,
  }));
  api.moveCanvasPointerGesture(pointer(50, 16)); // output point 50,40
  assert.deepEqual(
    plain({ x: api.state.canvas.layers[0].x, y: api.state.canvas.layers[0].y, width: api.state.canvas.layers[0].width, height: api.state.canvas.layers[0].height }),
    { x: 10, y: 10, width: 40, height: 40 },
  );
  api.endCanvasPointerGesture(pointer(50, 16));
  api.undoCanvas();
  assert.deepEqual(plain({ width: api.state.canvas.layers[0].width, height: api.state.canvas.layers[0].height }), { width: 20, height: 20 });

  const rotateTarget = { closest: () => ({ dataset: { canvasHandle: "rotate" } }) };
  api.beginCanvasSelectionGesture(pointer(30, 8, {
    currentTarget: elements.canvasSelectionBox,
    target: rotateTarget,
  }));
  api.moveCanvasPointerGesture(pointer(20, 12));
  assert.ok(Math.abs(api.state.canvas.layers[0].rotation - 90) < 1e-9);
  api.endCanvasPointerGesture(pointer(20, 12));
  api.undoCanvas();
  assert.equal(api.state.canvas.layers[0].rotation, 0);
});

test("a pointercancel event restores an active canvas gesture without committing history", () => {
  const { api, elements } = loadActionApi();
  elements.canvasDisplayCanvas.getContext = () => createRecordingCanvasContext();
  const layer = canvasLayer("cancelled", { x: 10.25, y: 20.5, width: 20, height: 20 });
  api.state.mode = "canvas";
  api.state.canvas.width = 100;
  api.state.canvas.height = 100;
  api.state.canvas.snap = false;
  api.state.canvas.layers = [layer];

  const event = (clientX, clientY) => ({
    button: 0,
    pointerId: 3,
    clientX,
    clientY,
    currentTarget: elements.canvasDisplayCanvas,
    preventDefault() {},
  });
  api.beginCanvasPointerGesture(event(20, 10));
  api.moveCanvasPointerGesture(event(40, 18));
  assert.notEqual(api.state.canvas.layers[0].x, 10.25);
  elements.canvasDisplayCanvas.dispatchEvent({ type: "pointercancel", pointerId: 3 });

  assert.equal(api.state.canvas.gesture, null);
  assert.deepEqual(compactCanvasLayer(api.state.canvas.layers[0]), compactCanvasLayer(layer));
  assert.equal(api.state.canvas.history.length, 0);
});

test("active canvas gestures roll back for Ctrl/Cmd+Z or Escape without consuming prior history", () => {
  const { api, elements } = loadActionApi();
  elements.canvasDisplayCanvas.getContext = () => createRecordingCanvasContext();
  const layer = canvasLayer("shortcut", { x: 10, y: 10, width: 20, height: 20 });
  api.state.mode = "canvas";
  api.state.canvas.width = 100;
  api.state.canvas.height = 100;
  api.state.canvas.snap = false;
  api.state.canvas.layers = [layer];
  api.state.canvas.selectedId = layer.id;
  api.mutateSelectedCanvasLayer((selected) => {
    selected.x = 20;
  });
  assert.equal(api.state.canvas.history.length, 1, "the pre-existing action is the history entry that must survive");

  const pointer = (clientX, clientY) => ({
    button: 0,
    pointerId: 31,
    clientX,
    clientY,
    currentTarget: elements.canvasDisplayCanvas,
    preventDefault() {},
  });
  const cancelWith = (key, modifiers = {}) => {
    api.beginCanvasPointerGesture(pointer(30, 8));
    api.moveCanvasPointerGesture(pointer(40, 12));
    assert.equal(api.state.canvas.layers[0].x, 30);
    let prevented = false;
    api.handleCanvasKeyboard({
      key,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      target: null,
      preventDefault() { prevented = true; },
      ...modifiers,
    });
    assert.equal(prevented, true);
    assert.equal(api.state.canvas.gesture, null);
    assert.equal(api.state.canvas.layers[0].x, 20);
    assert.equal(api.state.canvas.history.length, 1);
    assert.equal(api.state.canvas.redo.length, 0);
  };

  cancelWith("z", { ctrlKey: true });
  cancelWith("z", { metaKey: true });
  cancelWith("Escape");
  cancelWith("z", { ctrlKey: true, target: elements.canvasLayerX });
});

test("all four canvas resize handles keep the opposite corner fixed and honor aspect locking", () => {
  const api = loadPureApi();
  const start = canvasLayer("subject", { x: 100, y: 100, width: 200, height: 100, keepAspect: true });
  const cases = [
    ["se", { x: 400, y: 250 }, { x: 100, y: 100, width: 300, height: 150 }],
    ["nw", { x: 0, y: 50 }, { x: 0, y: 50, width: 300, height: 150 }],
    ["ne", { x: 400, y: 50 }, { x: 100, y: 50, width: 300, height: 150 }],
    ["sw", { x: 0, y: 250 }, { x: 0, y: 100, width: 300, height: 150 }],
  ];
  for (const [handle, point, expected] of cases) {
    const resized = api.resizeCanvasLayerFromHandle(start, handle, point);
    assert.deepEqual(plain({ x: resized.x, y: resized.y, width: resized.width, height: resized.height }), expected);
    assert.equal(resized.width / resized.height, 2);
  }

  const free = api.resizeCanvasLayerFromHandle({ ...start, keepAspect: false }, "se", { x: 350, y: 300 });
  assert.deepEqual(plain({ x: free.x, y: free.y, width: free.width, height: free.height }), {
    x: 100,
    y: 100,
    width: 250,
    height: 200,
  });

  const rotated = { ...start, rotation: 37 };
  const oppositeBefore = api.getCanvasLayerCorners(rotated)[0];
  const resizedRotated = api.resizeCanvasLayerFromHandle(rotated, "se", { x: 430, y: 310 });
  const oppositeAfter = api.getCanvasLayerCorners(resizedRotated)[0];
  assertPointClose(oppositeAfter, oppositeBefore, 1e-8);
  assert.ok(Math.abs(resizedRotated.width / resizedRotated.height - 2) < 1e-12);
});

test("canvas rotation, snap targets, and grid lines have exact output-space behavior", () => {
  const api = loadPureApi();
  const rotating = canvasLayer("rotating", { x: 100, y: 50, width: 200, height: 100, rotation: 30 });
  assert.ok(Math.abs(api.calculateCanvasRotation(
    rotating,
    { x: 200, y: 0 },
    { x: 300, y: 100 },
  ) - 120) < 1e-12);
  assert.equal(api.calculateCanvasRotation(
    { ...rotating, rotation: 7 },
    { x: 200, y: 0 },
    { x: 300, y: 100 },
    true,
  ), 90);
  assert.equal(api.normalizeCanvasRotation(-450), 270);

  const canvas = { width: 1000, height: 800, snap: true };
  const centered = api.snapCanvasLayer(canvasLayer("snap", {
    x: 453,
    y: 372,
    width: 100,
    height: 50,
  }), canvas, 8);
  assert.deepEqual(plain({ x: centered.layer.x, y: centered.layer.y }), { x: 450, y: 375 });
  assert.deepEqual(plain({ guideX: centered.guideX, guideY: centered.guideY }), { guideX: 500, guideY: 400 });

  const right = api.snapCanvasLayer(canvasLayer("right", { x: 894, y: 100, width: 100, height: 50 }), canvas, 8);
  assert.equal(right.layer.x, 900);
  assert.equal(right.guideX, 1000);
  const bottom = api.snapCanvasLayer(canvasLayer("bottom", { x: 100, y: 744, width: 100, height: 50 }), canvas, 8);
  assert.equal(bottom.layer.y, 750);
  assert.equal(bottom.guideY, 800);
  const disabled = api.snapCanvasLayer(canvasLayer("free", { x: 453, y: 372, width: 100, height: 50 }), {
    ...canvas,
    snap: false,
  }, 8);
  assert.deepEqual(plain({ x: disabled.layer.x, y: disabled.layer.y, guideX: disabled.guideX, guideY: disabled.guideY }), {
    x: 453,
    y: 372,
    guideX: null,
    guideY: null,
  });
  assert.deepEqual(plain(api.getCanvasGridLines(100, 80, 20)), {
    x: [20, 40, 60, 80],
    y: [20, 40, 60],
  });
});

test("canvas fit and layer reordering follow back-to-front storage semantics", () => {
  const api = loadPureApi();
  const layer = canvasLayer("subject", { naturalWidth: 400, naturalHeight: 200 });
  const canvas = { width: 1200, height: 800 };
  assert.deepEqual(plain(api.calculateCanvasLayerFit(layer, canvas, "width")), {
    x: 0,
    y: 100,
    width: 1200,
    height: 600,
  });
  assert.deepEqual(plain(api.calculateCanvasLayerFit(layer, canvas, "height")), {
    x: -200,
    y: 0,
    width: 1600,
    height: 800,
  });
  assert.deepEqual(plain(api.calculateCanvasLayerFit(layer, canvas, "contain")), {
    x: 0,
    y: 100,
    width: 1200,
    height: 600,
  });
  assert.deepEqual(plain(api.calculateCanvasLayerFit(layer, canvas, "cover")), {
    x: -200,
    y: 0,
    width: 1600,
    height: 800,
  });

  const layers = ["background", "frame", "flower", "logo"].map((id, zIndex) => canvasLayer(id, { zIndex }));
  const reordered = api.reorderCanvasLayers(layers, "flower", "logo", false);
  assert.deepEqual(Array.from(reordered, (item) => item.id), ["background", "frame", "logo", "flower"]);
  assert.deepEqual(Array.from(layers, (item) => item.id), ["background", "frame", "flower", "logo"], "pure reorder must not mutate input");
});

test("canvas layer actions keep lock boundaries, exact properties, and undo history", () => {
  const { api, elements } = loadActionApi();
  const layer = canvasLayer("subject", { x: 10.25, y: 20.5, width: 400, height: 200 });
  api.state.canvas.layers = [layer];
  api.state.canvas.selectedId = layer.id;
  api.state.canvas.history = [];
  api.state.canvas.redo = [];

  elements.canvasLayerName.value = "  右上の花  ";
  api.updateCanvasLayerFromControl("name");
  assert.equal(layer.name, "右上の花");
  elements.canvasLayerName.value = "   ";
  api.updateCanvasLayerFromControl("name");
  assert.equal(layer.name, "右上の花");

  elements.canvasLayerX.value = "350.75";
  api.updateCanvasLayerFromControl("x");
  assert.equal(layer.x, 350.75);
  api.undoCanvas();
  assert.equal(api.state.canvas.layers[0].x, 10.25);
  api.redoCanvas();
  assert.equal(api.state.canvas.layers[0].x, 350.75);

  api.state.canvas.selectedId = layer.id;
  const current = api.state.canvas.layers[0];
  elements.canvasLayerOpacity.dispatchEvent({ type: "pointerdown" });
  elements.canvasLayerOpacity.value = "37";
  elements.canvasLayerOpacity.dispatchEvent({ type: "input" });
  elements.canvasLayerOpacity.dispatchEvent({ type: "change" });
  assert.equal(current.opacity, 0.37);
  assert.equal(elements.canvasOpacityValue.textContent, "37%");

  api.toggleCanvasLayerLock();
  const lockedBefore = compactCanvasLayer(current);
  api.rotateCanvasLayer(90);
  api.alignCanvasLayer("center");
  api.fitSelectedCanvasLayer("width");
  api.flipCanvasLayer("flipX");
  assert.deepEqual(compactCanvasLayer(current), lockedBefore, "locked geometry and flip actions must be rejected");
  api.toggleCanvasLayerVisibility();
  assert.equal(current.visible, false, "visibility remains available for a locked layer");
  api.toggleCanvasLayerLock();
  assert.equal(current.locked, false);
});

test("keyboard changes to canvas opacity create one reversible history entry", () => {
  const { api, elements } = loadActionApi();
  const layer = canvasLayer("subject", { opacity: 1 });
  api.state.canvas.layers = [layer];
  api.state.canvas.selectedId = layer.id;
  api.state.canvas.history = [];

  elements.canvasLayerOpacity.dispatchEvent({ type: "focus" });
  elements.canvasLayerOpacity.value = "25";
  elements.canvasLayerOpacity.dispatchEvent({ type: "input" });
  elements.canvasLayerOpacity.dispatchEvent({ type: "change" });

  assert.equal(api.state.canvas.layers[0].opacity, 0.25);
  assert.equal(api.state.canvas.history.length, 1);
  api.undoCanvas();
  assert.equal(api.state.canvas.layers[0].opacity, 1);
});

test("canvas color history starts from each keyboard focus rather than a stale earlier focus", () => {
  const { api, elements } = loadActionApi();
  const layer = canvasLayer("subject", { x: 0 });
  api.state.canvas.layers = [layer];
  api.state.canvas.selectedId = layer.id;
  const initialColor = api.state.canvas.backgroundColor;

  elements.canvasBackgroundColor.dispatchEvent({ type: "focus" });
  elements.canvasBackgroundColor.dispatchEvent({ type: "blur" });
  api.state.canvas.layers[0].x = 50;
  api.state.canvas.history = [];
  api.state.canvas.redo = [];

  elements.canvasBackgroundColor.dispatchEvent({ type: "focus" });
  elements.canvasBackgroundColor.value = "#123456";
  elements.canvasBackgroundColor.dispatchEvent({ type: "input" });
  elements.canvasBackgroundColor.dispatchEvent({ type: "change" });
  assert.equal(api.state.canvas.history.length, 1);
  api.undoCanvas();

  assert.equal(api.state.canvas.layers[0].x, 50, "Undoing color must not rewind unrelated work since a prior focus");
  assert.equal(api.state.canvas.backgroundColor, initialColor);
});

test("canvas depth buttons, duplicate, delete, and Undo preserve back-to-front state and shared sources", () => {
  const harness = createLoadHarness();
  const { api } = loadActionApi({ URL: harness.URL });
  const layers = ["background", "frame", "flower", "logo"].map((id, zIndex) => canvasLayer(id, { zIndex }));
  api.state.canvas.layers = layers;
  api.state.canvas.selectedId = "frame";

  api.moveCanvasLayerOrder("front");
  assert.deepEqual(Array.from(api.state.canvas.layers, (item) => item.id), ["background", "flower", "logo", "frame"]);
  assert.deepEqual(Array.from(api.state.canvas.layers, (item) => item.zIndex), [0, 1, 2, 3]);
  api.undoCanvas();
  assert.deepEqual(Array.from(api.state.canvas.layers, (item) => item.id), ["background", "frame", "flower", "logo"]);

  api.state.canvas.selectedId = "frame";
  api.moveCanvasLayerOrder("forward");
  assert.deepEqual(Array.from(api.state.canvas.layers, (item) => item.id), ["background", "flower", "frame", "logo"]);
  api.undoCanvas();

  api.state.canvas.selectedId = "flower";
  const source = api.getSelectedCanvasLayer();
  api.state.canvas.sourceUrls.add(source.objectUrl);
  api.duplicateCanvasLayer(20);
  const duplicate = api.getSelectedCanvasLayer();
  assert.notEqual(duplicate.id, source.id);
  assert.equal(duplicate.objectUrl, source.objectUrl);
  assert.equal(duplicate.image, source.image);
  assert.equal(duplicate.x, source.x + 20);
  assert.equal(duplicate.y, source.y + 20);
  assert.equal(duplicate.locked, false);
  assert.equal(api.state.canvas.layers.indexOf(duplicate), api.state.canvas.layers.indexOf(source) + 1);

  duplicate.x = 999;
  assert.notEqual(source.x, duplicate.x);
  api.deleteSelectedCanvasLayer();
  assert.equal(harness.revoked.length, 0, "deleting a duplicate must not revoke its shared source");
  api.undoCanvas();
  assert.ok(api.state.canvas.layers.some((item) => item.id === duplicate.id));
  assert.equal(harness.revoked.length, 0, "Undo must retain a renderable source URL");

  api.clearCanvasComposition();
  assert.deepEqual(harness.revoked, []);
  api.undoCanvas();
  assert.ok(api.state.canvas.layers.length > 0, "all cleared layers can be restored");
});

test("the imported background remains the reserved back layer during foreground depth changes", () => {
  const { api } = loadActionApi();
  const background = canvasLayer("background", {
    isBackground: true,
    locked: true,
    x: 0,
    y: 0,
    width: 1200,
    height: 800,
    zIndex: 0,
  });
  const foreground = canvasLayer("foreground", { zIndex: 1 });
  api.state.canvas.backgroundMode = "image";
  api.state.canvas.layers = [background, foreground];
  api.state.canvas.selectedId = foreground.id;

  api.moveCanvasLayerOrder("back");
  assert.deepEqual(Array.from(api.state.canvas.layers, (layer) => layer.id), ["background", "foreground"]);
  assert.deepEqual(Array.from(api.getCanvasDrawLayers(), (layer) => layer.id), ["background", "foreground"]);

  assert.deepEqual(
    Array.from(api.reorderCanvasLayers([background, foreground], foreground.id, background.id, true), (layer) => layer.id),
    ["background", "foreground"],
    "dragging a foreground row below the reserved background must be clamped",
  );
  assert.deepEqual(
    Array.from(api.reorderCanvasLayers([background, foreground], background.id, foreground.id, false), (layer) => layer.id),
    ["background", "foreground"],
    "the reserved background itself must not be dragged above foreground layers",
  );
});

test("deleting a background-image layer does not erase a separately selected solid background", () => {
  for (const backgroundMode of ["white", "black", "custom"]) {
    const { api } = loadActionApi();
    const background = canvasLayer(`background-${backgroundMode}`, { isBackground: true, locked: true });
    api.state.canvas.backgroundMode = backgroundMode;
    api.state.canvas.backgroundColor = "#123456";
    api.state.canvas.layers = [background];
    api.state.canvas.selectedId = background.id;

    api.deleteSelectedCanvasLayer();
    assert.equal(api.state.canvas.backgroundMode, backgroundMode);
    const expected = backgroundMode === "white" ? "#ffffff" : backgroundMode === "black" ? "#000000" : "#123456";
    assert.equal(api.resolveCanvasBackground(api.state.canvas, "png"), expected);
  }
});

test("canvas centering and fit actions are exact and reversible", () => {
  const { api } = loadActionApi();
  const layer = canvasLayer("subject", { x: 17, y: 29, width: 400, height: 200, naturalWidth: 400, naturalHeight: 200 });
  api.state.canvas.width = 1200;
  api.state.canvas.height = 800;
  api.state.canvas.layers = [layer];
  api.state.canvas.selectedId = layer.id;

  api.alignCanvasLayer("horizontal");
  assert.deepEqual(plain({ x: layer.x, y: layer.y }), { x: 400, y: 29 });
  api.alignCanvasLayer("vertical");
  assert.deepEqual(plain({ x: layer.x, y: layer.y }), { x: 400, y: 300 });
  api.undoCanvas();
  assert.deepEqual(plain({ x: api.state.canvas.layers[0].x, y: api.state.canvas.layers[0].y }), { x: 400, y: 29 });

  const restored = api.state.canvas.layers[0];
  api.state.canvas.selectedId = restored.id;
  api.fitSelectedCanvasLayer("height");
  assert.deepEqual(plain({ x: restored.x, y: restored.y, width: restored.width, height: restored.height }), {
    x: -200,
    y: 0,
    width: 1600,
    height: 800,
  });
});

test("canvas snapshots deep-copy mutable layer state and coalesce unchanged history", () => {
  const { api } = loadActionApi();
  const layer = canvasLayer("subject", { x: 10 });
  api.state.canvas.layers = [layer];
  api.state.canvas.selectedId = layer.id;
  const snapshot = api.snapshotCanvasState();

  layer.x = 99;
  layer.name = "changed";
  assert.equal(snapshot.layers[0].x, 10);
  assert.equal(snapshot.layers[0].name, "subject.png");
  assert.equal(snapshot.layers[0].image, layer.image, "Image references should remain reusable across Undo");
  assert.equal(api.pushCanvasHistory(api.snapshotCanvasState()), false, "an unchanged snapshot must not create history");
  assert.equal(api.pushCanvasHistory(snapshot), true);
  assert.equal(api.state.canvas.history.length, 1);
  api.undoCanvas();
  assert.equal(api.state.canvas.layers[0].x, 10);
  assert.equal(api.state.canvas.layers[0].name, "subject.png");
});

test("canvas scene drawing uses the exact background, visibility, transforms, opacity, and back-to-front order", () => {
  const api = loadPureApi();
  const back = canvasLayer("back", { locked: true, opacity: 1, rotation: 0 });
  const hidden = canvasLayer("hidden", { visible: false });
  const transparent = canvasLayer("transparent", { opacity: 0 });
  const front = canvasLayer("front", {
    x: 25,
    y: 35,
    width: 80,
    height: 40,
    rotation: 90,
    opacity: 0.37,
    flipX: true,
  });
  const scene = {
    width: 300,
    height: 200,
    backgroundMode: "custom",
    backgroundColor: "#123456",
    layers: [back, hidden, transparent, front],
  };

  assert.deepEqual(Array.from(api.getCanvasDrawLayers(scene.layers), (layer) => layer.id), ["back", "front"]);
  const context = createRecordingCanvasContext();
  api.drawCanvasScene(context, scene, { format: "png" });

  assert.deepEqual(
    context.calls.filter(([name]) => name === "drawImage").map((call) => call[1].id),
    ["back-image", "front-image"],
    "the canonical layer array must paint from back to front",
  );
  assert.deepEqual(context.calls.find(([name]) => name === "clearRect"), ["clearRect", 0, 0, 300, 200]);
  assert.ok(context.calls.some((call) => call[0] === "fillStyle" && call[1] === "#123456"));
  assert.ok(context.calls.some((call) => call[0] === "fillRect" && call.slice(1).join(",") === "0,0,300,200"));
  assert.ok(context.calls.some((call) => call[0] === "globalAlpha" && call[1] === 0.37));
  assert.ok(context.calls.some((call) => call[0] === "translate" && call[1] === 65 && call[2] === 55));
  assert.ok(context.calls.some((call) => call[0] === "rotate" && Math.abs(call[1] - Math.PI / 2) < 1e-12));
  assert.ok(context.calls.some((call) => call[0] === "scale" && call[1] === -1 && call[2] === 1));
  assert.equal(context.imageSmoothingEnabled, true);
  assert.equal(context.imageSmoothingQuality, "high");

  assert.equal(api.resolveCanvasBackground({ backgroundMode: "transparent" }, "png"), null);
  assert.equal(api.resolveCanvasBackground({ backgroundMode: "transparent" }, "webp"), null);
  assert.equal(api.resolveCanvasBackground({ backgroundMode: "transparent" }, "jpeg"), "#ffffff");
  assert.equal(api.resolveCanvasBackground({ backgroundMode: "white" }, "png"), "#ffffff");
  assert.equal(api.resolveCanvasBackground({ backgroundMode: "black" }, "png"), "#000000");
});

test("canvas export snapshots one exact-size composition per PNG, JPEG, or WebP request and locks duplicates", async () => {
  const harness = createExportHarness();
  const { api, elements } = loadActionApi({
    createElement: harness.createElement,
    URL: harness.URL,
    setTimeout: harness.setTimeout,
    clearTimeout: harness.clearTimeout,
  });
  api.state.mode = "canvas";
  api.state.canvas.width = 321;
  api.state.canvas.height = 123;
  api.state.canvas.layers = [canvasLayer("exported")];
  api.state.canvas.selectedId = "exported";

  const cases = [
    ["png", "image/png", /\.png$/],
    ["jpeg", "image/jpeg", /\.jpg$/],
    ["webp", "image/webp", /\.webp$/],
  ];
  for (const [format, mime, extension] of cases) {
    elements.outputFormat.value = format;
    api.updateActionAvailability();
    assert.equal(elements.exportBtn.disabled, false);

    const canvasCount = harness.canvases.length;
    const encodeCount = harness.pendingEncodes.length;
    const exporting = api.exportCurrentMode();
    const duplicate = api.exportCurrentMode();
    await flushMicrotasks();

    assert.equal(harness.canvases.length, canvasCount + 1, "a duplicate request must not allocate a canvas");
    assert.equal(harness.pendingEncodes.length, encodeCount + 1);
    assert.deepEqual(
      [harness.pendingEncodes[encodeCount].canvas.width, harness.pendingEncodes[encodeCount].canvas.height],
      [321, 123],
    );
    assert.equal(harness.pendingEncodes[encodeCount].mime, mime);
    assert.equal(api.state.exporting, true);

    await duplicate;
    harness.resolveEncode(encodeCount);
    await exporting;
    await flushMicrotasks();
    assert.equal(api.state.exporting, false);
    assert.match(harness.downloads.at(-1).download, /^canvas_\d{8}_\d{6}/);
    assert.match(harness.downloads.at(-1).download, extension);
  }

  assert.equal(harness.downloads.length, 3);
  assert.deepEqual(harness.revoked, harness.objectUrls.map(({ url }) => url));
});

test("canvas clear cancels queued and pending decodes without stale layer resurrection", async () => {
  const harness = createLoadHarness();
  const { api, elements } = loadActionApi({ Image: harness.Image, URL: harness.URL });
  api.state.mode = "canvas";

  const pending = api.addCanvasFiles([imageFile("pending.png")], { x: 300, y: 200 });
  assert.equal(elements.clearAllBtn.disabled, false, "clear must remain available while the first decode is queued");
  await flushMicrotasks();
  assert.equal(harness.instances.length, 1);
  assert.equal(api.state.canvas.pendingLoads.size, 1);

  api.clearCanvasComposition();
  await pending;
  await flushMicrotasks();
  assert.equal(api.state.canvas.layers.length, 0);
  assert.equal(api.state.canvas.pendingLoads.size, 0);
  assert.equal(api.state.canvas.queuedLoadCount, 0);
  assert.deepEqual(harness.revoked, [harness.created[0].url]);

  harness.instances[0].succeed(640, 480);
  await flushMicrotasks();
  assert.equal(api.state.canvas.layers.length, 0, "a cancelled onload must not reinsert its layer");
  assert.equal(harness.revoked.length, 1, "the cancelled object URL must be revoked exactly once");
});

test("canvas export stays disabled while a new layer is queued or decoding beside existing layers", async () => {
  const harness = createLoadHarness();
  const { api, elements } = loadActionApi({ Image: harness.Image, URL: harness.URL });
  api.state.mode = "canvas";
  api.state.canvas.layers = [canvasLayer("existing")];
  api.state.canvas.selectedId = "existing";
  api.updateActionAvailability();
  assert.equal(elements.exportBtn.disabled, false);

  const loading = api.addCanvasFiles([imageFile("new-layer.webp", "image/webp")], { x: 400, y: 300 });
  assert.equal(elements.exportBtn.disabled, true, "the queued phase must close the export gate synchronously");
  await flushMicrotasks();
  assert.equal(api.state.canvas.pendingLoads.size, 1);
  assert.equal(elements.exportBtn.disabled, true, "the decode phase must keep the export gate closed");

  harness.instances[0].succeed(320, 180);
  await loading;
  await flushMicrotasks();
  assert.equal(api.state.canvas.layers.length, 2);
  assert.equal(elements.exportBtn.disabled, false);
  api.clearCanvasComposition();
});

test("canvas zoom clamps and rounds without entering document history or changing layers", () => {
  const { api, elements } = loadActionApi();
  const layer = canvasLayer("subject", { x: 12.5, y: 34.75 });
  api.state.canvas.layers = [layer];
  const before = compactCanvasLayer(layer);

  api.setCanvasZoom(0.249);
  assert.equal(api.state.canvas.zoom, 0.25);
  api.setCanvasZoom(1.376);
  assert.equal(api.state.canvas.zoom, 1.38);
  api.setCanvasZoom(99);
  assert.equal(api.state.canvas.zoom, 4);
  assert.equal(elements.canvasZoomValue.textContent, "400%");
  assert.deepEqual(compactCanvasLayer(api.state.canvas.layers[0]), before);
  assert.equal(api.state.canvas.history.length, 0);
});

test("canvas layer list renders the frontmost layer first with listitem semantics", () => {
  const { api, elements } = loadActionApi();
  api.state.canvas.layers = [
    canvasLayer("back", { zIndex: 0 }),
    canvasLayer("middle", { zIndex: 1, visible: false }),
    canvasLayer("front", { zIndex: 2, locked: true }),
  ];
  api.state.canvas.selectedId = "front";
  api.renderCanvasLayerList();

  assert.deepEqual(elements.canvasLayerList.children.map((row) => row.dataset.id), ["front", "middle", "back"]);
  assert.ok(elements.canvasLayerList.children.every((row) => row.getAttribute("role") === "listitem"));
  assert.equal(elements.canvasLayerList.children[0].getAttribute("aria-current"), "true");
  assert.equal(elements.canvasLayerList.children[0].classList.contains("is-locked"), true);
  assert.equal(elements.canvasLayerList.children[1].classList.contains("is-hidden-layer"), true);
  assert.equal(elements.canvasLayerCount.textContent, "3層");
});

test("a layer-row Delete key bubbles as an already handled event without deleting a second layer", () => {
  const { api, elements } = loadActionApi();
  api.state.mode = "canvas";
  api.state.canvas.layers = [
    canvasLayer("back", { zIndex: 0 }),
    canvasLayer("middle", { zIndex: 1 }),
    canvasLayer("front", { zIndex: 2 }),
  ];
  api.state.canvas.selectedId = "front";
  api.renderCanvasLayerList();
  const row = elements.canvasLayerList.children.find((item) => item.dataset.id === "middle");
  assert.ok(row);
  const event = {
    type: "keydown",
    key: "Delete",
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    target: row,
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
  };

  row.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  api.handleCanvasKeyboard(event); // document-level bubble phase

  assert.deepEqual(Array.from(api.state.canvas.layers, (layer) => layer.id), ["back", "front"]);
  assert.equal(api.state.canvas.history.length, 1);
});

test("a layer-row Alt+Arrow reorder bubbles without also nudging the layer position", () => {
  const { api, elements } = loadActionApi();
  api.state.mode = "canvas";
  api.state.canvas.layers = [
    canvasLayer("back", { zIndex: 0 }),
    canvasLayer("middle", { zIndex: 1, y: 50 }),
    canvasLayer("front", { zIndex: 2 }),
  ];
  api.state.canvas.selectedId = "front";
  api.renderCanvasLayerList();
  const row = elements.canvasLayerList.children.find((item) => item.dataset.id === "middle");
  assert.ok(row);
  const event = {
    type: "keydown",
    key: "ArrowUp",
    altKey: true,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    target: row,
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
  };

  row.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  api.handleCanvasKeyboard(event); // document-level bubble phase

  assert.deepEqual(Array.from(api.state.canvas.layers, (layer) => layer.id), ["back", "front", "middle"]);
  assert.equal(api.state.canvas.layers.find((layer) => layer.id === "middle").y, 50);
  assert.equal(api.state.canvas.history.length, 1);
});

test("horizontal, vertical, and grid layouts preserve order and expected dimensions", () => {
  const api = loadPureApi();
  const records = [record("a", 40, 20), record("b", 20, 40), record("c", 10, 10)];

  assert.deepEqual(compactLayout(api.calculateCombineLayout(records, options("horizontal"))), {
    width: 76,
    height: 44,
    placements: [
      { name: "a", x: 2, y: 12, width: 40, height: 20 },
      { name: "b", x: 43, y: 2, width: 20, height: 40 },
      { name: "c", x: 64, y: 17, width: 10, height: 10 },
    ],
  });

  assert.deepEqual(compactLayout(api.calculateCombineLayout(records.slice(0, 2), options("vertical"))), {
    width: 44,
    height: 65,
    placements: [
      { name: "a", x: 2, y: 2, width: 40, height: 20 },
      { name: "b", x: 12, y: 23, width: 20, height: 40 },
    ],
  });

  assert.deepEqual(compactLayout(api.calculateCombineLayout(records, options("grid"))), {
    width: 85,
    height: 85,
    placements: [
      { name: "a", x: 2, y: 12, width: 40, height: 20 },
      { name: "b", x: 53, y: 2, width: 20, height: 40 },
      { name: "c", x: 17, y: 58, width: 10, height: 10 },
    ],
  });
});

test("sizing modes retain aspect ratio and center images inside custom boxes", () => {
  const api = loadPureApi();
  const records = [record("wide", 40, 20), record("tall", 20, 40)];

  const widthLayout = compactLayout(api.calculateCombineLayout(records, options("horizontal", {
    sizing: "width",
    gap: 0,
    padding: 0,
  })));
  assert.deepEqual(widthLayout, {
    width: 80,
    height: 80,
    placements: [
      { name: "wide", x: 0, y: 30, width: 40, height: 20 },
      { name: "tall", x: 40, y: 0, width: 40, height: 80 },
    ],
  });

  const heightLayout = compactLayout(api.calculateCombineLayout(records, options("vertical", {
    sizing: "height",
    gap: 0,
    padding: 0,
  })));
  assert.deepEqual(heightLayout, {
    width: 80,
    height: 80,
    placements: [
      { name: "wide", x: 0, y: 0, width: 80, height: 40 },
      { name: "tall", x: 30, y: 40, width: 20, height: 40 },
    ],
  });

  const customLayout = compactLayout(api.calculateCombineLayout(records, options("horizontal", {
    sizing: "custom",
    targetWidth: 50,
    targetHeight: 50,
    gap: 0,
    padding: 0,
  })));
  assert.equal(customLayout.width, 100);
  assert.equal(customLayout.height, 50);
  assert.deepEqual(customLayout.placements, [
    { name: "wide", x: 0, y: 12.5, width: 50, height: 25 },
    { name: "tall", x: 62.5, y: 0, width: 25, height: 50 },
  ]);
});

test("processed crop, resize, and rotation dimensions feed the combine calculation", () => {
  const api = loadPureApi();
  const records = [
    record("cropped", 100, 80, { crop: { x: 10, y: 20, width: 50, height: 30 } }),
    record("resized", 30, 20, { resize: { width: 60, height: 40, keepAspect: true } }),
    record("rotated", 90, 40, {
      rotation: 90,
      crop: { x: 0, y: 0, width: 40, height: 90 },
    }),
  ];
  const layout = compactLayout(api.calculateCombineLayout(records, options("horizontal", {
    gap: 0,
    padding: 0,
  })));
  assert.deepEqual(layout, {
    width: 150,
    height: 90,
    placements: [
      { name: "cropped", x: 0, y: 30, width: 50, height: 30 },
      { name: "resized", x: 50, y: 25, width: 60, height: 40 },
      { name: "rotated", x: 110, y: 0, width: 40, height: 90 },
    ],
  });
});

test("crop helpers center ratios and clamp invalid coordinates", () => {
  const api = loadPureApi();
  assert.deepEqual(
    { ...api.largestCenteredCrop({ width: 400, height: 300 }, 1) },
    { x: 50, y: 0, width: 300, height: 300 },
  );
  assert.deepEqual(
    { ...api.largestCenteredCrop({ width: 400, height: 300 }, 16 / 9) },
    { x: 0, y: 37.5, width: 400, height: 225 },
  );
  assert.deepEqual(
    { ...api.clampCrop({ x: -5, y: 99, width: 200, height: 2 }, { width: 100, height: 80 }) },
    { x: 0, y: 78, width: 100, height: 2 },
  );
  assert.deepEqual(
    { ...api.clampCrop({ x: 98, y: -10, width: 1, height: 500 }, { width: 100, height: 80 }) },
    { x: 98, y: 0, width: 2, height: 80 },
  );
});

test("ratio and rotation normalization reject invalid values predictably", () => {
  const api = loadPureApi();
  assert.equal(api.ratioNumber("1:1"), 1);
  assert.equal(api.ratioNumber("16:9"), 16 / 9);
  assert.equal(api.ratioNumber("9:16"), 9 / 16);
  assert.equal(api.ratioNumber("free"), null);
  assert.equal(api.ratioNumber("bad"), null);
  assert.equal(api.ratioNumber("1:0"), null);
  assert.deepEqual([-450, -90, 0, 90, 450, 720].map(api.normalizeRotation), [270, 270, 0, 90, 90, 0]);
});

test("right/left rotation transforms crop coordinates, ratio labels, and flip axes", () => {
  const { api } = loadActionApi();
  const originalCrop = { x: 10, y: 20, width: 100, height: 50 };
  const item = stateRecord("subject", 400, 300, {
    crop: { ...originalCrop },
    cropRatio: "4:3",
    flipX: true,
    flipY: false,
  });
  api.state.images = [item];
  api.state.selectedId = item.id;

  api.rotateSelected(90);
  assert.equal(item.rotation, 90);
  assert.deepEqual(plain(item.crop), { x: 230, y: 10, width: 50, height: 100 });
  assert.equal(item.cropRatio, "3:4");
  assert.equal(item.flipX, false);
  assert.equal(item.flipY, true);

  api.rotateSelected(-90);
  assert.equal(item.rotation, 0);
  assert.deepEqual(plain(item.crop), originalCrop);
  assert.equal(item.cropRatio, "4:3");
  assert.equal(item.flipX, true);
  assert.equal(item.flipY, false);

  api.rotateSelected(-90);
  assert.equal(item.rotation, 270);
  assert.deepEqual(plain(item.crop), { x: 20, y: 290, width: 50, height: 100 });
});

test("four rotations and double flips return the exact crop and orientation state", () => {
  const { api } = loadActionApi();
  const item = stateRecord("subject", 401, 299, {
    crop: { x: 17, y: 23, width: 137, height: 89 },
    cropRatio: "16:9",
  });
  api.state.images = [item];
  api.state.selectedId = item.id;
  const initial = plain({
    rotation: item.rotation,
    flipX: item.flipX,
    flipY: item.flipY,
    crop: item.crop,
    cropRatio: item.cropRatio,
  });

  for (let index = 0; index < 4; index += 1) api.rotateSelected(90);
  assert.deepEqual(plain({
    rotation: item.rotation,
    flipX: item.flipX,
    flipY: item.flipY,
    crop: item.crop,
    cropRatio: item.cropRatio,
  }), initial);

  api.toggleSelectedFlip("flipX");
  assert.deepEqual(plain(item.crop), { x: 247, y: 23, width: 137, height: 89 });
  assert.equal(item.flipX, true);
  api.toggleSelectedFlip("flipX");
  assert.deepEqual(plain(item.crop), initial.crop);
  assert.equal(item.flipX, false);

  api.toggleSelectedFlip("flipY");
  assert.deepEqual(plain(item.crop), { x: 17, y: 187, width: 137, height: 89 });
  assert.equal(item.flipY, true);
  api.toggleSelectedFlip("flipY");
  assert.deepEqual(plain(item.crop), initial.crop);
  assert.equal(item.flipY, false);
});

test("rotating a resized image swaps its output dimensions", () => {
  const { api } = loadActionApi();
  const item = stateRecord("subject", 400, 300, {
    resize: { width: 800, height: 600, keepAspect: true },
  });
  api.state.images = [item];
  api.state.selectedId = item.id;
  api.rotateSelected(90);
  assert.deepEqual(plain(item.resize), { width: 600, height: 800, keepAspect: true });
  assert.deepEqual(plain(api.getProcessedDimensions(item)), { width: 600, height: 800 });
  api.rotateSelected(-90);
  assert.deepEqual(plain(item.resize), { width: 800, height: 600, keepAspect: true });
});

test("changing crop ratio reconciles an existing aspect-locked resize", () => {
  const { api } = loadActionApi();
  const item = stateRecord("subject", 400, 300, {
    resize: { width: 800, height: 600, keepAspect: true },
  });
  api.state.images = [item];
  api.state.selectedId = item.id;
  api.applyCenteredRatioToAll("1:1");
  assert.deepEqual(plain(item.crop), { x: 50, y: 0, width: 300, height: 300 });
  assert.deepEqual(plain(item.resize), { width: 800, height: 800, keepAspect: true });
});

test("free batch crop maps relative coordinates and leaves independent crop objects", () => {
  const { api } = loadActionApi();
  const source = stateRecord("source", 400, 200, {
    crop: { x: 100, y: 50, width: 200, height: 100 },
  });
  const portrait = stateRecord("portrait", 200, 400);
  const square = stateRecord("square", 100, 100);
  api.state.images = [source, portrait, square];
  api.state.selectedId = source.id;

  api.applySelectedCropToAll();
  assert.deepEqual(plain(source.crop), { x: 100, y: 50, width: 200, height: 100 });
  assert.deepEqual(plain(portrait.crop), { x: 50, y: 100, width: 100, height: 200 });
  assert.deepEqual(plain(square.crop), { x: 25, y: 25, width: 50, height: 50 });
  assert.notEqual(source.crop, portrait.crop);
  assert.notEqual(portrait.crop, square.crop);
  portrait.crop.x = 0;
  assert.equal(square.crop.x, 25);
  assert.equal(source.crop.x, 100);
});

test("fixed-ratio batch crop remains in bounds and retains the selected aspect ratio", () => {
  const { api } = loadActionApi();
  const source = stateRecord("source", 400, 300, {
    crop: { x: 0, y: 37.5, width: 400, height: 225 },
    cropRatio: "16:9",
  });
  const portrait = stateRecord("portrait", 100, 200);
  const landscape = stateRecord("landscape", 200, 100);
  api.state.images = [source, portrait, landscape];
  api.state.selectedId = source.id;

  api.applySelectedCropToAll();
  for (const item of [portrait, landscape]) {
    assert.equal(item.cropRatio, "16:9");
    assert.ok(item.crop.x >= 0 && item.crop.y >= 0);
    assert.ok(item.crop.x + item.crop.width <= item.originalWidth);
    assert.ok(item.crop.y + item.crop.height <= item.originalHeight);
    assert.ok(Math.abs(item.crop.width / item.crop.height - 16 / 9) < 1e-12);
  }
  assert.deepEqual(plain(portrait.crop), { x: 0, y: 71.875, width: 100, height: 56.25 });
  assert.deepEqual(plain(landscape.crop), {
    x: 33.33333333333334,
    y: 12.5,
    width: 133.33333333333331,
    height: 75,
  });
});

test("fixed crop ratios survive the minimum crop size", () => {
  const { api } = loadActionApi();
  const crop = api.fitCropToRatio(
    { x: 4, y: 4, width: 2, height: 2 },
    { width: 10, height: 10 },
    16 / 9,
  );
  assert.ok(Math.abs(crop.width / crop.height - 16 / 9) < 1e-12);
  assert.ok(crop.width >= 2 && crop.height >= 2);
  assert.ok(crop.x >= 0 && crop.y >= 0);
  assert.ok(crop.x + crop.width <= 10 && crop.y + crop.height <= 10);
});

test("fixed 16:9 crops preserve their ratio when 1-3px-wide images are normalized and rotated", () => {
  const { api } = loadActionApi();
  const items = [1, 2, 3].map((width) => {
    const item = stateRecord(`narrow-${width}`, width, 100, { cropRatio: "16:9" });
    item.crop = api.largestCenteredCrop(api.getOrientedDimensions(item), 16 / 9);
    return item;
  });
  api.state.images = items;

  for (const item of items) {
    const before = api.normalizedCrop(item);
    assert.ok(Math.abs(before.width / before.height - 16 / 9) < 1e-12);
    assert.ok(before.width <= item.originalWidth && before.height <= item.originalHeight);
    item.crop = before;
    api.state.selectedId = item.id;
    api.rotateSelected(90);

    const after = api.normalizedCrop(item);
    const bounds = api.getOrientedDimensions(item);
    assert.equal(item.cropRatio, "9:16");
    assert.ok(Math.abs(after.width / after.height - 9 / 16) < 1e-12);
    assert.ok(after.x >= 0 && after.y >= 0);
    assert.ok(after.x + after.width <= bounds.width);
    assert.ok(after.y + after.height <= bounds.height);
  }
});

test("fixed 16:9 batch crop preserves ratio across 1-3px-wide images", () => {
  const { api } = loadActionApi();
  const items = [1, 2, 3].map((width) => stateRecord(`narrow-${width}`, width, 100));
  items[0].cropRatio = "16:9";
  items[0].crop = api.largestCenteredCrop(api.getOrientedDimensions(items[0]), 16 / 9);
  api.state.images = items;
  api.state.selectedId = items[0].id;

  api.applySelectedCropToAll();
  for (const item of items) {
    const crop = api.normalizedCrop(item);
    const bounds = api.getOrientedDimensions(item);
    assert.equal(item.cropRatio, "16:9");
    assert.ok(Math.abs(crop.width / crop.height - 16 / 9) < 1e-12);
    assert.ok(crop.x >= 0 && crop.y >= 0);
    assert.ok(crop.x + crop.width <= bounds.width);
    assert.ok(crop.y + crop.height <= bounds.height);
  }
});

test("moving a fixed crop by numeric X or Y keeps its precise fractional size", () => {
  const { api, elements } = loadActionApi();
  const width = 123.4567890123;
  const height = width / (16 / 9);
  const item = stateRecord("subject", 400, 300, {
    crop: { x: 20.123456789, y: 30.987654321, width, height },
    cropRatio: "16:9",
  });
  api.state.images = [item];
  api.state.selectedId = item.id;
  const assertPreciseSize = () => {
    const widthError = Math.abs(item.crop.width - width);
    const heightError = Math.abs(item.crop.height - height);
    assert.ok(widthError <= Number.EPSILON * Math.abs(width) * 4, `width drifted by ${widthError}px`);
    assert.ok(heightError <= Number.EPSILON * Math.abs(height) * 4, `height drifted by ${heightError}px`);
    assert.notEqual(item.crop.width, Math.round(item.crop.width));
    assert.notEqual(item.crop.height, Math.round(item.crop.height));
  };

  elements.cropX.value = "100.23456789";
  elements.cropY.value = String(item.crop.y);
  elements.cropWidth.value = "123";
  elements.cropHeight.value = "69";
  api.updateCropFromNumbers("cropX");
  assertPreciseSize();

  elements.cropY.value = "120.87654321";
  elements.cropWidth.value = "2";
  elements.cropHeight.value = "2";
  api.updateCropFromNumbers("cropY");
  assertPreciseSize();
  assert.ok(Math.abs(item.crop.width / item.crop.height - 16 / 9) < 1e-12);
});

test("numeric and handle-based fixed-ratio crops survive the minimum crop size", () => {
  const { api, elements } = loadActionApi();
  const item = stateRecord("subject", 10, 10, {
    crop: { x: 4, y: 4, width: 2, height: 2 },
    cropRatio: "16:9",
  });
  api.state.images = [item];
  api.state.selectedId = item.id;
  elements.cropX.value = "4";
  elements.cropY.value = "4";
  elements.cropWidth.value = "2";
  elements.cropHeight.value = "2";
  api.updateCropFromNumbers("cropWidth");
  assert.ok(Math.abs(item.crop.width / item.crop.height - 16 / 9) < 1e-12);

  const resized = api.resizeCrop(
    { x: 4, y: 4, width: 2, height: 2 },
    "se",
    0,
    0,
    { width: 10, height: 10 },
    16 / 9,
  );
  assert.ok(Math.abs(resized.width / resized.height - 16 / 9) < 1e-12);
  assert.ok(resized.width >= 2 && resized.height >= 2);
});

test("oversized numeric fixed-ratio crops fit inside bounds without changing ratio", () => {
  const { api, elements } = loadActionApi();
  const item = stateRecord("subject", 100, 50, {
    cropRatio: "16:9",
  });
  api.state.images = [item];
  api.state.selectedId = item.id;
  elements.cropX.value = "0";
  elements.cropY.value = "0";
  elements.cropWidth.value = "100";
  elements.cropHeight.value = "50";
  api.updateCropFromNumbers("cropWidth");
  assert.ok(Math.abs(item.crop.width / item.crop.height - 16 / 9) < 1e-12);
  assert.ok(item.crop.width <= 100 && item.crop.height <= 50);
});

test("fixed-ratio resize handles stop at their anchor instead of growing after crossing it", () => {
  const { api } = loadActionApi();
  const start = { x: 100, y: 100, width: 200, height: 112.5 };
  const bounds = { width: 500, height: 400 };
  const nearAnchor = api.resizeCrop(start, "e", -198, 0, bounds, 16 / 9);
  const pastAnchor = api.resizeCrop(start, "e", -250, 0, bounds, 16 / 9);
  assert.ok(Math.abs(nearAnchor.width / nearAnchor.height - 16 / 9) < 1e-12);
  assert.ok(Math.abs(pastAnchor.width / pastAnchor.height - 16 / 9) < 1e-12);
  assert.ok(pastAnchor.width <= nearAnchor.width, `crossing anchor grew ${nearAnchor.width}px to ${pastAnchor.width}px`);
});

test("batch resize copies exact output dimensions without sharing resize objects", () => {
  const { api } = loadActionApi();
  const source = stateRecord("source", 400, 200, {
    crop: { x: 0, y: 0, width: 200, height: 100 },
    resize: { width: 300, height: 150, keepAspect: false },
  });
  const portrait = stateRecord("portrait", 200, 400);
  const square = stateRecord("square", 100, 100);
  api.state.images = [source, portrait, square];
  api.state.selectedId = source.id;

  api.applySelectedResizeToAll();
  for (const item of api.state.images) {
    assert.deepEqual(plain(item.resize), { width: 300, height: 150, keepAspect: false });
  }
  assert.notEqual(source.resize, portrait.resize);
  assert.notEqual(portrait.resize, square.resize);
  portrait.resize.width = 99;
  assert.equal(source.resize.width, 300);
  assert.equal(square.resize.width, 300);
});

test("batch resize converts a locked source into one exact unlocked size for every image", () => {
  const { api } = loadActionApi();
  const source = stateRecord("source", 400, 200, {
    resize: { width: 300, height: 150, keepAspect: true },
  });
  const portrait = stateRecord("portrait", 200, 400, {
    resize: { width: 50, height: 100, keepAspect: true },
  });
  const square = stateRecord("square", 100, 100);
  api.state.images = [source, portrait, square];
  api.state.selectedId = source.id;

  api.applySelectedResizeToAll();
  for (const item of api.state.images) {
    assert.deepEqual(plain(item.resize), { width: 300, height: 150, keepAspect: false });
    assert.deepEqual(plain(api.getProcessedDimensions(item)), { width: 300, height: 150 });
  }
});

test("exact single-image presets disable aspect locking while reset restores it", () => {
  const { api, elements } = loadActionApi();
  const item = stateRecord("subject", 800, 600);
  api.state.images = [item];
  api.state.selectedId = item.id;

  for (const [button, width, height] of [
    [elements.preset512Btn, 512, 512],
    [elements.preset1024Btn, 1024, 1024],
    [elements.preset1920Btn, 1920, 1080],
  ]) {
    button.dispatchEvent({ type: "click" });
    assert.deepEqual(plain(item.resize), { width, height, keepAspect: false });
    assert.equal(elements.keepAspect.checked, false);
  }

  elements.resetSizeBtn.dispatchEvent({ type: "click" });
  assert.deepEqual(plain(item.resize), { width: null, height: null, keepAspect: true });
  assert.equal(elements.keepAspect.checked, true);
});

test("exact batch preset sets independent unlocked resize values for every image", () => {
  const { api } = loadActionApi();
  const first = stateRecord("first", 400, 200);
  const second = stateRecord("second", 200, 400);
  api.state.images = [first, second];
  api.state.selectedId = first.id;

  api.applyResizePresetToAll(512, 512);
  assert.deepEqual(plain(first.resize), { width: 512, height: 512, keepAspect: false });
  assert.deepEqual(plain(second.resize), { width: 512, height: 512, keepAspect: false });
  assert.notEqual(first.resize, second.resize);
});

test("invalid numeric control values are clamped or replaced with finite defaults", () => {
  const { api, elements } = loadActionApi();
  elements.combineDirection.value = "grid";
  elements.combineSizing.value = "custom";
  elements.gridColumns.value = "-99";
  elements.targetWidth.value = "0";
  elements.targetHeight.value = "Infinity";
  elements.gapSize.value = "-20";
  elements.outerPadding.value = "1e309";
  elements.outputQuality.value = "NaN";
  elements.outputFormat.value = "webp";

  const fallback = plain(api.getCombineOptions());
  assert.deepEqual(fallback, {
    direction: "grid",
    columns: 1,
    sizing: "custom",
    targetWidth: 1,
    targetHeight: 1200,
    gap: 0,
    padding: 0,
    background: "transparent",
    customBackground: "#ffffff",
    format: "webp",
    quality: 0.9,
  });

  elements.gridColumns.value = "999";
  elements.targetWidth.value = "999999999";
  elements.targetHeight.value = "999999999";
  elements.gapSize.value = "999999999";
  elements.outerPadding.value = "999999999";
  elements.outputQuality.value = "999";
  const maximum = plain(api.getCombineOptions());
  assert.equal(maximum.columns, 20);
  assert.equal(maximum.targetWidth, 32767);
  assert.equal(maximum.targetHeight, 32767);
  assert.equal(maximum.gap, 5000);
  assert.equal(maximum.padding, 5000);
  assert.equal(maximum.quality, 1);

  const item = stateRecord("subject", 200, 100);
  api.state.images = [item];
  api.state.selectedId = item.id;
  elements.cropX.value = "-999";
  elements.cropY.value = "Infinity";
  elements.cropWidth.value = "0";
  elements.cropHeight.value = "999999999";
  api.updateCropFromNumbers("cropWidth");
  assert.deepEqual(plain(item.crop), { x: 0, y: 0, width: 2, height: 100 });
  elements.resizeWidth.value = "-5";
  elements.resizeHeight.value = "Infinity";
  api.updateResizeFromNumbers("width");
  assert.deepEqual(plain(item.resize), { width: 1, height: 50, keepAspect: true });
});

test("blank numeric values use their fallback instead of becoming zero", () => {
  const { api, elements } = loadActionApi();
  assert.equal(api.numberValue("", 42), 42);
  assert.equal(api.numberValue("   ", 42), 42);
  elements.targetWidth.value = "";
  elements.targetHeight.value = "";
  elements.gapSize.value = "";
  elements.outerPadding.value = "";
  const optionsWithBlanks = plain(api.getCombineOptions());
  assert.equal(optionsWithBlanks.targetWidth, 1200);
  assert.equal(optionsWithBlanks.targetHeight, 1200);
  assert.equal(optionsWithBlanks.gap, 0);
  assert.equal(optionsWithBlanks.padding, 0);
});

test("aspect-locked resize never computes a dimension above the export limit", () => {
  const { api, elements } = loadActionApi();
  const item = stateRecord("subject", 2, 100);
  api.state.images = [item];
  api.state.selectedId = item.id;
  elements.resizeWidth.value = "32767";
  elements.resizeHeight.value = "100";
  api.updateResizeFromNumbers("width");
  assert.ok(item.resize.width >= 1 && item.resize.width <= 32767);
  assert.ok(item.resize.height >= 1 && item.resize.height <= 32767);
  assert.ok(Math.abs(item.resize.width / item.resize.height - 2 / 100) < 1e-12);
});

test("a 1:1 locked 32767px resize is scaled below the 120MP export limit", () => {
  const { api, elements } = loadActionApi();
  const item = stateRecord("square", 100, 100, {
    cropRatio: "1:1",
  });
  api.state.images = [item];
  api.state.selectedId = item.id;
  elements.resizeWidth.value = "32767";
  elements.resizeHeight.value = "32767";

  api.updateResizeFromNumbers("width");
  assert.equal(item.resize.keepAspect, true);
  assert.ok(Math.abs(item.resize.width / item.resize.height - 1) < 1e-12);
  const size = api.getProcessedDimensions(item);
  assert.ok(size.width * size.height <= 120_000_000, `${size.width}×${size.height} exceeds 120MP`);
  assert.doesNotThrow(() => api.assertExportSize(size.width, size.height));
});

test("1920px-wide batch resize preserves aspect and scales extreme images inside export limits", () => {
  const { api } = loadActionApi();
  const normal = stateRecord("normal", 400, 200);
  const extreme = stateRecord("extreme", 2, 100);
  api.state.images = [normal, extreme];
  api.state.selectedId = normal.id;

  api.apply1920WidthToAll();
  assert.deepEqual(plain(normal.resize), { width: 1920, height: 960, keepAspect: true });
  assert.equal(extreme.resize.keepAspect, true);
  assert.ok(extreme.resize.width >= 1 && extreme.resize.width <= 32767);
  assert.ok(extreme.resize.height >= 1 && extreme.resize.height <= 32767);
  assert.ok(Math.abs(extreme.resize.width / extreme.resize.height - 2 / 100) < 1e-12);

  for (const item of api.state.images) {
    const size = api.getProcessedDimensions(item);
    assert.doesNotThrow(() => api.assertExportSize(size.width, size.height));
  }
});

test("canvas encoding rejects a browser fallback with the wrong MIME type", async () => {
  const { api } = loadActionApi();
  const fallbackCanvas = {
    toBlob(callback) {
      callback(new Blob(["not really webp"], { type: "image/png" }));
    },
  };
  await assert.rejects(
    api.canvasToBlob(fallbackCanvas, "image/webp", 0.9),
    /image\/webp|形式|変換/,
  );
});

test("combined export locks duplicate requests until its single encode completes", async () => {
  const harness = createExportHarness();
  const { api, elements } = loadActionApi({
    createElement: harness.createElement,
    URL: harness.URL,
    setTimeout: harness.setTimeout,
    clearTimeout: harness.clearTimeout,
  });
  const first = stateRecord("first", 10, 10, { image: { id: "first-image" } });
  const second = stateRecord("second", 20, 10, { image: { id: "second-image" } });
  api.state.images = [first, second];
  api.state.selectedId = first.id;
  api.state.mode = "combine";
  elements.combineDirection.value = "horizontal";
  elements.combineSizing.value = "original";
  elements.gapSize.value = "0";
  elements.outerPadding.value = "0";
  elements.outputFormat.value = "png";
  api.updateActionAvailability();

  const exporting = api.exportCurrentMode();
  const duplicate = api.exportCurrentMode();
  assert.equal(api.state.exporting, true);
  assert.equal(elements.exportBtn.disabled, true);
  assert.equal(harness.canvases.length, 1);
  assert.equal(harness.pendingEncodes.length, 1);
  assert.deepEqual([harness.canvases[0].width, harness.canvases[0].height], [30, 10]);

  first.crop.width = 2;
  first.resize = { width: 999, height: 999, keepAspect: false };
  api.state.images.push(stateRecord("late", 100, 100, { image: { id: "late-image" } }));
  harness.resolveEncode(0);
  await Promise.all([exporting, duplicate]);
  await flushMicrotasks();

  assert.equal(harness.canvases.length, 1, "the duplicate request must not create another canvas");
  assert.equal(harness.downloads.length, 1);
  assert.match(harness.downloads[0].download, /^combined_\d{8}_\d{6}\.png$/);
  assert.equal(api.state.exporting, false);
  assert.equal(elements.exportBtn.disabled, false);
});

test("edited export snapshots records and format while rejecting a duplicate workflow", async () => {
  const harness = createExportHarness();
  const { api, elements, body } = loadActionApi({
    createElement: harness.createElement,
    URL: harness.URL,
    setTimeout: harness.setTimeout,
    clearTimeout: harness.clearTimeout,
  });
  const first = stateRecord("first", 10, 10, { image: { id: "first-image" } });
  const second = stateRecord("second", 20, 10, { image: { id: "second-image" } });
  api.state.images = [first, second];
  api.state.selectedId = first.id;
  api.state.mode = "edit";
  elements.outputFormat.value = "png";
  elements.outputQuality.value = "90";
  api.updateActionAvailability();

  const exporting = api.exportCurrentMode();
  const duplicate = api.exportCurrentMode();
  assert.equal(harness.pendingEncodes.length, 1);
  assert.deepEqual([harness.canvases[0].width, harness.canvases[0].height], [10, 10]);
  assert.equal(harness.pendingEncodes[0].mime, "image/png");

  second.fileName = "changed.jpg";
  second.crop = { x: 0, y: 0, width: 2, height: 2 };
  second.resize = { width: 100, height: 100, keepAspect: false };
  api.state.images = [];
  elements.outputFormat.value = "jpeg";
  harness.resolveEncode(0);
  await flushMicrotasks(20);

  assert.equal(harness.pendingEncodes.length, 2, "the original second record must still be exported");
  assert.equal(harness.canvases.length, 2, "a duplicate workflow must not add extra canvases");
  assert.deepEqual([harness.canvases[1].width, harness.canvases[1].height], [20, 10]);
  assert.equal(harness.pendingEncodes[1].mime, "image/png", "the format must remain the initial snapshot");
  harness.resolveEncode(1);
  await Promise.all([exporting, duplicate]);
  await flushMicrotasks();

  const descendants = (node) => node.children.flatMap((child) => [child, ...descendants(child)]);
  const downloadLinks = descendants(body).filter((node) => typeof node.download === "string");
  assert.deepEqual(downloadLinks.map((item) => item.download), [
    "first_edited.png",
    "second_edited.png",
  ]);
  assert.equal(harness.downloads.length, 0, "multiple files should wait for explicit link clicks");
  assert.equal(harness.objectUrls.length, 2);
  downloadLinks[0].click();
  assert.deepEqual(harness.downloads, [{
    href: downloadLinks[0].href,
    download: "first_edited.png",
  }], "a download starts only after an explicit link activation");

  const closeButton = descendants(body).find((node) => node.className.includes("download-dialog__close"));
  assert.ok(closeButton, "the explicit download list must provide a close control");
  assert.equal(typeof api.state.downloadCleanup, "function");
  closeButton.dispatchEvent({ type: "click" });
  assert.deepEqual(harness.revoked, harness.objectUrls.map(({ url }) => url));
  assert.equal(api.state.downloadCleanup, null);
  closeButton.dispatchEvent({ type: "click" });
  assert.equal(harness.revoked.length, 2, "download URL cleanup must be idempotent");
  assert.equal(api.state.exporting, false);
});

test("export size guard rejects excessive dimensions and pixel counts", () => {
  const { api } = loadActionApi();
  assert.doesNotThrow(() => api.assertExportSize(10_000, 10_000));
  assert.throws(() => api.assertExportSize(32_768, 1), /大きすぎ/);
  assert.throws(() => api.assertExportSize(1, 32_768), /大きすぎ/);
  assert.throws(() => api.assertExportSize(20_000, 10_000), /大きすぎ/);
  assert.throws(() => api.assertExportSize(Number.NaN, 100), /サイズ|正数|大きすぎ/);
  assert.throws(() => api.assertExportSize(0, 100), /サイズ|正数|大きすぎ/);
  assert.throws(() => api.assertExportSize(-1, 100), /サイズ|正数|大きすぎ/);
});

test("edited output stems sanitize filesystem-reserved characters", () => {
  const { api } = loadActionApi();
  assert.equal(api.fileStem("photo.original.webp"), "photo.original");
  assert.equal(api.fileStem("a:b/c\\d*e?f\"g<h>i|j.png"), "a_b_c_d_e_f_g_h_i_j");
  assert.equal(api.fileStem(".png"), "image");
});

test("grid handles partial final rows, excessive columns, and finite sanitized options", () => {
  const { api, elements } = loadActionApi();
  const records = [
    record("a", 10, 20),
    record("b", 20, 10),
    record("c", 30, 30),
    record("d", 40, 10),
    record("e", 10, 40),
  ];
  const layout = compactLayout(api.calculateCombineLayout(records, options("grid", {
    columns: 2,
    gap: 3,
    padding: 4,
  })));
  assert.equal(layout.width, 91);
  assert.equal(layout.height, 134);
  assert.deepEqual(layout.placements.map(({ name }) => name), ["a", "b", "c", "d", "e"]);
  for (const placement of layout.placements) {
    assert.ok(placement.x >= 4 && placement.y >= 4);
    assert.ok(placement.x + placement.width <= layout.width - 4);
    assert.ok(placement.y + placement.height <= layout.height - 4);
  }

  elements.combineDirection.value = "grid";
  elements.gridColumns.value = "999";
  elements.gapSize.value = "-1";
  elements.outerPadding.value = "Infinity";
  const sanitized = plain(api.getCombineOptions());
  const singleRow = compactLayout(api.calculateCombineLayout(records, sanitized));
  assert.equal(singleRow.placements.length, 5);
  assert.ok(Number.isFinite(singleRow.width));
  assert.ok(Number.isFinite(singleRow.height));
});

test("grid column input accepts 1 through 20 and normalizes blank, fractional, and excessive values", () => {
  const { api, elements } = loadActionApi();
  elements.combineDirection.value = "grid";

  assert.deepEqual(
    ["1", "20", "", "   ", "2.6", "999", "-4", "NaN"].map((value) => api.normalizeGridColumns(value)),
    [1, 20, 2, 2, 3, 20, 1, 2],
  );

  for (const [input, expected] of [
    ["1", 1],
    ["20", 20],
    ["", 2],
    ["2.6", 3],
    ["999", 20],
    ["-4", 1],
  ]) {
    elements.gridColumns.value = input;
    assert.equal(api.getCombineOptions().columns, expected, `gridColumns=${JSON.stringify(input)}`);
  }

  const equalRecords = Array.from({ length: 5 }, (_, index) => record(String(index + 1), 10, 10));
  for (const [columns, expectedSize] of [
    [1, [10, 50]],
    [20, [50, 10]],
    ["", [20, 30]],
    [2.6, [30, 20]],
    [999, [50, 10]],
    [Number.NaN, [20, 30]],
  ]) {
    const layout = api.calculateCombineLayout(equalRecords, options("grid", {
      columns,
      gap: 0,
      padding: 0,
    }));
    assert.deepEqual([layout.width, layout.height], expectedSize, `direct columns=${JSON.stringify(columns)}`);
  }
});

test("a numeric three-column grid keeps order and positions a partial final row correctly", () => {
  const { api, elements } = loadActionApi();
  const records = [
    record("a", 10, 20),
    record("b", 20, 10),
    record("c", 30, 30),
    record("d", 40, 10),
    record("e", 10, 40),
  ];
  elements.combineDirection.value = "grid";
  elements.gridColumns.value = "3";
  elements.gapSize.value = "3";
  elements.outerPadding.value = "4";

  const layout = compactLayout(api.calculateCombineLayout(records, plain(api.getCombineOptions())));
  assert.deepEqual(layout, {
    width: 134,
    height: 91,
    placements: [
      { name: "a", x: 19, y: 14, width: 10, height: 20 },
      { name: "b", x: 57, y: 19, width: 20, height: 10 },
      { name: "c", x: 95, y: 9, width: 30, height: 30 },
      { name: "d", x: 4, y: 62, width: 40, height: 10 },
      { name: "e", x: 62, y: 47, width: 10, height: 40 },
    ],
  });
});

test("split regions cover every pixel exactly in stable row-major order", () => {
  const api = loadPureApi();
  const columns = plain(api.calculateSplitRegions(10, 7, 3, 1));
  assert.deepEqual(columns.regions.map(({ x, y, width, height }) => ({ x, y, width, height })), [
    { x: 0, y: 0, width: 3, height: 7 },
    { x: 3, y: 0, width: 3, height: 7 },
    { x: 6, y: 0, width: 4, height: 7 },
  ]);

  const rows = plain(api.calculateSplitRegions(10, 7, 1, 3));
  assert.deepEqual(rows.regions.map(({ x, y, width, height }) => ({ x, y, width, height })), [
    { x: 0, y: 0, width: 10, height: 2 },
    { x: 0, y: 2, width: 10, height: 2 },
    { x: 0, y: 4, width: 10, height: 3 },
  ]);

  const grid = plain(api.calculateSplitRegions(11, 8, 3, 2));
  assert.equal(grid.total, 6);
  assert.deepEqual(grid.regions.map(({ row, column }) => ({ row, column })), [
    { row: 0, column: 0 },
    { row: 0, column: 1 },
    { row: 0, column: 2 },
    { row: 1, column: 0 },
    { row: 1, column: 1 },
    { row: 1, column: 2 },
  ]);
  const covered = new Set();
  for (const region of grid.regions) {
    assert.ok(region.width > 0 && region.height > 0);
    for (let y = region.y; y < region.y + region.height; y += 1) {
      for (let x = region.x; x < region.x + region.width; x += 1) {
        const key = `${x},${y}`;
        assert.equal(covered.has(key), false, `duplicate pixel ${key}`);
        covered.add(key);
      }
    }
  }
  assert.equal(covered.size, 11 * 8);
});

test("split counts normalize to 1-20 and never create zero-pixel pieces", () => {
  const api = loadPureApi();
  for (const [input, fallback, expected] of [
    ["", 2, 2],
    ["   ", 2, 2],
    ["invalid", 2, 2],
    [-99, 2, 1],
    [3.6, 2, 4],
    [999, 2, 20],
  ]) {
    assert.equal(api.normalizeSplitAxisCount(input, fallback), expected);
  }

  const tiny = plain(api.calculateSplitRegions(2, 1, 20, 20));
  assert.equal(tiny.columns, 2);
  assert.equal(tiny.rows, 1);
  assert.equal(tiny.total, 2);
  assert.deepEqual(tiny.regions.map(({ width, height }) => ({ width, height })), [
    { width: 1, height: 1 },
    { width: 1, height: 1 },
  ]);
  assert.deepEqual(plain(api.calculateSplitRegions(0, 8, 2, 2).regions), []);
  assert.deepEqual(plain(api.calculateSplitRegions(8, Number.NaN, 2, 2).regions), []);
});

test("split settings preserve active blank input, summarize remainders, and use processed dimensions", () => {
  const { api, elements, document } = loadActionApi();
  elements.splitColumns.value = "";
  elements.splitRows.value = "2.7";
  document.activeElement = elements.splitColumns;
  api.normalizeSplitControls();
  assert.equal(elements.splitColumns.value, "", "active typing must not be replaced");
  assert.equal(elements.splitRows.value, "3");
  api.normalizeSplitControls({ commit: true });
  assert.equal(elements.splitColumns.value, "2");
  assert.equal(elements.splitRows.value, "3");

  const layout = plain(api.calculateSplitRegions(5, 3, 2, 2));
  assert.equal(api.formatSplitSummary(layout), "4枚（幅 2〜3 px × 高さ 1〜2 px）");

  const edited = stateRecord("edited", 12, 6, {
    resize: { width: 8, height: 4, keepAspect: false },
    rotation: 90,
  });
  const processed = plain(api.getSplitLayout(edited, { columns: 4, rows: 2 }));
  assert.equal(processed.width, 8);
  assert.equal(processed.height, 4);
  assert.equal(processed.total, 8);
  assert.ok(processed.regions.every((region) => region.width === 2 && region.height === 2));
});

test("the image-splitting mode switch exposes only split settings and the correct save action", () => {
  const { api, elements } = loadActionApi();
  elements.modeSplitBtn.dispatchEvent({ type: "click" });
  assert.equal(api.state.mode, "split");
  for (const [id, pressed] of [
    ["modeCombineBtn", "false"],
    ["modeEditBtn", "false"],
    ["modeCanvasBtn", "false"],
    ["modeFilterBtn", "false"],
    ["modeSplitBtn", "true"],
  ]) {
    assert.equal(elements[id].getAttribute("aria-pressed"), pressed, id);
  }
  assert.equal(elements.splitSettings.hidden, false);
  assert.equal(elements.combineSettings.hidden, true);
  assert.equal(elements.editSettings.hidden, true);
  assert.equal(elements.canvasSettings.hidden, true);
  assert.equal(elements.filterSettings.hidden, true);
  assert.equal(elements.standardAssetPanel.hidden, false);
  assert.equal(elements.canvasLayerPanel.hidden, true);
  assert.equal(elements.exportBtn.textContent, "分割画像を保存");
  assert.equal(elements.resetCurrentBtn.textContent, "分割設定をリセット");
  assert.equal(elements.exportBtn.disabled, true, "an image is required before split export");
});

test("split export snapshots one selected processed image and creates ordered explicit links", async () => {
  const harness = createExportHarness();
  const { api, elements, body } = loadActionApi({
    createElement: harness.createElement,
    URL: harness.URL,
    setTimeout: harness.setTimeout,
    clearTimeout: harness.clearTimeout,
  });
  const pixels = new Uint8ClampedArray(5 * 3 * 4).fill(255);
  api.state.images = [stateRecord("source", 5, 3, {
    fileName: "photo.png",
    image: { pixels, naturalWidth: 5, naturalHeight: 3 },
  })];
  api.state.selectedId = "source";
  elements.splitColumns.value = "2";
  elements.splitRows.value = "2";
  elements.outputFormat.value = "png";
  elements.outputQuality.value = "80";
  elements.modeSplitBtn.dispatchEvent({ type: "click" });
  assert.equal(elements.exportBtn.disabled, false);

  const firstExport = api.exportCurrentMode();
  const duplicateExport = api.exportCurrentMode();
  await duplicateExport;
  assert.equal(harness.pendingEncodes.length, 1, "duplicate export must not create a second canvas");
  for (let index = 0; index < 4; index += 1) {
    assert.equal(harness.pendingEncodes.length, index + 1);
    harness.resolveEncode(index);
    await flushMicrotasks(12);
  }
  await firstExport;

  assert.deepEqual(harness.pendingEncodes.map(({ width, height }) => ({ width, height })), [
    { width: 2, height: 1 },
    { width: 3, height: 1 },
    { width: 2, height: 2 },
    { width: 3, height: 2 },
  ]);
  assert.ok(harness.pendingEncodes.every(({ mime }) => mime === "image/png"));
  assert.ok(harness.pendingEncodes.every(({ quality }) => quality === 0.8));

  const pieceDraws = harness.canvases.slice(1).map((canvas) => (
    canvas.context.calls.find((call) => call[0] === "drawImage").slice(2)
  ));
  assert.deepEqual(pieceDraws, [
    [0, 0, 2, 1, 0, 0, 2, 1],
    [2, 0, 3, 1, 0, 0, 3, 1],
    [0, 1, 2, 2, 0, 0, 2, 2],
    [2, 1, 3, 2, 0, 0, 3, 2],
  ]);

  const dialog = body.children.find((child) => hasClass(child, "download-dialog"));
  assert.ok(dialog, "split export must open the explicit-link dialog");
  const panel = dialog.children[0];
  const list = panel.children.find((child) => hasClass(child, "download-dialog__list"));
  const names = list.children.map((item) => item.children[0].download);
  assert.deepEqual(names, [
    "photo_r01_c01.png",
    "photo_r01_c02.png",
    "photo_r02_c01.png",
    "photo_r02_c02.png",
  ]);
  assert.equal(harness.objectUrls.length, 4);
  assert.equal(api.state.exporting, false);
  assert.equal(elements.exportBtn.disabled, false);
  assert.match(elements.statusMessage.textContent, /4枚の保存リンク/);
});

test("JPEG split pieces receive a white backdrop and jpg filenames", async () => {
  const harness = createExportHarness();
  const { api, elements, body } = loadActionApi({
    createElement: harness.createElement,
    URL: harness.URL,
    setTimeout: harness.setTimeout,
    clearTimeout: harness.clearTimeout,
  });
  api.state.images = [stateRecord("alpha", 4, 2, {
    fileName: "alpha?.png",
    image: { pixels: new Uint8ClampedArray(4 * 2 * 4), naturalWidth: 4, naturalHeight: 2 },
  })];
  api.state.selectedId = "alpha";
  elements.splitColumns.value = "2";
  elements.splitRows.value = "1";
  elements.outputFormat.value = "jpeg";
  elements.outputQuality.value = "90";
  elements.modeSplitBtn.dispatchEvent({ type: "click" });
  const exporting = api.exportCurrentMode();
  for (let index = 0; index < 2; index += 1) {
    assert.equal(harness.pendingEncodes.length, index + 1);
    harness.resolveEncode(index);
    await flushMicrotasks(12);
  }
  await exporting;
  assert.ok(harness.pendingEncodes.every(({ mime }) => mime === "image/jpeg"));
  for (const piece of harness.canvases.slice(1)) {
    assert.ok(
      piece.context.calls.some((call) => call[0] === "fillRect" && call[1] === "#ffffff"),
      "JPEG pieces must be flattened over white",
    );
  }
  const dialog = body.children.find((child) => hasClass(child, "download-dialog"));
  const list = dialog.children[0].children.find((child) => hasClass(child, "download-dialog__list"));
  assert.deepEqual(list.children.map((item) => item.children[0].download), [
    "alpha__r01_c01.jpg",
    "alpha__r01_c02.jpg",
  ]);
});

test("processing presets tolerate unavailable or corrupt storage and whitelist persisted data", () => {
  const api = loadPureApi();
  const key = api.PROCESSING_PRESET_STORAGE_KEY;
  for (const raw of ["{", "null", "[]", JSON.stringify({ version: 99, presets: [] })]) {
    const storage = createStorageHarness({ [key]: raw });
    assert.deepEqual(plain(api.loadProcessingPresets(storage)), []);
  }
  assert.deepEqual(plain(api.loadProcessingPresets({ getItem() { throw new Error("blocked"); } })), []);
  assert.equal(api.writeProcessingPresets([], { setItem() { throw new Error("quota"); } }), false);
  assert.equal(api.sanitizeProcessingPresetSettings("edit", {}).rotation, 0);

  const storage = createStorageHarness();
  const presets = Array.from({ length: 55 }, (_, index) => ({
    id: `combine-${index}`,
    name: `${"長".repeat(80)} ${index}`,
    mode: "combine",
    createdAt: index,
    updatedAt: index,
    file: { name: "secret.png" },
    objectUrl: "blob:secret",
    settings: {
      direction: index === 54 ? "grid" : "invalid",
      columns: 999,
      gap: -2,
      padding: 99999,
      output: { format: "invalid", quality: 999 },
      layers: [{ objectUrl: "blob:layer" }],
      finishLayers: [{ objectUrl: "blob:finish" }],
    },
  }));
  assert.equal(api.writeProcessingPresets(presets, storage), true);
  const raw = storage.getItem(key);
  const payload = JSON.parse(raw);
  assert.equal(payload.version, 1);
  assert.equal(payload.presets.length, 50);
  assert.ok(payload.presets.every((preset) => preset.name.length <= 60));
  assert.ok(payload.presets.every((preset) => preset.settings.columns === 20));
  assert.ok(payload.presets.every((preset) => preset.settings.gap === 0));
  assert.ok(payload.presets.every((preset) => preset.settings.padding === 5000));
  assert.doesNotMatch(raw, /secret\.png|blob:|finishLayers|layers|objectUrl/);
});

test("named processing presets update in place and failed persistence leaves memory unchanged", () => {
  let failWrites = false;
  const storage = createStorageHarness();
  const originalSetItem = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    if (failWrites) throw new Error("quota");
    originalSetItem(key, value);
  };
  const { api, elements } = loadActionApi({ localStorage: storage });
  elements.processingPresetName.value = "Web 投稿";
  elements.combineDirection.value = "grid";
  elements.gridColumns.value = "7";
  elements.gapSize.value = "12";
  elements.outputFormat.value = "webp";
  elements.outputQuality.value = "84";
  assert.equal(api.saveCurrentProcessingPreset(), true);
  assert.equal(api.state.processingPresets.length, 1);
  const firstId = api.state.processingPresets[0].id;
  assert.equal(api.state.processingPresets[0].settings.columns, 7);

  elements.gridColumns.value = "9";
  assert.equal(api.saveCurrentProcessingPreset(), true);
  assert.equal(api.state.processingPresets.length, 1);
  assert.equal(api.state.processingPresets[0].id, firstId);
  assert.equal(api.state.processingPresets[0].settings.columns, 9);

  failWrites = true;
  elements.processingPresetName.value = "保存失敗";
  assert.equal(api.saveCurrentProcessingPreset(), false);
  assert.equal(api.state.processingPresets.length, 1);
  assert.equal(api.state.processingPresets[0].id, firstId);
  assert.match(elements.statusMessage.textContent, /保存できませんでした/);

  elements.processingPresetSelect.value = firstId;
  assert.equal(api.deleteSelectedProcessingPreset(), false);
  assert.equal(api.state.processingPresets.length, 1, "failed deletion must keep the in-memory preset");
  failWrites = false;
  assert.equal(api.deleteSelectedProcessingPreset(), true);
  assert.equal(api.state.processingPresets.length, 0);
  assert.deepEqual(plain(api.loadProcessingPresets(storage)), []);
});

test("the fifty-first named preset is refused without evicting an existing preset", () => {
  const storage = createStorageHarness();
  const { api, elements } = loadActionApi({ localStorage: storage });
  api.state.processingPresets = Array.from({ length: 50 }, (_, index) => api.sanitizeProcessingPreset({
    id: `preset-${index}`,
    name: `設定${index}`,
    mode: "combine",
    createdAt: index + 1,
    updatedAt: index + 1,
    settings: {},
  }));
  const originalIds = api.state.processingPresets.map((preset) => preset.id).join(",");
  elements.processingPresetName.value = "51件目";
  assert.equal(api.saveCurrentProcessingPreset(), false);
  assert.equal(api.state.processingPresets.length, 50);
  assert.equal(api.state.processingPresets.map((preset) => preset.id).join(","), originalIds);
  assert.match(elements.statusMessage.textContent, /50件まで/);
});

test("combine and split presets restore only bounded mode settings plus output options", () => {
  const { api, elements } = loadActionApi();
  api.state.mode = "combine";
  elements.combineDirection.value = "grid";
  elements.gridColumns.value = "6";
  elements.combineSizing.value = "custom";
  elements.targetWidth.value = "640";
  elements.targetHeight.value = "360";
  elements.gapSize.value = "14";
  elements.outerPadding.value = "22";
  elements.backgroundMode.value = "custom";
  elements.customBackground.value = "#123456";
  elements.outputFormat.value = "webp";
  elements.outputQuality.value = "81";
  const combine = api.captureCurrentProcessingSettings("combine");
  elements.combineDirection.value = "horizontal";
  elements.gridColumns.value = "1";
  assert.equal(api.applyProcessingPresetSettings("combine", combine), true);
  assert.equal(elements.combineDirection.value, "grid");
  assert.equal(elements.gridColumns.value, "6");
  assert.equal(elements.targetWidth.value, "640");
  assert.equal(elements.outerPadding.value, "22");
  assert.equal(elements.outputFormat.value, "webp");
  assert.equal(elements.outputQuality.value, "81");

  api.state.mode = "split";
  assert.equal(api.applyProcessingPresetSettings("split", {
    columns: 200,
    rows: -3,
    output: { format: "jpeg", quality: 73 },
  }), true);
  assert.equal(elements.splitColumns.value, "20");
  assert.equal(elements.splitRows.value, "1");
  assert.equal(elements.outputFormat.value, "jpeg");
  assert.equal(api.applyProcessingPresetSettings("combine", combine), false, "another mode must be rejected");
});

test("edit presets map crop ratios to a different image size and filter presets keep finish layers", () => {
  const { api, elements } = loadActionApi();
  const source = stateRecord("source", 200, 100, {
    crop: { x: 50, y: 10, width: 100, height: 50 },
    cropRatio: "free",
    resize: { width: 80, height: 40, keepAspect: false },
    resizeAnchor: "width",
    filter: api.createDefaultFilterState(),
    finishLayers: [],
  });
  api.state.images = [source];
  api.state.selectedId = source.id;
  api.state.mode = "edit";
  elements.outputFormat.value = "png";
  elements.outputQuality.value = "90";
  const edit = api.captureCurrentProcessingSettings("edit");

  const targetFinish = finishLayer("kept");
  const target = stateRecord("target", 400, 200, {
    crop: { x: 0, y: 0, width: 400, height: 200 },
    cropRatio: "free",
    resize: { width: null, height: null, keepAspect: true },
    resizeAnchor: "width",
    filter: api.createDefaultFilterState(),
    finishLayers: [targetFinish],
  });
  api.state.images = [target];
  api.state.selectedId = target.id;
  assert.equal(api.applyProcessingPresetSettings("edit", edit), true);
  assert.deepEqual(plain(target.crop), { x: 100, y: 20, width: 200, height: 100 });
  assert.deepEqual(plain(target.resize), { width: 80, height: 40, keepAspect: false });
  assert.equal(target.finishLayers[0], targetFinish);

  api.state.mode = "filter";
  target.filter.adjustments.brightness = 33;
  target.filter.oil.brush = 11;
  const filter = api.captureCurrentProcessingSettings("filter");
  target.filter.adjustments.brightness = -20;
  assert.equal(api.applyProcessingPresetSettings("filter", filter), true);
  assert.equal(target.filter.adjustments.brightness, 33);
  assert.equal(target.filter.oil.brush, 11);
  assert.equal(target.finishLayers[0], targetFinish, "finish material must be preserved");
  filter.filter.adjustments.brightness = 99;
  assert.equal(target.filter.adjustments.brightness, 33, "applied filter must be a deep copy");
});

test("canvas presets exclude image materials while restoring canvas assistance settings reversibly", () => {
  const { api, elements } = loadActionApi();
  const layer = canvasLayer("subject");
  api.state.mode = "canvas";
  api.state.canvas.layers = [layer];
  api.state.canvas.selectedId = layer.id;
  api.state.canvas.width = 900;
  api.state.canvas.height = 700;
  api.state.canvas.backgroundMode = "image";
  api.state.canvas.backgroundColor = "#abcdef";
  api.state.canvas.snap = false;
  api.state.canvas.gridVisible = true;
  api.state.canvas.gridSize = 37;
  elements.outputFormat.value = "png";
  elements.outputQuality.value = "90";
  const preset = api.captureCurrentProcessingSettings("canvas");
  assert.equal(preset.backgroundMode, "transparent");
  assert.doesNotMatch(JSON.stringify(preset), /blob:|layers|selectedId|history/);

  api.state.canvas.width = 1200;
  api.state.canvas.height = 800;
  api.state.canvas.backgroundMode = "white";
  api.state.canvas.snap = true;
  api.state.canvas.gridVisible = false;
  api.state.canvas.gridSize = 20;
  assert.equal(api.applyProcessingPresetSettings("canvas", preset), true);
  assert.equal(api.state.canvas.width, 900);
  assert.equal(api.state.canvas.height, 700);
  assert.equal(api.state.canvas.backgroundMode, "transparent");
  assert.equal(api.state.canvas.snap, false);
  assert.equal(api.state.canvas.gridVisible, true);
  assert.equal(api.state.canvas.gridSize, 37);
  assert.equal(api.state.canvas.layers[0], layer);
  assert.equal(api.state.canvas.selectedId, layer.id);
  assert.equal(api.state.canvas.history.length, 1);
  api.undoCanvas();
  assert.equal(api.state.canvas.width, 1200);
  assert.equal(api.state.canvas.height, 800);
  assert.equal(api.state.canvas.backgroundMode, "white");
  assert.equal(api.state.canvas.snap, true);
  assert.equal(api.state.canvas.gridVisible, false);
  assert.equal(api.state.canvas.gridSize, 20);
  assert.equal(api.state.canvas.layers[0].id, layer.id);
  assert.equal(api.state.canvas.layers[0].image, layer.image);
});

test("preset dialog cards render selection and filter to one or zero matching settings", () => {
  const { api, elements } = loadActionApi();
  const square = api.sanitizeProcessingPreset({
    id: "preset-square",
    name: "SNS正方形",
    mode: "combine",
    createdAt: 100,
    updatedAt: 100,
    settings: { direction: "grid", columns: 2 },
  });
  const banner = api.sanitizeProcessingPreset({
    id: "preset-banner",
    name: "ブログ横長",
    mode: "combine",
    createdAt: 200,
    updatedAt: 200,
    settings: { direction: "horizontal" },
  });
  assert.ok(square);
  assert.ok(banner);
  api.state.processingPresets = [square, banner];

  elements.processingPresetSearch.value = "";
  api.renderProcessingPresetControls(square.id);
  assert.equal(elements.processingPresetCount.textContent, "2件");
  assert.equal(elements.processingPresetSelect.children.length, 2);
  assert.equal(elements.processingPresetSelect.value, square.id);
  assert.equal(elements.processingPresetList.children.length, 2);
  assert.equal(elements.processingPresetEmpty.hidden, true);
  assert.match(elementText(elements.processingPresetList.children[0]), /ブログ横長/);

  const selectedCard = elements.processingPresetList.children.find((card) => hasClass(card, "is-selected"));
  assert.ok(selectedCard, "the preferred preset must render as the selected card");
  assert.equal(selectedCard.getAttribute("role"), "listitem");
  assert.match(elementText(selectedCard), /SNS正方形/);
  assert.equal(selectedCard.children[0].dataset.presetAction, "select");
  assert.equal(selectedCard.children[0].dataset.presetId, square.id);
  assert.equal(selectedCard.children[0].getAttribute("aria-pressed"), "true");
  assert.equal(selectedCard.children[1].dataset.presetAction, "apply");
  assert.equal(selectedCard.children[1].dataset.presetId, square.id);

  elements.processingPresetSearch.value = "sns";
  api.renderProcessingPresetControls(square.id);
  assert.equal(elements.processingPresetCount.textContent, "2件", "the count describes all presets in the mode");
  assert.equal(elements.processingPresetList.children.length, 1);
  assert.match(elementText(elements.processingPresetList.children[0]), /SNS正方形/);
  assert.equal(hasClass(elements.processingPresetList.children[0], "is-selected"), true);
  assert.equal(elements.processingPresetEmpty.hidden, true);

  elements.processingPresetSearch.value = "未登録";
  api.renderProcessingPresetControls(square.id);
  assert.equal(elements.processingPresetCount.textContent, "2件");
  assert.equal(elements.processingPresetList.children.length, 0);
  assert.equal(elements.processingPresetEmpty.hidden, false);
  assert.equal(elements.processingPresetEmpty.textContent, "一致する保存設定はありません。");
});

test("image bulk selection synchronizes partial, all, empty, and exporting states", () => {
  const { api, elements } = loadActionApi();
  const images = [stateRecord("a", 10, 10), stateRecord("b", 10, 10), stateRecord("c", 10, 10)];
  api.state.images = images;
  api.state.selectedId = images[0].id;
  api.renderImageList();
  assert.equal(api.setImageMarked("b", true), true);
  assert.equal(elements.imageSelectionCount.textContent, "1枚選択");
  assert.equal(elements.imageSelectAll.checked, false);
  assert.equal(elements.imageSelectAll.indeterminate, true);
  assert.equal(elements.deleteSelectedImagesBtn.disabled, false);

  assert.equal(api.setAllImagesMarked(true), true);
  assert.equal(elements.imageSelectAll.checked, true);
  assert.equal(elements.imageSelectAll.indeterminate, false);
  assert.equal(elements.imageSelectionCount.textContent, "3枚選択");
  api.state.exporting = true;
  api.updateActionAvailability();
  assert.equal(elements.imageSelectAll.disabled, true);
  assert.equal(elements.deleteSelectedImagesBtn.disabled, true);
  assert.equal(api.setAllImagesMarked(false), false);
  assert.equal(api.setImageMarked("a", false), false);
  assert.equal(api.state.markedImageIds.size, 3);
});

test("bulk deletion selects the next survivor and retains sources until undo history expires", () => {
  const revoked = [];
  const { api, elements } = loadActionApi({
    URL: { revokeObjectURL(url) { revoked.push(url); } },
  });
  const a = stateRecord("a", 10, 10, { objectUrl: "blob:shared", finishLayers: [] });
  const b = stateRecord("b", 10, 10, { finishLayers: [] });
  const c = stateRecord("c", 10, 10, { objectUrl: "blob:shared", finishLayers: [] });
  const d = stateRecord("d", 10, 10, { finishLayers: [] });
  api.state.images = [a, b, c, d];
  api.state.selectedId = c.id;
  api.state.markedImageIds.add(a.id);
  api.state.markedImageIds.add(c.id);
  api.deleteMarkedImages();
  assert.deepEqual(plain(api.state.images.map((item) => item.id)), ["b", "d"]);
  assert.equal(api.state.selectedId, "d");
  assert.equal(api.state.markedImageIds.size, 0);
  assert.equal(revoked.filter((url) => url === "blob:shared").length, 0);
  forgetImageHistory(api);
  assert.equal(revoked.filter((url) => url === "blob:shared").length, 1);
  assert.match(elements.statusMessage.textContent, /2枚/);
});

test("bulk deletion retains a shared finish source until its last image reference is removed", () => {
  const revoked = [];
  const { api } = loadActionApi({
    URL: { revokeObjectURL(url) { revoked.push(url); } },
  });
  const sharedFinish = finishLayer("shared", { objectUrl: "blob:finish-shared" });
  const a = stateRecord("a", 10, 10, { objectUrl: "blob:main-shared", finishLayers: [sharedFinish] });
  const b = stateRecord("b", 10, 10, {
    objectUrl: "blob:main-shared",
    finishLayers: [{ ...sharedFinish, id: "shared-2" }],
  });
  api.state.images = [a, b];
  api.state.selectedId = a.id;
  api.state.filter.finishSourceUrls.add("blob:finish-shared");
  api.removeImagesByIds([a.id]);
  assert.equal(revoked.includes("blob:finish-shared"), false);
  assert.equal(revoked.includes("blob:main-shared"), false);
  api.removeImagesByIds([b.id]);
  assert.equal(revoked.length, 0, "history keeps both shared sources renderable");
  forgetImageHistory(api);
  assert.equal(revoked.filter((url) => url === "blob:finish-shared").length, 1);
  assert.equal(revoked.filter((url) => url === "blob:main-shared").length, 1);
});

test("the ARIA list owns image cards with listitem semantics", () => {
  const { api, elements } = loadActionApi();
  const item = stateRecord("subject", 10, 10);
  api.state.images = [item];
  api.state.selectedId = item.id;
  api.renderImageList();
  assert.equal(elements.imageList.children.length, 1);
  assert.equal(elements.imageList.children[0].getAttribute("role"), "listitem");
});

test("card keyboard handling does not cancel a nested remove button activation", () => {
  const { api, elements } = loadActionApi();
  const first = stateRecord("first", 10, 10);
  const second = stateRecord("second", 10, 10);
  api.state.images = [first, second];
  api.state.selectedId = first.id;
  api.renderImageList();
  const secondCard = elements.imageList.children[1];
  const removeButton = secondCard.children.find((child) => hasClass(child, "image-card__remove"));
  assert.ok(removeButton);
  let prevented = false;
  const event = {
    key: "Enter",
    altKey: false,
    target: removeButton,
    preventDefault() { prevented = true; },
  };
  for (const listener of secondCard.listeners.get("keydown") || []) listener.call(secondCard, event);
  assert.equal(prevented, false);
  assert.equal(api.state.selectedId, first.id);
});

test("returning to the empty state clears stale preview dimensions", () => {
  const { api, elements } = loadActionApi();
  elements.previewDimensions.textContent = "1920 × 1080 px";
  api.state.images = [];
  api.state.selectedId = null;
  api.updateEmptyState();
  assert.equal(elements.previewDimensions.textContent, "—");
});

test("all batch action buttons are disabled when there are no images", () => {
  const { api, elements } = loadActionApi();
  api.state.images = [];
  api.state.selectedId = null;
  api.updateActionAvailability();
  for (const id of [
    "applyCropAllBtn",
    "applyResizeAllBtn",
    "presetSquareAllBtn",
    "preset169AllBtn",
    "preset512AllBtn",
    "preset1920WidthAllBtn",
  ]) {
    assert.equal(elements[id].disabled, true, `#${id} should be disabled`);
  }
});

test("HTML contains every app.js control contract and local-only asset references", () => {
  const html = readFileSync(INDEX_PATH, "utf8");
  const source = readFileSync(APP_PATH, "utf8");
  const idsBlock = source.match(/const ids = \[([\s\S]*?)\];/);
  assert.ok(idsBlock, "Could not find app.js ids contract");
  const requiredIds = Array.from(idsBlock[1].matchAll(/"([A-Za-z][A-Za-z0-9]*)"/g), (match) => match[1]);
  const htmlIds = new Set(Array.from(html.matchAll(/\bid="([^"]+)"/g), (match) => match[1]));
  assert.deepEqual(requiredIds.filter((id) => !htmlIds.has(id)), []);
  assert.match(html, /<html\s+lang="ja"/i);
  assert.match(html, /<meta\s+charset="utf-8"/i);
  assert.match(html, /<script\s+src="app\.js"\s+defer><\/script>/i);
  assert.match(html, /<link\s+rel="stylesheet"\s+href="style\.css">/i);
  assert.match(html, /id="fileInput"[^>]+accept="[^"]*image\/png[^"]*image\/jpeg[^"]*image\/webp/i);
  assert.match(html, /id="fileInput"[^>]+multiple/i);
  assert.match(html, /id="canvasFileInput"[^>]+accept="[^"]*image\/png[^"]*image\/jpeg[^"]*image\/webp/i);
  assert.match(html, /id="canvasFileInput"[^>]+multiple/i);
  assert.deepEqual(
    Array.from(html.matchAll(/data-canvas-handle="([^"]+)"/g), (match) => match[1]).sort(),
    ["ne", "nw", "rotate", "se", "sw"],
  );
  assert.match(html, /id="canvasLayerList"[^>]+role="list"/i);
  const htmlWithoutDeclaredContact = html.replace('href="https://tetoriapot.sakura.ne.jp/index.html"', "");
  assert.doesNotMatch(htmlWithoutDeclaredContact, /(?:src|href)="https?:\/\//i);
});

test("HTML IDs, labels, ARIA references, and button types are internally consistent", () => {
  const html = readFileSync(INDEX_PATH, "utf8");
  const ids = Array.from(html.matchAll(/\bid="([^"]+)"/g), (match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, "HTML IDs must be unique");
  const idSet = new Set(ids);

  for (const match of html.matchAll(/\baria-(?:controls|labelledby|describedby)="([^"]+)"/g)) {
    for (const id of match[1].trim().split(/\s+/)) {
      assert.ok(idSet.has(id), `ARIA reference points to missing #${id}`);
    }
  }

  for (const match of html.matchAll(/<(input|select)\b([^>]*)>/gi)) {
    const attributes = match[2];
    const id = attributes.match(/\bid="([^"]+)"/)?.[1];
    assert.ok(id, `${match[1]} is missing an id`);
    const labelled = new RegExp(`<label\\b[^>]*\\bfor="${id}"`, "i").test(html)
      || /\baria-label="[^"]+"/i.test(attributes)
      || /\baria-labelledby="[^"]+"/i.test(attributes);
    assert.ok(labelled, `#${id} has no associated label or accessible name`);
  }

  for (const match of html.matchAll(/<button\b[^>]*>/gi)) {
    assert.match(match[0], /\btype="button"/i, `Button is missing type=button: ${match[0]}`);
  }
  const css = readFileSync(STYLE_PATH, "utf8");
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /@media\s*\(max-width:\s*960px\)/);
  assert.match(css, /\.canvas-selection-(?:box|handle)/);
  assert.match(css, /\.canvas-layer-row/);
});

test("preset dialog and bulk-selection UI are local, accessible, and preserve narrow image-card space", () => {
  const html = readFileSync(INDEX_PATH, "utf8");
  const css = readFileSync(STYLE_PATH, "utf8");
  assert.match(html, /id="imageBulkActions"[^>]+role="group"[^>]+aria-label="画像一覧の一括操作"/i);
  assert.match(html, /id="imageSelectAll"[^>]+type="checkbox"[^>]+aria-controls="imageList"[^>]+aria-describedby="imageSelectionCount"/i);
  assert.match(html, /id="imageSelectionCount"[^>]+aria-live="polite"[^>]*>0枚選択/i);

  assert.doesNotMatch(html, /\bid="settingsPresetOpenButton"/i);
  assert.doesNotMatch(html, /\bclass="[^"]*settings-preset-jump[^"]*"/i);

  const presetDialog = html.match(/<dialog\b(?=[^>]*\bid="processingPresetDialog")[^>]*>[\s\S]*?<\/dialog>/i)?.[0];
  assert.ok(presetDialog, "Missing #processingPresetDialog");
  for (const id of [
    "processingPresetSection",
    "processingPresetMode",
    "processingPresetName",
    "saveProcessingPresetBtn",
    "processingPresetSearch",
    "processingPresetSelect",
    "processingPresetList",
    "processingPresetEmpty",
    "processingPresetDialogStatus",
    "applyProcessingPresetBtn",
    "deleteProcessingPresetBtn",
  ]) {
    assert.match(presetDialog, new RegExp(`\\bid="${id}"`, "i"), `#${id} must remain inside the preset dialog`);
  }
  assert.match(presetDialog, /id="processingPresetSection"[^>]+aria-labelledby="processingPresetHeading"/i);
  assert.match(presetDialog, /id="processingPresetName"[^>]+maxlength="60"/i);
  assert.match(presetDialog, /id="processingPresetSearch"[^>]+type="search"/i);
  assert.match(presetDialog, /id="processingPresetList"[^>]+role="list"[^>]+aria-label="保存済み設定の一覧"/i);
  assert.match(presetDialog, /id="processingPresetDialogStatus"[^>]+role="status"[^>]+aria-live="polite"/i);
  assert.match(presetDialog, /この端末のブラウザ内/);
  assert.match(presetDialog, /プリセットはこのブラウザ内、作業ファイルはダウンロード先/);
  assert.match(presetDialog, /画像素材、仕上げ素材、キャンバスのレイヤー画像は保存されません/);

  const card = css.match(/\.image-card\s*\{([^}]*)\}/i)?.[1] || "";
  assert.ok(card, "Missing CSS rule for .image-card");
  assert.match(card, /grid-template-columns:\s*52px\s+minmax\(0,\s*1fr\)\s+30px/i);
  const checkbox = cssRuleBody(css, ".image-card__select");
  assert.match(checkbox, /position:\s*absolute/i);
  assert.match(checkbox, /z-index:\s*2/i);
});

test("header utility actions expose accessible native dialogs, help tabs, updates, and hover hints", () => {
  const html = readFileSync(INDEX_PATH, "utf8");
  const css = readFileSync(STYLE_PATH, "utf8");

  const utilityBar = html.match(/<nav\b[^>]*class="[^"]*utility-menu-bar[^"]*"[^>]*aria-label="ヘルプと設定"[^>]*>[\s\S]*?<\/nav>/i)?.[0];
  assert.ok(utilityBar, "Missing the header utility action bar");
  assert.doesNotMatch(utilityBar, /<details\b|<summary\b/i);
  assert.equal((utilityBar.match(/<button\b[^>]*class="utility-action(?:\s+[^"]*)?"[^>]*>/gi) || []).length, 3);

  for (const [buttonId, tooltipId, dialogId, label] of [
    ["updatesMenuButton", "updatesMenuTooltip", "updatesDialog", "更新情報"],
    ["helpMenuButton", "helpMenuTooltip", "helpDialog", "ヘルプ"],
    ["settingsMenuButton", "settingsMenuTooltip", "processingPresetDialog", "設定保存"],
  ]) {
    const button = utilityBar.match(new RegExp(`<button\\b(?=[^>]*\\bid="${buttonId}")[^>]*>[\\s\\S]*?<\\/button>`, "i"))?.[0];
    assert.ok(button, `Missing #${buttonId}`);
    const openingTag = button.match(/^<button\b[^>]*>/i)?.[0];
    assert.ok(openingTag, `Missing opening tag for #${buttonId}`);
    assert.match(openingTag, /\bclass="[^"]*utility-action[^"]*has-tooltip[^"]*"/i);
    assert.match(openingTag, /\btype="button"/i);
    assert.match(openingTag, /\baria-haspopup="dialog"/i);
    assert.match(openingTag, new RegExp(`\\baria-controls="${dialogId}"`, "i"));
    assert.match(openingTag, /\baria-expanded="false"/i);
    assert.match(openingTag, new RegExp(`\\baria-describedby="${tooltipId}"`, "i"));
    assert.match(button, new RegExp(`<span>\\s*${label}\\s*<\\/span>`, "i"));
    assert.match(
      button,
      new RegExp(`<span\\b[^>]*id="${tooltipId}"[^>]*class="[^"]*ui-tooltip[^"]*"[^>]*role="tooltip"`, "i"),
    );
  }

  const dialogBlocks = new Map();
  for (const [dialogId, titleId, descriptionId, closeId, footerCloseId] of [
    ["updatesDialog", "updatesDialogTitle", "updatesDialogDescription", "updatesDialogClose", "updatesDialogFooterClose"],
    ["helpDialog", "helpDialogTitle", "helpDialogDescription", "helpDialogClose", "helpDialogFooterClose"],
    ["processingPresetDialog", "processingPresetDialogTitle", "processingPresetDialogDescription", "processingPresetDialogClose", "processingPresetDialogFooterClose"],
  ]) {
    const dialog = html.match(new RegExp(`<dialog\\b(?=[^>]*\\bid="${dialogId}")[^>]*>[\\s\\S]*?<\\/dialog>`, "i"))?.[0];
    assert.ok(dialog, `Missing #${dialogId}`);
    dialogBlocks.set(dialogId, dialog);
    const openingTag = dialog.match(/^<dialog\b[^>]*>/i)?.[0];
    assert.match(openingTag, /\bclass="[^"]*app-dialog[^"]*"/i);
    assert.match(openingTag, /\baria-modal="true"/i);
    assert.match(openingTag, new RegExp(`\\baria-labelledby="${titleId}"`, "i"));
    assert.match(openingTag, new RegExp(`\\baria-describedby="${descriptionId}"`, "i"));
    assert.doesNotMatch(openingTag, /\bopen(?:\s|=|>)/i);
    assert.match(dialog, new RegExp(`\\bid="${titleId}"`, "i"));
    assert.match(dialog, new RegExp(`\\bid="${descriptionId}"`, "i"));
    assert.match(
      dialog,
      new RegExp(`<button\\b(?=[^>]*\\bid="${closeId}")(?=[^>]*\\btype="button")(?=[^>]*\\baria-label="[^"]*閉じる")[^>]*>`, "i"),
    );
    assert.match(
      dialog,
      new RegExp(`<button\\b(?=[^>]*\\bid="${footerCloseId}")(?=[^>]*\\btype="button")[^>]*>\\s*閉じる\\s*<\\/button>`, "i"),
    );
  }

  const helpDialog = dialogBlocks.get("helpDialog");
  assert.match(helpDialog, /class="[^"]*app-dialog__tabs[^"]*"[^>]+role="tablist"[^>]+aria-label="ヘルプの内容"/i);
  for (const [tabId, panelId, selected, tabIndex, hidden] of [
    ["helpUsageTab", "helpUsagePanel", "true", "0", false],
    ["helpShortcutsTab", "helpShortcutsPanel", "false", "-1", true],
  ]) {
    const tab = helpDialog.match(new RegExp(`<button\\b(?=[^>]*\\bid="${tabId}")[^>]*>`, "i"))?.[0];
    assert.ok(tab, `Missing #${tabId}`);
    assert.match(tab, /\btype="button"/i);
    assert.match(tab, /\brole="tab"/i);
    assert.match(tab, new RegExp(`\\baria-selected="${selected}"`, "i"));
    assert.match(tab, new RegExp(`\\baria-controls="${panelId}"`, "i"));
    assert.match(tab, new RegExp(`\\btabindex="${tabIndex}"`, "i"));
    const panel = helpDialog.match(new RegExp(`<section\\b(?=[^>]*\\bid="${panelId}")[^>]*>`, "i"))?.[0];
    assert.ok(panel, `Missing #${panelId}`);
    assert.match(panel, /\brole="tabpanel"/i);
    assert.match(panel, new RegExp(`\\baria-labelledby="${tabId}"`, "i"));
    if (hidden) assert.match(panel, /\bhidden\b/i);
    else assert.doesNotMatch(panel, /\bhidden\b/i);
  }

  const updatesDialog = dialogBlocks.get("updatesDialog");
  const updateDates = Array.from(updatesDialog.matchAll(/<time\b[^>]*\bdatetime="([^"]+)"/gi), (match) => match[1]);
  assert.ok(updateDates.length >= 2, "Updates dialog must expose dated entries");
  assert.ok(updateDates.every((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)), "Update dates must be machine readable");
  assert.deepEqual(updateDates, [...updateDates].sort((left, right) => right.localeCompare(left)));

  const contactTag = html.match(/<a\b(?=[^>]*\bid="contactLink")[^>]*>/i)?.[0];
  assert.ok(contactTag, "Missing #contactLink");
  assert.match(contactTag, /class="[^"]*dialog-contact-link[^"]*"/i);
  assert.match(contactTag, /href="https:\/\/tetoriapot\.sakura\.ne\.jp\/index\.html"/i);
  assert.match(contactTag, /target="_blank"/i);
  const rel = contactTag.match(/\brel="([^"]+)"/i)?.[1]?.toLowerCase().split(/\s+/) || [];
  assert.ok(rel.includes("noopener"), "external contact link must use rel=noopener");
  assert.ok(rel.includes("noreferrer"), "external contact link must use rel=noreferrer");
  assert.match(contactTag, /aria-label="[^"]*TeToriapot[^"]*新しいタブ[^"]*"/i);
  assert.match(helpDialog, /id="contactLink"[\s\S]*?TeToriapot/i);

  const tooltip = cssRuleBody(css, ".ui-tooltip");
  assert.match(tooltip, /(?:opacity:\s*0|visibility:\s*hidden)/i);
  for (const selector of [
    ".has-tooltip:hover > .ui-tooltip",
    ".has-tooltip:focus-visible > .ui-tooltip",
  ]) {
    const shown = cssRuleBody(css, selector);
    assert.match(shown, /opacity:\s*1\s*;/i, `${selector} must reveal the hint`);
    assert.match(shown, /visibility:\s*visible\s*;/i, `${selector} must reveal the hint`);
  }
});

test("dialog controls restore their opener on Escape and switch Help tabs accessibly", () => {
  const { api, elements } = loadActionApi();
  let openerFocusCount = 0;
  elements.helpMenuButton.focus = () => { openerFocusCount += 1; };

  assert.equal(api.dialogIsOpen(elements.helpDialog), false);
  elements.helpMenuButton.dispatchEvent({ type: "click" });
  assert.equal(api.dialogIsOpen(elements.helpDialog), true);
  assert.equal(elements.helpMenuButton.getAttribute("aria-expanded"), "true");

  let escapePrevented = false;
  elements.helpDialog.dispatchEvent({
    type: "keydown",
    key: "Escape",
    preventDefault() { escapePrevented = true; },
  });
  assert.equal(escapePrevented, true);
  assert.equal(api.dialogIsOpen(elements.helpDialog), false);
  assert.equal(elements.helpMenuButton.getAttribute("aria-expanded"), "false");
  assert.equal(openerFocusCount, 1);

  let shortcutFocusCount = 0;
  elements.helpShortcutsTab.focus = () => { shortcutFocusCount += 1; };
  api.setHelpTab("shortcuts", true);
  assert.equal(elements.helpUsageTab.getAttribute("aria-selected"), "false");
  assert.equal(elements.helpUsageTab.tabIndex, -1);
  assert.equal(elements.helpUsagePanel.hidden, true);
  assert.equal(elements.helpShortcutsTab.getAttribute("aria-selected"), "true");
  assert.equal(elements.helpShortcutsTab.tabIndex, 0);
  assert.equal(elements.helpShortcutsPanel.hidden, false);
  assert.equal(shortcutFocusCount, 1);

  api.setHelpTab("usage");
  assert.equal(elements.helpUsageTab.getAttribute("aria-selected"), "true");
  assert.equal(elements.helpUsagePanel.hidden, false);
  assert.equal(elements.helpShortcutsTab.getAttribute("aria-selected"), "false");
  assert.equal(elements.helpShortcutsPanel.hidden, true);

  let presetOpenerFocusCount = 0;
  elements.settingsMenuButton.focus = () => { presetOpenerFocusCount += 1; };
  assert.equal(api.openAppDialog(elements.processingPresetDialog, elements.settingsMenuButton), true);
  assert.equal(elements.settingsMenuButton.getAttribute("aria-expanded"), "true");
  assert.equal(api.closeAppDialog(elements.processingPresetDialog), true);
  assert.equal(elements.settingsMenuButton.getAttribute("aria-expanded"), "false");
  assert.equal(presetOpenerFocusCount, 1);
});

test("grid columns are entered as an explicitly bounded whole number", () => {
  const html = readFileSync(INDEX_PATH, "utf8");
  const input = html.match(/<input\b(?=[^>]*\bid="gridColumns")[^>]*>/i)?.[0];
  assert.ok(input, "#gridColumns must be an input rather than a short fixed select");
  assert.match(input, /\btype="number"/i);
  assert.match(input, /\bmin="1"/i);
  assert.match(input, /\bmax="20"/i);
  assert.match(input, /\bstep="1"/i);
  assert.match(input, /\binputmode="numeric"/i);
  assert.match(input, /\bvalue="2"/i);
});

test("mode navigation uses the requested order and user-facing names everywhere", () => {
  const html = readFileSync(INDEX_PATH, "utf8");
  const source = readFileSync(APP_PATH, "utf8");
  const modeNav = html.match(/<nav\b[^>]*class="mode-switch"[^>]*>([\s\S]*?)<\/nav>/i)?.[1] || "";
  const buttons = Array.from(modeNav.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi), (match) => ({
    id: match[1].match(/\bid="([^"]+)"/i)?.[1],
    label: match[2].replace(/<span\b[\s\S]*$/i, "").replace(/<[^>]+>/g, "").trim(),
  }));
  assert.deepEqual(buttons, [
    { id: "modeCombineBtn", label: "画像結合" },
    { id: "modeSplitBtn", label: "画像分割" },
    { id: "modeEditBtn", label: "画像編集" },
    { id: "modeCanvasBtn", label: "画像合成" },
    { id: "modeFilterBtn", label: "画像加工" },
  ]);
  assert.doesNotMatch(html, /キャンバス合成|フィルター加工/);
  assert.doesNotMatch(source, /キャンバス合成|フィルター加工/);

  const { elements } = loadActionApi();
  for (const [buttonId, label] of [
    ["modeCombineBtn", "画像結合"],
    ["modeSplitBtn", "画像分割"],
    ["modeEditBtn", "画像編集"],
    ["modeCanvasBtn", "画像合成"],
    ["modeFilterBtn", "画像加工"],
  ]) {
    elements[buttonId].dispatchEvent({ type: "click" });
    assert.equal(elements.processingPresetMode.textContent, label);
  }
});

test("split mode HTML exposes labelled row-column controls, preview, summary, and hover help", () => {
  const html = readFileSync(INDEX_PATH, "utf8");
  const css = readFileSync(STYLE_PATH, "utf8");
  const modeButton = html.match(/<button\b(?=[^>]*\bid="modeSplitBtn")[^>]*>[\s\S]*?<\/button>/i)?.[0];
  assert.ok(modeButton, "Missing #modeSplitBtn");
  assert.match(modeButton, /class="[^"]*mode-button[^"]*has-tooltip[^"]*"/i);
  assert.match(modeButton, /aria-pressed="false"/i);
  assert.match(modeButton, /aria-controls="standardAssetPanel splitSettings splitPreviewCanvas"/i);
  assert.match(modeButton, /aria-describedby="modeSplitTooltip"/i);
  assert.match(modeButton, /id="modeSplitTooltip"[^>]*role="tooltip"/i);

  assert.match(html, /id="splitSettings"[^>]*class="[^"]*settings-stack[^"]*is-hidden[^"]*"[^>]*hidden/i);
  assert.match(html, /id="splitPreviewCanvas"[^>]*class="[^"]*preview-canvas[^"]*is-hidden[^"]*"[^>]*aria-label="[^"]+"[^>]*aria-describedby="splitSummary"[^>]*hidden/i);
  assert.match(html, /id="splitSummary"[^>]*aria-live="polite"/i);
  for (const [id, value] of [["splitColumns", "2"], ["splitRows", "1"]]) {
    const input = html.match(new RegExp(`<input\\b(?=[^>]*\\bid="${id}")[^>]*>`, "i"))?.[0];
    assert.ok(input, id);
    assert.match(input, /type="number"/i);
    assert.match(input, /inputmode="numeric"/i);
    assert.match(input, /min="1"/i);
    assert.match(input, /max="20"/i);
    assert.match(input, /step="1"/i);
    assert.match(input, new RegExp(`value="${value}"`, "i"));
    assert.match(input, /aria-describedby="splitGridHelp"/i);
    assert.match(html, new RegExp(`<label\\b[^>]*for="${id}"`, "i"));
  }

  assert.match(cssRuleBody(css, ".mode-switch"), /grid-template-columns:\s*repeat\(5,\s*minmax\(/i);
  assert.match(cssRuleBody(cssMediaBlock(css, 1180), ".mode-switch"), /grid-template-columns:\s*repeat\(5,\s*minmax\(/i);
  const phone = cssMediaBlock(css, 620);
  assert.match(cssRuleBody(phone, ".mode-switch"), /grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)/i);
  assert.match(cssRuleBody(phone, ".mode-button:nth-child(-n + 2)"), /grid-column:\s*span\s+3/i);
  assert.match(cssRuleBody(phone, ".mode-button:nth-child(n + 3)"), /grid-column:\s*span\s+2/i);
  assert.match(cssRuleBody(css, ".split-summary"), /display:\s*block/i);
});

test("header dialog actions and modal surfaces fit tablet and phone viewports", () => {
  const css = readFileSync(STYLE_PATH, "utf8");
  const baseHeader = cssRuleBody(css, ".app-header");
  const baseControls = cssRuleBody(css, ".header-controls");
  assert.match(baseHeader, /justify-content:\s*space-between\s*;/i);
  assert.match(baseControls, /display:\s*flex\s*;/i);
  assert.match(baseControls, /gap:\s*\d+(?:\.\d+)?(?:px|rem)\s*;/i);
  assert.match(baseControls, /min-width:\s*0\s*;/i);

  const tablet = cssMediaBlock(css, 960);
  const tabletControls = cssRuleBody(tablet, ".header-controls");
  assert.match(tabletControls, /(?:width:\s*100%|flex-wrap:\s*wrap|flex-direction:\s*column)\s*;/i);

  const phone = cssMediaBlock(css, 620);
  const phoneHeader = cssRuleBody(phone, ".app-header");
  assert.match(phoneHeader, /display:\s*grid\s*;/i);
  assert.match(phoneHeader, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*;/i);
  const phoneControls = cssRuleBody(phone, ".header-controls");
  assert.match(phoneControls, /display:\s*grid\s*;/i);
  assert.match(phoneControls, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*;/i);
  assert.match(phoneControls, /align-items:\s*stretch\s*;/i);
  assert.match(phoneControls, /width:\s*100%\s*;/i);
  const phoneMenuBar = cssRuleBody(phone, ".utility-menu-bar");
  assert.match(phoneMenuBar, /width:\s*100%\s*;/i);
  assert.match(phoneMenuBar, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)\s*;/i);

  const dialog = cssRuleBody(css, ".app-dialog");
  assert.match(dialog, /width:\s*min\(860px,\s*calc\(100vw\s*-\s*32px\)\)\s*;/i);
  assert.match(dialog, /max-height:\s*calc\(100dvh\s*-\s*32px\)\s*;/i);
  assert.match(dialog, /overflow:\s*hidden\s*;/i);
  assert.match(cssRuleBody(css, ".app-dialog__body"), /overflow:\s*auto\s*;/i);
  assert.match(cssRuleBody(css, ".app-dialog::backdrop"), /background:\s*rgb\(/i);

  const phoneDialog = cssRuleBody(phone, ".app-dialog");
  assert.match(phoneDialog, /width:\s*calc\(100vw\s*-\s*32px\)\s*;/i);
  assert.match(phoneDialog, /max-height:\s*calc\(100dvh\s*-\s*16px\)\s*;/i);
  assert.match(cssRuleBody(phone, ".help-card-grid"), /grid-template-columns:\s*1fr\s*;/i);
  assert.match(cssRuleBody(phone, ".preset-dialog-grid"), /grid-template-columns:\s*1fr\s*;/i);
});

test("filter HTML exposes all presets, ranges, comparison, batch actions, and accessible relationships", () => {
  const html = readFileSync(INDEX_PATH, "utf8");
  assert.match(
    html,
    /id="modeFilterBtn"[\s\S]*?aria-pressed="false"[\s\S]*?aria-controls="standardAssetPanel filterSettings filterPreviewCanvas"/i,
  );
  assert.match(html, /id="filterPreviewCanvas"[^>]+aria-label="[^"]+"/i);
  assert.deepEqual(
    Array.from(html.matchAll(/data-filter-time="([^"]+)"/g), (match) => match[1]).sort(),
    ["day", "evening", "morning", "night", "none"],
  );
  assert.deepEqual(
    Array.from(html.matchAll(/data-filter-effect="([^"]+)"/g), (match) => match[1]).sort(),
    ["monochrome", "none", "oil", "poster", "sepia"],
  );
  assert.match(html, /class="[^"]*filter-time-grid[^"]*"[^>]+role="group"[^>]+aria-labelledby="filterTimeHeading"/i);
  assert.match(html, /class="[^"]*filter-effect-grid[^"]*"[^>]+role="group"[^>]+aria-labelledby="filterEffectHeading"/i);
  assert.match(html, /id="filterIntensity"[^>]+min="0"[^>]+max="100"[^>]+value="70"/i);
  assert.match(html, /id="filterPosterLevels"[^>]+min="2"[^>]+max="16"[^>]+value="6"/i);
  assert.match(html, /id="filterCompareBtn"[^>]+aria-pressed="false"[^>]+aria-describedby="filterCompareHelp"/i);
  assert.match(html, /id="filterExportVariantsBtn"[^>]+aria-describedby="filterVariantsHelp"/i);
  for (const id of [
    "filterBrightness",
    "filterContrast",
    "filterSaturation",
    "filterTemperature",
    "filterTint",
    "filterHighlights",
    "filterShadows",
  ]) {
    assert.match(html, new RegExp(`id="${id}"[^>]+min="-100"[^>]+max="100"`, "i"));
  }
  const css = readFileSync(STYLE_PATH, "utf8");
  assert.match(css, /\.filter-preview-canvas/);
  assert.match(css, /\.filter-preset-button/);
  assert.match(css, /\.filter-compare-button/);
});

test("finish HTML exposes local multi-load, accessible layer controls, frame modes, gestures, and both batch actions", () => {
  const html = readFileSync(INDEX_PATH, "utf8");
  for (const id of [
    "filterFinishInput",
    "filterFinishAddBtn",
    "filterFinishLayerList",
    "filterFinishLayerCount",
    "filterFinishEmpty",
    "filterFinishName",
    "filterFinishX",
    "filterFinishY",
    "filterFinishWidth",
    "filterFinishHeight",
    "filterFinishKeepAspect",
    "filterFinishRotation",
    "filterFinishOpacity",
    "filterFinishOpacityValue",
    "filterFinishBlendMode",
    "filterFinishPlacement",
    "filterFinishFrameBtn",
    "filterFinishFitMode",
    "filterFinishVisibilityBtn",
    "filterFinishDeleteBtn",
    "filterFinishBringFrontBtn",
    "filterFinishForwardBtn",
    "filterFinishBackwardBtn",
    "filterFinishSendBackBtn",
    "filterFinishFitCanvasBtn",
    "filterFinishFitWidthBtn",
    "filterFinishFitHeightBtn",
    "filterFinishPlaceCenterBtn",
    "filterFinishPlaceTopLeftBtn",
    "filterFinishPlaceTopRightBtn",
    "filterFinishPlaceBottomLeftBtn",
    "filterFinishPlaceBottomRightBtn",
    "filterApplyFinishAllBtn",
    "filterApplyFilterFinishAllBtn",
    "filterFinishSelectionBox",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`, "i"), id);
  }
  assert.match(
    html,
    /id="filterFinishInput"[\s\S]*?type="file"[\s\S]*?accept="[^"]*image\/png[^"]*image\/jpeg[^"]*image\/webp[^"]*"[\s\S]*?multiple/i,
  );
  assert.match(html, /id="filterFinishLayerList"[^>]+role="list"[^>]+aria-label="[^"]*上ほど手前/i);
  assert.match(html, /class="filter-finish-description"/i);
  assert.match(html, /class="[^"]*filter-finish-add-button[^"]*"/i);
  assert.match(html, /class="[^"]*filter-finish-order-help[^"]*"/i);
  assert.match(html, /id="filterFinishFrameBtn"[^>]+type="button"[^>]+aria-pressed="false"[^>]+aria-describedby="filterFinishFrameHelp"/i);
  assert.match(html, /id="filterFinishVisibilityBtn"[^>]+type="button"[^>]+aria-pressed="true"/i);
  assert.deepEqual(
    Array.from(html.matchAll(/<option value="(stretch|center|cover|contain)"/g), (match) => match[1]),
    ["stretch", "center", "cover", "contain"],
  );
  assert.deepEqual(
    Array.from(html.matchAll(/data-finish-handle="(nw|ne|sw|se|rotate)"/g), (match) => match[1]).sort(),
    ["ne", "nw", "rotate", "se", "sw"],
  );
  assert.match(html, /id="filterFinishSelectionBox"[\s\S]*?role="group"[\s\S]*?tabindex="0"[\s\S]*?aria-label="[^"]+"/i);
  assert.match(html, /id="filterFinishOpacity"[^>]+type="range"[^>]+min="0"[^>]+max="100"/i);
  assert.match(html, /id="filterFinishBlendMode"[\s\S]*?value="normal"[\s\S]*?value="multiply"[\s\S]*?value="screen"[\s\S]*?value="overlay"/i);
  assert.match(html, /id="filterFinishPlacement"[\s\S]*?value="front"[\s\S]*?value="behind"/i);
  const css = readFileSync(STYLE_PATH, "utf8");
  assert.match(css, /\.filter-finish-layer-row/);
  assert.match(css, /\.filter-finish-base-row/);
  assert.match(css, /\.filter-finish-selection-box/);
  assert.match(css, /#filterFinishFrameBtn\[aria-pressed="true"\]/);
  assert.match(cssRuleBody(css, ".filter-finish-heading-row"), /margin-bottom:\s*14px/i);
  assert.match(cssRuleBody(css, ".filter-finish-heading-row .eyebrow"), /margin-bottom:\s*3px/i);
  assert.match(
    cssRuleBody(css, ".filter-finish-section > .filter-finish-description"),
    /margin:\s*0\s+0\s+16px/i,
  );
  assert.match(
    cssRuleBody(css, ".filter-finish-section > .filter-finish-order-help"),
    /margin:\s*14px\s+2px\s+10px/i,
  );
});

test("numeric form grids keep every label and unit input aligned", () => {
  const css = readFileSync(STYLE_PATH, "utf8");
  const inputGrid = cssRuleBody(css, ".input-grid");
  const gridField = cssRuleBody(css, ".input-grid > .field");
  const field = cssRuleBody(css, ".field");
  const numberInput = cssRuleBody(css, 'input[type="number"]');
  const unitWrapper = cssRuleBody(css, ".input-with-unit");
  const unitInput = cssRuleBody(css, ".input-with-unit input");
  const unitLabel = cssRuleBody(css, ".input-with-unit span");

  assert.match(inputGrid, /display:\s*grid\s*;/i);
  assert.match(inputGrid, /align-items:\s*(?:start|flex-start|end|flex-end)\s*;/i, "grid cells must share an explicit edge");
  assert.match(gridField, /margin-top:\s*0\s*;/i, "adjacent .field spacing must not offset grid cells");
  assert.match(`${field}\n${gridField}`, /min-width:\s*0\s*;/i, "grid inputs must be allowed to shrink without overflow");

  assert.match(unitWrapper, /position:\s*relative\s*;/i);
  assert.match(numberInput, /display:\s*block\s*;/i);
  assert.match(numberInput, /width:\s*100%\s*;/i);
  assert.match(unitInput, /padding-right:\s*\d+(?:\.\d+)?(?:px|rem)\s*;/i);
  assert.match(unitLabel, /position:\s*absolute\s*;/i);
  assert.match(unitLabel, /top:\s*50%\s*;/i);
  assert.match(unitLabel, /right:\s*\d+(?:\.\d+)?(?:px|rem)\s*;/i);
  assert.match(unitLabel, /pointer-events:\s*none\s*;/i);
});

test("viewport shell and responsive footer cannot leave an empty page tail", () => {
  const html = readFileSync(INDEX_PATH, "utf8");
  const css = readFileSync(STYLE_PATH, "utf8");
  const appShell = cssRuleBody(css, ".app-shell");
  const actionBar = cssRuleBody(css, ".action-bar");

  assert.match(
    html,
    /<div\b[^>]*class="[^"]*\bapp-shell\b[^"]*"[^>]*>[\s\S]*?<main\b[\s\S]*?<\/main>\s*<footer\b[^>]*class="[^"]*\baction-bar\b[^"]*"[\s\S]*?<\/footer>\s*<\/div>/i,
    "the action bar must be the final row inside the app shell",
  );
  assert.match(appShell, /display:\s*grid\s*;/i);
  assert.match(appShell, /grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)\s+auto\s*;/i);
  assert.match(appShell, /(?:height|min-height):\s*(?:100%|100vh|100dvh)\s*;/i);
  const viewportSizing = `${cssRuleBody(css, "html")}\n${cssRuleBody(css, "body")}\n${appShell}`;
  assert.match(viewportSizing, /(?:height|min-height):\s*100vh\s*;/i);
  assert.match(viewportSizing, /(?:height|min-height):\s*100dvh\s*;/i);
  assert.match(actionBar, /width:\s*100%\s*;/i);
  assert.match(actionBar, /flex-shrink:\s*0\s*;/i);

  const tablet = cssMediaBlock(css, 960);
  const tabletShell = cssRuleBody(tablet, ".app-shell");
  const tabletActionBar = cssRuleBody(tablet, ".action-bar");
  const tabletFooterActions = cssRuleBody(tablet, ".footer-actions");
  assert.doesNotMatch(tabletShell, /display:\s*block\s*;/i, "block layout lets the footer stop above the viewport edge");
  assert.match(tabletShell, /display:\s*(?:grid|flex)\s*;/i);
  assert.match(tabletShell, /min-height:\s*100vh\s*;/i);
  assert.match(tabletShell, /min-height:\s*100dvh\s*;/i);
  assert.match(tabletActionBar, /flex-direction:\s*column\s*;/i);
  assert.match(tabletActionBar, /align-items:\s*stretch\s*;/i);
  assert.match(tabletFooterActions, /flex-wrap:\s*wrap\s*;/i);

  const phone = cssMediaBlock(css, 620);
  assert.match(cssRuleBody(phone, ".four-columns"), /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*;/i);
  assert.match(cssRuleBody(phone, ".footer-actions"), /display:\s*grid\s*;/i);
  assert.match(cssRuleBody(phone, ".footer-actions"), /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*;/i);
  assert.match(cssRuleBody(phone, ".export-button"), /grid-column:\s*1\s*\/\s*-1\s*;/i);
});

test("image history restores resize, filter, finish and deleted sources with independent values", () => {
  const revoked = [];
  const { api, elements } = loadActionApi({ URL: { revokeObjectURL: (url) => revoked.push(url) } });
  const item = stateRecord("history", 100, 80, { filter: { adjustments: { brightness: 12 } }, finishLayers: [finishLayer("frame")] });
  api.state.images = [item]; api.state.selectedId = item.id;
  api.state.filter.finishSourceUrls.add("blob:frame");
  forgetImageHistory(api);
  api.setSelectedResize(50, 40, false);
  assert.equal(api.state.imageHistory.past.length, 1);
  api.state.markedImageIds.add(item.id);
  api.deleteMarkedImages();
  assert.equal(api.state.images.length, 0);
  assert.equal(elements.undoRemovalBtn.hidden, false);
  assert.equal(revoked.length, 0);
  assert.equal(api.travelImageHistory("undo"), true);
  assert.equal(api.state.images[0].resize.width, 50);
  assert.equal(api.state.images[0].filter.adjustments.brightness, 12);
  assert.equal(api.state.images[0].finishLayers[0].objectUrl, "blob:frame");
  assert.equal(api.travelImageHistory("undo"), true);
  assert.equal(api.state.images[0].resize.width, null);
  assert.equal(api.travelImageHistory("redo"), true);
  assert.equal(api.state.images[0].resize.width, 50);
  api.setSelectedResize(25, 20, false);
  assert.equal(api.state.imageHistory.future.length, 0, "new changes invalidate redo");
  assert.equal(item.resize.width, 50, "restored states do not reuse mutable records");
});

test("history coalesces a focused numeric edit and releases sources after forty later changes", () => {
  const revoked = [];
  const { api, elements, document } = loadActionApi({ URL: { revokeObjectURL: (url) => revoked.push(url) } });
  const item = stateRecord("expire", 100, 80, { finishLayers: [] });
  api.state.images = [item]; api.state.selectedId = item.id;
  forgetImageHistory(api);
  document.activeElement = { id: "resizeWidth", matches: () => true };
  api.setSelectedResize(50, 40, false);
  api.setSelectedResize(60, 48, false);
  assert.equal(api.state.imageHistory.past.length, 1);
  document.activeElement = null;
  api.removeImagesByIds([item.id]);
  assert.equal(revoked.length, 0);
  for (let index = 0; index < 42; index += 1) { elements.gapSize.value = String(index + 1); api.recordImageHistory(); }
  assert.equal(api.state.imageHistory.past.length, 40);
  assert.deepEqual(revoked, [item.objectUrl]);
});

test("selected bulk operations leave every unchecked image unchanged and undo as one change", () => {
  const { api } = loadActionApi();
  const source = stateRecord("source", 100, 80, { resize: { width: 50, height: 40, keepAspect: false }, filter: { adjustments: { brightness: 20 } }, finishLayers: [finishLayer("texture")] });
  const target = stateRecord("target", 200, 160, { finishLayers: [] });
  const untouched = stateRecord("untouched", 300, 200, { finishLayers: [] });
  api.state.images = [source, target, untouched]; api.state.selectedId = source.id;
  api.state.markedImageIds.add(target.id);
  forgetImageHistory(api);
  assert.equal(api.applyMarkedBatch("resize"), true);
  assert.equal(target.resize.width, 50);
  assert.equal(untouched.resize.width, null);
  assert.equal(api.state.imageHistory.past.length, 1);
  api.travelImageHistory("undo");
  assert.equal(api.state.images[1].resize.width, null);
  assert.equal(api.applyMarkedBatch("filter"), true);
  assert.equal(api.state.images[1].filter.adjustments.brightness, 20);
  assert.equal(api.state.images[2].filter.adjustments.brightness, 0);
  assert.equal(api.state.images[2].finishLayers.length, 0);
});

test("workspace source cleanup respects assets shared between image and canvas histories", () => {
  const revoked = [];
  const { api } = loadActionApi({ URL: { revokeObjectURL: (url) => revoked.push(url) } });
  api.state.images = [stateRecord("main", 10, 10, { objectUrl: "blob:shared" })];
  api.state.canvas.layers = [canvasLayer("canvas", { objectUrl: "blob:shared" })];
  api.state.canvas.sourceUrls.add("blob:shared");
  api.recordImageHistory();
  api.removeImagesByIds(["main"]);
  forgetImageHistory(api);
  assert.deepEqual(revoked, []);
  api.state.canvas.layers = [];
  api.state.canvas.history = [];
  api.sweepCanvasSourceUrls(); api.sweepImageSourceUrls();
  assert.deepEqual(revoked, ["blob:shared"], "a shared URL is released once");
});

test("project JSON roundtrip preserves materials, crop, finish placement and canvas layout", async () => {
  const { api, elements } = loadActionApi();
  const file = new File([new Uint8Array([1, 2, 3, 4])], "素材.png", { type: "image/png" });
  const image = { naturalWidth: 100, naturalHeight: 80 };
  const common = { file, image, objectUrl: "blob:one" };
  const main = stateRecord("main", 100, 80, { ...common, crop: { x: 10, y: 5, width: 60, height: 40 }, filter: { adjustments: { brightness: 23 } }, finishLayers: [finishLayer("finish", { ...common, placement: "behind", opacity: 0.4 })] });
  api.state.images = [main]; api.state.selectedId = main.id;
  api.state.canvas.layers = [canvasLayer("layer", { ...common, x: 45, rotation: 20, opacity: 0.7 })];
  elements.combineDirection.value = "vertical";
  elements.splitColumns.value = "3"; elements.splitRows.value = "2";
  const saved = await api.createProjectDocument();
  assert.equal(saved.assets.length, 1, "shared source is embedded only once");
  assert.equal(saved.assets[0].data, "AQIDBA==");
  assert.equal(saved.combine.direction, "vertical");
  const document = api.validateProjectDocument(JSON.parse(JSON.stringify(saved)));
  const sources = new Map([[saved.assets[0].id, { ...common, fileName: file.name, naturalWidth: 100, naturalHeight: 80 }]]);
  const restored = api.unpackProject(document, sources);
  assert.deepEqual(plain(restored.images[0].crop), { x: 10, y: 5, width: 60, height: 40 });
  assert.equal(restored.images[0].filter.adjustments.brightness, 23);
  assert.equal(restored.images[0].finishLayers[0].placement, "behind");
  assert.equal(restored.images[0].finishLayers[0].opacity, 0.4);
  assert.equal(restored.canvas.layers[0].x, 45);
  assert.equal(restored.canvas.layers[0].rotation, 20);
  assert.equal(restored.canvas.layers[0].opacity, 0.7);
  assert.equal(JSON.stringify(saved).includes("blob:"), false);
});

test("project validation rejects external sources, duplicate ids and corrupted references", () => {
  const api = loadPureApi();
  const valid = { schema: "image-tool-project", version: 1, assets: [{ id: "a", type: "image/png", data: "AQIDBA==" }], images: [{ id: "i", asset: "a", finishLayers: [] }], canvas: { layers: [] } };
  assert.equal(api.validateProjectDocument(valid), valid);
  for (const change of [
    (value) => { value.assets[0].type = "image/svg+xml"; },
    (value) => { value.assets[0].data = "https://invalid.example/image.png"; },
    (value) => { value.assets.push({ ...value.assets[0] }); },
    (value) => { value.images[0].asset = "missing"; },
    (value) => { value.version = 999; },
  ]) {
    const value = structuredClone(valid); change(value);
    assert.throws(() => api.validateProjectDocument(value));
  }
});

test("failed project image decode keeps the current workspace and releases staged URLs", async () => {
  const harness = createLoadHarness();
  const { api, elements } = loadActionApi({ Image: harness.Image, URL: harness.URL });
  const original = stateRecord("original", 10, 10);
  api.state.images = [original]; api.state.selectedId = original.id;
  api.state.pendingProject = { schema: "image-tool-project", version: 1, assets: [{ id: "a", type: "image/png", name: "broken.png", data: "AQIDBA==" }], images: [], canvas: { layers: [] } };
  const opening = api.openPendingProject();
  await flushMicrotasks();
  harness.instances[0].fail();
  assert.equal(await opening, false);
  assert.equal(api.state.images[0], original);
  assert.equal(api.state.exporting, false);
  assert.equal(harness.revoked.length, 1);
  assert.match(elements.projectStatus.textContent, /読み込めない/);
});

test("ZIP output contains valid stored records, UTF-8 names, unique names and matching checksums", async () => {
  const { api } = loadActionApi();
  assert.equal(api.zipCrc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  const blob = await api.createImageZip([
    { fileName: "素材.png", blob: new Blob(["abc"]) },
    { fileName: "素材.png", blob: new Blob(["defg"]) },
    { fileName: "../unsafe.png", blob: new Blob(["x"]) },
  ]);
  const bytes = new Uint8Array(await blob.arrayBuffer()), view = new DataView(bytes.buffer);
  const names = [], contents = [];
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true), nameLength = view.getUint16(offset + 26, true);
    assert.equal(view.getUint16(offset + 6, true), 0x800);
    const data = bytes.slice(offset + 30 + nameLength, offset + 30 + nameLength + size);
    assert.equal(view.getUint32(offset + 14, true), api.zipCrc32(data));
    names.push(new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + nameLength)));
    contents.push(new TextDecoder().decode(data));
    offset += 30 + nameLength + size;
  }
  assert.deepEqual(names, ["素材.png", "素材_2.png", "__unsafe.png"]);
  assert.deepEqual(contents, ["abc", "defg", "x"]);
  assert.equal(view.getUint32(offset, true), 0x02014b50);
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
  assert.equal(view.getUint32(bytes.length - 6, true), offset);
  assert.equal(view.getUint16(bytes.length - 12, true), 3);
});

test("project import commits decoded images and canvas atomically, resets histories and retains presets", async () => {
  const harness = createLoadHarness();
  const { api, elements } = loadActionApi({ Image: harness.Image, URL: harness.URL });
  api.state.images = [stateRecord("old", 10, 10)]; api.state.selectedId = "old";
  api.state.processingPresets = [{ id: "existing", name: "keep", mode: "combine", updatedAt: 1 }];
  api.recordImageHistory();
  api.state.pendingProject = {
    schema: "image-tool-project", version: 1, mode: "edit", selectedId: "new",
    assets: [{ id: "a", type: "image/png", name: "new.png", data: "AQIDBA==" }],
    images: [{ id: "new", fileName: "new.png", asset: "a", crop: { x: 10, y: 5, width: 60, height: 40 }, resize: { width: 30, height: 20, keepAspect: false }, filter: { adjustments: { brightness: 20 } }, finishLayers: [] }],
    canvas: { width: 600, height: 400, backgroundMode: "white", layers: [{ id: "canvas", name: "layer", asset: "a", x: 15, y: 30, width: 100, height: 80 }] },
    combine: { direction: "vertical", gap: 8, output: { format: "webp", quality: 70 } }, split: { columns: 3, rows: 2 },
  };
  const opening = api.openPendingProject(); await flushMicrotasks();
  assert.equal(api.state.images[0].id, "old", "existing work remains until decode finishes");
  harness.instances[0].succeed(100, 80);
  assert.equal(await opening, true);
  assert.equal(api.state.mode, "edit");
  assert.equal(api.state.images[0].resize.width, 30);
  assert.equal(api.state.images[0].filter.adjustments.brightness, 20);
  assert.equal(api.state.canvas.layers[0].x, 15);
  assert.equal(api.state.canvas.width, 600);
  assert.equal(elements.combineDirection.value, "vertical");
  assert.equal(elements.outputFormat.value, "webp");
  assert.equal(elements.splitColumns.value, "3");
  assert.equal(api.state.imageHistory.past.length, 0);
  assert.equal(api.state.canvas.history.length, 0);
  assert.equal(api.state.processingPresets[0].id, "existing");
  assert.equal(harness.revoked.includes("blob:old"), true);
  assert.equal(harness.revoked.includes(api.state.images[0].objectUrl), false);
  assert.match(elements.statusMessage.textContent, /復元/);
});

test("project preparation rejects corrupt JSON without touching current material or creating URLs", async () => {
  const { api, elements } = loadActionApi();
  const original = stateRecord("original", 50, 50);
  api.state.images = [original];
  assert.equal(await api.prepareProjectImport(new File(["{broken"], "broken.json")), false);
  assert.equal(api.state.images[0], original);
  assert.equal(api.state.pendingProject, null);
  assert.equal(api.state.exporting, false);
  assert.match(elements.projectStatus.textContent, /読み取れません/);
});

test("product sources allow only the declared TeToriapot contact URL and no external requests", () => {
  const files = [APP_PATH, INDEX_PATH, STYLE_PATH];
  const allowedContact = "https://tetoriapot.sakura.ne.jp/index.html";
  const remoteUrls = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource)\s*\(/, path.basename(file));
    for (const match of source.matchAll(/https?:\/\/[^"'\s)<]+/gi)) {
      remoteUrls.push({ file: path.basename(file), url: match[0] });
    }
    assert.doesNotMatch(source, /(?:src|url\s*\()\s*["']?https?:\/\//i, `${path.basename(file)} must not load a remote asset`);
    assert.doesNotMatch(source, /@import\s+(?:url\s*\()?\s*["']?https?:\/\//i, path.basename(file));
  }
  assert.deepEqual(remoteUrls, [{ file: "index.html", url: allowedContact }]);
});
