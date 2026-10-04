import { BaseJSONRepository, BibleJSONData } from './BaseJSONRepository';
import { BibleReference } from '@/domain/bible/entities/BibleEntities';

/**
 * RVR1960 Repository - Adapter for Spanish Reina-Valera 1960 Bible
 */
export class RVR1960Repository extends BaseJSONRepository {
    protected readonly versionId = 'RVR1960';
    protected readonly language = 'es';
    protected loadBibleData(): BibleJSONData[] {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require('../../../../assets/bible/rvr1960.json') as BibleJSONData[];
    }
    protected readonly bookMapping: Record<string, string> = {
        // Antiguo Testamento
        'Génesis': 'gn', 'Genesis': 'gn', 'Gn': 'gn', 'Gen': 'gn',
        'Éxodo': 'ex', 'Exodo': 'ex', 'Ex': 'ex',
        'Levítico': 'lv', 'Levitico': 'lv', 'Lv': 'lv', 'Lev': 'lv',
        'Números': 'nm', 'Numeros': 'nm', 'Nm': 'nm', 'Num': 'nm',
        'Deuteronomio': 'dt', 'Dt': 'dt', 'Deut': 'dt',
        'Josué': 'js', 'Josue': 'js', 'Jos': 'js',
        'Jueces': 'jud', 'Jue': 'jud',
        'Rut': 'rt', 'Rt': 'rt',
        '1 Samuel': '1sm', '1Samuel': '1sm', '1 Sam': '1sm', '1S': '1sm', '1Sm': '1sm',
        '2 Samuel': '2sm', '2Samuel': '2sm', '2 Sam': '2sm', '2S': '2sm', '2Sm': '2sm',
        '1 Reyes': '1kgs', '1Reyes': '1kgs', '1 Rey': '1kgs', '1R': '1kgs', '1Kgs': '1kgs',
        '2 Reyes': '2kgs', '2Reyes': '2kgs', '2 Rey': '2kgs', '2R': '2kgs', '2Kgs': '2kgs',
        '1 Crónicas': '1ch', '1Cronicas': '1ch', '1 Cro': '1ch', '1Cr': '1ch', '1Ch': '1ch',
        '2 Crónicas': '2ch', '2Cronicas': '2ch', '2 Cro': '2ch', '2Cr': '2ch', '2Ch': '2ch',
        'Esdras': 'ezr', 'Esd': 'ezr',
        'Nehemías': 'ne', 'Nehemias': 'ne', 'Neh': 'ne',
        'Ester': 'et', 'Est': 'et',
        'Job': 'job', 'Jb': 'job',
        'Salmos': 'ps', 'Sal': 'ps', 'Sl': 'ps', 'Salmo': 'ps',
        'Proverbios': 'prv', 'Prov': 'prv', 'Pr': 'prv',
        'Eclesiastés': 'ec', 'Eclesiastes': 'ec', 'Ecl': 'ec',
        'Cantares': 'so', 'Cant': 'so', 'Cnt': 'so',
        'Isaías': 'is', 'Isaias': 'is', 'Isa': 'is', 'Is': 'is',
        'Jeremías': 'jr', 'Jeremias': 'jr', 'Jer': 'jr',
        'Lamentaciones': 'lm', 'Lam': 'lm',
        'Ezequiel': 'ez', 'Eze': 'ez',
        'Daniel': 'dn', 'Dan': 'dn',
        'Oseas': 'ho', 'Os': 'ho',
        'Joel': 'jl', 'Jl': 'jl',
        'Amós': 'am', 'Amos': 'am', 'Am': 'am',
        'Abdías': 'ob', 'Abdias': 'ob', 'Abd': 'ob',
        'Jonás': 'jn', 'Jonas': 'jn', 'Jon': 'jn',
        'Miqueas': 'mi', 'Miq': 'mi',
        'Nahúm': 'na', 'Nahum': 'na', 'Nah': 'na',
        'Habacuc': 'hk', 'Hab': 'hk',
        'Sofonías': 'zp', 'Sofonias': 'zp', 'Sof': 'zp',
        'Hageo': 'hg', 'Hag': 'hg',
        'Zacarías': 'zc', 'Zacarias': 'zc', 'Zac': 'zc',
        'Malaquías': 'ml', 'Malaquias': 'ml', 'Mal': 'ml',

        // Nuevo Testamento
        'Mateo': 'mt', 'Mat': 'mt', 'Mt': 'mt',
        'Marcos': 'mk', 'Mar': 'mk', 'Mc': 'mk', 'Mr': 'mk',
        'Lucas': 'lk', 'Luc': 'lk', 'Lc': 'lk',
        'Juan': 'jo', 'Jn': 'jo',
        'Hechos': 'act', 'Hch': 'act', 'Hec': 'act',
        'Romanos': 'rm', 'Rom': 'rm', 'Ro': 'rm', 'Rm': 'rm',
        '1 Corintios': '1co', '1Corintios': '1co', '1Cor': '1co', '1 Cor': '1co', '1Co': '1co',
        '2 Corintios': '2co', '2Corintios': '2co', '2Cor': '2co', '2 Cor': '2co', '2Co': '2co',
        'Gálatas': 'gl', 'Galatas': 'gl', 'Gál': 'gl', 'Gal': 'gl', 'Ga': 'gl',
        'Efesios': 'eph', 'Ef': 'eph', 'Efe': 'eph',
        'Filipenses': 'ph', 'Fil': 'ph', 'Fp': 'ph',
        'Colosenses': 'col', 'Col': 'col',
        '1 Tesalonicenses': '1ts', '1Tesalonicenses': '1ts', '1Tes': '1ts', '1 Tes': '1ts', '1Ts': '1ts',
        '2 Tesalonicenses': '2ts', '2Tesalonicenses': '2ts', '2Tes': '2ts', '2 Tes': '2ts', '2Ts': '2ts',
        '1 Timoteo': '1ti', '1Timoteo': '1ti', '1Tim': '1ti', '1 Tim': '1ti', '1Ti': '1ti',
        '2 Timoteo': '2ti', '2Timoteo': '2ti', '2Tim': '2ti', '2 Tim': '2ti', '2Ti': '2ti',
        'Tito': 'tit', 'Tit': 'tit', 'Ti': 'tit',
        'Filemón': 'phm', 'Filemon': 'phm', 'Flm': 'phm', 'Flmn': 'phm',
        'Hebreos': 'hb', 'Heb': 'hb', 'He': 'hb',
        'Santiago': 'jm', 'Sant': 'jm', 'Stg': 'jm',
        '1 Pedro': '1pe', '1Pedro': '1pe', '1Ped': '1pe', '1 Ped': '1pe', '1Pe': '1pe', '1P': '1pe',
        '2 Pedro': '2pe', '2Pedro': '2pe', '2Ped': '2pe', '2 Ped': '2pe', '2Pe': '2pe', '2P': '2pe',
        '1 Juan': '1jo', '1Juan': '1jo', '1Jn': '1jo', '1 Jn': '1jo',
        '2 Juan': '2jo', '2Juan': '2jo', '2Jn': '2jo', '2 Jn': '2jo',
        '3 Juan': '3jo', '3Juan': '3jo', '3Jn': '3jo', '3 Jn': '3jo',
        'Judas': 'jd', 'Jud': 'jd',
        'Apocalipsis': 're', 'Apoc': 're', 'Ap': 're'
    };

    parseReference(ref: string): BibleReference | null {
        const normalized = ref.trim();
        const match = normalized.match(/^((?:[1-3]\s?)?[A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\s+de\s+los\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+)?)\s*(\d+)[:.](\d+)(?:[-–](\d+))?$/i);

        if (!match) return null;

        const bookName = match[1]?.trim() || '';
        let resolvedBook = '';
        for (const [key] of Object.entries(this.bookMapping)) {
            if (key.toLowerCase() === bookName.toLowerCase()) {
                resolvedBook = key;
                break;
            }
        }

        if (!resolvedBook) return null;

        return {
            book: resolvedBook,
            chapter: parseInt(match[2] || '0'),
            verseStart: parseInt(match[3] || '0'),
            verseEnd: match[4] ? parseInt(match[4]) : undefined
        };
    }
}
