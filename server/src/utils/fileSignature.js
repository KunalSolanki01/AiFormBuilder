/**
 * Checks that a file's bytes match the extension it claims, so a renamed
 * executable or script can't be uploaded as a PDF/image/document.
 */

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const OLE2 = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

const startsWith = (buf, sig) => buf.length >= sig.length && buf.subarray(0, sig.length).equals(sig);

const CHECKS = {
  pdf: (buf) => buf.subarray(0, 1024).includes('%PDF-'),
  png: (buf) => startsWith(buf, PNG),
  jpg: (buf) => startsWith(buf, JPEG),
  jpeg: (buf) => startsWith(buf, JPEG),
  // Legacy Word (OLE2 compound file).
  doc: (buf) => startsWith(buf, OLE2),
  // .docx is a ZIP that holds a `word/` part; other ZIPs (xlsx, pptx, plain archives) are refused.
  docx: (buf) => startsWith(buf, ZIP) && buf.includes('word/'),
};

/** @param {string} ext lowercase extension without the dot */
export function matchesSignature(ext, buffer) {
  const check = CHECKS[ext];
  return Boolean(check && Buffer.isBuffer(buffer) && buffer.length > 0 && check(buffer));
}
