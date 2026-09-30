import { describe, expect, it } from 'vitest';
import { esquemaEstricto, quitarNulosOpcionales } from '../esquemaEstricto';

describe('esquemaEstricto', () => {
    const original = {
        type: 'object',
        description: 'Análisis',
        properties: {
            verso: { type: 'string', description: 'referencia' },
            nota: { type: 'string' },
            confianza: { type: 'number', minimum: 0, maximum: 1 },
            variante: { type: 'string', nullable: true },
            tipo: { type: 'string', enum: ['a', 'b'] },
            pasos: { type: 'array', items: { type: 'object', properties: { n: { type: 'integer' } }, required: ['n'] } },
        },
        required: ['verso', 'confianza', 'variante', 'pasos'],
    };
    const e = esquemaEstricto(original);

    it('todo objeto cierra sus propiedades y las vuelve todas obligatorias', () => {
        expect(e.additionalProperties).toBe(false);
        expect(e.required).toEqual(['verso', 'nota', 'confianza', 'variante', 'tipo', 'pasos']);
        const item = (e.properties as any).pasos.items;
        expect(item.additionalProperties).toBe(false);
        expect(item.required).toEqual(['n']);
    });

    it('un campo que era opcional pasa a admitir null; uno obligatorio no', () => {
        const p = e.properties as any;
        expect(p.nota.type).toEqual(['string', 'null']);
        expect(p.verso.type).toBe('string');
        // Un enum opcional también tiene que aceptar null en la lista.
        expect(p.tipo.enum).toEqual(['a', 'b', null]);
    });

    it('`nullable: true` pasa a la forma estándar aunque el campo sea obligatorio', () => {
        expect((e.properties as any).variante.type).toEqual(['string', 'null']);
        expect((e.properties as any).variante.nullable).toBeUndefined();
    });

    it('descarta lo que el modo estricto no entiende y conserva las descripciones', () => {
        const c = (e.properties as any).confianza;
        expect(c.minimum).toBeUndefined();
        expect(c.maximum).toBeUndefined();
        expect(e.description).toBe('Análisis');
        expect((e.properties as any).verso.description).toBe('referencia');
    });

    it('no toca el esquema original', () => {
        expect(original.properties.nota).toEqual({ type: 'string' });
        expect(original.required).toHaveLength(4);
    });
});

describe('quitarNulosOpcionales', () => {
    const esquema = {
        type: 'object',
        properties: {
            a: { type: 'string' },
            opcional: { type: 'string' },
            anulable: { type: 'string', nullable: true },
            lista: { type: 'array', items: { type: 'object', properties: { x: { type: 'string' }, y: { type: 'string' } }, required: ['x'] } },
        },
        required: ['a', 'anulable', 'lista'],
    };

    it('el opcional en null vuelve a estar ausente, también dentro de listas', () => {
        const r = quitarNulosOpcionales({ a: 'v', opcional: null, anulable: null, lista: [{ x: '1', y: null }] }, esquema);
        expect(r).toEqual({ a: 'v', anulable: null, lista: [{ x: '1' }] });
    });

    it('un opcional con valor se conserva', () => {
        expect(quitarNulosOpcionales({ a: 'v', opcional: 'sí', anulable: 'x', lista: [] }, esquema))
            .toEqual({ a: 'v', opcional: 'sí', anulable: 'x', lista: [] });
    });
});
