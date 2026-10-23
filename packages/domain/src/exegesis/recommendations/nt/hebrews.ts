import type { BookRecommendations } from '../types';

/**
 * Curated bibliography for Hebreos. Hero book #1 in the v1.7 launch
 * — chosen because:
 *   1. Highly preached in expository series (epistolary/homily blend).
 *   2. Has a particularly well-defined commentary tradition (Cockerill,
 *      Lane, Attridge, O'Brien) at every academic tier.
 *   3. Demands strong primary-source / monograph engagement (Filón,
 *      Vanhoye on rhetorical structure).
 *
 * Subsequent books are added incrementally per usage telemetry.
 */
export const HEBREWS_RECOMMENDATIONS: BookRecommendations = {
    bookId: 'HEB',
    bySourceType: {
        'commentary-critical': [
            {
                author: 'Lane, William L.',
                title: 'Hebrews 1-8 / Hebrews 9-13',
                series: 'WBC 47A & 47B',
                publisher: 'Word',
                year: 1991,
                isbn: '9780849902468',
                tier: 'essential',
                languages: ['en'],
                rationale: '2 vols. Estándar técnico para el griego, sintaxis y aparato textual.',
            },
            {
                author: 'Attridge, Harold W.',
                title: 'The Epistle to the Hebrews: A Commentary',
                series: 'Hermeneia',
                publisher: 'Fortress',
                year: 1989,
                isbn: '9780800660215',
                tier: 'essential',
                languages: ['en'],
                rationale: 'Comentario crítico-académico de máximo rigor. Énfasis filón-helenístico.',
            },
            {
                author: 'Ellingworth, Paul',
                title: 'The Epistle to the Hebrews: A Commentary on the Greek Text',
                series: 'NIGTC',
                publisher: 'Eerdmans',
                year: 1993,
                isbn: '9780802824202',
                tier: 'essential',
                languages: ['en'],
                rationale: 'Comentario sobre el texto griego — análisis morfosintáctico verso a verso.',
            },
            {
                author: 'Koester, Craig R.',
                title: 'Hebrews: A New Translation with Introduction and Commentary',
                series: 'Anchor Yale Bible 36',
                publisher: 'Yale University Press',
                year: 2001,
                isbn: '9780300139891',
                tier: 'recommended',
                languages: ['en'],
                rationale: 'Lectura retórica del discurso. Útil para análisis estructural.',
            },
        ],
        'commentary-expository': [
            {
                author: 'Cockerill, Gareth Lee',
                title: 'The Epistle to the Hebrews',
                series: 'NICNT',
                publisher: 'Eerdmans',
                year: 2012,
                isbn: '9780802824929',
                tier: 'essential',
                languages: ['en'],
                rationale: 'Volumen de referencia para predicación expositiva. Equilibra exégesis técnica y aplicación.',
            },
            {
                author: 'O\'Brien, Peter T.',
                title: 'The Letter to the Hebrews',
                series: 'Pillar New Testament Commentary',
                publisher: 'Eerdmans',
                year: 2010,
                isbn: '9780802837295',
                tier: 'recommended',
                languages: ['en'],
                rationale: 'Estilo claro, énfasis teológico y pastoral. Excelente para sermón expositivo.',
            },
            {
                author: 'Schreiner, Thomas R.',
                title: 'Commentary on Hebrews',
                series: 'Biblical Theology for Christian Proclamation',
                publisher: 'Holman',
                year: 2015,
                // Corregido 2026-10-23 con Open Library: el ISBN no era válido.
                isbn: '9780805496130',
                tier: 'recommended',
                languages: ['en'],
                rationale: 'Énfasis en teología bíblica y predicación reformada.',
            },
            {
                author: 'Bruce, F. F.',
                title: 'The Epistle to the Hebrews',
                series: 'NICNT (revised)',
                publisher: 'Eerdmans',
                year: 1990,
                isbn: '9780802825148',
                tier: 'recommended',
                languages: ['en', 'es'],
                rationale: 'Clásico evangélico. Hay traducción al español por CLIE.',
            },
        ],
        'theological-monograph': [
            {
                author: 'Vanhoye, Albert',
                title: 'Structure and Message of the Epistle to the Hebrews',
                series: null,
                publisher: 'Pontifical Biblical Institute',
                year: 1989,
                isbn: '9788876531385',
                tier: 'essential',
                languages: ['en', 'fr'],
                rationale: 'Análisis estructural-quiástico clásico. Indispensable para entender la arquitectura del discurso.',
            },
            {
                author: 'deSilva, David A.',
                title: 'Perseverance in Gratitude: A Socio-Rhetorical Commentary on the Epistle "to the Hebrews"',
                series: null,
                publisher: 'Eerdmans',
                year: 2000,
                isbn: '9780802844392',
                tier: 'recommended',
                languages: ['en'],
                rationale: 'Lectura socio-retórica. Marco honor/vergüenza y patrón cliente/patrón.',
            },
            {
                author: 'Caird, G. B.',
                title: 'The Exegetical Method of the Epistle to the Hebrews',
                series: 'Canadian Journal of Theology 5',
                publisher: 'CJT',
                year: 1959,
                isbn: null,
                tier: 'standard',
                languages: ['en'],
                rationale: 'Artículo seminal sobre la hermenéutica del autor de Hebreos con el AT.',
            },
        ],
        'primary-source-ancient': [
            {
                author: 'Philo of Alexandria',
                title: 'On the Life of Moses / Allegorical Interpretation / Que es Heres',
                series: null,
                publisher: 'Hendrickson',
                year: 1993,
                isbn: '9780943575933',
                tier: 'essential',
                languages: ['en'],
                rationale: 'Filón provee el trasfondo lógos-sumo-sacerdote-Melquisedec que Hebreos presupone.',
            },
        ],
    },
};
