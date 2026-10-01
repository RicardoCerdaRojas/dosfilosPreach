import type { BookRecommendations } from '../types';

/**
 * Curated bibliography for Romanos. Hero book #2 in the v1.7 launch
 * — the most commented-on epistle in the canon, with massive scholarly
 * coverage at every tier. Pastors regularly preach expository series
 * over Romanos and need clear guidance on the commentary tradition.
 */
export const ROMANS_RECOMMENDATIONS: BookRecommendations = {
    bookId: 'ROM',
    bySourceType: {
        'commentary-critical': [
            {
                author: 'Cranfield, C. E. B.',
                title: 'A Critical and Exegetical Commentary on the Epistle to the Romans',
                series: 'ICC',
                publisher: 'T&T Clark',
                year: 1975,
                isbn: '9780567084064',
                tier: 'essential',
                languages: ['en'],
                rationale: '2 vols. Comentario crítico técnico de máximo rigor sobre el griego.',
            },
            {
                author: 'Dunn, James D. G.',
                title: 'Romans 1-8 / Romans 9-16',
                series: 'WBC 38A & 38B',
                publisher: 'Word',
                year: 1988,
                isbn: '9780849902376',
                tier: 'essential',
                languages: ['en'],
                rationale: '2 vols. Lectura desde la \"Nueva Perspectiva sobre Pablo\". Indispensable para el debate.',
            },
            {
                author: 'Jewett, Robert',
                title: 'Romans: A Commentary',
                series: 'Hermeneia',
                publisher: 'Fortress',
                year: 2007,
                isbn: '9780800660840',
                tier: 'essential',
                languages: ['en'],
                rationale: 'Comentario crítico-académico con énfasis socio-retórico.',
            },
            {
                author: 'Wright, N. T.',
                title: 'The Letter to the Romans',
                series: 'New Interpreter\'s Bible 10',
                publisher: 'Abingdon',
                year: 2002,
                isbn: '9780687278237',
                tier: 'recommended',
                languages: ['en'],
                rationale: 'Lectura desde la \"Nueva Perspectiva\" en clave narrativa-teológica.',
            },
        ],
        'commentary-expository': [
            {
                author: 'Moo, Douglas J.',
                title: 'The Letter to the Romans',
                series: 'NICNT (2nd ed.)',
                publisher: 'Eerdmans',
                year: 2018,
                isbn: '9780802871213',
                tier: 'essential',
                languages: ['en', 'es'],
                rationale: 'Estándar evangélico contemporáneo. Equilibrio rigor-aplicación. Trad. española de la 1a ed. por CLIE.',
            },
            {
                author: 'Schreiner, Thomas R.',
                title: 'Romans',
                series: 'BECNT (2nd ed.)',
                publisher: 'Baker Academic',
                year: 2018,
                isbn: '9780801097447',
                tier: 'essential',
                languages: ['en'],
                rationale: 'Comentario evangélico de gran rigor exegético, lectura reformada tradicional.',
            },
            {
                author: 'Stott, John R. W.',
                title: 'The Message of Romans: God\'s Good News for the World',
                series: 'BST',
                publisher: 'IVP Academic',
                year: 1994,
                isbn: '9780830812462',
                tier: 'recommended',
                languages: ['en', 'es'],
                rationale: 'Énfasis pastoral y aplicación expositiva. Edición española por Andamio.',
            },
            {
                author: 'Witherington, Ben III; Hyatt, Darlene',
                title: 'Paul\'s Letter to the Romans: A Socio-Rhetorical Commentary',
                series: null,
                publisher: 'Eerdmans',
                year: 2004,
                isbn: '9780802845047',
                tier: 'recommended',
                languages: ['en'],
                rationale: 'Lectura socio-retórica del argumento paulino.',
            },
        ],
        'theological-monograph': [
            // NOTA: las obras "paulinas-amplias" (Sanders PPJ, Wright PFG,
            // Westerholm) se movieron al catálogo de grupo `pauline-epistles`
            // — desde ahí aplican a CUALQUIER carta paulina sin necesidad
            // de duplicarlas en cada libro. Lo que sigue aquí son obras
            // específicas de Romanos.
            {
                author: 'Käsemann, Ernst',
                title: 'Commentary on Romans',
                series: null,
                publisher: 'Eerdmans',
                year: 1980,
                isbn: '9780802835178',
                tier: 'recommended',
                languages: ['en', 'de'],
                rationale: 'Lectura luterana radical de la justicia de Dios en Romanos. Diálogo crítico con Bultmann.',
            },
        ],
        'historical-background': [
            {
                author: 'Lampe, Peter',
                title: 'From Paul to Valentinus: Christians at Rome in the First Two Centuries',
                series: null,
                publisher: 'Fortress',
                year: 2003,
                isbn: '9780800627027',
                tier: 'recommended',
                languages: ['en', 'de'],
                rationale: 'Reconstrucción del cristianismo romano del siglo I. Contexto del destinatario de Romanos.',
            },
        ],
    },
};
