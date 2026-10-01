import type { BibleBookGroup, GroupRecommendations } from './types';

/**
 * Group-level curated recommendations. Each entry covers MULTIPLE
 * Bible books — works that are genuinely written about a corpus
 * (Sanders on Paul, Murphy on wisdom, Smith on the Twelve) rather
 * than a single book.
 *
 * The `getSourceRecommendations` helper merges these BETWEEN
 * book-specific (most relevant, top) and invariant entries (most
 * general, bottom). Books not in any group fall through directly to
 * invariant.
 *
 * Curation principle: only put a work here if it ACTUALLY treats the
 * group as a unit. A book-specific WBC volume goes to the book file,
 * not here. Schnelle on Paul belongs here. Cranfield on Romans does not.
 */

const PENTATEUCH: GroupRecommendations = {
    groupId: 'pentateuch',
    bySourceType: {
        'theological-monograph': [
            {
                author: 'Sailhamer, John H.',
                title: 'The Pentateuch as Narrative: A Biblical-Theological Commentary',
                series: null,
                publisher: 'Zondervan Academic',
                year: 1992,
                isbn: '9780310574217',
                tier: 'essential',
                languages: ['en'],
                rationale: 'Lectura narrativa-canónica del Pentateuco como una unidad. Marco interpretativo influyente.',
            },
            {
                author: 'Wenham, Gordon J.',
                title: 'Story as Torah: Reading Old Testament Narrative Ethically',
                series: null,
                publisher: 'Baker Academic',
                year: 2000,
                isbn: '9780801027809',
                tier: 'recommended',
                languages: ['en'],
                rationale: 'Hermenéutica para leer las narrativas del Pentateuco con sensibilidad ética y literaria.',
            },
            {
                author: 'Alexander, T. Desmond',
                title: 'From Paradise to the Promised Land: An Introduction to the Pentateuch',
                series: null,
                publisher: 'Baker Academic',
                year: 2012,
                isbn: '9780801039980',
                tier: 'recommended',
                languages: ['en'],
                rationale: 'Introducción evangélica al Pentateuco con énfasis en teología bíblica.',
            },
        ],
    },
};

const HISTORICAL_BOOKS: GroupRecommendations = {
    groupId: 'historical-books',
    bySourceType: {
        'theological-monograph': [
            {
                author: 'Noth, Martin',
                title: 'The Deuteronomistic History',
                series: 'JSOTSup 15',
                publisher: 'Sheffield Academic',
                year: 1991,
                isbn: '9781850752691',
                tier: 'essential',
                languages: ['en', 'de'],
                rationale: 'Hipótesis seminal de la "Historia Deuteronomística". Diálogo crítico imprescindible para Josué-2 Reyes.',
            },
            {
                author: 'McConville, J. Gordon',
                title: 'God and Earthly Power: An Old Testament Political Theology',
                series: 'Library of Hebrew Bible/OT Studies',
                publisher: 'T&T Clark',
                year: 2006,
                isbn: '9780567045287',
                tier: 'recommended',
                languages: ['en'],
                rationale: 'Lectura teológico-política del corpus histórico AT. Útil para predicación sobre realeza, profecía y Estado.',
            },
            {
                author: 'Provan, Iain; Long, V. Philips; Longman, Tremper III',
                title: 'A Biblical History of Israel',
                series: null,
                publisher: 'Westminster John Knox',
                year: 2015,
                isbn: '9780664239138',
                tier: 'recommended',
                languages: ['en'],
                rationale: 'Reconstrucción evangélica responsable de la historia de Israel. Diálogo con el minimalismo crítico.',
            },
        ],
    },
};

const WISDOM: GroupRecommendations = {
    groupId: 'wisdom',
    bySourceType: {
        'theological-monograph': [
            {
                author: 'Murphy, Roland E.',
                title: 'The Tree of Life: An Exploration of Biblical Wisdom Literature',
                series: null,
                publisher: 'Eerdmans',
                year: 2002,
                isbn: '9780802839565',
                tier: 'essential',
                languages: ['en'],
                rationale: 'Tratado integral del corpus sapiencial (Job, Proverbios, Eclesiastés, Cantares + Sabiduría/Sirá).',
            },
            {
                author: 'Crenshaw, James L.',
                title: 'Old Testament Wisdom: An Introduction',
                series: null,
                publisher: 'Westminster John Knox',
                year: 2010,
                isbn: '9780664234591',
                tier: 'essential',
                languages: ['en'],
                rationale: 'Introducción estándar a la literatura sapiencial AT. Análisis de género, contexto, teología.',
            },
            {
                author: 'Goldingay, John',
                title: 'The Theology of the Book of Psalms',
                series: 'Old Testament Theology vol. 3 (porción sapiencial)',
                publisher: 'IVP Academic',
                year: 2009,
                isbn: '9780830825653',
                tier: 'recommended',
                languages: ['en'],
                rationale: 'Análisis sapiencial-teológico transversal. Útil para Salmos didácticos y libros sapienciales.',
            },
            {
                author: 'Bartholomew, Craig G.; O\'Dowd, Ryan P.',
                title: 'Old Testament Wisdom Literature: A Theological Introduction',
                series: null,
                publisher: 'IVP Academic',
                year: 2011,
                isbn: '9780830838967',
                tier: 'recommended',
                languages: ['en'],
                rationale: 'Introducción evangélica con énfasis teológico cristiano. Bridge a aplicación predicada.',
            },
        ],
    },
};

const MAJOR_PROPHETS: GroupRecommendations = {
    groupId: 'major-prophets',
    bySourceType: {
        'theological-monograph': [
            {
                author: 'Heschel, Abraham J.',
                title: 'The Prophets',
                series: null,
                publisher: 'Harper Perennial',
                year: 2001,
                isbn: '9780060936990',
                tier: 'essential',
                languages: ['en', 'es'],
                rationale: 'Clásico contemporáneo sobre conciencia profética. Ed. española por Paidós.',
            },
            {
                author: 'Brueggemann, Walter',
                title: 'The Prophetic Imagination',
                series: null,
                publisher: 'Fortress',
                year: 2018,
                isbn: '9781506449302',
                tier: 'essential',
                languages: ['en', 'es'],
                rationale: 'Hermenéutica profética para predicación contemporánea. Ed. española por Sal Terrae.',
            },
            {
                author: 'Childs, Brevard S.',
                title: 'Biblical Theology of the Old and New Testaments',
                series: null,
                publisher: 'Fortress',
                year: 1992,
                isbn: '9780800606329',
                tier: 'recommended',
                languages: ['en'],
                rationale: 'Lectura canónica de los profetas mayores en la teología bíblica integral.',
            },
        ],
    },
};

const MINOR_PROPHETS: GroupRecommendations = {
    groupId: 'minor-prophets',
    bySourceType: {
        'commentary-critical': [
            {
                author: 'Smith, Ralph L.',
                title: 'Micah-Malachi',
                covers: ['MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL'],
                series: 'WBC 32',
                publisher: 'Word',
                year: 1984,
                isbn: '9780849902314',
                tier: 'essential',
                languages: ['en'],
                rationale: 'Comentario técnico sobre Miqueas-Malaquías (segunda mitad de Los Doce).',
            },
            {
                author: 'Stuart, Douglas',
                title: 'Hosea-Jonah',
                covers: ['HOS', 'JOL', 'AMO', 'OBA', 'JON'],
                series: 'WBC 31',
                publisher: 'Word',
                year: 1987,
                isbn: '9780849902307',
                tier: 'essential',
                languages: ['en'],
                rationale: 'Comentario técnico sobre Oseas-Jonás (primera mitad de Los Doce).',
            },
            {
                author: 'McComiskey, Thomas Edward (ed.)',
                title: 'The Minor Prophets: An Exegetical and Expository Commentary',
                series: null,
                publisher: 'Baker Academic',
                year: 2009,
                isbn: '9780801036316',
                tier: 'essential',
                languages: ['en'],
                rationale: '3 vols. (1 vol. en ed. compacta). Comentario evangélico exegético-expositivo de Los Doce.',
            },
        ],
        'commentary-expository': [
            {
                author: 'Achtemeier, Elizabeth',
                title: 'Minor Prophets I (Hosea, Joel, Amos, Obadiah, Jonah, Micah)',
                covers: ['HOS', 'JOL', 'AMO', 'OBA', 'JON', 'MIC'],
                series: 'New International Biblical Commentary 17',
                publisher: 'Hendrickson',
                year: 1996,
                isbn: '9780943575872',
                tier: 'recommended',
                languages: ['en'],
                rationale: 'Comentario expositivo accesible para predicación.',
            },
        ],
        'theological-monograph': [
            {
                author: 'Petersen, David L.',
                title: 'The Prophetic Literature: An Introduction',
                series: null,
                publisher: 'Westminster John Knox',
                year: 2002,
                isbn: '9780664254537',
                tier: 'recommended',
                languages: ['en'],
                rationale: 'Introducción al corpus profético. Útil tanto para mayores como para menores.',
            },
            {
                author: 'House, Paul R.',
                title: 'The Unity of the Twelve',
                series: 'JSOTSup 97',
                publisher: 'Sheffield Academic',
                year: 1990,
                isbn: '9781850752370',
                tier: 'recommended',
                languages: ['en'],
                rationale: 'Argumento literario por leer Los Doce como unidad redaccional. Influyente para predicación expositiva del corpus.',
            },
        ],
    },
};

const GOSPELS: GroupRecommendations = {
    groupId: 'gospels',
    bySourceType: {
        'theological-monograph': [
            {
                author: 'Wright, N. T.',
                title: 'Jesus and the Victory of God',
                series: 'Christian Origins and the Question of God 2',
                publisher: 'Fortress',
                year: 1996,
                isbn: '9780800626822',
                tier: 'essential',
                languages: ['en', 'es'],
                rationale: 'Cristología histórica monumental. Marco para comprender los anuncios del Reino.',
            },
            {
                author: 'Bauckham, Richard',
                title: 'Jesus and the Eyewitnesses: The Gospels as Eyewitness Testimony',
                series: null,
                publisher: 'Eerdmans',
                year: 2017,
                isbn: '9780802874313',
                tier: 'essential',
                languages: ['en'],
                rationale: 'Argumento por la transmisión testimonial de los evangelios. Clave para el debate sobre fiabilidad.',
            },
            {
                author: 'Sanders, E. P.',
                title: 'Jesus and Judaism',
                series: null,
                publisher: 'Fortress',
                year: 1985,
                isbn: '9780800620615',
                tier: 'recommended',
                languages: ['en'],
                rationale: 'Lectura del Jesús histórico desde el judaísmo del Segundo Templo.',
            },
            {
                author: 'Hengel, Martin',
                title: 'Studies in the Gospel of Mark',
                series: null,
                publisher: 'Wipf & Stock',
                year: 2003,
                isbn: '9781592442836',
                tier: 'recommended',
                languages: ['en', 'de'],
                rationale: 'Estudios sobre Marcos como ejemplo del género evangelio. Aplicable a estudios sinópticos.',
            },
        ],
    },
};

const SYNOPTIC_GOSPELS: GroupRecommendations = {
    groupId: 'synoptic-gospels',
    bySourceType: {
        'theological-monograph': [
            {
                author: 'Sanders, E. P.; Davies, Margaret',
                title: 'Studying the Synoptic Gospels',
                series: null,
                publisher: 'SCM Press',
                year: 1989,
                isbn: '9780334022428',
                tier: 'essential',
                languages: ['en'],
                rationale: 'Manual estándar sobre la cuestión sinóptica, fuentes, redacción y método.',
            },
            {
                author: 'Stein, Robert H.',
                title: 'Studying the Synoptic Gospels: Origin and Interpretation',
                series: null,
                publisher: 'Baker Academic',
                year: 2001,
                isbn: '9780801022807',
                tier: 'recommended',
                languages: ['en'],
                rationale: 'Introducción evangélica a la crítica sinóptica. Más accesible que Sanders/Davies.',
            },
        ],
    },
};

const JOHANNINE_LITERATURE: GroupRecommendations = {
    groupId: 'johannine-literature',
    bySourceType: {
        'theological-monograph': [
            {
                author: 'Brown, Raymond E.',
                title: 'The Community of the Beloved Disciple',
                series: null,
                publisher: 'Paulist Press',
                year: 1979,
                isbn: '9780809121748',
                tier: 'essential',
                languages: ['en', 'es'],
                rationale: 'Reconstrucción del entorno joánico que produjo Evangelio + Cartas + Apocalipsis. Ed. española por Sígueme.',
            },
            {
                author: 'Bauckham, Richard',
                title: 'Gospel of Glory: Major Themes in Johannine Theology',
                series: null,
                publisher: 'Baker Academic',
                year: 2015,
                isbn: '9780801096129',
                tier: 'recommended',
                languages: ['en'],
                rationale: 'Síntesis de la teología joánica del Evangelio en diálogo con el resto del corpus.',
            },
        ],
    },
};

const PAULINE_EPISTLES: GroupRecommendations = {
    groupId: 'pauline-epistles',
    bySourceType: {
        'theological-monograph': [
            {
                author: 'Sanders, E. P.',
                title: 'Paul and Palestinian Judaism: A Comparison of Patterns of Religion',
                series: null,
                publisher: 'Fortress',
                year: 1977,
                isbn: '9780800618995',
                tier: 'essential',
                languages: ['en'],
                rationale: 'Detonante de la "Nueva Perspectiva sobre Pablo". Imprescindible para cualquier carta paulina.',
            },
            {
                author: 'Wright, N. T.',
                title: 'Paul and the Faithfulness of God',
                series: 'Christian Origins and the Question of God 4',
                publisher: 'Fortress',
                year: 2013,
                isbn: '9780800626839',
                tier: 'essential',
                languages: ['en'],
                rationale: '2 vols. Síntesis monumental de la teología paulina narrativa-pactual.',
            },
            {
                author: 'Schnelle, Udo',
                title: 'Apostle Paul: His Life and Theology',
                series: null,
                publisher: 'Baker Academic',
                year: 2005,
                isbn: '9780801027963',
                tier: 'recommended',
                languages: ['en', 'de'],
                rationale: 'Biografía teológica completa de Pablo. Excelente cronología y contexto.',
            },
            {
                author: 'Westerholm, Stephen',
                title: 'Perspectives Old and New on Paul: The "Lutheran" Paul and His Critics',
                series: null,
                publisher: 'Eerdmans',
                year: 2004,
                isbn: '9780802848093',
                tier: 'recommended',
                languages: ['en'],
                rationale: 'Mapa equilibrado del debate sobre Pablo, justificación y judaísmo del Segundo Templo.',
            },
            {
                author: 'Hawthorne, Gerald F.; Martin, Ralph P.; Reid, Daniel G. (eds.)',
                title: 'Dictionary of Paul and His Letters',
                series: 'IVP Black Dictionary',
                publisher: 'IVP Academic',
                year: 1993,
                isbn: '9780830817788',
                tier: 'essential',
                languages: ['en'],
                rationale: 'Diccionario académico transversal a las paulinas. Entradas firmadas por especialistas.',
            },
        ],
    },
};

const PASTORAL_EPISTLES: GroupRecommendations = {
    groupId: 'pastoral-epistles',
    bySourceType: {
        'commentary-critical': [
            {
                author: 'Mounce, William D.',
                title: 'Pastoral Epistles',
                series: 'WBC 46',
                publisher: 'Word',
                year: 2000,
                isbn: '9780849902451',
                tier: 'essential',
                languages: ['en'],
                rationale: 'Comentario técnico estándar para 1-2 Timoteo y Tito.',
            },
            {
                author: 'Marshall, I. Howard; Towner, Philip H.',
                title: 'A Critical and Exegetical Commentary on the Pastoral Epistles',
                series: 'ICC',
                publisher: 'T&T Clark',
                year: 1999,
                isbn: '9780567084552',
                tier: 'essential',
                languages: ['en'],
                rationale: 'Comentario crítico-académico de máximo rigor sobre el griego.',
            },
            {
                author: 'Knight, George W. III',
                title: 'The Pastoral Epistles: A Commentary on the Greek Text',
                series: 'NIGTC',
                publisher: 'Eerdmans',
                year: 1992,
                isbn: '9780802823953',
                tier: 'recommended',
                languages: ['en'],
                rationale: 'Comentario evangélico sobre el texto griego. Cuidadoso con sintaxis y léxico.',
            },
        ],
        'commentary-expository': [
            {
                author: 'Towner, Philip H.',
                title: 'The Letters to Timothy and Titus',
                series: 'NICNT',
                publisher: 'Eerdmans',
                year: 2006,
                isbn: '9780802825131',
                tier: 'essential',
                languages: ['en'],
                rationale: 'Comentario expositivo de referencia para predicación pastoral.',
            },
            {
                author: 'Köstenberger, Andreas J.',
                title: 'Commentary on 1-2 Timothy and Titus',
                series: 'Biblical Theology for Christian Proclamation',
                publisher: 'Holman',
                year: 2017,
                isbn: '9781535900201',
                tier: 'recommended',
                languages: ['en'],
                rationale: 'Énfasis en teología bíblica y predicación reformada-evangélica.',
            },
        ],
    },
};

const GENERAL_EPISTLES: GroupRecommendations = {
    groupId: 'general-epistles',
    bySourceType: {
        'commentary-critical': [
            {
                author: 'Bauckham, Richard',
                title: 'Jude, 2 Peter',
                covers: ['JUD', '2PE'],
                series: 'WBC 50',
                publisher: 'Word',
                year: 1983,
                isbn: '9780849902499',
                tier: 'essential',
                languages: ['en'],
                rationale: 'Comentario técnico estándar. Lectura crítica + reconstrucción de la opositión a Judas/2 Pedro.',
            },
            {
                author: 'Davids, Peter H.',
                title: 'The Epistle of James: A Commentary on the Greek Text',
                covers: ['JAS'],
                series: 'NIGTC',
                publisher: 'Eerdmans',
                year: 1982,
                isbn: '9780802823885',
                tier: 'essential',
                languages: ['en'],
                rationale: 'Comentario sobre el texto griego de Santiago. Análisis morfosintáctico verso a verso.',
            },
            {
                author: 'Yarbrough, Robert W.',
                title: '1-3 John',
                covers: ['1JN', '2JN', '3JN'],
                series: 'BECNT',
                publisher: 'Baker Academic',
                year: 2008,
                isbn: '9780801026874',
                tier: 'essential',
                languages: ['en'],
                rationale: 'Comentario evangélico de referencia para las cartas joánicas.',
            },
        ],
        'theological-monograph': [
            {
                author: 'Lockett, Darian R.',
                title: 'Letters from the Pillar Apostles: The Formation of the Catholic Epistles as a Canonical Collection',
                series: null,
                publisher: 'Pickwick',
                year: 2017,
                isbn: '9781498228053',
                tier: 'recommended',
                languages: ['en'],
                rationale: 'Argumento por leer Santiago, 1-2 Pedro, 1-3 Juan, Judas como una colección canónica intencional.',
            },
            {
                author: 'Painter, John',
                title: '1, 2, and 3 John',
                series: 'Sacra Pagina 18',
                publisher: 'Liturgical Press',
                year: 2002,
                isbn: '9780814659717',
                tier: 'recommended',
                languages: ['en'],
                rationale: 'Comentario católico-académico con énfasis teológico-literario sobre las cartas joánicas.',
            },
        ],
    },
};

const APOCALYPTIC: GroupRecommendations = {
    groupId: 'apocalyptic',
    bySourceType: {
        'theological-monograph': [
            {
                author: 'Collins, John J.',
                title: 'The Apocalyptic Imagination: An Introduction to Jewish Apocalyptic Literature',
                series: null,
                publisher: 'Eerdmans',
                year: 2016,
                isbn: '9780802872791',
                tier: 'essential',
                languages: ['en'],
                rationale: 'Manual estándar sobre el género apocalíptico judío. Esencial para Daniel y Apocalipsis.',
            },
            {
                author: 'Rowland, Christopher',
                title: 'The Open Heaven: A Study of Apocalyptic in Judaism and Early Christianity',
                series: null,
                publisher: 'Wipf & Stock',
                year: 2002,
                isbn: '9781592440498',
                tier: 'recommended',
                languages: ['en'],
                rationale: 'Análisis transversal del género apocalíptico judío-cristiano.',
            },
        ],
        'commentary-critical': [
            {
                author: 'Beale, G. K.',
                title: 'The Book of Revelation: A Commentary on the Greek Text',
                covers: ['REV'],
                series: 'NIGTC',
                publisher: 'Eerdmans',
                year: 1999,
                isbn: '9780802821744',
                tier: 'essential',
                languages: ['en', 'es'],
                rationale: 'Comentario sobre el texto griego de Apocalipsis. Énfasis en uso del AT. Hay traducción al español por CLIE.',
            },
            {
                author: 'Aune, David E.',
                title: 'Revelation 1-5 / Revelation 6-16 / Revelation 17-22',
                covers: ['REV'],
                series: 'WBC 52A, 52B, 52C',
                publisher: 'Word',
                year: 1997,
                isbn: '9780849902512',
                tier: 'essential',
                languages: ['en'],
                rationale: '3 vols. Comentario técnico exhaustivo sobre Apocalipsis con énfasis greco-romano.',
            },
        ],
    },
};

export const GROUP_CATALOG: Record<BibleBookGroup, GroupRecommendations> = {
    'pentateuch': PENTATEUCH,
    'historical-books': HISTORICAL_BOOKS,
    'wisdom': WISDOM,
    'major-prophets': MAJOR_PROPHETS,
    'minor-prophets': MINOR_PROPHETS,
    'gospels': GOSPELS,
    'synoptic-gospels': SYNOPTIC_GOSPELS,
    'johannine-literature': JOHANNINE_LITERATURE,
    'pauline-epistles': PAULINE_EPISTLES,
    'pastoral-epistles': PASTORAL_EPISTLES,
    'general-epistles': GENERAL_EPISTLES,
    'apocalyptic': APOCALYPTIC,
};
