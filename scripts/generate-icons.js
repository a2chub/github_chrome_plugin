#!/usr/bin/env node
/**
 * Generate simple PNG icons for the Chrome extension.
 * Uses only Node.js standard libraries (no external dependencies).
 *
 * Generates a GitHub-themed icon: a dark background (#24292e) square
 * with a lighter accent border (#58a6ff) to represent the
 * "GitHub Dashboard Customizer" extension.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/**
 * Create a minimal valid PNG file with the given pixel data.
 * PNG specification: http://www.w3.org/TR/PNG/
 */
function createPNG(width, height, pixelRows) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type: RGB
  ihdrData[10] = 0; // compression method
  ihdrData[11] = 0; // filter method
  ihdrData[12] = 0; // interlace method
  const ihdr = createChunk('IHDR', ihdrData);

  // IDAT chunk - image data
  // Each row is prefixed with a filter byte (0 = None)
  const rawData = Buffer.concat(pixelRows.map((row, y) => {
    const filterByte = Buffer.from([0]); // no filter
    return Buffer.concat([filterByte, row]);
  }));
  const compressed = zlib.deflateSync(rawData);
  const idat = createChunk('IDAT', compressed);

  // IEND chunk
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

/**
 * Create a PNG chunk with type, data, and CRC.
 */
function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcInput);

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

/**
 * CRC-32 calculation for PNG chunks.
 */
function crc32(data) {
  // Build CRC table
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xEDB88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    table[n] = c;
  }

  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Generate icon pixel data.
 *
 * Design:
 *   - Background: GitHub dark (#24292e)
 *   - Border: GitHub blue accent (#58a6ff), 1-2px depending on size
 *   - Center: A small "G" shape approximation using lighter color (#c9d1d9)
 *     For small sizes, just a contrasting inner square.
 */
function generateIconPixels(size) {
  const bgR = 0x24, bgG = 0x29, bgB = 0x2e;       // dark background
  const borderR = 0x58, borderG = 0xa6, borderB = 0xff; // blue border
  const fgR = 0xc9, fgG = 0xd1, fgB = 0xd9;       // light foreground

  const borderWidth = size <= 16 ? 1 : size <= 48 ? 2 : 4;
  const rows = [];

  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(size * 3);
    for (let x = 0; x < size; x++) {
      const offset = x * 3;
      const isBorder = (x < borderWidth || x >= size - borderWidth ||
                        y < borderWidth || y >= size - borderWidth);

      if (isBorder) {
        row[offset] = borderR;
        row[offset + 1] = borderG;
        row[offset + 2] = borderB;
      } else if (isGShape(x, y, size, borderWidth)) {
        row[offset] = fgR;
        row[offset + 1] = fgG;
        row[offset + 2] = fgB;
      } else {
        row[offset] = bgR;
        row[offset + 1] = bgG;
        row[offset + 2] = bgB;
      }
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Determine if pixel (x, y) is part of the "G" letter shape.
 * The G is drawn relative to the inner area (inside the border).
 */
function isGShape(x, y, size, borderWidth) {
  // Inner area
  const innerX = x - borderWidth;
  const innerY = y - borderWidth;
  const innerSize = size - 2 * borderWidth;

  if (innerSize <= 0) return false;

  // Normalize to 0..1 range
  const nx = innerX / innerSize;
  const ny = innerY / innerSize;

  // For very small icons (16px), just draw a simple block
  if (size <= 16) {
    return nx >= 0.2 && nx < 0.8 && ny >= 0.2 && ny < 0.8 &&
           !(nx >= 0.4 && nx < 0.7 && ny >= 0.3 && ny < 0.6);
  }

  const thickness = size <= 48 ? 0.18 : 0.14;

  // "G" shape: a C-shape with a horizontal bar extending inward from middle-right
  const inCircleArea = nx >= 0.15 && nx <= 0.85 && ny >= 0.15 && ny <= 0.85;
  if (!inCircleArea) return false;

  // Approximate circle using distance from center
  const cx = 0.5, cy = 0.5;
  const dx = nx - cx;
  const dy = ny - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  const outerR = 0.38;
  const innerR = outerR - thickness;

  // Ring of the G
  const onRing = dist >= innerR && dist <= outerR;

  // Gap in the ring: top-right quadrant (the opening of the G)
  const angle = Math.atan2(-dy, dx); // angle from center, -dy to flip y
  const isGap = angle > 0.15 && angle < 1.2; // roughly 10deg to 70deg

  // Horizontal bar of G: extends from center-right inward at the middle
  const isBar = ny >= 0.46 && ny <= (0.46 + thickness) &&
                nx >= 0.48 && nx <= (0.5 + outerR);

  return (onRing && !isGap) || isBar;
}

// Main
const outputDir = path.resolve(__dirname, '..', 'assets', 'icons');
fs.mkdirSync(outputDir, { recursive: true });

const sizes = [16, 48, 128];

for (const size of sizes) {
  const pixels = generateIconPixels(size);
  const png = createPNG(size, size, pixels);
  const filename = `icon${size}.png`;
  const filepath = path.join(outputDir, filename);
  fs.writeFileSync(filepath, png);
  console.log(`Generated: ${filepath} (${png.length} bytes)`);
}

console.log('Icon generation complete.');
