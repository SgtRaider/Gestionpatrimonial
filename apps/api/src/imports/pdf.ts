import type { Buffer } from 'node:buffer';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

type TextItem = { x: number; y: number; str: string };

const Y_TOLERANCE = 2;

// Extracts plain text from a PDF buffer. pdfjs returns text fragments in
// document writing order, which is NOT necessarily top-to-bottom. We collect
// every fragment with its (x, y) coords, sort by Y desc → X asc, then group
// fragments whose Y values are within Y_TOLERANCE into the same line. This
// keeps tabular layouts (bank statements) coherent line-by-line for the
// downstream regex / token parsers.
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
      const items: TextItem[] = [];
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const str = (item as { str: string }).str;
        if (!str) continue;
        const transform = (item as { transform?: number[] }).transform;
        if (!transform || transform.length < 6) continue;
        const x = transform[4];
        const y = transform[5];
        if (typeof x !== 'number' || typeof y !== 'number') continue;
        items.push({ x, y, str });
      }
      items.sort((a, b) => b.y - a.y || a.x - b.x);

      const lines: string[] = [];
      let currentLine: string[] = [];
      let currentY: number | null = null;
      for (const it of items) {
        if (currentY === null || Math.abs(it.y - currentY) <= Y_TOLERANCE) {
          currentLine.push(it.str);
          if (currentY === null) currentY = it.y;
        } else {
          if (currentLine.length) lines.push(currentLine.join(' ').replace(/\s+/g, ' ').trim());
          currentLine = [it.str];
          currentY = it.y;
        }
      }
      if (currentLine.length) lines.push(currentLine.join(' ').replace(/\s+/g, ' ').trim());

      pages.push(lines.filter(Boolean).join('\n'));
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  return pages.join('\n\n');
}
