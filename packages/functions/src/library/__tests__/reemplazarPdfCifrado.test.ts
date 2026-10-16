import { describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PDFDocument } from 'pdf-lib';
import type { File } from '@google-cloud/storage';
import { esCopiaDescifrada, MARCA_DE_DESCIFRADO, PdfConContrasenaError, prepararPdfDescargado, rutaDeRespaldo } from '../reemplazarPdfCifrado';

async function pdf(contrasenaDeApertura: string | null): Promise<Buffer> {
    const doc = await PDFDocument.create();
    doc.addPage().drawText('Hoja del libro', { x: 50, y: 700 });
    const plano = await doc.save();
    if (contrasenaDeApertura === null) return Buffer.from(plano);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crear = require('@neslinesli93/qpdf-wasm');
    const qpdf = await crear({ locateFile: () => require.resolve('@neslinesli93/qpdf-wasm/dist/qpdf.wasm'), noInitialRun: true });
    qpdf.FS.writeFile('/a.pdf', plano);
    const antes = process.exitCode;
    qpdf.callMain(['--encrypt', contrasenaDeApertura, 'duenio', '256', '--print=none', '--', '/a.pdf', '/b.pdf']);
    process.exitCode = antes;
    return Buffer.from(qpdf.FS.readFile('/b.pdf'));
}

const RUTA = 'users/u1/library/r1/libro.pdf';
type Llamada = [string, ...unknown[]];

/** Un archivo de Storage que anota lo que se le hace, en orden. */
function archivoFalso(opciones: { respaldoYaExiste?: boolean; generacionCambio?: boolean; storageFalla?: boolean } = {}) {
    const llamadas: Llamada[] = [];
    const err412 = Object.assign(new Error('precondition'), { code: 412 });
    const respaldo = {
        name: rutaDeRespaldo(RUTA),
        setMetadata: async (m: unknown) => { llamadas.push(['respaldo.setMetadata', m]); },
    };
    const archivo = {
        name: RUTA,
        bucket: { file: (ruta: string) => { expect(ruta).toBe(rutaDeRespaldo(RUTA)); return respaldo; } },
        getMetadata: async () => {
            if (opciones.storageFalla) throw new Error('storage caído');
            return [{ contentType: 'application/pdf', generation: '17', metadata: { firebaseStorageDownloadTokens: 'token-del-visor' } }];
        },
        copy: async (_d: unknown, o: unknown) => { llamadas.push(['copy', o]); if (opciones.respaldoYaExiste) throw err412; },
        save: async (bytes: Buffer, o: Record<string, any>) => { llamadas.push(['save', bytes, o]); if (opciones.generacionCambio) throw err412; },
        setMetadata: async (m: unknown) => { llamadas.push(['setMetadata', m]); },
    };
    return { archivo: archivo as unknown as File, llamadas };
}

const temporal = async (contenido: Buffer) => {
    const ruta = path.join(os.tmpdir(), `descifrar-${Math.random().toString(36).slice(2)}.pdf`);
    fs.writeFileSync(ruta, contenido);
    return ruta;
};

describe('prepararPdfDescargado', () => {
    it('cifrado sin contraseña: respalda el original sin token, guarda la copia con el token del visor y la marca, y quita la marca', async () => {
        const ruta = await temporal(await pdf(''));
        const { archivo, llamadas } = archivoFalso();
        expect(await prepararPdfDescargado(archivo, ruta)).toBe('descifrado');
        expect((await PDFDocument.load(fs.readFileSync(ruta))).isEncrypted).toBe(false);
        expect(llamadas.map(l => l[0])).toEqual(['copy', 'respaldo.setMetadata', 'save', 'setMetadata']);
        // El respaldo sólo se crea si no existe, y sin el token de descarga.
        expect(llamadas[0]![1]).toEqual({ preconditionOpts: { ifGenerationMatch: 0 } });
        expect(llamadas[1]![1]).toEqual({ metadata: { firebaseStorageDownloadTokens: null } });
        const opciones = llamadas[2]![2] as Record<string, any>;
        expect((await PDFDocument.load(llamadas[2]![1] as Buffer)).isEncrypted).toBe(false);
        expect(opciones.metadata.metadata).toEqual({ firebaseStorageDownloadTokens: 'token-del-visor', [MARCA_DE_DESCIFRADO]: 'si' });
        expect(opciones.preconditionOpts).toEqual({ ifGenerationMatch: 17 });
        expect(llamadas[3]![1]).toEqual({ metadata: { [MARCA_DE_DESCIFRADO]: null } });
        fs.unlinkSync(ruta);
    });

    it('si ya había respaldo (otra ejecución), no lo pisa y sigue', async () => {
        const ruta = await temporal(await pdf(''));
        const { archivo, llamadas } = archivoFalso({ respaldoYaExiste: true });
        expect(await prepararPdfDescargado(archivo, ruta)).toBe('descifrado');
        expect(llamadas.map(l => l[0])).toEqual(['copy', 'save', 'setMetadata']);
        fs.unlinkSync(ruta);
    });

    it('si otro proceso lo reemplazó primero (412), no falla: deja el suyo y sigue con el temporal descifrado', async () => {
        const ruta = await temporal(await pdf(''));
        const { archivo, llamadas } = archivoFalso({ generacionCambio: true });
        const aviso = vi.spyOn(console, 'warn');
        expect(await prepararPdfDescargado(archivo, ruta)).toBe('descifrado');
        expect(llamadas.map(l => l[0])).not.toContain('setMetadata');
        // Es el desenlace esperado de una carrera, no una falla de Storage.
        expect(aviso).not.toHaveBeenCalled();
        aviso.mockRestore();
        expect((await PDFDocument.load(fs.readFileSync(ruta))).isEncrypted).toBe(false);
        fs.unlinkSync(ruta);
    });

    it('si Storage falla, la extracción sigue con el temporal descifrado', async () => {
        const ruta = await temporal(await pdf(''));
        expect(await prepararPdfDescargado(archivoFalso({ storageFalla: true }).archivo, ruta)).toBe('descifrado');
        expect((await PDFDocument.load(fs.readFileSync(ruta))).isEncrypted).toBe(false);
        fs.unlinkSync(ruta);
    });

    it('sin cifrar: no escribe nada', async () => {
        const ruta = await temporal(await pdf(null));
        const { archivo, llamadas } = archivoFalso();
        expect(await prepararPdfDescargado(archivo, ruta)).toBe('sin-cifrar');
        expect(llamadas).toEqual([]);
        fs.unlinkSync(ruta);
    });

    it('con contraseña de apertura: lanza el error con el mensaje para el usuario y no escribe', async () => {
        const ruta = await temporal(await pdf('secreta'));
        const { archivo, llamadas } = archivoFalso();
        await expect(prepararPdfDescargado(archivo, ruta)).rejects.toBeInstanceOf(PdfConContrasenaError);
        expect(llamadas).toEqual([]);
        fs.unlinkSync(ruta);
    });

    it('más grande que el tope: ni lo intenta (qpdf no entraría en la memoria de la función)', async () => {
        const ruta = await temporal(Buffer.alloc(61 * 1024 * 1024));
        const { archivo, llamadas } = archivoFalso();
        expect(await prepararPdfDescargado(archivo, ruta)).toBe('muy-grande');
        expect(llamadas).toEqual([]);
        fs.unlinkSync(ruta);
    });
});

describe('rutaDeRespaldo', () => {
    it('dentro de la carpeta del usuario (la borra el borrado de cuenta) y fuera de library/ (el disparador no la mira)', () => {
        const r = rutaDeRespaldo(RUTA);
        expect(r).toBe('users/u1/respaldos/pdf-cifrados/r1/libro.pdf');
        expect(r.startsWith('users/u1/')).toBe(true);
        expect(r).not.toMatch(/^users\/[^/]+\/library\//);
    });
});

describe('esCopiaDescifrada', () => {
    it('sólo con la marca', () => {
        expect(esCopiaDescifrada(undefined)).toBe(false);
        expect(esCopiaDescifrada({ firebaseStorageDownloadTokens: 'x' })).toBe(false);
        expect(esCopiaDescifrada({ [MARCA_DE_DESCIFRADO]: 'si' })).toBe(true);
    });
});
