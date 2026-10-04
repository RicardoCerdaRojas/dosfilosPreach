import { BaseJSONRepository, BibleJSONData } from './BaseJSONRepository';
import { BibleReference } from '@/domain/bible/entities/BibleEntities';

interface ASVVerse {
    book: number;
    chapter: number;
    verse: number;
    text: string;
}

interface ASVData {
    verses: ASVVerse[];
}

/**
 * ASV (American Standard Version) Repository - Adapter for English Bible
 */
export class ASVRepository extends BaseJSONRepository {
    protected readonly versionId = 'ASV';
    protected readonly language = 'en';
    protected readonly bookMapping: Record<string, string> = {
        // Old Testament
        'Genesis': '1', 'Gen': '1', 'Gn': '1',
        'Exodus': '2', 'Ex': '2',
        'Leviticus': '3', 'Lev': '3', 'Lv': '3',
        'Numbers': '4', 'Num': '4', 'Nm': '4',
        'Deuteronomy': '5', 'Deut': '5', 'Dt': '5',
        'Joshua': '6', 'Josh': '6', 'Jos': '6',
        'Judges': '7', 'Judg': '7', 'Jdg': '7',
        'Ruth': '8', 'Ru': '8',
        '1 Samuel': '9', '1Samuel': '9', '1 Sam': '9', '1Sam': '9', '1S': '9',
        '2 Samuel': '10', '2Samuel': '10', '2 Sam': '10', '2Sam': '10', '2S': '10',
        '1 Kings': '11', '1Kings': '11', '1 Kgs': '11', '1Kgs': '11', '1K': '11',
        '2 Kings': '12', '2Kings': '12', '2 Kgs': '12', '2Kgs': '12', '2K': '12',
        '1 Chronicles': '13', '1Chronicles': '13', '1 Chron': '13', '1Chr': '13', '1Ch': '13',
        '2 Chronicles': '14', '2Chronicles': '14', '2 Chron': '14', '2Chr': '14', '2Ch': '14',
        'Ezra': '15', 'Ezr': '15',
        'Nehemiah': '16', 'Neh': '16',
        'Esther': '17', 'Est': '17',
        'Job': '18', 'Jb': '18',
        'Psalms': '19', 'Psalm': '19', 'Ps': '19', 'Psa': '19',
        'Proverbs': '20', 'Prov': '20', 'Pr': '20',
        'Ecclesiastes': '21', 'Eccl': '21', 'Ec': '21',
        'Song of Solomon': '22', 'Song': '22', 'So': '22', 'Canticles': '22',
        'Isaiah': '23', 'Isa': '23', 'Is': '23',
        'Jeremiah': '24', 'Jer': '24', 'Jr': '24',
        'Lamentations': '25', 'Lam': '25', 'Lm': '25',
        'Ezekiel': '26', 'Ezek': '26', 'Ez': '26',
        'Daniel': '27', 'Dan': '27', 'Dn': '27',
        'Hosea': '28', 'Hos': '28', 'Ho': '28',
        'Joel': '29', 'Jl': '29',
        'Amos': '30', 'Am': '30',
        'Obadiah': '31', 'Obad': '31', 'Ob': '31',
        'Jonah': '32', 'Jon': '32', 'Jnh': '32',
        'Micah': '33', 'Mic': '33', 'Mi': '33',
        'Nahum': '34', 'Nah': '34', 'Na': '34',
        'Habakkuk': '35', 'Hab': '35', 'Hk': '35',
        'Zephaniah': '36', 'Zeph': '36', 'Zep': '36', 'Zp': '36',
        'Haggai': '37', 'Hag': '37', 'Hg': '37',
        'Zechariah': '38', 'Zech': '38', 'Zc': '38',
        'Malachi': '39', 'Mal': '39', 'Ml': '39',

        // New Testament
        'Matthew': '40', 'Matt': '40', 'Mt': '40',
        'Mark': '41', 'Mk': '41', 'Mr': '41',
        'Luke': '42', 'Lk': '42', 'Lc': '42',
        'John': '43', 'Jn': '43',
        'Acts': '44',
        'Romans': '45', 'Rom': '45', 'Ro': '45', 'Rm': '45',
        '1 Corinthians': '46', '1Corinthians': '46', '1Cor': '46', '1 Cor': '46', '1Co': '46',
        '2 Corinthians': '47', '2Corinthians': '47', '2Cor': '47', '2 Cor': '47', '2Co': '47',
        'Galatians': '48', 'Gal': '48', 'Ga': '48',
        'Ephesians': '49', 'Eph': '49', 'Ef': '49',
        'Philippians': '50', 'Phil': '50', 'Php': '50',
        'Colossians': '51', 'Col': '51',
        '1 Thessalonians': '52', '1Thessalonians': '52', '1Thess': '52', '1 Thess': '52', '1Th': '52',
        '2 Thessalonians': '53', '2Thessalonians': '53', '2Thess': '53', '2 Thess': '53', '2Th': '53',
        '1 Timothy': '54', '1Timothy': '54', '1Tim': '54', '1 Tim': '54', '1Ti': '54',
        '2 Timothy': '55', '2Timothy': '55', '2Tim': '55', '2 Tim': '55', '2Ti': '55',
        'Titus': '56', 'Tit': '56', 'Ti': '56',
        'Philemon': '57', 'Phlm': '57', 'Phm': '57',
        'Hebrews': '58', 'Heb': '58', 'He': '58',
        'James': '59', 'Jas': '59', 'Jm': '59',
        '1 Peter': '60', '1Peter': '60', '1Pet': '60', '1 Ped': '60', '1Pe': '60', '1P': '60',
        '2 Peter': '61', '2Peter': '61', '2Pet': '61', '2 Ped': '61', '2Pe': '61', '2P': '61',
        '1 John': '62', '1John': '62', '1Jn': '62', '1 Jn': '62',
        '2 John': '63', '2John': '63', '2Jn': '63', '2 Jn': '63',
        '3 John': '64', '3John': '64', '3Jn': '64', '3 Jn': '64',
        'Jude': '65',
        'Revelation': '66', 'Rev': '66', 'Re': '66'
    };

    protected loadBibleData(): BibleJSONData[] {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return this.transformData(require('../../../../assets/bible/asv.json') as ASVData);
    }

    private transformData(asv: ASVData): BibleJSONData[] {
        const booksMap = new Map<number, string[][]>();

        asv.verses.forEach(v => {
            if (!booksMap.has(v.book)) {
                booksMap.set(v.book, []);
            }
            const chapters = booksMap.get(v.book)!;
            const chapterIdx = v.chapter - 1;
            if (!chapters[chapterIdx]) {
                chapters[chapterIdx] = [];
            }
            chapters[chapterIdx][v.verse - 1] = v.text;
        });

        const result: BibleJSONData[] = [];
        booksMap.forEach((chapters, bookNum) => {
            result.push({
                id: bookNum.toString(),
                chapters: chapters
            });
        });

        return result;
    }

    parseReference(ref: string): BibleReference | null {
        const normalized = ref.trim();
        const match = normalized.match(/^((?:[1-3]\s?)?[A-Za-z]+(?:\s+[A-Za-z]+)*)\s*(\d+)[:.](\d+)(?:[-–](\d+))?$/i);

        if (!match) return null;

        const bookNameInput = match[1]?.trim() || '';
        let resolvedBookLabel = '';

        const searchName = bookNameInput.toLowerCase();
        for (const [key] of Object.entries(this.bookMapping)) {
            if (key.toLowerCase() === searchName) {
                resolvedBookLabel = key;
                break;
            }
        }

        if (!resolvedBookLabel) return null;

        return {
            book: resolvedBookLabel,
            chapter: parseInt(match[2] || '0'),
            verseStart: parseInt(match[3] || '0'),
            verseEnd: match[4] ? parseInt(match[4]) : undefined
        };
    }
}
