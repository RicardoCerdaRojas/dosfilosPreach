import { describe, expect, it } from 'vitest';
import { assemblyDelivery } from '../assemblyContents';
import type { ExegeticalPaper } from '../../entities/ExegeticalPaper';
import type { ExegeticalStep, ExegeticalStepVersion } from '../../entities/ExegeticalStep';

const version = (id: string, markdown: string): ExegeticalStepVersion =>
    ({ id, markdown, createdAt: new Date('2026-09-25') } as ExegeticalStepVersion);

const conEnsamble = (
    current: ExegeticalStepVersion | null,
    accepted: ExegeticalStepVersion | null,
    assembledMarkdown: string | null,
    extra: ExegeticalStep[] = [],
): ExegeticalPaper => ({
    steps: [...extra, { id: 'a', kind: 'assembly', order: 99, current, accepted } as ExegeticalStep],
    assembledMarkdown,
} as ExegeticalPaper);

const CUATRO = '# Santiago 2:1-13\n\n## 2:1\nprosa de los cuatro versículos.';
const NUEVE = '# Santiago 2:1-13\n\n## 2:3\nprosa de los nueve que se excluyeron.';

describe('assemblyDelivery — lo que se entrega contra lo que se ve', () => {
    it('sin ensamble guardado no hay nada viejo que entregar', () => {
        // Los exportadores caen en armar desde los pasos aceptados, que es lo
        // que el autor está viendo. Avisar acá sería una advertencia falsa.
        expect(assemblyDelivery(conEnsamble(version('v1', CUATRO), null, null)).state).toBe('sin-ensamble');
        expect(assemblyDelivery(conEnsamble(version('v1', CUATRO), null, '   ')).state).toBe('sin-ensamble');
        expect(assemblyDelivery({ steps: [], assembledMarkdown: CUATRO } as ExegeticalPaper).state)
            .toBe('sin-ensamble');
    });

    it('el caso medido: se ve un documento y se entrega otro', () => {
        const check = assemblyDelivery(conEnsamble(version('v3', CUATRO), null, NUEVE));
        expect(check.state).toBe('difiere');
        expect(check.deliveredWords).toBeGreaterThan(0);
        expect(check.onScreenWords).toBeGreaterThan(0);
        expect(check.deliveredWords).not.toBe(check.onScreenWords);
    });

    it('sin versión aceptada pero con el MISMO texto no se avisa nada', () => {
        // La falsa alarma que descartó comparar por identificador: recomponer
        // un verso parchea `assembledMarkdown` sin tocar las versiones del
        // paso, y el trabajo queda sin aceptada y con el texto correcto.
        expect(assemblyDelivery(conEnsamble(version('v3', CUATRO), null, CUATRO)).state).toBe('al-dia');
    });

    it('un parche en sitio más nuevo que la versión aceptada sí se avisa', () => {
        const check = assemblyDelivery(conEnsamble(version('v2', NUEVE), version('v2', NUEVE), CUATRO));
        expect(check.state).toBe('difiere');
    });

    it('aceptada, actual y entregable coinciden', () => {
        const v = version('v3', CUATRO);
        expect(assemblyDelivery(conEnsamble(v, v, CUATRO)).state).toBe('al-dia');
    });

    it('un versículo aceptado después del ensamble NO marca nada por sí solo', () => {
        // La vía de comparar FECHAS contra las secciones se descartó por esto:
        // la sección recompuesta suele estar ya entregada por el parche en
        // sitio, y avisar ahí sería la advertencia falsa de siempre.
        const v = version('v3', CUATRO);
        const verso = { id: 'b', kind: 'verse', order: 1, current: version('x', 'nuevo'), accepted: version('x', 'nuevo') } as ExegeticalStep;
        expect(assemblyDelivery(conEnsamble(v, v, CUATRO, [verso])).state).toBe('al-dia');
    });
});
