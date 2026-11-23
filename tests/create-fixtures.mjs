// Deterministic local-only images for browser smoke testing.
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
const directory = new URL("./fixtures/", import.meta.url);
mkdirSync(directory, { recursive: true });
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const prefix = Buffer.alloc(4), suffix = Buffer.alloc(4);
  prefix.writeUInt32BE(data.length);
  const content = Buffer.concat([Buffer.from(type), data]);
  suffix.writeUInt32BE(crc32(content));
  return Buffer.concat([prefix, content, suffix]);
}
for (let sample = 0; sample < 3; sample++) {
  const width = 320, height = 200, pixels = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = y * (width * 4 + 1) + 1 + x * 4;
    pixels[index] = sample === 1 ? 240 : 50;
    pixels[index + 1] = x < width / 2 ? 120 : 190;
    pixels[index + 2] = sample === 0 ? 230 : 90;
    pixels[index + 3] = sample === 2 && x > 20 && x < 300 && y > 20 && y < 180 ? 0 : 255;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]);
  writeFileSync(new URL(`sample-${sample + 1}.png`, directory), png);
}

function gifImageData(width, height, leftColor, rightColor) {
  const descriptor = Buffer.alloc(10);
  descriptor[0] = 0x2c;
  descriptor.writeUInt16LE(width, 5);
  descriptor.writeUInt16LE(height, 7);
  // An eight-color palette uses four-bit LZW codes. Clearing before each pixel
  // keeps these small fixtures deterministic without a growing dictionary.
  const codes = Buffer.alloc(width * height + 1);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const border = x < 8 || x >= width - 8 || y < 8 || y >= height - 8;
    const color = border ? 0 : x < width / 2 ? leftColor : rightColor;
    codes[y * width + x] = 8 | (color << 4);
  }
  codes[codes.length - 1] = 9;
  const blocks = [descriptor, Buffer.from([3])];
  for (let offset = 0; offset < codes.length; offset += 255) {
    const block = codes.subarray(offset, offset + 255);
    blocks.push(Buffer.from([block.length]), block);
  }
  blocks.push(Buffer.from([0]));
  return Buffer.concat(blocks);
}

function createGif(animated) {
  const width = 64, height = 40;
  const screen = Buffer.alloc(7);
  screen.writeUInt16LE(width);
  screen.writeUInt16LE(height, 2);
  screen[4] = 0xa2;
  const palette = Buffer.from([
    255, 255, 255, 255, 0, 0, 0, 255, 0, 0, 0, 255,
    255, 255, 0, 255, 0, 255, 0, 255, 255, 0, 0, 0,
  ]);
  const blocks = [Buffer.from(animated ? "GIF89a" : "GIF87a"), screen, palette];
  if (animated) {
    blocks.push(Buffer.from([0x21, 0xff, 11]), Buffer.from("NETSCAPE2.0"), Buffer.from([3, 1, 0, 0, 0]));
    for (const [leftColor, rightColor] of [[1, 2], [3, 4]]) {
      // Restore the transparent background between frames; display each for 300 ms.
      blocks.push(Buffer.from([0x21, 0xf9, 4, 9, 30, 0, 0, 0]));
      blocks.push(gifImageData(width, height, leftColor, rightColor));
    }
  } else {
    blocks.push(gifImageData(width, height, 1, 2));
  }
  blocks.push(Buffer.from([0x3b]));
  return Buffer.concat(blocks);
}

writeFileSync(new URL("sample-static.gif", directory), createGif(false));
writeFileSync(new URL("sample-animated.gif", directory), createGif(true));
console.log(fileURLToPath(directory));
