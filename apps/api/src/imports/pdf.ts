import type { Buffer } from 'node:buffer';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

// Extracts plain text from a PDF buffer. We join text fragments with spaces and
// pages with double newlines so per-line regex matchers have stable input.
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const data = new Uint8Array(buffer);
  const loadingTask = getDocument({
    data,
    useSystemFonts: false,
    disableFontFace: true,
    isEvalSupported: false,
  });
  const doc = await loadingTask.promise;
  const pages: string[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let lastY: number | null = null;
      const lineParts: string[] = [];
      const lines: string[] = [];
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const y = 'transform' in item && item.transform ? item.transform[5] : null;
        if (lastY !== null && y !== null && Math.abs((y as number) - lastY) > 2) {
          if (lineParts.length) lines.push(lineParts.join(' '));
          lineParts.length = 0;
        }
        lineParts.push(item.str);
        if (typeof y === 'number') lastY = y;
      }
      if (lineParts.length) lines.push(lineParts.join(' '));
      pages.push(lines.join('\n'));
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  return pages.join('\n\n');
}
