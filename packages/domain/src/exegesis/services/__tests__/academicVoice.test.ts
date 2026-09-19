import { describe, expect, it } from 'vitest';
import { buildAcademicVoiceBlock, selectAcademicVoiceSamples } from '../academicVoice';

const parrafo = (texto: string) => texto;
const LARGO_A = parrafo(
    'La cláusula nominal que abre el salmo no afirma una posesión cualquiera. El sufijo pronominal '
    + 'convierte una declaración general sobre el oficio del pastor en una confesión personal, y esa '
    + 'diferencia gobierna la lectura de los versículos siguientes. Conviene por eso demorarse en ella.',
);
const LARGO_B = parrafo(
    'Los comentaristas discrepan en el peso que asignan a la metáfora pastoril. Unos la leen como una '
    + 'imagen real, tomada de la vida cotidiana del antiguo Israel; otros la entienden como un título '
    + 'regio que el salmista aplica deliberadamente a Yahvé. La segunda lectura explica mejor el verso final.',
);

describe('selectAcademicVoiceSamples', () => {
    it('toma párrafos de prosa continua', () => {
        const muestras = selectAcademicVoiceSamples([LARGO_A, LARGO_B].join('\n\n'));
        expect(muestras).toHaveLength(2);
        expect(muestras[0]!.excerpt).toContain('cláusula nominal');
    });

    it('descarta encabezados, viñetas y notas: enseñarían formato, no registro', () => {
        const texto = ['## Introducción', '- Punto uno del listado que se extiende bastante para superar el largo mínimo exigido por el selector de muestras.', '<!-- page: 3 -->', LARGO_A].join('\n\n');
        const muestras = selectAcademicVoiceSamples(texto);
        expect(muestras).toHaveLength(1);
        expect(muestras[0]!.excerpt).toContain('cláusula nominal');
    });

    it('descarta el párrafo cargado de lengua original: enseñaría a citar, no a escribir', () => {
        const hebreo = 'יְהוָה רֹעִי לֹא אֶחְסָר בִּנְאוֹת דֶּשֶׁא יַרְבִּיצֵנִי עַל־מֵי מְנֻחוֹת יְנַהֲלֵנִי יְשׁוֹבֵב נַפְשִׁי יַנְחֵנִי בְמַעְגְּלֵי־צֶדֶק לְמַעַן שְׁמוֹ. Y una frase suelta.';
        expect(selectAcademicVoiceSamples(hebreo)).toEqual([]);
    });

    it('descarta la cita en bloque: es la prosa de otro', () => {
        expect(selectAcademicVoiceSamples(`> ${LARGO_A}`)).toEqual([]);
    });

    it('descarta el índice: los puntos conductores lo delatan', () => {
        // Salido de un documento real: pasaba todos los demás filtros porque
        // es largo, es latino y tiene puntos.
        const indice = 'Publicación electrónica ....................................... 30 '
            + 'Artículo de un sitio web ..................................... 31 '
            + 'Entrada de blog .............................................. 32';
        expect(selectAcademicVoiceSamples(indice)).toEqual([]);
    });

    it('en un documento largo se salta el arranque: portada, índice y resumen', () => {
        const veinte = Array.from({ length: 20 }, (_, i) => `${LARGO_A} Bloque ${i}.`).join('\n\n');
        const muestras = selectAcademicVoiceSamples(veinte, 1);
        expect(muestras[0]!.position).toBeGreaterThan(0);
    });

    it('un texto sin un solo salto de línea se agrupa por oraciones', () => {
        // Medido: la guía de estilo del seminario son 130.566 caracteres y
        // CERO saltos de línea; con el troceo por párrafos daba una muestra,
        // y era la portada.
        const seguido = Array.from({ length: 30 }, (_, i) => `${LARGO_A} Oración ${i}.`).join(' ');
        expect(selectAcademicVoiceSamples(seguido).length).toBeGreaterThan(1);
    });

    it('descarta lo demasiado corto: no hay frase que imitar', () => {
        expect(selectAcademicVoiceSamples('Una frase breve y nada más.')).toEqual([]);
    });

    it('reparte a lo largo del documento en vez de tomar los primeros', () => {
        // El contrato es que las muestras vengan de tramos distintos —el
        // arranque de un trabajo es portada, índice y resumen—. Qué párrafo
        // exacto toca es del algoritmo y no se fija acá: fijarlo cementaría
        // el paso de reparto y volvería roja cualquier mejora del criterio.
        const diez = Array.from({ length: 10 }, (_, i) => `${LARGO_A} Marca ${i}.`).join('\n\n');
        const muestras = selectAcademicVoiceSamples(diez, 2);
        expect(muestras).toHaveLength(2);
        expect(muestras[1]!.position).toBeGreaterThan(0.4);
        expect(muestras[0]!.position).toBeLessThan(0.4);
    });

    it('el bloque entero cabe holgado en el prompt: cuatro muestras de 700 son 2.800 caracteres', () => {
        // El tope del prompt es 200.000 (`fitPromptToCap`). Este invariante
        // ata las dos constantes que deciden el tamaño —cuántas muestras y
        // cuán largas— para que subir una no rompa el otro en silencio.
        const enormes = Array.from({ length: 20 }, () => `${LARGO_A} ${'palabra '.repeat(400)}`).join('\n\n');
        const bloque = buildAcademicVoiceBlock(selectAcademicVoiceSamples(enormes), 'es');
        expect(bloque.length).toBeLessThan(4_000);
    });

    it('recorta un párrafo larguísimo en vez de llevarse la página entera', () => {
        // Con separación de párrafos: el documento declara dónde termina uno,
        // y ese párrafo mide más de lo que cabe en una muestra.
        const enorme = [LARGO_B, `${LARGO_A} ${'palabra corrida. '.repeat(60)}`, LARGO_B].join('\n\n');
        const muestras = selectAcademicVoiceSamples(enorme);
        const largo = muestras.find(m => m.excerpt.length > 690);
        expect(largo).toBeDefined();
        expect(largo!.excerpt.length).toBeLessThanOrEqual(701);
        expect(largo!.excerpt.endsWith('…')).toBe(true);
    });

    it('un texto vacío no aporta muestras', () => {
        expect(selectAcademicVoiceSamples('')).toEqual([]);
    });
});

describe('buildAcademicVoiceBlock', () => {
    it('dice que se imita el registro y que NO se toma el contenido', () => {
        const bloque = buildAcademicVoiceBlock(selectAcademicVoiceSamples(LARGO_A), 'es');
        expect(bloque).toMatch(/registro/i);
        expect(bloque).toMatch(/NUNCA tomes contenido, fuentes, páginas/);
        expect(bloque).toContain('cláusula nominal');
    });

    it('sin muestras no hay bloque: el prompt queda como estaba', () => {
        expect(buildAcademicVoiceBlock([], 'es')).toBe('');
    });
});
