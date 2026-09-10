import { useEffect, useState } from 'react';
// El worker se configura en `@/lib/pdfWorker`. Importarlo desde ahí NO es
// cosmético: sin worker `getDocument` tira excepción, el `catch` de abajo la
// traduce a «no se pudo leer», y el diagnóstico queda mudo sin error visible.
import { pdfjsLib } from '@/lib/pdfWorker';
import {
    diagnosePdfSource,
    sampleWindow,
    type PdfDiagnosis,
    type PdfEvidence,
} from '@dosfilos/domain';

/**
 * Lee el PDF que el usuario acaba de elegir y dice si va a servir,
 * ANTES de subirlo y antes de que cueste una página.
 *
 * El veredicto lo decide `diagnosePdfSource`, en el dominio, que es el
 * mismo que usa `npm run diagnosticar` desde la terminal. Acá sólo se
 * reúnen los hechos, con pdf.js en el navegador.
 *
 * **Sólo advierte.** No bloquea la subida ni deshabilita nada: hay
 * libros que el diagnóstico no puede juzgar —no sabe si un manual de
 * homilética debería traer griego— y quien decide es el usuario, con la
 * información delante.
 */

/**
 * Cuántas páginas se leen del medio del libro.
 *
 * Menos que en la terminal: acá corre en el navegador de alguien que
 * está esperando, y diez páginas ya distinguen un escaneo de un libro
 * con texto. El principio del libro no sirve —es portada e índice—, así
 * que la ventana se toma del centro.
 */
const PAGINAS_A_LEER = 10;

/** Techo de tiempo. Pasado esto se calla en vez de hacer esperar. */
const LIMITE_MS = 12_000;

export type PdfPreflightState =
    | { status: 'idle' }
    | { status: 'reading' }
    | { status: 'done'; diagnosis: PdfDiagnosis; evidence: PdfEvidence }
    /** No se pudo leer. No es un veredicto: es la ausencia de uno. */
    | { status: 'unavailable' };

export function usePdfPreflight(file: File | null): PdfPreflightState {
    const [state, setState] = useState<PdfPreflightState>({ status: 'idle' });

    useEffect(() => {
        if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
            setState({ status: 'idle' });
            return;
        }

        let cancelado = false;
        setState({ status: 'reading' });

        const temporizador = setTimeout(() => {
            if (!cancelado) setState({ status: 'unavailable' });
        }, LIMITE_MS);

        void (async () => {
            try {
                const evidence = await reunirEvidencia(file);
                if (cancelado) return;
                setState({ status: 'done', diagnosis: diagnosePdfSource(evidence), evidence });
            } catch (err) {
                console.warn('[library] no se pudo diagnosticar el PDF:', err);
                if (!cancelado) setState({ status: 'unavailable' });
            } finally {
                clearTimeout(temporizador);
            }
        })();

        return () => { cancelado = true; clearTimeout(temporizador); };
    }, [file]);

    return state;
}

async function reunirEvidencia(file: File): Promise<PdfEvidence> {
    const datos = new Uint8Array(await file.arrayBuffer());
    const doc = await pdfjsLib.getDocument({ data: datos, ...PDFJS_ASSETS }).promise;
    try {
        const pages = doc.numPages;
        const { from, to } = sampleWindow(pages, PAGINAS_A_LEER);

        let texto = '';
        const fuentes = new Set<string>();
        for (let n = from; n <= to; n++) {
            const page = await doc.getPage(n);
            const contenido = await page.getTextContent();
            for (const item of contenido.items) {
                if (!('str' in item)) continue;
                texto += item.str + ' ';
                if (item.fontName) fuentes.add(item.fontName);
            }
        }

        const { griego, hebreo, diacriticos } = contarEscritura(texto);
        return {
            pages,
            // Sin fuentes en el texto no hay capa de texto: la página es
            // una imagen. Es la misma señal que `pdffonts` da con cero.
            fontCount: fuentes.size,
            sampleFromPage: from,
            sampleToPage: to,
            sampleChars: texto.trim().length,
            greekLetters: griego,
            hebrewLetters: hebreo,
            diacritics: diacriticos,
            garbledTokenRatio: ratioDeBasura(texto),
        };
    } finally {
        void doc.destroy();
    }
}

/** Mismos recursos que el visor de páginas: sin ellos el griego sale en cajas. */
const PDFJS_ASSETS = {
    wasmUrl: '/pdfjs/wasm/',
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
} as const;

function contarEscritura(texto: string): { griego: number; hebreo: number; diacriticos: number } {
    const griego = [...texto].filter(c => /\p{Script=Greek}/u.test(c));
    const hebreo = [...texto].filter(c => /\p{Script=Hebrew}/u.test(c));
    const escritura = [...griego, ...hebreo].join('').normalize('NFD');
    const diacriticos = [...escritura].filter(c => /\p{Mn}/u.test(c)).length;
    return { griego: griego.length, hebreo: hebreo.length, diacriticos };
}

/**
 * Palabras que no parecen lenguaje. Espejo de la misma cuenta que hace
 * el script de terminal: letras mezcladas con dígitos o signos, o sin
 * una sola vocal.
 */
function ratioDeBasura(texto: string): number {
    const tokens = texto.split(/\s+/).filter(x => x.length >= 2);
    if (tokens.length === 0) return 0;
    const esBasura = (x: string): boolean => {
        const nucleo = x.replace(/^[.,;:!?()[\]{}«»"'—–-]+|[.,;:!?()[\]{}«»"'—–-]+$/g, '');
        if (nucleo.length < 2) return false;
        if (/[A-Za-zÀ-ÿ][0-9"$%&*+/<=>@\\^_|~]|[0-9"$%&*+/<=>@\\^_|~][A-Za-zÀ-ÿ]/.test(nucleo)) return true;
        return /[A-Za-zÀ-ÿ]/.test(nucleo) && !/[aeiouáéíóúüAEIOUÁÉÍÓÚ]/.test(nucleo);
    };
    return tokens.filter(esBasura).length / tokens.length;
}
