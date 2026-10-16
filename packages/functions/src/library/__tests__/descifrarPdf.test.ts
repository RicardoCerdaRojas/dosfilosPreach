import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { descifrarPdf, puedeEstarCifrado } from '../descifrarPdf';
import { leerPaginasDelPdf } from '../textoDelPdf';

/** Un PDF de dos páginas con texto. */
async function pdfDePrueba(): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const fuente = await doc.embedFont(StandardFonts.Helvetica);
    for (const linea of ['Pagina uno del libro', 'Pagina dos del libro']) doc.addPage().drawText(linea, { x: 50, y: 700, font: fuente, size: 14 });
    return doc.save();
}

/** Lo cifra el mismo qpdf, como viene un libro comprado. */
async function cifrar(pdf: Uint8Array, contrasenaDeApertura: string): Promise<Uint8Array> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crear = require('@neslinesli93/qpdf-wasm');
    const qpdf = await crear({ locateFile: () => require.resolve('@neslinesli93/qpdf-wasm/dist/qpdf.wasm'), noInitialRun: true, print: () => undefined, printErr: () => undefined });
    qpdf.FS.writeFile('/a.pdf', pdf);
    const antes = process.exitCode;
    expect(qpdf.callMain(['--encrypt', contrasenaDeApertura, 'duenio', '256', '--print=none', '--extract=n', '--', '/a.pdf', '/b.pdf'])).toBe(0);
    process.exitCode = antes;
    return qpdf.FS.readFile('/b.pdf');
}

describe('descifrarPdf', () => {
    it('un PDF sin cifrar no se toca (ni se carga qpdf)', async () => {
        const pdf = await pdfDePrueba();
        expect(puedeEstarCifrado(pdf)).toBe(false);
        expect(await descifrarPdf(pdf)).toEqual({ estado: 'sin-cifrar' });
    });

    it('cifrado sin contraseña de apertura: sale un PDF que pdf-lib recorta y que conserva el texto', async () => {
        const cifrado = await cifrar(await pdfDePrueba(), '');
        expect(puedeEstarCifrado(cifrado)).toBe(true);
        // El problema de hoy: pdf-lib no lo abre sin `ignoreEncryption`.
        await expect(PDFDocument.load(cifrado)).rejects.toThrow(/encrypted/i);

        const r = await descifrarPdf(cifrado);
        expect(r.estado).toBe('descifrado');
        const bytes = (r as { bytes: Buffer }).bytes;
        const doc = await PDFDocument.load(bytes);
        expect(doc.isEncrypted).toBe(false);
        // Recortado como lo hace la extracción por tramos, el texto sigue ahí.
        const recorte = await PDFDocument.create();
        for (const p of await recorte.copyPages(doc, [1])) recorte.addPage(p);
        const paginas = await leerPaginasDelPdf(Buffer.from(await recorte.save()), Date.now() + 30_000);
        expect(paginas.map(p => p.text).join(' ')).toContain('Pagina dos del libro');
    });

    it('con contraseña de apertura: no se puede, y lo dice', async () => {
        const cifrado = await cifrar(await pdfDePrueba(), 'secreta');
        expect(await descifrarPdf(cifrado)).toEqual({ estado: 'pide-contrasena' });
    });

    it('la marca «/Encrypt» dentro de un texto no lo hace cifrado', async () => {
        const doc = await PDFDocument.create();
        doc.addPage().drawText('/Encrypt', { x: 50, y: 700 });
        const pdf = await doc.save({ useObjectStreams: false });
        // pdf-lib comprime el flujo; si la marca no quedó legible, la prueba no prueba nada.
        const conMarca = puedeEstarCifrado(pdf) ? pdf : Buffer.concat([Buffer.from(pdf), Buffer.from('\n% /Encrypt\n')]);
        expect(puedeEstarCifrado(conMarca)).toBe(true);
        expect(await descifrarPdf(conMarca)).toEqual({ estado: 'sin-cifrar' });
    });

    it('un PDF cifrado y dañado que qpdf no abre NO se informa como «pide contraseña»', async () => {
        const cifrado = Buffer.from(await cifrar(await pdfDePrueba(), ''));
        // Basura después de %%EOF: los lectores tolerantes lo leen, este qpdf no.
        const danado = Buffer.concat([cifrado, Buffer.alloc(5000)]);
        const r = await descifrarPdf(danado);
        expect(r.estado).toBe('no-se-pudo-abrir');
    });

    it('no deja su código de salida en el proceso (un script terminaría «fallido»)', async () => {
        const antes = process.exitCode;
        await descifrarPdf(await cifrar(await pdfDePrueba(), 'secreta'));
        await descifrarPdf(await cifrar(await pdfDePrueba(), ''));
        expect(process.exitCode).toBe(antes);
    });

    it('dos PDF seguidos: cada uno con su módulo, sin mezclar archivos', async () => {
        const a = await descifrarPdf(await cifrar(await pdfDePrueba(), ''));
        const b = await descifrarPdf(await cifrar(await pdfDePrueba(), ''));
        expect(a.estado).toBe('descifrado');
        expect(b.estado).toBe('descifrado');
    });
});
