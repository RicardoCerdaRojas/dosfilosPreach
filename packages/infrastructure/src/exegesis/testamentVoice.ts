import { getBookById } from '@dosfilos/domain';

/**
 * Las autoridades, el aparato y la morfología cambian con el testamento.
 *
 * El prompt estaba fijo en griego del Nuevo Testamento — sistema, autoridades,
 * aparato NA28, testigos 𝔓⁴⁶ ℵ A B C D, "participio aoristo activo", y un
 * "presenta el texto griego" en el mensaje del usuario. Analizando Jonás, que
 * es hebreo, el modelo obedecía al prompt: sacaba la LXX de memoria e ignoraba
 * el texto masorético que se le estaba dando como base.
 *
 * No es un matiz. Un análisis de Jonás con aparato NA28 y categorías de Wallace
 * es exégesis del libro equivocado, y la referencia a manuscritos griegos que
 * no contienen el texto hebreo es una cita imposible de verificar.
 */
export interface TestamentVoice {
    language: 'griego' | 'hebreo';
    languageAdjEs: 'griega' | 'hebrea';
    testamentEs: string;
    testamentEn: string;
    languageEn: 'Greek' | 'Hebrew';
    expertEs: string;
    expertEn: string;
    grammarsEs: string;
    grammarsEn: string;
    lexiconsEs: string;
    lexiconsEn: string;
    apparatusEs: string;
    apparatusEn: string;
    witnessesEs: string;
    witnessesEn: string;
    morphologyEs: string;
    morphologyEn: string;
}

const NT_VOICE: TestamentVoice = {
    language: 'griego', languageAdjEs: 'griega', languageEn: 'Greek',
    testamentEs: 'del Nuevo Testamento', testamentEn: 'New Testament',
    expertEs: 'griego del Nuevo Testamento', expertEn: 'New Testament biblical Greek',
    grammarsEs: 'Gramática/sintaxis griega: Wallace, BDF, Robertson',
    grammarsEn: 'Greek grammar/syntax: Wallace, BDF, Robertson',
    lexiconsEs: 'Léxico: BDAG, LSJ, Louw-Nida, TDNT, NIDNTTE',
    lexiconsEn: 'Lexicon: BDAG, LSJ, Louw-Nida, TDNT, NIDNTTE',
    apparatusEs: 'Crítica textual: Metzger, Comfort & Barrett, aparato NA28',
    apparatusEn: 'Textual criticism: Metzger, Comfort & Barrett, NA28 apparatus',
    witnessesEs: '𝔓⁴⁶, ℵ, A, B, C, D según corresponda',
    witnessesEn: '𝔓⁴⁶, ℵ, A, B, C, D as appropriate',
    morphologyEs: 'participio aoristo activo, nominativo masculino singular',
    morphologyEn: 'aorist active participle, masculine singular nominative',
};

const OT_VOICE: TestamentVoice = {
    language: 'hebreo', languageAdjEs: 'hebrea', languageEn: 'Hebrew',
    testamentEs: 'del Antiguo Testamento', testamentEn: 'Old Testament',
    expertEs: 'hebreo bíblico', expertEn: 'Biblical Hebrew',
    grammarsEs: 'Gramática/sintaxis hebrea: Waltke-O\'Connor, Joüon-Muraoka, Gesenius (GKC)',
    grammarsEn: 'Hebrew grammar/syntax: Waltke-O\'Connor, Joüon-Muraoka, Gesenius (GKC)',
    lexiconsEs: 'Léxico: HALOT, BDB, DCH, TDOT, NIDOTTE',
    lexiconsEn: 'Lexicon: HALOT, BDB, DCH, TDOT, NIDOTTE',
    apparatusEs: 'Crítica textual: aparato de BHS/BHQ, Tov, Würthwein',
    apparatusEn: 'Textual criticism: BHS/BHQ apparatus, Tov, Würthwein',
    witnessesEs: 'TM (Códice de Leningrado), Pentateuco Samaritano, LXX, Qumrán (1QIsaᵃ y afines), Peshitta, Vulgata, Targumim según corresponda',
    witnessesEn: 'MT (Leningrad Codex), Samaritan Pentateuch, LXX, Qumran (1QIsaᵃ and related), Peshitta, Vulgate, Targumim as appropriate',
    morphologyEs: 'qatal qal 3ª masculino singular; participio nifal; wayyiqtol hifil',
    morphologyEn: 'qal qatal 3rd masculine singular; niphal participle; hiphil wayyiqtol',
};

/**
 * El AT se analiza en hebreo aunque exista la LXX. La versión griega es un
 * TESTIGO textual del hebreo, no el texto a exegetar: tratarla como base
 * invierte la relación y produce un análisis de la traducción en vez del
 * original.
 */
export function voiceFor(bookId: string): TestamentVoice {
    const book = getBookById(bookId as never);
    return book?.testament === 'OT' ? OT_VOICE : NT_VOICE;
}
