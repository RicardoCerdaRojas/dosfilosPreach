import { describe, it, expect } from 'vitest';
import { recommendExtractionMode, VISION_MAX_BYTES, PREMIUM_MAX_BYTES } from '../recommendExtractionMode';
import type { PdfDiagnosis } from '../diagnosePdfSource';

/**
 * El producto recomendaba lo contrario de lo que funciona: Premium por defecto,
 * comentado como «best quality». Medido sobre el mismo escaneo de la BHS:
 *
 *     Premium  (LlamaParse)     0 caracteres hebreos
 *     Estándar (visión Gemini)  2.418 caracteres hebreos
 *
 * Premium no es peor; resuelve otro problema. Reconstruye maquetación sobre
 * documentos que YA tienen texto. Un escaneo no tiene texto que reconstruir.
 */
const dx = (verdict: PdfDiagnosis['verdict']): PdfDiagnosis =>
    ({ verdict, reasons: [], suggestions: [], diacriticRatio: null });

const MB = 1024 * 1024;

describe('recommendExtractionMode', () => {
    it('un escaneo que cabe en visión va por Estándar, y con convicción', () => {
        const r = recommendExtractionMode({ sizeBytes: 2 * MB, diagnosis: dx('sin-capa-de-texto') });
        expect(r).toEqual({ recommended: 'standard', reasonKey: 'scan-fits-vision', strong: true });
    });

    it('un escaneo demasiado grande no tiene ruta buena: hay que partirlo', () => {
        // El PDF real de la BHS pesa 67 MB. Cabe en Premium, y Premium sobre un
        // escaneo hebreo devuelve cero hebreo; Estándar caería a pdf-parse, que
        // sobre ese archivo devolvía «0"'m1 nin~' bnnElid1».
        const r = recommendExtractionMode({ sizeBytes: 67 * MB, diagnosis: dx('sin-capa-de-texto') });
        expect(r.recommended).toBeNull();
        expect(r.reasonKey).toBe('scan-too-large');
        expect(r.strong).toBe(true);
    });

    it('justo en el tope de visión todavía entra', () => {
        expect(recommendExtractionMode({ sizeBytes: VISION_MAX_BYTES, diagnosis: dx('sin-capa-de-texto') }).recommended)
            .toBe('standard');
    });

    it('un documento con capa de texto sigue prefiriendo Premium', () => {
        // Ahí Premium hace lo que sabe: tablas, columnas, maquetación.
        const r = recommendExtractionMode({ sizeBytes: 20 * MB, diagnosis: dx('escritura-sin-diacriticos') });
        expect(r.recommended).toBe('premium');
        expect(r.strong).toBe(false);
    });

    it('por encima de todos los topes no hay motor que valga', () => {
        // Dibelius pesa 128 MB en esta biblioteca.
        const r = recommendExtractionMode({ sizeBytes: 128 * MB, diagnosis: dx('sin-capa-de-texto') });
        expect(r).toEqual({ recommended: null, reasonKey: 'over-every-cap', strong: true });
    });

    it('el tamaño manda incluso sin diagnóstico', () => {
        expect(recommendExtractionMode({ sizeBytes: PREMIUM_MAX_BYTES + 1, diagnosis: null }).reasonKey)
            .toBe('over-every-cap');
    });

    it('sin diagnóstico no inventa una recomendación', () => {
        const r = recommendExtractionMode({ sizeBytes: 5 * MB, diagnosis: null });
        expect(r.recommended).toBeNull();
        expect(r.reasonKey).toBe('unknown');
        expect(r.strong).toBe(false);
    });
});

/**
 * Libros CON capa de texto cuya escritura está mal codificada.
 *
 * Este caso no lo cubre «¿es un escaneo?»: los tres de abajo tienen capa —uno
 * sacó 827.573 caracteres— y una regla que sólo mirara el escaneo los mandaría
 * a Premium, que lee justamente esa capa envenenada.
 *
 *     «Hebreo Bíblico», manual        827.573 chars   0 hebreo
 *     Barrick & Busenitz, gramática   342.995 chars   0 hebreo
 *     Sasson, «Jonah» (Anchor Bible)  790.779 chars   0 hebreo   205 citas
 */
describe('recommendExtractionMode — la capa existe pero miente', () => {
    it('manda a visión una obra hebrea cuya capa no trae hebreo', () => {
        const r = recommendExtractionMode({
            sizeBytes: 12 * MB,
            diagnosis: dx('sin-escritura-original'),
            requiredScripts: ['hebrew'],
            evidence: { hebrewLetters: 0, greekLetters: 0 },
        });
        expect(r).toEqual({ recommended: 'standard', reasonKey: 'layer-missing-script', strong: true });
    });

    it('un puñado de letras en diez páginas centrales tampoco alcanza', () => {
        const r = recommendExtractionMode({
            sizeBytes: 12 * MB,
            diagnosis: dx('sin-escritura-original'),
            requiredScripts: ['hebrew'],
            evidence: { hebrewLetters: 8, greekLetters: 1122 },
        });
        expect(r.reasonKey).toBe('layer-missing-script');
    });

    it('NO toca la capa sana: una capa correcta le gana a la visión', () => {
        // Visión comete errores de OCR. Leyendo el Salmo 23 transcribió
        // `בְּנֵיָא` donde el libro dice `בְּגֵיא`. Si la capa trae la escritura
        // bien, pasarla por visión la empeora.
        const r = recommendExtractionMode({
            sizeBytes: 16 * MB,
            diagnosis: dx('apto'),
            requiredScripts: ['greek'],
            evidence: { greekLetters: 4200, hebrewLetters: 0 },
        });
        expect(r.recommended).toBe('premium');
    });

    it('manda a visión cuando la escritura es basura, aunque no se exija ninguna', () => {
        // `escritura-ausente` significa que los glifos se dibujan bien y sus
        // códigos apuntan a letras latinas. Eso se sabe sin conocer el libro.
        const r = recommendExtractionMode({
            sizeBytes: 12 * MB,
            diagnosis: dx('escritura-ausente'),
        });
        expect(r).toEqual({ recommended: 'standard', reasonKey: 'layer-garbled', strong: true });
    });

    it('no acusa a la capa cuando el libro no declara necesitar la escritura', () => {
        // Un comentario en español sobre Jonás puede no traer una letra hebrea
        // y estar perfecto. No se lo marca como capa rota — pero tampoco se
        // afirma Premium: no se sabe, y eso se dice.
        const r = recommendExtractionMode({
            sizeBytes: 12 * MB,
            diagnosis: dx('sin-escritura-original'),
            requiredScripts: [],
            evidence: { hebrewLetters: 0, greekLetters: 0 },
        });
        expect(r.reasonKey).toBe('no-script-found');
        expect(r.strong).toBe(false);
    });

    it('sin evidencia no acusa a la capa, y tampoco afirma Premium', () => {
        const r = recommendExtractionMode({
            sizeBytes: 12 * MB,
            diagnosis: dx('sin-escritura-original'),
            requiredScripts: ['hebrew'],
            evidence: null,
        });
        expect(r.reasonKey).toBe('no-script-found');
        expect(r.recommended).toBeNull();
    });

    it('capa rota y archivo que no entra en visión: ningún motor sirve', () => {
        // Premium leería esa misma capa envenenada y Estándar caería a
        // pdf-parse, que la lee también. Cambiar de motor no arregla nada:
        // la respuesta es partir el archivo.
        const r = recommendExtractionMode({
            sizeBytes: 60 * MB,
            diagnosis: dx('sin-escritura-original'),
            requiredScripts: ['hebrew'],
            evidence: { hebrewLetters: 0, greekLetters: 0 },
        });
        expect(r).toEqual({ recommended: null, reasonKey: 'layer-too-large', strong: true });
    });
});

/**
 * El caso Sasson, tal como se vio en producción.
 *
 * Un comentario del texto hebreo de 24 MB cuya capa no trae UNA letra hebrea en
 * 392 páginas. El diagnóstico lo dijo en pantalla —«No encontramos griego ni
 * hebreo dentro»— y justo debajo el selector marcaba «Premium RECOMENDADO»,
 * contradiciéndolo. Premium es el motor que lee justamente esa capa.
 *
 * La causa era doble: la categoría seguía en su valor de fábrica, así que no se
 * exigía escritura; y el distintivo «Recomendado» se pintaba también sobre las
 * recomendaciones DÉBILES, que existen precisamente para no afirmar de más.
 */
describe('recommendExtractionMode — no afirmar lo que no se sabe', () => {
    it('sin escritura hallada y sin saber si el libro la necesita, devuelve la pregunta', () => {
        const r = recommendExtractionMode({
            sizeBytes: 24 * MB,
            diagnosis: dx('sin-escritura-original'),
            requiredScripts: [],
            evidence: { hebrewLetters: 0, greekLetters: 0 },
        });
        expect(r.recommended).toBeNull();
        expect(r.reasonKey).toBe('no-script-found');
        // Débil a propósito: no se sabe, así que no se marca nada como bueno.
        expect(r.strong).toBe(false);
    });

    it('y con la categoría puesta, ya decide', () => {
        const r = recommendExtractionMode({
            sizeBytes: 24 * MB,
            diagnosis: dx('sin-escritura-original'),
            requiredScripts: ['hebrew'],
            evidence: { hebrewLetters: 0, greekLetters: 0 },
        });
        expect(r).toEqual({ recommended: 'standard', reasonKey: 'layer-missing-script', strong: true });
    });

    it('nunca afirma Premium sobre un archivo sin la escritura hallada', () => {
        // Era el defecto: caía en `text-layer-premium`, que la interfaz pintaba
        // con el mismo distintivo que una certeza.
        const r = recommendExtractionMode({
            sizeBytes: 24 * MB,
            diagnosis: dx('sin-escritura-original'),
        });
        expect(r.recommended).not.toBe('premium');
    });
});

/**
 * EL CASO BHQ. El fascículo de la Biblia Hebraica Quinta de los Doce Profetas
 * pesa 94 MB y tiene 315 páginas. Es un escaneo, así que la visión es la ÚNICA
 * ruta que puede leerlo — y el consejo decía «ninguna ruta sirve, parte el
 * archivo», porque el tope era 50 MB.
 *
 * Ese tope se puso cuando la extracción subía el PDF ENTERO al modelo. Con la
 * cola, cada tarea recorta su rango y sube sólo esa rebanada: el archivo
 * completo nunca se sube. Medido localmente sobre ese mismo fascículo:
 *
 *     cargar con pdf-lib     instantáneo
 *     memoria (RSS)          237 MB   de los 2 GiB de la función
 *     recorte de 30 páginas  9,9 MB   ← lo único que ve el modelo
 *
 * Así que el tope protegía de algo que en ese camino ya no ocurre. Lo que
 * decide no es cuánto pesa el archivo: es POR DÓNDE va a ir.
 */
describe('el tope de visión depende del camino, no sólo del tamaño', () => {
    const BHQ = { sizeBytes: 94 * MB, diagnosis: dx('sin-capa-de-texto') };

    it('un escaneo largo de 94 MB ahora sí se puede leer', () => {
        const r = recommendExtractionMode({ ...BHQ, pageCount: 315 });
        expect(r.recommended).toBe('standard');
        expect(r.reasonKey).toBe('scan-fits-vision');
    });

    it('el mismo peso en un libro CORTO sigue sin poder: va en una sola pasada', () => {
        // Con pocas páginas no hay cola: el archivo se sube completo y 94 MB no
        // entran. El consejo tiene que seguir diciendo la verdad para ese caso.
        const r = recommendExtractionMode({ ...BHQ, pageCount: 40 });
        expect(r.recommended).toBeNull();
        expect(r.reasonKey).toBe('scan-too-large');
    });

    it('sin saber las páginas se contesta con el tope conservador', () => {
        // Prometer que entra y que después el servidor lo rechace es peor que
        // quedarse corto: el usuario elige una ruta que va a fallar.
        expect(recommendExtractionMode({ ...BHQ, pageCount: null }).recommended).toBeNull();
        expect(recommendExtractionMode(BHQ).recommended).toBeNull();
    });

    it('por debajo del tope de una pasada nada cambia', () => {
        const chico = { sizeBytes: 20 * MB, diagnosis: dx('sin-capa-de-texto') };
        expect(recommendExtractionMode({ ...chico, pageCount: 315 }).recommended).toBe('standard');
        expect(recommendExtractionMode({ ...chico, pageCount: 40 }).recommended).toBe('standard');
    });

    it('lo que ninguna ruta soporta sigue sin soportarse', () => {
        // El tope de premium no se movió, y por encima de él no hay camino.
        const enorme = { sizeBytes: 400 * MB, diagnosis: dx('sin-capa-de-texto'), pageCount: 315 };
        expect(recommendExtractionMode(enorme).reasonKey).toBe('over-every-cap');
    });
});
