import { describe, expect, it } from 'vitest';
import { sectionsBehindAssembly } from '../assemblyContents';
import type { ExegeticalPaper } from '../../entities/ExegeticalPaper';
import type { ExegeticalStep, ExegeticalStepVersion } from '../../entities/ExegeticalStep';

const dia = (n: number) => new Date(2026, 9, n);

const version = (
    id: string,
    markdown: string,
    createdAt: Date = dia(9),
    origin: ExegeticalStepVersion['origin'] = 'generated',
): ExegeticalStepVersion => ({ id, markdown, createdAt, origin } as ExegeticalStepVersion);

const conclusion = (accepted: ExegeticalStepVersion, extra: Partial<ExegeticalStep> = {}): ExegeticalStep =>
    ({ id: 'c', kind: 'conclusion', order: 5, verseRef: null, accepted, current: accepted, versions: [accepted], ...extra } as ExegeticalStep);

const ensamble = (versions: ExegeticalStepVersion[], accepted: ExegeticalStepVersion | null): ExegeticalStep =>
    ({ id: 'a', kind: 'assembly', order: 99, versions, accepted, current: versions[versions.length - 1] } as ExegeticalStep);

const VIEJA = 'La prosa vieja de la conclusión, tal como se ensambló.';
const OTRA = 'Otro párrafo del trabajo que nadie tocó después de ensamblar.';
const MAS = 'Un tercer párrafo del trabajo, también sin cambios desde entonces.';
const DOCUMENTO = `# Título\n\n---\n\n## Introducción\n\n${OTRA}\n\n${MAS}\n\n---\n\n## Conclusión\n\n${VIEJA}\n`;
const GENERADO = version('g', DOCUMENTO, dia(10));

const trabajo = (steps: ExegeticalStep[], assembledMarkdown: string | null = DOCUMENTO): ExegeticalPaper =>
    ({ steps, assembledMarkdown } as ExegeticalPaper);

const etiquetas = (paper: ExegeticalPaper) => sectionsBehindAssembly(paper, 'es').map(p => p.label);
const NUEVA = 'La prosa nueva de la conclusión, que no llegó al archivo.';

describe('sectionsBehindAssembly — lo aceptado que no llegó al Word', () => {
    it('un texto que el ensamble no traía y el archivo tampoco se avisa', () => {
        expect(etiquetas(trabajo([conclusion(version('c2', NUEVA)), ensamble([GENERADO], GENERADO)]))).toEqual(['Conclusión']);
    });

    it('el mismo texto que el ensamble traía no se avisa', () => {
        expect(etiquetas(trabajo([conclusion(version('c2', VIEJA)), ensamble([GENERADO], GENERADO)]))).toEqual([]);
    });

    it('una corrección a mano en el archivo se respeta: la sección no cambió', () => {
        const doc = DOCUMENTO.replace(VIEJA, 'La prosa corregida a mano en el documento mismo.');
        expect(etiquetas(trabajo([conclusion(version('c1', VIEJA)), ensamble([GENERADO], GENERADO)], doc))).toEqual([]);
    });

    it('una edición a mano del ensamble no mueve la comparación: lo que no llegó se avisa', () => {
        const aMano = version('e', DOCUMENTO, dia(14), 'edited');
        expect(etiquetas(trabajo([conclusion(version('c2', NUEVA)), ensamble([GENERADO, aMano], aMano)]))).toEqual(['Conclusión']);
    });

    it('una corrección a mano nacida del primer ensamble no se compara con uno regenerado y descartado', () => {
        const descartado = version('g2', DOCUMENTO.replace(VIEJA, NUEVA), dia(12));
        const aMano = { ...version('e', DOCUMENTO, dia(14), 'edited'), parentVersionId: 'g' } as ExegeticalStepVersion;
        expect(etiquetas(trabajo([conclusion(version('c2', NUEVA)), ensamble([GENERADO, descartado, aMano], aMano)]))).toEqual(['Conclusión']);
    });

    it('sube por las madres hasta el generado', () => {
        const primera = { ...version('e1', DOCUMENTO, dia(14), 'edited'), parentVersionId: 'g2' } as ExegeticalStepVersion;
        const segunda = { ...version('e2', DOCUMENTO, dia(15), 'edited'), parentVersionId: 'e1' } as ExegeticalStepVersion;
        const g2 = version('g2', DOCUMENTO.replace(VIEJA, NUEVA), dia(12));
        expect(etiquetas(trabajo([conclusion(version('c2', NUEVA)), ensamble([GENERADO, g2, primera, segunda], segunda)]))).toEqual([]);
    });

    it('una cadena rota no se queda colgada', () => {
        const a = { ...version('a', DOCUMENTO, dia(14), 'edited'), parentVersionId: 'b' } as ExegeticalStepVersion;
        const b = { ...version('b', DOCUMENTO, dia(15), 'edited'), parentVersionId: 'a' } as ExegeticalStepVersion;
        expect(etiquetas(trabajo([conclusion(version('c1', VIEJA)), ensamble([a, b], b)]))).toEqual([]);
    });

    it('un ensamble regenerado sin aceptar no mueve la comparación: el archivo sigue siendo el viejo', () => {
        const sinAceptar = version('g2', DOCUMENTO.replace(VIEJA, NUEVA), dia(14));
        expect(etiquetas(trabajo([conclusion(version('c2', NUEVA)), ensamble([GENERADO, sinAceptar], GENERADO)]))).toEqual(['Conclusión']);
    });

    it('sin versión aceptada del ensamble se compara con la que está a la vista', () => {
        expect(etiquetas(trabajo([conclusion(version('c2', NUEVA)), ensamble([GENERADO], null)]))).toEqual(['Conclusión']);
    });

    it('sin versión generada se compara con la más antigua', () => {
        const aMano = version('e', DOCUMENTO, dia(14), 'edited');
        expect(etiquetas(trabajo([conclusion(version('c2', NUEVA)), ensamble([aMano], aMano)]))).toEqual(['Conclusión']);
    });

    it('sin versión generada, una corrección a mano sobre la más antigua sigue siendo corrección', () => {
        const primera = version('e1', DOCUMENTO, dia(10), 'edited');
        const corregida = version('e2', DOCUMENTO.replace(VIEJA, 'La prosa corregida a mano en el documento mismo.'), dia(14), 'edited');
        expect(etiquetas(trabajo([conclusion(version('c1', VIEJA)), ensamble([primera, corregida], corregida)], corregida.markdown))).toEqual([]);
    });

    it('la comparación es con el ensamble generado, no con la corrección a mano que vino después', () => {
        const corregida = version('e', DOCUMENTO.replace(VIEJA, 'La prosa corregida a mano en el documento mismo.'), dia(14), 'edited');
        expect(etiquetas(trabajo([conclusion(version('c1', VIEJA)), ensamble([GENERADO, corregida], corregida)], corregida.markdown))).toEqual([]);
    });

    it('lo que entró al archivo en su sitio no se avisa', () => {
        const doc = DOCUMENTO.replace(VIEJA, NUEVA);
        expect(etiquetas(trabajo([conclusion(version('c2', NUEVA)), ensamble([GENERADO], GENERADO)], doc))).toEqual([]);
    });

    it('la oración pegada a mano en el archivo, con la línea entera, no se avisa', () => {
        const nueva = `${VIEJA} Y una oración agregada.`;
        const anterior = version('c1', VIEJA);
        const actual = version('c2', nueva);
        const doc = DOCUMENTO.replace(VIEJA, nueva);
        expect(etiquetas(trabajo([conclusion(actual, { versions: [anterior, actual] }), ensamble([GENERADO], GENERADO)], doc))).toEqual([]);
    });

    it('un párrafo borrado que sigue en el archivo se avisa', () => {
        const borrado = 'Un párrafo entero que el autor quitó de la conclusión.';
        const anterior = version('c1', `${VIEJA}\n\n${borrado}`);
        const actual = version('c2', VIEJA);
        const generado = version('g', `${DOCUMENTO}\n${borrado}\n`, dia(10));
        expect(etiquetas(trabajo([conclusion(actual, { versions: [anterior, actual] }), ensamble([generado], generado)], `${DOCUMENTO}\n${borrado}\n`))).toEqual(['Conclusión']);
    });

    it('una línea que otra versión comparte con la aceptada no es texto quitado', () => {
        const anterior = version('c1', `${VIEJA}\n\nOtra cosa que ya no está.`);
        const actual = version('c2', VIEJA);
        expect(etiquetas(trabajo([conclusion(actual, { versions: [anterior, actual] }), ensamble([GENERADO], GENERADO)]))).toEqual([]);
    });

    it('una línea breve de otra versión no prueba nada: puede estar por otra razón', () => {
        const anterior = version('c1', `${VIEJA}\n\nEn conclusión`);
        const actual = version('c2', VIEJA);
        const doc = `En conclusión\n\n${DOCUMENTO}`;
        expect(etiquetas(trabajo([conclusion(actual, { versions: [anterior, actual] }), ensamble([GENERADO], GENERADO)], doc))).toEqual([]);
    });

    it('una línea corta, pero de cuatro palabras o más, sí prueba', () => {
        const corta = 'Véase también Ross, p. 12.';
        const anterior = version('c1', `${VIEJA}\n\n${corta}`);
        const actual = version('c2', VIEJA);
        const doc = `${DOCUMENTO}\n${corta}\n`;
        expect(etiquetas(trabajo([conclusion(actual, { versions: [anterior, actual] }), ensamble([GENERADO], GENERADO)], doc))).toEqual(['Conclusión']);
    });

    it('un separador no es prosa', () => {
        expect(etiquetas(trabajo([conclusion(version('c2', `${VIEJA}\n\n----`)), ensamble([GENERADO], GENERADO)]))).toEqual([]);
    });

    it('la prosa recompuesta que se deshizo y sigue en el archivo se avisa', () => {
        const deshecha = { ...version('c1', VIEJA), previousProse: { markdown: NUEVA, undone: true } };
        const doc = DOCUMENTO.replace(VIEJA, NUEVA);
        expect(etiquetas(trabajo([conclusion(deshecha), ensamble([GENERADO], GENERADO)], doc))).toEqual(['Conclusión']);
    });

    it('sin prosa aceptada, con la de otra versión todavía en el archivo, se avisa', () => {
        const sinProsa = version('c1', '');
        const conProsa = version('c2', VIEJA);
        expect(etiquetas(trabajo([conclusion(sinProsa, { versions: [sinProsa, conProsa] }), ensamble([GENERADO], GENERADO)]))).toEqual(['Conclusión']);
    });

    it('sin prosa aceptada y sin nada en el archivo, no hay qué avisar', () => {
        const sinProsa = version('c1', '');
        const conProsa = version('c2', NUEVA);
        expect(etiquetas(trabajo([conclusion(sinProsa, { versions: [sinProsa, conProsa] }), ensamble([GENERADO], GENERADO)]))).toEqual([]);
    });

    it('excluir una sección después de ensamblar se avisa si su texto sigue ahí', () => {
        expect(etiquetas(trabajo([conclusion(version('c1', VIEJA), { includeInDocument: false }), ensamble([GENERADO], GENERADO)]))).toEqual(['Conclusión']);
    });

    it('excluida, también cuenta el texto de otra versión o el que se deshizo', () => {
        const anterior = version('c1', NUEVA);
        const deshecha = { ...version('c2', VIEJA.replace('vieja', 'otra')), previousProse: { markdown: VIEJA, undone: true } };
        expect(etiquetas(trabajo([conclusion(deshecha, { versions: [deshecha], includeInDocument: false }), ensamble([GENERADO], GENERADO)]))).toEqual(['Conclusión']);
        const doc = DOCUMENTO.replace(VIEJA, NUEVA);
        expect(etiquetas(trabajo([conclusion(version('c2', VIEJA), { versions: [anterior], includeInDocument: false }), ensamble([GENERADO], GENERADO)], doc))).toEqual(['Conclusión']);
    });

    it('la prosa deshecha de una versión que no es la aceptada también cuenta', () => {
        const deshecha = { ...version('c1', VIEJA), previousProse: { markdown: NUEVA, undone: true } };
        const actual = version('c2', VIEJA);
        const doc = DOCUMENTO.replace(VIEJA, NUEVA);
        expect(etiquetas(trabajo([conclusion(actual, { versions: [deshecha, actual] }), ensamble([GENERADO], GENERADO)], doc))).toEqual(['Conclusión']);
    });

    it('una sección excluida sin texto en el archivo no se avisa', () => {
        expect(etiquetas(trabajo([conclusion(version('c1', NUEVA), { includeInDocument: false }), ensamble([GENERADO], GENERADO)]))).toEqual([]);
    });

    it('el párrafo de una excluida que ahora dice otra sección no se avisa: regenerar no lo quitaría', () => {
        const excluida = conclusion(version('c1', VIEJA), { includeInDocument: false });
        const intro = { ...conclusion(version('i', `${OTRA}\n\n${MAS}\n\n${VIEJA}`)), id: 'i', kind: 'introduction', order: 0 } as ExegeticalStep;
        expect(etiquetas(trabajo([intro, excluida, ensamble([GENERADO], GENERADO)]))).toEqual([]);
    });

    it('un archivo que ni el ensamble ni las secciones explican es una composición guardada: no se avisa', () => {
        const composicion = '# Título\n\nUna redacción entera, escrita de corrido sobre el trabajo.\n\nCon otros párrafos que ninguna sección dice.\n\nY un tercero también nuevo, de la misma composición.\n';
        expect(etiquetas(trabajo([conclusion(version('c2', NUEVA)), ensamble([GENERADO], GENERADO)], composicion))).toEqual([]);
    });

    it('muchas secciones recompuestas en su sitio no parecen una composición', () => {
        const doc = DOCUMENTO.replace(OTRA, 'Uno recompuesto en su sitio.').replace(MAS, 'Dos recompuesto en su sitio.');
        const intro = { ...conclusion(version('i', 'Uno recompuesto en su sitio.\n\nDos recompuesto en su sitio.')), id: 'i', kind: 'introduction', order: 0 } as ExegeticalStep;
        expect(etiquetas(trabajo([intro, conclusion(version('c2', NUEVA)), ensamble([GENERADO], GENERADO)], doc))).toEqual(['Conclusión']);
    });

    it('un cambio en un párrafo pegado a su título también cuenta', () => {
        expect(etiquetas(trabajo([conclusion(version('c2', `## Conclusión\n${NUEVA}`)), ensamble([GENERADO], GENERADO)]))).toEqual(['Conclusión']);
    });

    it('el título propio de la sección no cuenta como cambio', () => {
        // El ensamble puede ponerle otro encabezado; la prosa es la misma.
        expect(etiquetas(trabajo([conclusion(version('c2', `## Otro título\n\n${VIEJA}`)), ensamble([GENERADO], GENERADO)]))).toEqual([]);
    });

    it('la raya de los rangos y el nombre del libro no son un cambio', () => {
        const paper = trabajo([
            conclusion(version('c2', 'Lo dice en Salmo 23:1-3.', dia(12))),
            ensamble([version('g', `${OTRA}\n`, dia(10))], null),
        ], `${OTRA}\n\nLo dice en Salmos 23:1–3.\n`);
        expect(etiquetas(paper)).toEqual([]);
    });

    it('sin archivo guardado no hay nada atrasado: el Word se arma de los pasos', () => {
        expect(etiquetas(trabajo([conclusion(version('c2', NUEVA)), ensamble([GENERADO], GENERADO)], null))).toEqual([]);
    });
});
