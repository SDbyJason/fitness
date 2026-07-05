/* Erzeugt icon-192.png und icon-512.png (Hantel im APEX-Farbverlauf) ohne Abhängigkeiten. */
const zlib = require('zlib');
const fs = require('fs');

function crc32(buf) {
  let c; const t = [];
  for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = t[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function makeIcon(size, file) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(size * stride);
  const lerp = (a, b, t) => Math.round(a + (b - a) * t);
  const c1 = [124, 92, 255], c2 = [0, 229, 168]; // --acc → --acc2
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // Filter: none
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      let r = 11, g = 14, b = 23; // Hintergrund #0b0e17
      const bar = u >= .17 && u <= .83 && v >= .455 && v <= .545;
      const p1 = u >= .20 && u <= .285 && v >= .27 && v <= .73;
      const p2 = u >= .315 && u <= .38 && v >= .34 && v <= .66;
      const p3 = u >= .62 && u <= .685 && v >= .34 && v <= .66;
      const p4 = u >= .715 && u <= .80 && v >= .27 && v <= .73;
      if (bar || p1 || p2 || p3 || p4) {
        const t = (u + v) / 2;
        r = lerp(c1[0], c2[0], t); g = lerp(c1[1], c2[1], t); b = lerp(c1[2], c2[2], t);
      }
      const o = y * stride + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 bit, RGBA
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
  console.log(file, png.length, 'bytes');
}
makeIcon(512, __dirname + '/icon-512.png');
makeIcon(192, __dirname + '/icon-192.png');
