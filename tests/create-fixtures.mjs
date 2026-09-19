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
console.log(fileURLToPath(directory));
