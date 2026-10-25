import type { BookRecommendations } from '../types';
import {
    EZRA_NEHEMIAH_BACKGROUND,
    EZRA_NEHEMIAH_CRITICAL,
    EZRA_NEHEMIAH_EXPOSITORY,
    EZRA_NEHEMIAH_MONOGRAPHS,
    EZRA_NEHEMIAH_PRIMARY,
} from './ezraNehemiah';

/**
 * Bibliografía curada de Esdras (fase «Encuadre de la serie»,
 * docs/FASE_ENCUADRE_SERIE_2026-10.md). Por qué: el fundador abrió el
 * proyecto «Esdras — serie expositiva» y «Buscar candidatas» le dio cero
 * comentarios (medido el 2026-10-24).
 *
 * Lo común con Nehemías viene de ezraNehemiah.ts; aquí van solo las obras
 * que comentan Esdras. Las reglas de verificación son las de nehemiah.ts.
 * Las herramientas de arameo están en el invariante con `covers`, porque
 * sirven igual a Daniel.
 */
export const EZRA_RECOMMENDATIONS: BookRecommendations = {
    bookId: 'EZR',
    bySourceType: {
        'commentary-critical': [
            ...EZRA_NEHEMIAH_CRITICAL,
            {
                author: 'Fried, Lisbeth S.',
                title: 'Ezra: A Commentary',
                series: null,
                publisher: 'Sheffield Phoenix',
                year: 2015,
                isbn: '9781909697751',
                tier: 'essential',
                languages: ['en'],
                approach: 'historical-critical',
                rationale: 'Comentario técnico de Esdras leído desde los documentos del imperio persa.',
                verified: { source: 'openlibrary', ref: '/isbn/9781909697751', checkedAt: '2026-10-24' },
            },
        ],
        'commentary-expository': [
            ...EZRA_NEHEMIAH_EXPOSITORY,
            {
                author: 'Burt, David F.',
                title: 'Esdras',
                series: 'Comentario Antiguo Testamento Andamio',
                publisher: 'Publicaciones Andamio',
                year: 2014,
                isbn: '9788496551930',
                tier: 'essential',
                languages: ['es'],
                approach: 'historical-grammatical',
                rationale: 'El comentario de Esdras más completo escrito en español, pensado para la predicación.',
                verified: { source: 'bne', ref: 'bne:991047875219708606', checkedAt: '2026-10-24' },
            },
            {
                author: 'Fyall, Robert S.',
                title: 'The Message of Ezra and Haggai: Building for God',
                series: 'BST',
                publisher: 'Inter-Varsity Press',
                year: 2010,
                isbn: '9781844744794',
                tier: 'recommended',
                languages: ['en'],
                approach: 'historical-grammatical',
                rationale: 'Exposición pensada para la predicación, junto con Hageo (el mismo regreso).',
                verified: { source: 'openlibrary', ref: '/isbn/9781844744794', checkedAt: '2026-10-24' },
            },
            {
                author: 'Reynolds, Adrian',
                title: 'Teaching Ezra: From Text to Message',
                series: 'Teach the Bible',
                publisher: 'Christian Focus',
                year: 2018,
                isbn: '9781781917527',
                tier: 'standard',
                languages: ['en'],
                approach: 'historical-grammatical',
                rationale: 'Guía para pasar del texto al sermón, con propuestas de unidades de predicación.',
                verified: { source: 'openlibrary', ref: '/isbn/9781781917527', checkedAt: '2026-10-24' },
            },
        ],
        'theological-monograph': [
            ...EZRA_NEHEMIAH_MONOGRAPHS,
            {
                author: 'Pakkala, Juha',
                title: 'Ezra the Scribe: The Development of Ezra 7–10 and Nehemiah 8',
                series: 'BZAW 347',
                publisher: 'Walter de Gruyter',
                year: 2004,
                isbn: '9783110182804',
                tier: 'recommended',
                languages: ['en'],
                approach: 'historical-critical',
                rationale: 'Estudio de la composición de Esdras 7–10 y su relación con Nehemías 8.',
                verified: { source: 'openlibrary', ref: '/isbn/9783110182804', checkedAt: '2026-10-24' },
            },
        ],
        'historical-background': [...EZRA_NEHEMIAH_BACKGROUND],
        'primary-source-ancient': [...EZRA_NEHEMIAH_PRIMARY],
    },
};
