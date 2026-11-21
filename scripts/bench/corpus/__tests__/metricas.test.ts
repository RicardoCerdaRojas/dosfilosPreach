import { describe, expect, it } from 'vitest';
import { grupoDe, medirCaso, regresiones, resumir } from '../metricas';
import type { CasoBanco, PropuestaFuente } from '../tipos';

const caso = (citas: CasoBanco['citas'], fuera: CasoBanco['fueraDeLaBiblioteca'] = []): CasoBanco => ({
  id: 'x', nombre: 'X', conjunto: 'desarrollo', idioma: 'griego',
  pasaje: { bookId: 'JAS', chapterStart: 5, chapterEnd: 5, verseStart: 1, verseEnd: 6 },
  consigna: null, fuentes: [], citas, citasSinHoja: [], fueraDeLaBiblioteca: fuera, origen: '',
});

const propuesta = (libro: string, sourceType: string, rutas: Record<string, number[]>, porPregunta: Record<number, number[]> = {}): PropuestaFuente => ({
  libro, sourceType, rutaInicial: 'pasaje',
  rutas: Object.fromEntries(Object.entries(rutas).map(([k, v]) => [k, new Set(v)])),
  porPregunta: new Map(Object.entries(porPregunta).map(([k, v]) => [Number(k), new Set(v)])),
});

describe('grupoDe', () => {
  it('separa gramáticas, léxicos y el resto', () => {
    expect(grupoDe('grammar-syntax')).toBe('gramatica');
    expect(grupoDe('lexicon-technical')).toBe('lexico');
    expect(grupoDe('theological-dictionary')).toBe('lexico');
    expect(grupoDe('commentary-critical')).toBe('comentario-y-texto');
    expect(grupoDe('textual-commentary')).toBe('comentario-y-texto');
  });
});

describe('medirCaso', () => {
  const c = caso([
    { libro: 'Wallace', etiqueta: '627', hoja: 663, pregunta: 1 },
    { libro: 'Wallace', etiqueta: '627', hoja: 663, pregunta: 1 }, // repetida: cuenta una vez
    { libro: 'Wallace', etiqueta: '627', hoja: 663, pregunta: 2 }, // otra pregunta: cuenta aparte
    { libro: 'Mayor', etiqueta: '148', hoja: 184, pregunta: 1 },
    { libro: 'Tuggy', etiqueta: 'h.538', hoja: 538 },
    { libro: 'Sin propuesta', etiqueta: '1', hoja: 1 },
  ], [{ libro: 'BDAG', etiqueta: 'κάμνω' }, { libro: 'BDAG', etiqueta: 'κάμνω' }]);
  const props = [
    propuesta('Wallace', 'grammar-syntax', { inicial: [663, 664], seccion: [700] }, { 1: [663] }),
    propuesta('Mayor', 'commentary-critical', { inicial: [180] }),
    propuesta('Tuggy', 'lexicon-technical', { lema: [538] }),
  ];

  it('cuenta aciertos solo con las rutas pedidas', () => {
    const r = medirCaso(c, props, ['inicial']);
    expect(r.citadas).toBe(4);
    expect(r.acertadas).toBe(2);
    expect(r.propuestas).toBe(3);
    expect(r.perdidas.map(p => p.libro).sort()).toEqual(['Mayor', 'Tuggy']);
    expect(medirCaso(c, props, ['inicial', 'lema']).acertadas).toBe(3);
  });

  it('mide la misma pregunta por separado', () => {
    const r = medirCaso(c, props, ['inicial']);
    expect(r.enLaMismaPregunta).toEqual({ acertadas: 1, citadas: 3 });
  });

  it('agrupa por tipo de fuente y cuenta las obras fuera de la biblioteca sin repetir', () => {
    const r = medirCaso(c, props, ['inicial', 'seccion', 'lema']);
    expect(r.porGrupo.gramatica).toEqual({ citadas: 2, acertadas: 2, propuestas: 3 });
    expect(r.porGrupo.lexico).toEqual({ citadas: 1, acertadas: 1, propuestas: 1 });
    expect(r.porGrupo['comentario-y-texto']).toEqual({ citadas: 1, acertadas: 0, propuestas: 1 });
    expect(r.fueraDeLaBiblioteca).toBe(1);
  });
});

describe('regresiones', () => {
  const base = resumir([medirCaso(caso([{ libro: 'A', etiqueta: '1', hoja: 1 }, { libro: 'A', etiqueta: '2', hoja: 2 }]),
    [propuesta('A', 'commentary-critical', { inicial: [1, 2, 3, 4] })], ['inicial'])]);

  it('no hay regresión contra sí misma', () => {
    expect(regresiones(base, base)).toEqual([]);
  });

  it('detecta una caída de recall', () => {
    const peor = resumir([medirCaso(caso([{ libro: 'A', etiqueta: '1', hoja: 1 }, { libro: 'A', etiqueta: '2', hoja: 2 }]),
      [propuesta('A', 'commentary-critical', { inicial: [1, 3, 4, 5] })], ['inicial'])]);
    expect(regresiones(base, peor).map(r => r.medida)).toContain('recall');
  });

  it('tolera una baja chica de precisión y detecta una grande', () => {
    const algoMas = resumir([medirCaso(caso([{ libro: 'A', etiqueta: '1', hoja: 1 }, { libro: 'A', etiqueta: '2', hoja: 2 }]),
      [propuesta('A', 'commentary-critical', { inicial: [1, 2, 3, 4, 5] })], ['inicial'])]);
    expect(regresiones(base, algoMas, 0.15)).toEqual([]);
    expect(regresiones(base, algoMas, 0.02).map(r => r.medida)).toEqual(['precisión mínima']);
  });
});
