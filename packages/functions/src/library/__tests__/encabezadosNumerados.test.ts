import { describe, expect, it } from 'vitest';
import {
    cortarPorHermanosNumerados,
    lugarDelHermano,
    numeracionDe,
    sigueLaNumeracion,
    tituloAlComienzo,
} from '../encabezadosNumerados';
import { chunkStructuredMarkdown } from '../markdownChunker';

/**
 * Medido en Robertson (2026-11-23): «VIII. The Genitive» llegó como título y
 * IX–XII como párrafos; en MODE, «2. CAUSAL SENTENCES» como título y 3–10
 * como texto.
 */
const relleno = 'Texto del cuerpo de la gramática con suficiente largo para formar un fragmento propio. '.repeat(4);

describe('numeracionDe', () => {
    it('romano con título en mayúscula, y arábigo; marca si el título está en mayúsculas', () => {
        expect(numeracionDe('VIII. The Genitive (True) Case (ἡ γενικὴ πτῶσις).')).toEqual({ estilo: 'romano', n: 8, mayusculas: false });
        expect(numeracionDe('IX. The Ablative ("Ablatival Genitive") Case')).toEqual({ estilo: 'romano', n: 9, mayusculas: false });
        expect(numeracionDe('5. TEMPORAL CLAUSES.')).toEqual({ estilo: 'arabigo', n: 5, mayusculas: true });
        // Lo que va entre paréntesis no cuenta para las mayúsculas.
        expect(numeracionDe('9. INDIRECT DISCOURSE (Oratio Obliqua).')?.mayusculas).toBe(true);
        expect(numeracionDe('2. Causal sentences')?.mayusculas).toBe(false);
    });

    it('no es numeración: romano no canónico, sigla, minúscula, sin espacio', () => {
        expect(numeracionDe('IIII. The Fourth')).toBeNull();
        expect(numeracionDe('IC. The Thing')).toBeNull();
        expect(numeracionDe('I. Cor. 13:4 dice')).toBeNull();
        expect(numeracionDe('C. H. Dodd sostiene')).toBeNull();
        expect(numeracionDe('V. the lower case')).toBeNull();
        expect(numeracionDe('VIII.The Genitive')).toBeNull();
        expect(numeracionDe('Genitive')).toBeNull();
        // Una cita, un título de menos de cinco letras.
        expect(numeracionDe('II. Thess. 2:3 speaks of the man')).toBeNull();
        expect(numeracionDe('II. Kings 5 dice que')).toBeNull();
        expect(numeracionDe('3. NOTA')).toBeNull();
        // «Vol.», «Section» no son un libro bíblico.
        expect(numeracionDe('Vol. 2:3 Index')).toBeNull();
        expect(numeracionDe('Section 2.3 Foo')).toBeNull();
    });
});

describe('referencias', () => {
    it('una referencia con su rango; una numeración decimal también; «1.2.1» no', () => {
        expect(numeracionDe('7.53-8.11 Pericope of the Adulteress')).toMatchObject({ estilo: 'referencia', n: 7053, fin: 8011, libro: '' });
        expect(numeracionDe('1:12–27 The Gospel Promise')).toMatchObject({ n: 1012, fin: 1027 });
        expect(numeracionDe('JAMES 2:1–7')).toMatchObject({ n: 2001, fin: 2007, libro: 'james' });
        expect(numeracionDe('8.44 οὐκ ἔστηκεν {D}')).toMatchObject({ n: 8044, fin: 8044 });
        expect(numeracionDe('1.2.1 El aoristo')).toBeNull();
    });
    it('hermana si empieza después de que la anterior termina; dentro de su rango, hija; otro libro, no', () => {
        const ref = (t: string) => numeracionDe(t)!;
        expect(sigueLaNumeracion(ref('7.53-8.11 Pericope'), ref('8.16 ἀληθινή'), true)).toBe(true);
        expect(sigueLaNumeracion(ref('7.53-8.11 Pericope'), ref('8.2 καὶ πᾶς'), true)).toBe(false);
        expect(sigueLaNumeracion(ref('JAMES 2:1–7'), ref('JUDE 1:8'), true)).toBe(false);
        // Del texto no se promueve una referencia.
        expect(sigueLaNumeracion(ref('7.53-8.11 Pericope'), ref('8.16 ἀληθινή'), false)).toBe(false);
    });
    it('Metzger: la perícopa es madre de 8.2–8.11 y no de lo que sigue, aunque la extracción cambie de nivel', () => {
        const md = `<!-- page: 1 -->\n# JOHN\n\n## 7.52 προφήτης\n\n${relleno}\n\n## 7.53-8.11 Pericope of the Adulteress\n\n${relleno}\n\n### 8.2 καὶ πᾶς\n\n${relleno}\n\n### 8.10 Ἰησοῦς\n\n${relleno}\n\n### 8.16 ἀληθινή\n\n${relleno}\n\n### 8.44 οὐκ ἔστηκεν\n\n${relleno}\n`;
        const rutas = [...new Set(chunkStructuredMarkdown(md).map(c => c.sectionPath.join(' › ')))];
        expect(rutas).toEqual([
            'JOHN › 7.52 προφήτης',
            'JOHN › 7.53-8.11 Pericope of the Adulteress',
            'JOHN › 7.53-8.11 Pericope of the Adulteress › 8.2 καὶ πᾶς',
            'JOHN › 7.53-8.11 Pericope of the Adulteress › 8.10 Ἰησοῦς',
            'JOHN › 8.16 ἀληθινή',
            'JOHN › 8.44 οὐκ ἔστηκεν',
        ]);
    });
});

describe('sigueLaNumeracion', () => {
    const r = (n: number) => ({ estilo: 'romano' as const, n, mayusculas: false });
    const a = (n: number, mayusculas = true) => ({ estilo: 'arabigo' as const, n, mayusculas });
    it('el siguiente, o hasta tres más (en MODE faltaban el 3 y el 4)', () => {
        expect(sigueLaNumeracion(r(8), r(9))).toBe(true);
        expect(sigueLaNumeracion(a(2), a(5))).toBe(true);
        expect(sigueLaNumeracion(a(2), a(6))).toBe(false);
    });
    it('no hacia atrás, no el mismo, no otro estilo', () => {
        expect(sigueLaNumeracion(r(9), r(8))).toBe(false);
        expect(sigueLaNumeracion(r(9), r(9))).toBe(false);
        expect(sigueLaNumeracion(r(1), a(2))).toBe(false);
    });
    it('el arábigo, solo en mayúsculas los dos: una lista del cuerpo no es un hermano', () => {
        expect(sigueLaNumeracion(a(1, false), a(2, false))).toBe(false);
        expect(sigueLaNumeracion(a(1, true), a(2, false))).toBe(false);
        expect(sigueLaNumeracion(a(1, false), a(2, true))).toBe(false);
    });
    it('el romano, con las mismas mayúsculas que su hermano', () => {
        expect(sigueLaNumeracion({ ...r(1), mayusculas: true }, r(2))).toBe(false);
    });
});

describe('tituloAlComienzo', () => {
    it('la línea entera, o hasta el punto que cierra el título fuera de paréntesis', () => {
        expect(tituloAlComienzo('X. The Locative (" Locatival Dative ") Case (ἡ τοπικὴ πτῶσις).\n\n(a) THE NAME')).toBe('X. The Locative (" Locatival Dative ") Case (ἡ τοπικὴ πτῶσις).');
        expect(tituloAlComienzo('IX. The Ablative ("Ablatival Genitive") Case (ἡ ἀφαιρετικὴ πτῶσις). The treatment of this case')).toBe('IX. The Ablative ("Ablatival Genitive") Case (ἡ ἀφαιρετικὴ πτῶσις).');
        expect(tituloAlComienzo('7. WISHES. The use of the optative')).toBe('7. WISHES.');
        // Un punto dentro del paréntesis no cierra el título.
        expect(tituloAlComienzo('IX. The Ablative (cf. Gen. 2) Case. The treatment')).toBe('IX. The Ablative (cf. Gen. 2) Case.');
        expect(tituloAlComienzo('Texto sin número')).toBeNull();
        // Un renglón larguísimo sin punto no es un título.
        expect(tituloAlComienzo(`5. ${'PALABRA '.repeat(30)}`)).toBeNull();
    });
});

describe('cortarPorHermanosNumerados', () => {
    const ruta = ['THE CASES', 'VIII. The Genitive'];
    it('corta en cada hermano siguiente, encadenado, y deja el texto de antes', () => {
        const cuerpo = `fin del genitivo.\n\nIX. The Ablative Case. Texto\n\nmás\n\nX. The Locative Case.\n\nTexto`;
        const tramos = cortarPorHermanosNumerados(cuerpo, ruta);
        expect(tramos.map(t => [t.titulo, t.indice])).toEqual([[null, null], ['IX. The Ablative Case.', 1], ['X. The Locative Case.', 1]]);
        expect(tramos.map(t => cuerpo.slice(t.desde, t.hasta)).join('')).toBe(cuerpo);
    });
    it('un número que no sigue, o un arábigo tras un salto de línea simple, no corta', () => {
        const cuerpo = `Ver el capítulo\n\nXV. The Far Case.\n\nII. The Earlier Case.`;
        expect(cortarPorHermanosNumerados(cuerpo, ruta).map(t => t.titulo)).toEqual([null]);
        expect(cortarPorHermanosNumerados('texto\n3. TEMPORAL CLAUSES.', ['MODE', '2. CAUSAL SENTENCES.']).map(t => t.titulo)).toEqual([null]);
    });
    it('un romano tras un salto de línea simple sí corta (la extracción no siempre deja el renglón en blanco)', () => {
        expect(cortarPorHermanosNumerados('fin.\nIX. The Ablative Case. Texto', ruta).map(t => t.titulo)).toEqual([null, 'IX. The Ablative Case.']);
    });
    it('prueba cada ancestro numerado: un romano es hermano de VIII aunque abajo haya un arábigo', () => {
        const t = cortarPorHermanosNumerados('fin.\n\nIX. The Ablative Case.', ['THE CASES', 'VIII. The Genitive', '1. MEANING OF THE GENITIVE']);
        expect(t.map(x => [x.titulo, x.indice])).toEqual([[null, null], ['IX. The Ablative Case.', 1]]);
    });
    it('sin encabezado numerado en la ruta, no corta nada', () => {
        expect(cortarPorHermanosNumerados('IX. The Ablative Case.', ['THE CASES']).map(t => t.titulo)).toEqual([null]);
    });
    it('una cita o una nota al pie no son un hermano (revisión adversarial)', () => {
        expect(cortarPorHermanosNumerados('x\n\nII. Thess. 2:3 speaks of the man', ['I. The Man of Sin']).map(t => t.titulo)).toEqual([null]);
        expect(cortarPorHermanosNumerados('x\n\n3. LXX. Cf. Gen. 4:3.', ['MODE', '2. CAUSAL SENTENCES.']).map(t => t.titulo)).toEqual([null]);
    });
});

describe('lugarDelHermano', () => {
    it('un numerado va donde está su hermano anterior, aunque llegue con otro nivel', () => {
        expect(lugarDelHermano(['THE CASES', 'VII. The Accusative'], 'VIII. The Genitive')).toBe(1);
        expect(lugarDelHermano(['THE CASES', 'VII. The Accusative', '(a) Detalle'], 'VIII. The Genitive')).toBe(1);
        expect(lugarDelHermano(['THE CASES'], 'VIII. The Genitive')).toBeNull();
        // Con dos candidatos, el inmediato anterior: «3. Next» es hermano de «2. The Text», no de «1. Greek».
        expect(lugarDelHermano(['Intro', '2. The Text', '1. Greek'], '3. Next Section')).toBe(1);
        expect(lugarDelHermano(['THE CASES', 'Aorist'], 'Genitive')).toBeNull();
    });
});

describe('chunkStructuredMarkdown — hermanos numerados', () => {
    it('Robertson: IX y X llegan como párrafos y abren su subsección; el genitivo no se arrastra', () => {
        const md = [
            `<!-- page: 1 -->\n# THE CASES\n\n## VII. The Accusative\n\n${relleno}\n\n### VIII. The Genitive (True) Case.\n\n${relleno}\n`,
            `<!-- page: 2 -->\n## THE CASES\n\n${relleno}\n\nIX. The Ablative ("Ablatival Genitive") Case. ${relleno}\n`,
            `<!-- page: 3 -->\n## THE CASES\n\n${relleno}\n\nX. The Locative Case.\n\n${relleno}\n`,
            `<!-- page: 4 -->\n## THE CASES\n\n${relleno}\n`,
        ].join('');
        const cs = chunkStructuredMarkdown(md);
        const rutas = (hoja: number) => [...new Set(cs.filter(c => c.page === hoja).map(c => c.sectionPath.join(' › ')))];
        // El genitivo es hermano del acusativo, aunque llegó con «###».
        expect(rutas(1)).toEqual(['THE CASES › VII. The Accusative', 'THE CASES › VIII. The Genitive (True) Case.']);
        expect(rutas(2)).toEqual(['THE CASES › VIII. The Genitive (True) Case.', 'THE CASES › IX. The Ablative ("Ablatival Genitive") Case.']);
        expect(rutas(3)).toEqual(['THE CASES › IX. The Ablative ("Ablatival Genitive") Case.', 'THE CASES › X. The Locative Case.']);
        expect(rutas(4)).toEqual(['THE CASES › X. The Locative Case.']);
        // No se pierde texto: el párrafo del encabezado queda en su fragmento.
        expect(cs.some(c => c.text.startsWith('IX. The Ablative'))).toBe(true);
    });

    it('poner un título en el lugar de su hermano solo lo SUBE (BECNT de Santiago, hoja 152)', () => {
        // «II. Overview» repetido arriba de la página quedó bajo «# E.»; «# III.» llega con nivel 1 y no baja a colgar de él.
        const md = `<!-- page: 1 -->\n# E. True Religion (1:26–27)\n\n${relleno}\n\n## II. Overview of the Life of Faith\n\n### E. True Religion\n\n${relleno}\n\n# III. First Discourse: Faith and Behavior (2:1–26)\n\n${relleno}\n`;
        expect(chunkStructuredMarkdown(md).at(-1)?.sectionPath).toEqual(['III. First Discourse: Faith and Behavior (2:1–26)']);
    });

    it('un hermano marcado necesita las mismas mayúsculas: no sube por encima del capítulo (revisión adversarial)', () => {
        const md = `<!-- page: 1 -->\n# 3. THE VERB\n\n## 2. Mood\n\n${relleno}\n\n## 4. Voice\n\n${relleno}\n`;
        expect(chunkStructuredMarkdown(md).at(-1)?.sectionPath).toEqual(['3. THE VERB', '4. Voice']);
        const md2 = `<!-- page: 1 -->\n# 1. INTRODUCCIÓN\n\n## Fuentes\n\n${relleno}\n\n### 2. Josefo y su obra\n\n${relleno}\n`;
        expect(chunkStructuredMarkdown(md2).at(-1)?.sectionPath).toEqual(['1. INTRODUCCIÓN', 'Fuentes', '2. Josefo y su obra']);
    });

    it('una letra de lista no es un romano lejano: «C. Los objetos» no reemplaza a «III.» (Ryrie)', () => {
        const md = `<!-- page: 1 -->\n# ORDENANZAS\n\n## III. LA ORDENANZA DEL BAUTISMO\n\n${relleno}\n\n### C. Los objetos del bautismo\n\n${relleno}\n`;
        expect(chunkStructuredMarkdown(md).at(-1)?.sectionPath).toEqual(['ORDENANZAS', 'III. LA ORDENANZA DEL BAUTISMO', 'C. Los objetos del bautismo']);
    });

    it('MODE: el arábigo en mayúsculas salta del 2 al 5 y sigue; una lista del cuerpo no corta', () => {
        const md = [
            `<!-- page: 1 -->\n# MODE\n\n### 2. CAUSAL SENTENCES.\n\n${relleno}\n\n3. El verbo indica algo.\n\n4. Otra cosa.\n`,
            `<!-- page: 2 -->\n# MODE\n\n${relleno}\n\n5. TEMPORAL CLAUSES.\n\n${relleno}\n`,
            `<!-- page: 3 -->\n# MODE\n\n6. FINAL AND CONSECUTIVE CLAUSES.\n\n${relleno}\n`,
            `<!-- page: 4 -->\n# MODE\n\n${relleno}\n`,
        ].join('');
        const cs = chunkStructuredMarkdown(md);
        expect(cs.filter(c => c.page === 1).every(c => c.section === '2. CAUSAL SENTENCES.')).toBe(true);
        expect(cs.filter(c => c.page === 2).at(-1)?.section).toBe('5. TEMPORAL CLAUSES.');
        expect(cs.find(c => c.page === 4)?.sectionPath).toEqual(['MODE', '6. FINAL AND CONSECUTIVE CLAUSES.']);
    });
});
