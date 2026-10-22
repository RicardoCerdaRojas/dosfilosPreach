import { describe, expect, it } from 'vitest';
import { findQuoteInPageText, lemmaKey as lemmaKeyDelDominio } from '@dosfilos/domain';
import { conElIndiceDePasajes, foldForSearch, griegoPlegado, lemmaEntriesIn, lemmaKey, lemmaOccurrencesIn, lemmaSheetsIn, occurrencesIn, snippetAround, soloConsonantes, referenceOccurrencesIn, referenceRegExp, referenceVersesFromRefs, recortarPorRelevancia, hojasDevueltas } from '../documentTextSearch';

/**
 * Los dos buscadores tienen que plegar IGUAL.
 *
 * Uno corre en el servidor sobre los fragmentos del libro y dice «está en
 * la hoja 454»; el otro corre en el navegador sobre la capa de texto de
 * esa hoja y la resalta. Si uno cuenta una palabra partida por el guion
 * del renglón y el otro no, el libro manda al lector a una hoja que
 * responde «sin coincidencias».
 */
describe('paridad con el buscador de la hoja abierta (@dosfilos/domain)', () => {
    const casos: Array<[string, string]> = [
        ['Polel', 'to restore (Polel for Piel) (lit., make restored)'],
        ['polel', 'The Polel functions as the Piel'],           // mayúsculas
        ['restored', 'make re-\nstored Jacob to him'],           // guion de renglón
        ['la casa', 'entró en lacasa'],                          // espacios
        ['"cita"', 'una «cita» entre comillas'],                 // comillas
        // Sin vocales ni acentos (pedido del fundador, 2026-10-15).
        ['גיא', 'גַּ֘ם כִּֽי־אֵלֵ֨ךְ בְּגֵ֪יא צַלְמָ֡וֶת'],              // niqud y cantilación (BHS, Sal 23:4)
        ['כי אלך', 'גַּ֘ם כִּֽי־אֵלֵ֨ךְ בְּגֵ֪יא'],                     // maqaf
        ['προ παντων', 'There is a new note sounded by πρὸ πάντων here'], // acentos griegos
        ['λογος', 'ὁ Λόγος σὰρξ ἐγένετο'],                         // mayúscula y sigma final
        ['τῷ λογῳ', 'ἐν τῷ λόγῳ'],                                   // iota suscrita
        ['exegesis', 'la exégesis del pasaje'],                    // acentos latinos
    ];

    it.each(casos)('«%s» se encuentra en los dos lados', (termino, texto) => {
        expect(occurrencesIn(texto, foldForSearch(termino).text).length).toBeGreaterThan(0);
        // El visor busca lo que el lector escribe ignorando marcas, como el servidor.
        expect(findQuoteInPageText(termino, texto, { ignorarMarcas: true })).not.toBeNull();
    });

    it('la ñ no se pliega: «año» no encuentra «ano»', () => {
        expect(occurrencesIn('el ano', foldForSearch('año').text)).toEqual([]);
        expect(findQuoteInPageText('año', 'el ano', { ignorarMarcas: true })).toBeNull();
    });

    it('lo que no está, no está en ninguno de los dos', () => {
        const texto = 'The Hiphil delocutive pertains to the causing of an event.';
        expect(occurrencesIn(texto, foldForSearch('Polel').text)).toEqual([]);
        expect(findQuoteInPageText('Polel', texto, { ignorarMarcas: true })).toBeNull();
    });
});

describe('occurrencesIn', () => {
    it('cuenta todas las apariciones, no la primera', () => {
        expect(occurrencesIn('Polel, Polal y Polel otra vez', foldForSearch('polel').text)).toHaveLength(2);
    });

    it('las posiciones apuntan al texto original', () => {
        const texto = 'antes del Polel';
        const [at] = occurrencesIn(texto, foldForSearch('Polel').text);
        expect(texto.slice(at!, at! + 5)).toBe('Polel');
    });

    it('sin vocales, la posición cae sobre la palabra con sus puntos', () => {
        const texto = 'גַּ֘ם כִּֽי־אֵלֵ֨ךְ בְּגֵ֪יא צַלְמָ֡וֶת';
        const [at] = occurrencesIn(texto, foldForSearch('גיא').text);
        expect(texto.normalize('NFC').slice(at!, at! + 5).startsWith('ג')).toBe(true);
    });

    it('un término vacío no encuentra nada', () => {
        expect(occurrencesIn('cualquier cosa', '')).toEqual([]);
    });
});

describe('snippetAround', () => {
    it('devuelve una sola línea con el término dentro', () => {
        const texto = 'The same difference can be seen with שוב.\n2a. to restore (Polel for Piel) (lit., make restored) Jacob to him';
        const [at] = occurrencesIn(texto, foldForSearch('Polel').text);
        const s = snippetAround(texto, at!);
        expect(s).toContain('Polel');
        expect(s).not.toContain('\n');
    });

    it('marca con puntos suspensivos que hay más texto alrededor', () => {
        const largo = `${'x'.repeat(500)}Polel${'y'.repeat(500)}`;
        const s = snippetAround(largo, 500);
        expect(s.startsWith('…')).toBe(true);
        expect(s.endsWith('…')).toBe(true);
    });
});

describe('búsqueda por lema', () => {
    it('exige palabra entera: «שוב» no cuenta dentro de otra palabra', () => {
        const texto = 'וַיָּשׁוּבוּ el verbo compuesto';
        expect(lemmaOccurrencesIn(texto, soloConsonantes('שׁוּב'))).toEqual([]);
    });

    it('encuentra la entrada del léxico aunque las vocales no coincidan', () => {
        // El análisis escribe «שׁוּב»; el léxico encabeza «שוב».
        const entrada = '7725 שוב QAL: Volver, regresar';
        expect(lemmaOccurrencesIn(entrada, soloConsonantes('שׁוּב'))).toHaveLength(1);
    });

    it('cuenta todas las veces que la entrada nombra su lema', () => {
        const texto = 'נפש alma; נפש vida; נפשי mi alma';
        expect(lemmaOccurrencesIn(texto, soloConsonantes('נֶפֶשׁ'))).toHaveLength(2);
    });

    it('un lema sin consonantes no busca nada', () => {
        expect(lemmaOccurrencesIn('cualquier texto', soloConsonantes('...'))).toEqual([]);
    });
});

describe('modo referencia — dónde nombra el libro al pasaje', () => {
    const NOMBRES = ['santiago', 'james', 'stg', 'jas', 'sant', 'jam'];
    const santiago2 = (c: number, v: number) => c === 2 && v >= 1 && v <= 13;
    const buscar = (texto: string) =>
        referenceOccurrencesIn(texto, referenceRegExp(NOMBRES), santiago2);

    it('encuentra la cita tal como Wallace la escribe', () => {
        // El caso testigo: la hoja 515 de Wallace, donde discute el participio
        // adverbial de 2:9 y dice «otra opción posible es la de resultado».
        const r = buscar('Santiago 2:9 εἰ δὲ προσωπολημπτεῖτε, ἁμαρτίαν ἐργάζεσθε');
        expect(r.verses).toEqual([9]);
        expect(r.at).toHaveLength(1);
    });

    it('y las grafías abreviadas que usan el léxico y la gramática', () => {
        expect(buscar('la partícula aparece en Stg. 2.8 y en otros').verses).toEqual([8]);
        expect(buscar('cf. Jas 2:2 for the example').verses).toEqual([2]);
        expect(buscar('James 2 : 9 con el corte de renglón').verses).toEqual([9]);
    });

    it('un versículo de otro capítulo del mismo libro NO cuenta', () => {
        // Porter cita «Jas. 5:2-3» en la hoja 41 como ejemplo de otra cosa.
        // Ocho de once tramos propuestos entraron por citas así.
        expect(buscar('como en Jas. 5:2-3, el perfecto').verses).toEqual([]);
        expect(buscar('Santiago 2:14 ya es otro párrafo').verses).toEqual([]);
    });

    it('una hoja que discute varios versículos los reporta todos', () => {
        const r = buscar('compárese Santiago 2:2 con Stg. 2:4 y con 2:6');
        expect(r.verses).toEqual([2, 4]);
    });

    it('un nombre que no es el del libro no dispara nada', () => {
        expect(buscar('Juan 2:9 convirtió el agua en vino').verses).toEqual([]);
    });

    it('la grafía más larga gana, aunque llegue última en la lista', () => {
        // La alternancia de JavaScript se queda con la PRIMERA que entra. Con
        // «jas» antes que «james», el motor consume «jas» de «james 2:9»,
        // falla al pedir la cifra contra la «e», y la cita se pierde.
        const alReves = referenceRegExp(['jas', 'jam', 'james']);
        expect(referenceOccurrencesIn('James 2:9 dice', alReves, santiago2).verses).toEqual([9]);
        expect(referenceOccurrencesIn('Jas 2:9 dice', alReves, santiago2).verses).toEqual([9]);
    });

    it('las grafías se escapan: un punto del alias no es comodín', () => {
        // Sin escapar, «s.g» de un alias con punto haría de «sog 2:9» una cita.
        expect(referenceOccurrencesIn('sxg 2:9', referenceRegExp(['s.g']), santiago2).verses).toEqual([]);
        expect(referenceOccurrencesIn('s.g 2:9', referenceRegExp(['s.g']), santiago2).verses).toEqual([9]);
    });
});


/**
 * «Páginas por lema» no funcionaba con léxicos griegos: la clave del lema sólo
 * reconocía consonantes hebreas y un lema griego quedaba vacío.
 */
describe('lemas griegos', () => {
    it('la clave pliega acentos, espíritus, mayúsculas y sigma final', () => {
        expect(lemmaKey('ἐλέγχω')).toBe('ελεγχω');
        expect(lemmaKey('Κόσμος')).toBe(lemmaKey('κοσμος'));
    });

    it('encuentra la entrada de BDAG como palabra entera', () => {
        const pagina = 'ἐλέγχω fut. ἐλέγξω … 1. to scrutinize … cp. ἐλεγχόμενος';
        expect(lemmaOccurrencesIn(pagina, lemmaKey('ἐλέγχω'))).toHaveLength(1);
    });

    it('un léxico guardado en NFD también encuentra el lema (revisión adversarial de B2)', () => {
        const pagina = 'ἐλέγχω fut. ἐλέγξω'.normalize('NFD');
        expect(lemmaOccurrencesIn(pagina, lemmaKey('ἐλέγχω'))).toHaveLength(1);
    });

    it('la sigma lunada es σ', () => {
        expect(lemmaKey('κόϲμοϲ')).toBe(lemmaKey('κόσμος'));
    });

    it('paridad con el dominio: las dos claves pliegan igual', () => {
        for (const w of ['ἐλέγχω', 'Λόγος', 'κόσμος', 'שׁוּב', 'קִיקָיוֹן', 'πίστις', 'κόϲμοϲ', 'ἐλέγχω'.normalize('NFD'), 'חָרָה־לְךָ', 'הַקִּיקָיֽוֹן׃']) {
            expect(lemmaKey(w)).toBe(lemmaKeyDelDominio(w));
        }
    });
});

/** Una lectura del libro para todos los lemas, en vez de una por lema. */
describe('lemmaSheetsIn', () => {
    const chunks = [
        { text: 'קִיקָיוֹן n.m. a plant … קִיקָיוֹן', sheet: 440, section: null },
        { text: 'see קיקיון', sheet: 12, section: null },
        { text: 'חוּס vb. pity, look upon with compassion', sheet: 120, section: null },
    ];

    it('devuelve las hojas de cada lema, la de más apariciones primero', () => {
        const r = lemmaSheetsIn(chunks, [lemmaKey('קִיקָיוֹן'), lemmaKey('חוּס')], 10);
        expect(r[lemmaKey('קִיקָיוֹן')]!.map(h => h.sheet)).toEqual([440, 12]);
        expect(r[lemmaKey('חוּס')]!.map(h => h.sheet)).toEqual([120]);
    });

    it('respeta el tope por lema', () => {
        const r = lemmaSheetsIn(chunks, [lemmaKey('קִיקָיוֹן')], 1);
        expect(r[lemmaKey('קִיקָיוֹן')]).toHaveLength(1);
    });
});

/**
 * TP #8 (2026-10-21, fase 8a, A1): la búsqueda por referencia sólo leía la
 * forma «Libro c:v» del texto. El índice `refs` del fragmento encuentra lo que
 * esa forma pierde.
 */
describe('referenceVersesFromRefs · el índice de pasajes del fragmento', () => {
    const santiago4 = (c: number, v: number) => c === 4 && v >= 1 && v <= 10;

    it('devuelve los versículos del pasaje que nombra `refs`', () => {
        // Wallace, p. 533: «Jas 4:5, 6» — la regex sólo da 4:5; `refs` trae los dos.
        expect(referenceVersesFromRefs(['JAS.4', 'JAS.4.5', 'JAS.4.6', 'ROM.9.15'], 'JAS', santiago4)).toEqual([5, 6]);
    });

    it('ignora otros libros, otros capítulos y claves de capítulo sin versículo', () => {
        expect(referenceVersesFromRefs(['JAS.3.6', 'JAS.4', 'JON.4.2', 'JAS.4.11'], 'JAS', santiago4)).toEqual([]);
    });

    it('sin libro o sin `refs` no inventa nada', () => {
        expect(referenceVersesFromRefs(['JAS.4.2'], '', santiago4)).toEqual([]);
        expect(referenceVersesFromRefs(undefined, 'JAS', santiago4)).toEqual([]);
    });

    it('suma lo de `refs` a lo de la regex; si sólo `refs` lo nombra, la hoja cuenta', () => {
        expect(conElIndiceDePasajes({ at: [12], verses: [5] }, [5, 6])).toEqual({ at: [12], verses: [5, 6] });
        expect(conElIndiceDePasajes({ at: [], verses: [] }, [3])).toEqual({ at: [0], verses: [3] });
        expect(conElIndiceDePasajes({ at: [7], verses: [2] }, [])).toEqual({ at: [7], verses: [2] });
    });
});


/**
 * TP #8 (2026-10-21, fase 8a, A2). El texto es el de Tuggy en producción ese
 * día (fragmentos 3531–3535 y la entrada αἰτέω de la h. 37).
 */
describe('lemmaEntriesIn · dónde empieza y termina la entrada de un lema', () => {
    const tuggy = [
        { chunkIndex: 3531, sheet: 584, text: '**Μελίτη, ης, ἡ.** *Malta*: Hch. 28:1.' },
        { chunkIndex: 3532, sheet: 584, text: 'C) Forma conjugada sin inf. *Esperar, demorar*: Hch. 22:16.' },
        { chunkIndex: 3533, sheet: 584, text: '**μέλος, ους, τό.** *Miembro, parte del cuerpo*. A.T. הֶגֶה Ez. 2:10.' },
        { chunkIndex: 3534, sheet: 585, text: 'N.T., Mt. 5:29–30; Ro. 6:13; 1 Co. 12:12; Stg. 3:5–6; Stg. 4:1.' },
        { chunkIndex: 3535, sheet: 585, text: '**Μελχί, ὁ.** Nombre prop. indecl., en la genealogía de Jesús.' },
    ];

    it('μέλος empieza en la 584, donde está la definición, y llega a la 585', () => {
        expect(lemmaEntriesIn(tuggy, [griegoPlegado('μέλος')])).toEqual({ [griegoPlegado('μέλος')]: { startSheet: 584, endSheet: 585 } });
    });

    it('una entrada que termina en su hoja no se estira', () => {
        const fragmentos = [
            { chunkIndex: 1, sheet: 37, text: '154\n\n**αἰτέω.** (impera. αἴτει, med. αἰτοῦ). *Pedir, suplicar*.' },
            { chunkIndex: 2, sheet: 37, text: '155\n\n**αἰσχύνη, ης, ἡ.** *Vergüenza*.' },
        ];
        expect(lemmaEntriesIn(fragmentos, [griegoPlegado('αἰτέω')])[griegoPlegado('αἰτέω')]).toEqual({ startSheet: 37, endSheet: 37 });
    });

    it('reconoce un título markdown como comienzo de entrada (diccionarios)', () => {
        const kittel = [
            { chunkIndex: 10, sheet: 31, text: '## αἰτέω [pedir], ἀπαιτέω\n\nEl uso general no apoya una distinción…' },
            { chunkIndex: 11, sheet: 33, text: 'sigue la entrada' },
            { chunkIndex: 12, sheet: 34, text: '## αἴτημα\n\n«Solicitud»' },
        ];
        expect(lemmaEntriesIn(kittel, [griegoPlegado('αἰτέω')])[griegoPlegado('αἰτέω')]).toEqual({ startSheet: 31, endSheet: 34 });
    });

    it('una mención en negrita a mitad de renglón no abre entrada', () => {
        const texto = [{ chunkIndex: 1, sheet: 9, text: 'Véase también **μέλος** en la p. 584.' }];
        expect(lemmaEntriesIn(texto, [griegoPlegado('μέλος')])).toEqual({});
    });

    it('la entrada se corta en el tope de hojas', () => {
        const largo = [
            { chunkIndex: 1, sheet: 100, text: '**λόγος, ου, ὁ.** *Palabra*.' },
            { chunkIndex: 2, sheet: 130, text: '**λοιδορέω.** *Injuriar*.' },
        ];
        expect(lemmaEntriesIn(largo, [griegoPlegado('λόγος')], 8)[griegoPlegado('λόγος')]).toEqual({ startSheet: 100, endSheet: 107 });
    });
});

/** Revisión de 8a: el modo referencia recortaba las 80 primeras hojas por número. */
describe('recortarPorRelevancia', () => {
    it('se queda con lo que más nombra, aunque caiga al final del libro, y lo devuelve en orden de hoja', () => {
        const hojas = [
            ...Array.from({ length: 5 }, (_, i) => ({ sheet: i + 1, count: 1, verses: [1] })),
            { sheet: 938, count: 1, verses: [2, 3] },
            { sheet: 700, count: 9, verses: [1] },
        ];
        expect(recortarPorRelevancia(hojas, 2).map(h => h.sheet)).toEqual([700, 938]);
    });

    it('sin versículos, por apariciones', () => {
        expect(recortarPorRelevancia([{ sheet: 1, count: 1 }, { sheet: 2, count: 5 }], 1).map(h => h.sheet)).toEqual([2]);
    });
});

describe('hojasDevueltas', () => {
    const muchas = [
        ...Array.from({ length: 85 }, (_, i) => ({ sheet: i + 1, count: 1, verses: [1] })),
        { sheet: 938, count: 1, verses: [2, 3] },
    ];
    it('en modo referencia, la hoja del final que nombra más versículos entra', () => {
        expect(hojasDevueltas('referencia', muchas).map(h => h.sheet)).toContain(938);
    });
    it('en modo texto, por número de hoja como siempre', () => {
        expect(hojasDevueltas('texto', muchas).map(h => h.sheet)).not.toContain(938);
    });
});
