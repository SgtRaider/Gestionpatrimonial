import type { Buffer } from 'node:buffer';
import iconv from 'iconv-lite';

// Detect BOM and decode; falls back to Windows-1252 if UTF-8 strict decoding fails
// (Spanish bank exports are often Latin-1 / Windows-1252 — chars like 'ó' become
// 'Ã³' when read as UTF-8).
export function decodeTextBuffer(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.toString('utf-8', 3);
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return iconv.decode(buffer.subarray(2), 'utf-16le');
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return iconv.decode(buffer.subarray(2), 'utf-16be');
  }

  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    return decoder.decode(buffer);
  } catch {
    return iconv.decode(buffer, 'windows-1252');
  }
}
