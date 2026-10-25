import type { BookRecommendations } from '../types';
import {
    EZRA_NEHEMIAH_BACKGROUND,
    EZRA_NEHEMIAH_CRITICAL,
    EZRA_NEHEMIAH_EXPOSITORY,
    EZRA_NEHEMIAH_MONOGRAPHS,
    EZRA_NEHEMIAH_PRIMARY,
} from './ezraNehemiah';

/**
 * Bibliografía curada de Nehemías (etapa 2c, docs/FASE_BUSCAR_LITERATURA_2026-10.md).
 * Por qué este libro: Próximo proyecto exegético del fundador, para una serie expositiva (2026-10-23).
 *
 * Cada obra se verificó al escribirla contra un registro real (Open Library,
 * Crossref o la BNE) con scripts/catalog/verificar-catalogo.ts: título, autor
 * y año, y cada coincidencia se revisó a mano. `verified` guarda ese registro;
 * el ISBN sale de él, nunca de memoria, y queda vacío si el registro es de
 * otra editorial o de un libro electrónico. Lo que no se verificó no está.
 * El tipo sigue la serie (NICOT, NICNT, BECNT, PNTC, NAC y ZEC, expositivos),
 * y el enfoque es una propuesta del curador que el estudiante confirma.
 *
 * Las obras que comentan también Esdras viven en ezraNehemiah.ts (en el
 * canon hebreo son un solo libro); aquí quedan solo las de Nehemías.
 */
export const NEHEMIAH_RECOMMENDATIONS: BookRecommendations = {
    bookId: 'NEH',
    bySourceType: {
        'commentary-critical': [...EZRA_NEHEMIAH_CRITICAL],
        'commentary-expository': [
            ...EZRA_NEHEMIAH_EXPOSITORY,
            {
                author: 'Brown, Raymond',
                title: "The Message of Nehemiah: God's Servant in a Time of Change",
                series: 'BST',
                publisher: 'Inter-Varsity Press',
                year: 1998,
                isbn: '9780830883196',
                tier: 'standard',
                languages: ['en'],
                approach: 'canonical-theological',
                rationale: 'Exposición pensada para la predicación.',
                verified: { source: 'openlibrary', ref: '/works/OL26673278W', checkedAt: '2026-10-23' },
            },
            {
                author: 'Brown, Raymond',
                title: 'Nehemías: siervo de Dios en tiempos de cambio',
                series: null,
                publisher: 'Andamio',
                year: 2010,
                isbn: '9788492836758',
                tier: 'standard',
                languages: ['es'],
                approach: 'canonical-theological',
                rationale: 'Edición en español de la exposición de BST.',
                verified: { source: 'bne', ref: 'bne:991030986439708606', checkedAt: '2026-10-23' },
            },
        ],
        'theological-monograph': [
            ...EZRA_NEHEMIAH_MONOGRAPHS,
            {
                author: 'Wright, Jacob L.',
                title: 'Rebuilding Identity: The Nehemiah-Memoir and Its Earliest Readers',
                series: 'BZAW 348',
                publisher: 'de Gruyter',
                year: 2004,
                isbn: null,
                tier: 'recommended',
                languages: ['en'],
                approach: 'historical-critical',
                rationale: 'Estudio de la composición de la memoria de Nehemías.',
                verified: { source: 'openlibrary', ref: '/works/OL5719235W', checkedAt: '2026-10-23' },
            },
        ],
        'historical-background': [...EZRA_NEHEMIAH_BACKGROUND],
        'primary-source-ancient': [...EZRA_NEHEMIAH_PRIMARY],
    },
};
