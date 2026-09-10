import { describe, it, expect } from 'vitest';
import { parseCitations } from '../citationParser';

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
