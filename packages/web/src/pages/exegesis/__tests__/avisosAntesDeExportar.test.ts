import { describe, expect, it } from 'vitest';
import type { ExegeticalPaper } from '@dosfilos/domain';
import { avisosAntesDeExportar } from '../avisosAntesDeExportar';
import es from '@/i18n/locales/es/exegesis.json';
import en from '@/i18n/locales/en/exegesis.json';

const t = (clave: string, opciones?: Record<string, unknown>) => `${clave}|${JSON.stringify(opciones ?? {})}`;

const generado = { id: 'g', markdown: 'La prosa vieja.', createdAt: new Date(2026, 9, 10), origin: 'generated' };
const nueva = { id: 'c2', markdown: 'La prosa nueva.', createdAt: new Date(2026, 9, 12), origin: 'edited' };
const seccion = (id: string, kind: string, accepted: typeof nueva) =>
    ({ id, kind, order: 1, verseRef: null, accepted, current: accepted, versions: [accepted] });

const trabajo = (steps: unknown[]): ExegeticalPaper => ({
    steps: [...steps, seccion('a', 'assembly', generado)],
    assembledMarkdown: 'La prosa vieja.',
    displayLanguage: 'es',
    cover: { author: 'Autor', title: 'Título' },
} as unknown as ExegeticalPaper);

describe('avisos antes de exportar — el cambio que no llegó al archivo', () => {
    it('sin nada atrasado no agrega el aviso', () => {
        const avisos = avisosAntesDeExportar(trabajo([seccion('c', 'conclusion', generado)]), 'md', t);
        expect(avisos.filter(a => a.startsWith('detail.length.behind'))).toEqual([]);
    });

    it('nombra las secciones atrasadas y cuenta cuántas son, en Word y en Markdown', () => {
        const paper = trabajo([seccion('i', 'introduction', nueva), seccion('c', 'conclusion', nueva)]);
        for (const formato of ['docx', 'md'] as const) {
            const aviso = avisosAntesDeExportar(paper, formato, t).find(a => a.startsWith('detail.length.behind'));
            expect(aviso).toContain('"count":2');
            expect(aviso).toContain('Introducción, Conclusión');
        }
    });

    it('el texto existe en los dos idiomas, en singular y en plural', () => {
        for (const lengua of [es, en]) {
            const textos = (lengua as { detail: { length: Record<string, unknown> } }).detail.length;
            expect(textos.behind_one).toContain('{{sections}}');
            expect(textos.behind_other).toContain('{{sections}}');
        }
    });
});
