import { describe, expect, it } from 'vitest';
import { sectionsBehindAssembly } from '../assemblyContents';
import type { ExegeticalPaper } from '../../entities/ExegeticalPaper';
import type { ExegeticalStep, ExegeticalStepVersion } from '../../entities/ExegeticalStep';

const dia = (n: number) => new Date(2026, 9, n);

const version = (
    id: string,
    markdown: string,
    createdAt: Date,
    origin: ExegeticalStepVersion['origin'] = 'generated',
    extra: Partial<ExegeticalStepVersion> = {},
): ExegeticalStepVersion => ({ id, markdown, createdAt, origin, ...extra } as ExegeticalStepVersion);

const conclusion = (accepted: ExegeticalStepVersion, extra: Partial<ExegeticalStep> = {}): ExegeticalStep =>
    ({ id: 'c', kind: 'conclusion', order: 5, verseRef: null, accepted, current: accepted, versions: [accepted], ...extra } as ExegeticalStep);

const ensamble = (versions: ExegeticalStepVersion[], accepted: ExegeticalStepVersion | null): ExegeticalStep =>
    ({ id: 'a', kind: 'assembly', order: 99, versions, accepted, current: versions[versions.length - 1] } as ExegeticalStep);

const DOCUMENTO = '# Título\n\n---\n\n## Conclusión\n\nLa prosa vieja de la conclusión.\n';
const GENERADO = version('g', DOCUMENTO, dia(10));

const trabajo = (steps: ExegeticalStep[], assembledMarkdown: string | null = DOCUMENTO): ExegeticalPaper =>
    ({ steps, assembledMarkdown } as ExegeticalPaper);

const etiquetas = (paper: ExegeticalPaper) => sectionsBehindAssembly(paper, 'es').map(p => p.label);

describe('sectionsBehindAssembly — lo aceptado que no llegó al Word', () => {
    it('una conclusión aceptada después del ensamble, con otro texto, se avisa', () => {
        const paper = trabajo([conclusion(version('c2', 'La prosa nueva de la conclusión.', dia(12))), ensamble([GENERADO], GENERADO)]);
        expect(etiquetas(paper)).toEqual(['Conclusión']);
    });

    it('el mismo texto aceptado después del ensamble no se avisa', () => {
        const paper = trabajo([conclusion(version('c2', 'La prosa vieja de la conclusión.', dia(12))), ensamble([GENERADO], GENERADO)]);
        expect(etiquetas(paper)).toEqual([]);
    });

    it('lo aceptado antes del ensamble no se avisa aunque el documento diga otra cosa', () => {
        // Es la corrección hecha a mano sobre el ensamble, no un cambio perdido.
        const paper = trabajo([conclusion(version('c1', 'Otro texto, anterior al ensamble.', dia(9))), ensamble([GENERADO], GENERADO)]);
        expect(etiquetas(paper)).toEqual([]);
    });

    it('una edición a mano del ensamble no corre el corte: lo cambiado entre medio se avisa', () => {
        const aMano = version('e', DOCUMENTO, dia(14), 'edited');
        const paper = trabajo([conclusion(version('c2', 'La prosa nueva.', dia(12))), ensamble([GENERADO, aMano], aMano)]);
        expect(etiquetas(paper)).toEqual(['Conclusión']);
    });

    it('un ensamble regenerado sin aceptar no corre el corte: el archivo sigue siendo el viejo', () => {
        const sinAceptar = version('g2', 'Texto regenerado.', dia(14));
        const paper = trabajo([conclusion(version('c2', 'La prosa nueva.', dia(12))), ensamble([GENERADO, sinAceptar], GENERADO)]);
        expect(etiquetas(paper)).toEqual(['Conclusión']);
    });

    it('sin versión aceptada del ensamble, el corte es el que está a la vista', () => {
        const paper = trabajo([conclusion(version('c2', 'La prosa nueva.', dia(12))), ensamble([GENERADO], null)]);
        expect(etiquetas(paper)).toEqual(['Conclusión']);
    });

    it('lo recompuesto sobre la misma versión conserva su fecha y se avisa igual', () => {
        const recompuesta = version('c1', 'La prosa recompuesta.', dia(9), 'generated', {
            previousProse: { markdown: 'La prosa vieja de la conclusión.' },
        });
        const paper = trabajo([conclusion(recompuesta), ensamble([GENERADO], GENERADO)]);
        expect(etiquetas(paper)).toEqual(['Conclusión']);
    });

    it('un cambio en un párrafo pegado a su título también cuenta', () => {
        const paper = trabajo([conclusion(version('c2', '## Conclusión\nLa prosa nueva.', dia(12))), ensamble([GENERADO], GENERADO)]);
        expect(etiquetas(paper)).toEqual(['Conclusión']);
    });

    it('el título propio de la sección no cuenta como cambio', () => {
        // El ensamble puede ponerle otro encabezado; la prosa es la misma.
        const paper = trabajo([conclusion(version('c2', '## Otro título\n\nLa prosa vieja de la conclusión.', dia(12))), ensamble([GENERADO], GENERADO)]);
        expect(etiquetas(paper)).toEqual([]);
    });

    it('la raya de los rangos y el nombre del libro no son un cambio', () => {
        const paper = trabajo([
            conclusion(version('c2', 'Lo dice en Salmo 23:1-3.', dia(12))),
            ensamble([GENERADO], GENERADO),
        ], '# Título\n\nLo dice en Salmos 23:1–3.\n');
        expect(etiquetas(paper)).toEqual([]);
    });

    it('una sección excluida del documento no se avisa', () => {
        const paper = trabajo([
            conclusion(version('c2', 'La prosa nueva.', dia(12)), { includeInDocument: false }),
            ensamble([GENERADO], GENERADO),
        ]);
        expect(etiquetas(paper)).toEqual([]);
    });

    it('sin archivo guardado no hay nada atrasado: el Word se arma de los pasos', () => {
        const paper = trabajo([conclusion(version('c2', 'La prosa nueva.', dia(12))), ensamble([GENERADO], GENERADO)], null);
        expect(etiquetas(paper)).toEqual([]);
    });
});
