import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';
const data = new Uint8Array(fs.readFileSync(process.argv[2]));
const doc = await pdfjs.getDocument({ data }).promise;
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const anns = (await page.getAnnotations()).filter(a => !['Link','Widget','Popup'].includes(a.subtype));
  if (!anns.length) continue;
  const tc = await page.getTextContent();
  const lines = {};
  for (const it of tc.items) { if (!it.str.trim()) continue; const y = Math.round(it.transform[5]); (lines[y] ??= []).push(it.str); }
  const ys = Object.keys(lines).map(Number);
  for (const a of anns) {
    const ay = a.rect ? (a.rect[1]+a.rect[3])/2 : 0;
    const near = ys.sort((x,y)=>Math.abs(x-ay)-Math.abs(y-ay))[0];
    const txt = (a.contentsObj?.str ?? a.contents ?? '').trim();
    console.log(`p${p} [${a.subtype}] ${a.inReplyTo ? '(resp) ' : ''}«${txt}»\n    línea: ${near!==undefined ? lines[near].join(' ').slice(0,140) : ''}`);
  }
}
