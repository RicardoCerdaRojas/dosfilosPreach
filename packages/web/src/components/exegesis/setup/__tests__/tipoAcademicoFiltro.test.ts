import { describe, it, expect } from 'vitest';
import type { ResourceType, SourceType } from '@dosfilos/domain';
import { TIPO_ACADEMICO_POR_TIPO_DE_BIBLIOTECA, filtroDeBibliotecaPara } from '../tipoAcademico';

describe('filtroDeBibliotecaPara', () => {
    it('filtra cuando la respuesta es única', () => {
        expect(filtroDeBibliotecaPara('theological-dictionary')).toBe('theological-dictionary');
        expect(filtroDeBibliotecaPara('commentary-critical')).toBe('exegetical-commentary');
        expect(filtroDeBibliotecaPara('grammar-syntax')).toBe('grammar');
    });

    it('no filtra cuando varios tipos de biblioteca desembocan en el mismo', () => {
        // Trasfondo histórico recibe diccionarios bíblicos, panorámicas e
        // historia. Elegir uno escondería los otros dos, y un filtro que
        // oculta el libro buscado es peor que no filtrar.
        expect(filtroDeBibliotecaPara('historical-background')).toBe('all');
    });

    it('no filtra un tipo académico que ninguna categoría produce', () => {
        expect(filtroDeBibliotecaPara('critical-apparatus')).toBe('all');
    });

    it('el filtro siempre devuelve al mismo tipo académico', () => {
        // El invariante que ata las dos direcciones: si el filtro elige una
        // categoría, esa categoría tiene que clasificar de vuelta al tipo
        // pedido. Sin esto, el requisito podría abrir la biblioteca en una
        // categoría que no contiene lo que pide.
        const tipos = new Set(Object.values(TIPO_ACADEMICO_POR_TIPO_DE_BIBLIOTECA)) as Set<SourceType>;
        for (const tipo of tipos) {
            const filtro = filtroDeBibliotecaPara(tipo);
            if (filtro === 'all') continue;
            expect(TIPO_ACADEMICO_POR_TIPO_DE_BIBLIOTECA[filtro as ResourceType]).toBe(tipo);
        }
    });
});
