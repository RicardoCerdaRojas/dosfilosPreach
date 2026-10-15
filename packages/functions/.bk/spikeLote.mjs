import { GoogleGenAI, ThinkingLevel, MediaResolution } from '@google/genai';
import { PDFDocument } from 'pdf-lib';
import { readFileSync, writeFileSync } from 'node:fs';

const [, , pdfPath, desde, hasta, salida] = process.argv;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODELO = 'gemini-3.8-flash';
const prompt = `Extrae el texto completo de este PDF página por página.

Reglas:
1. Una entrada por página física, en orden, numeradas desde 1 según su posición en el archivo.
2. Preserva la estructura en markdown: encabezados con # / ##, párrafos separados, listas con -, tablas en formato markdown.
3. Transcribe el griego y el hebreo EXACTAMENTE como aparecen: griego politónico con espíritus, acentos e iota suscrita; hebreo con niqqud y acentos de cantilación. No normalices ni corrijas ninguna forma.
4. No traduzcas términos teológicos ni citas bíblicas.
5. No uses LaTeX ni notación matemática: nada de $...$, \\text ni ^{...}. Escribe los superíndices y las letras de nota del aparato como caracteres Unicode (ᵃ ᵇ ᶜ ¹ ²) pegados donde aparecen.
6. NO incluyas el número de página impreso en el contenido.

Devuelve JSON con esta estructura exacta:
{
  "pages": [
    { "page": 1, "md": "contenido de la página en markdown" }
  ]
}

Si una página está vacía, devuelve "md": "" pero conserva la entrada para no romper la numeración.`;
const config = {
    responseMimeType: 'application/json', maxOutputTokens: 65536,
    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH,
};

// Tramo del PDF
const src = await PDFDocument.load(readFileSync(pdfPath), { ignoreEncryption: true });
const dst = await PDFDocument.create();
const idx = Array.from({ length: Number(hasta) - Number(desde) + 1 }, (_, i) => Number(desde) - 1 + i);
for (const p of await dst.copyPages(src, idx)) dst.addPage(p);
const bytes = await dst.save();
const archivo = await ai.files.upload({ file: new Blob([bytes], { type: 'application/pdf' }), config: { mimeType: 'application/pdf' } });
const contents = [{ role: 'user', parts: [{ text: prompt }, { fileData: { mimeType: 'application/pdf', fileUri: archivo.uri } }] }];

const res = {};
// En línea
let t0 = Date.now();
const enLinea = await ai.models.generateContent({ model: MODELO, contents, config });
res.enLinea = { ms: Date.now() - t0, usage: enLinea.usageMetadata, finish: enLinea.candidates?.[0]?.finishReason, texto: enLinea.text };
console.log('en línea', res.enLinea.ms, 'ms', JSON.stringify(enLinea.usageMetadata));

// En lote
t0 = Date.now();
const job = await ai.batches.create({ model: MODELO, src: [{ contents, config }], config: { displayName: 'spike-lote-extraccion' } });
console.log('lote creado', job.name, job.state);
let j = job;
while (!['JOB_STATE_SUCCEEDED', 'JOB_STATE_FAILED', 'JOB_STATE_CANCELLED', 'JOB_STATE_EXPIRED'].includes(j.state)) {
    await new Promise(r => setTimeout(r, 20000));
    j = await ai.batches.get({ name: job.name });
    console.log(Math.round((Date.now() - t0) / 1000), 's', j.state);
    if (Date.now() - t0 > 50 * 60 * 1000) { console.log('se corta la espera; el lote sigue:', job.name); break; }
}
const r0 = j.dest?.inlinedResponses?.[0];
res.lote = { ms: Date.now() - t0, state: j.state, name: job.name, error: r0?.error ?? j.error ?? null,
    usage: r0?.response?.usageMetadata, finish: r0?.response?.candidates?.[0]?.finishReason,
    texto: r0?.response?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') };
console.log('lote', res.lote.state, res.lote.ms, 'ms', JSON.stringify(res.lote.usage));
writeFileSync(salida, JSON.stringify(res, null, 1));
