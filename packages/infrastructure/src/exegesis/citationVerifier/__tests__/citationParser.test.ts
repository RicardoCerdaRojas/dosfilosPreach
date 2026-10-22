import { describe, it, expect } from 'vitest';
import { maskRanges, parseCitations } from '../citationParser';

describe('parseCitations', () => {
    it('lee la forma canónica con título entre comillas', () => {
        const [cita] = parseCitations('El punto es claro (Lane, "Hebrews 1-8", p. 47).');
        expect(cita).toMatchObject({ author: 'Lane', title: 'Hebrews 1-8', pages: '47' });
    });

    it('lee «Autor (p. N)», que es lo que el paper emite de verdad', () => {
        const citas = parseCitations('El aoristo pide una decisión de la voluntad, Adamson (p. 53).');
        expect(citas).toHaveLength(1);
        expect(citas[0]).toMatchObject({ author: 'Adamson', title: '', pages: '53' });
    });

    it('lee «(Autor, p. N)» y «(Autor, N)»', () => {
        expect(parseCitations('Así se lee el genitivo (Wallace, p. 329).')[0])
            .toMatchObject({ author: 'Wallace', pages: '329' });
        expect(parseCitations('Así se lee el genitivo (Wallace, 329).')[0])
            .toMatchObject({ author: 'Wallace', pages: '329' });
    });

    it('lee rangos de páginas', () => {
        expect(parseCitations('Mayor (pp. 314-315) lo discute.')[0])
            .toMatchObject({ author: 'Mayor', pages: '314-315' });
    });

    it('no parte la forma rica en una pobre: una cita, no dos', () => {
        const citas = parseCitations('El punto es claro (Lane, "Hebrews 1-8", p. 47).');
        expect(citas).toHaveLength(1);
        expect(citas[0]!.title).toBe('Hebrews 1-8');
    });

    it('devuelve las citas en el orden en que aparecen', () => {
        const citas = parseCitations(
            'Primero Adamson (p. 53) y después (Wallace, "Greek Grammar", p. 329) cierran el punto.',
        );
        expect(citas.map(c => c.author)).toEqual(['Adamson', 'Wallace']);
    });

    it('ignora un paréntesis numérico sin autor', () => {
        expect(parseCitations('el segundo participio (2) depende del primero')).toEqual([]);
    });

    it('adjunta como evidencia la frase entrecomillada más cercana', () => {
        const [cita] = parseCitations('Escribe: "la constancia es obra madura" (Adamson, p. 54).');
        expect(cita!.evidenceIsQuoted).toBe(true);
        expect(cita!.evidence).toBe('la constancia es obra madura');
    });

    it('sin comillas cerca, la evidencia es la oración que contiene la cita', () => {
        const [cita] = parseCitations('El aoristo pide una decisión deliberada. Lo sostiene Adamson (p. 53).');
        expect(cita!.evidenceIsQuoted).toBe(false);
        expect(cita!.evidence).toContain('Lo sostiene');
    });

    it('no arrastra estado entre llamadas', () => {
        const md = 'Adamson (p. 53) lo sostiene.';
        expect(parseCitations(md)).toHaveLength(1);
        expect(parseCitations(md)).toHaveLength(1);
    });
});

describe('parseCitations — defectos hallados en un paper real', () => {
    it('no toma el titulo de la cita vecina como frase citada', () => {
        // Caso real de Santiago 1:12. La evidencia de la cita a Subukjian
        // salia siendo «Diccionario Teologico del NT» —el titulo del libro de
        // la cita anterior— y el verificador buscaba ESO en el corpus.
        const md = 'Resume las pruebas externas de 1:2 (Kittel, "Diccionario Teologico del NT", p. 633). '
            + 'Concluye asi la seccion sobre la perseverancia (Subukjian, "Volvamos a la predicacion", p. 16).';
        const cites = parseCitations(md);
        const subukjian = cites.find(c => c.author === 'Subukjian')!;
        expect(subukjian.evidence).not.toContain('Diccionario');
        expect(subukjian.evidence).toContain('perseverancia');
    });

    it('reconoce las dos citas de una compuesta con punto y coma', () => {
        // Caso real de Santiago 1:14. Antes no se reconocia ninguna de las
        // dos, y ademas el detector reportaba a Adamson como fuente nombrada
        // sin citar.
        const md = 'asegura la captura (Mayor, "The Epistle of James", 330; Adamson, "The Epistle of James", 75).';
        const autores = parseCitations(md).map(c => c.author).sort();
        expect(autores).toEqual(['Adamson', 'Mayor']);
        const mayor = parseCitations(md).find(c => c.author === 'Mayor')!;
        expect(mayor.pages).toBe('330');
    });

    it('detecta una cita verbatim entre comillas angulares', () => {
        // La prosa academica en espanol cita con «», no con comillas rectas.
        const md = 'Adamson lo glosa como «invencible al asalto de los males» (Adamson, "The Epistle of James", p. 74).';
        const c = parseCitations(md)[0]!;
        expect(c.evidenceIsQuoted).toBe(true);
        expect(c.evidence).toBe('invencible al asalto de los males');
    });

    it('la evidencia de una cita suelta sigue siendo su oracion', () => {
        const md = 'Primera oracion. El termino denota la prueba objetiva (Mayor, "The Epistle of James", 48).';
        const c = parseCitations(md)[0]!;
        expect(c.evidenceIsQuoted).toBe(false);
        expect(c.evidence).toContain('prueba objetiva');
        expect(c.evidence).not.toContain('Primera oracion');
    });
});

/**
 * El ancla «hoja N».
 *
 * El sistema la escribe cuando la fuente no declara numeración confirmada: es
 * la forma honesta de citar, porque no afirma una página impresa que nadie
 * verificó. El parser no la conocía, así que esas citas quedaban invisibles —y
 * como el detector después veía el apellido en la prosa sin cita asociada, las
 * reportaba como «fuente nombrada sin citarla». El formato correcto era el que
 * producía la advertencia.
 */
describe('parseCitations — el ancla en hojas', () => {
    it('lee una cita anclada a la hoja', () => {
        const out = parseCitations('Sitúa la instrucción (Subukjian, "Volvamos a la predicación Bíblica", hoja 16).');
        expect(out).toHaveLength(1);
        expect(out[0]!.author).toBe('Subukjian');
        // El número viaja pelado: el cotejo compara cantidades, y a esta altura
        // ambos lados ya hablan de la misma unidad.
        expect(out[0]!.pages).toBe('16');
    });

    it('no pierde las vecinas en una compuesta mixta', () => {
        const out = parseCitations(
            'Uno (Adamson, "The Epistle of James", p. 61). Dos (Subukjian, "Volvamos", hoja 16). Tres (Mayor, "The Epistle of James", p. 183).',
        );
        expect(out.map(c => c.author)).toEqual(['Adamson', 'Subukjian', 'Mayor']);
    });

    it('lee la forma sin título', () => {
        const out = parseCitations('Lo sostiene (Wallace, hoja 55).');
        expect(out).toHaveLength(1);
        expect(out[0]!.author).toBe('Wallace');
        expect(out[0]!.pages).toBe('55');
    });

    it('lee el autor fuera del paréntesis', () => {
        const out = parseCitations('Así lo explica Wallace (hoja 55) en su sintaxis.');
        expect(out).toHaveLength(1);
        expect(out[0]!.author).toBe('Wallace');
    });

    it('sigue leyendo «p. N», que es la forma de una fuente calibrada', () => {
        const out = parseCitations('El rico es hermano (Adamson, "The Epistle of James", p. 61).');
        expect(out[0]!.pages).toBe('61');
    });
});

/**
 * TP #8 (2026-10-21, #42): el punto de una abreviatura se leía como fin de
 * oración y la evidencia de la cita quedaba vacía o recortada.
 */
describe('parseCitations · el punto de una abreviatura no cierra la oración', () => {
    it('«4:9ss. (Autor, N)» conserva la oración entera', () => {
        const [cita] = parseCitations(
            'Adamson enumera un evangelio hebreo perdido y una paráfrasis de 1QS 4:9ss. (Adamson, 171).',
        );
        expect(cita!.evidence).toBe('Adamson enumera un evangelio hebreo perdido y una paráfrasis de 1QS 4:9ss.');
    });

    it('«ss.» a mitad de oración no la corta', () => {
        const [cita] = parseCitations('La paráfrasis de 1QS 4:9ss. propuesta por Gaster es tardía (Adamson, 171).');
        expect(cita!.evidence).toBe('La paráfrasis de 1QS 4:9ss. propuesta por Gaster es tardía');
    });

    it('«cf.» y «vv.» a mitad de oración no la cortan', () => {
        const [cita] = parseCitations('La misma idea aparece en el v. 6, cf. Pr 3:34, según Mayor (Mayor, 136).');
        expect(cita!.evidence).toBe('La misma idea aparece en el v. 6, cf. Pr 3:34, según Mayor');
    });

    it('un punto pegado a la cita pertenece a la oración que la cita respalda', () => {
        const [cita] = parseCitations('Primera idea. La fuente del dicho es desconocida. (Adamson, 170)');
        expect(cita!.evidence).toBe('La fuente del dicho es desconocida.');
    });

    it('el fin de oración real se sigue respetando', () => {
        const [cita] = parseCitations('Otra cosa distinta. La concesión de Mayor decide (Mayor, 133).');
        expect(cita!.evidence).toBe('La concesión de Mayor decide');
    });

    it('«etc.» que cierra una oración la cierra: no arrastra la anterior (revisión adversarial)', () => {
        const [cita] = parseCitations('Hay listas de vicios, virtudes, etc. Santiago contrapone dos sabidurías (Adamson, 171).');
        expect(cita!.evidence).toBe('Santiago contrapone dos sabidurías');
    });

    it('«ss.» que cierra una oración también la cierra', () => {
        const [cita] = parseCitations('Véase 1QS 4:9ss. Adamson ve un paralelo con Qumrán (Adamson, 171).');
        expect(cita!.evidence).toBe('Adamson ve un paralelo con Qumrán');
    });

    it('una abreviatura de la lista del dominio («Dr.») tampoco corta', () => {
        const [cita] = parseCitations('Primera idea. Según el Dr. Mayor la frase es causal (Mayor, 1).');
        expect(cita!.evidence).toBe('Según el Dr. Mayor la frase es causal');
    });
});

/** TP #8 (8b, D1): varias fuentes en un paréntesis, cada una juzgada por su parte. */
describe('parseCitations — un paréntesis con dos fuentes', () => {
    it('comparten la oración y cada una sabe de la otra', () => {
        const md = 'El ἐν indica la esfera del conflicto (Mayor, 129; Adamson, 166).';
        const [mayor, adamson] = parseCitations(md);
        expect(mayor!.evidence).toBe(adamson!.evidence);
        expect(mayor!.evidence).toContain('la esfera del conflicto');
        expect(mayor!.otherSources).toEqual(['Adamson']);
        expect(adamson!.otherSources).toEqual(['Mayor']);
    });

    it('dos paréntesis distintos no se mezclan', () => {
        const [a, b] = parseCitations('Uno (Mayor, 129). Otro (Adamson, 166).');
        expect(a).not.toHaveProperty('otherSources');
        expect(b).not.toHaveProperty('otherSources');
    });
});

/** TP #8 (8b, D2): la cita al comienzo de la oración y las letras fuera del plano básico. */
describe('parseCitations — evidencia hacia adelante y offsets UTF-16', () => {
    it('«Mayor (p. 314) lo discute…»: lo que respalda viene después', () => {
        const [c] = parseCitations('Introducción. Mayor (p. 314) lo discute con detalle y rechaza la lectura causal. Otra cosa.');
        expect(c!.evidence).toBe('lo discute con detalle y rechaza la lectura causal.');
    });

    it('con texto antes, sigue mirando hacia atrás', () => {
        const [c] = parseCitations('La lectura causal es la mejor (Mayor, 314). Otra cosa.');
        expect(c!.evidence).toContain('La lectura causal es la mejor');
    });

    it('una letra fuera del plano básico antes de la cita no corre los offsets', () => {
        const md = 'El testigo 𝔓⁴⁶ lee «πρὸς φθόνον» (Metzger, 683), y Mayor coincide (Mayor, 139).';
        const [metzger, mayor] = parseCitations(md);
        expect(metzger!.evidence).toBe('πρὸς φθόνον');
        expect(mayor!.evidence).toContain('Mayor coincide');
        expect(mayor!.evidence).not.toContain('683');
    });
});

describe('maskRanges — en unidades UTF-16', () => {
    it('tapa exactamente el tramo pedido aunque haya una letra fuera del plano básico antes', () => {
        const texto = '𝔓⁴⁶ lee (X, 1) y';
        const desde = texto.indexOf('(');
        const hasta = texto.indexOf(')') + 1;
        const tapado = maskRanges(texto, [{ offset: desde, end: hasta }]);
        expect(tapado.length).toBe(texto.length);
        expect(tapado.slice(0, desde)).toBe(texto.slice(0, desde));
        expect(tapado.slice(desde, hasta).trim()).toBe('');
        expect(tapado.slice(hasta)).toBe(' y');
    });
});

describe('parseCitations — la evidencia no cruza la cita anterior', () => {
    it('la segunda cita de la oración no carga con la primera', () => {
        const [, b] = parseCitations('Mayor lee la activa como pedir para sí (Mayor, 133), y Adamson la niega (Adamson, 167).');
        expect(b!.evidence).toBe('y Adamson la niega');
        expect(b!.evidence).not.toContain('pedir para sí');
    });
});
