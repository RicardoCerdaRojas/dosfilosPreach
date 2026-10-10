"""
Abreviaturas bíblicas (estilo SBL, como las usan las gramáticas en inglés) →
carpeta de nuestros datos fijados (packages/web/public/language-data/v1/{he,gr}).
"""
import re

AT = {
    'Gen': 'Gen', 'Exod': 'Exod', 'Lev': 'Lev', 'Num': 'Num', 'Deut': 'Deut', 'Josh': 'Josh', 'Judg': 'Judg', 'Ruth': 'Ruth',
    '1 Sam': '1Sam', '2 Sam': '2Sam', '1 Kgs': '1Kgs', '2 Kgs': '2Kgs', '1 Kg': '1Kgs', '2 Kg': '2Kgs',
    '1 Chr': '1Chr', '2 Chr': '2Chr', 'Ezra': 'Ezra', 'Neh': 'Neh', 'Esth': 'Esth', 'Job': 'Job', 'Ps': 'Ps', 'Pss': 'Ps',
    'Prov': 'Prov', 'Eccl': 'Eccl', 'Qoh': 'Eccl', 'Song': 'Song', 'Isa': 'Isa', 'Jer': 'Jer', 'Lam': 'Lam', 'Ezek': 'Ezek',
    'Dan': 'Dan', 'Hos': 'Hos', 'Joel': 'Joel', 'Amos': 'Amos', 'Obad': 'Obad', 'Jonah': 'Jonah', 'Mic': 'Mic', 'Nah': 'Nah',
    'Hab': 'Hab', 'Zeph': 'Zeph', 'Hag': 'Hag', 'Zech': 'Zech', 'Mal': 'Mal',
}
# Nombres completos («Matthew 6:24», Runge; «Genesis 1:1»).
AT.update({
    'Genesis': 'Gen', 'Exodus': 'Exod', 'Leviticus': 'Lev', 'Numbers': 'Num', 'Deuteronomy': 'Deut', 'Joshua': 'Josh',
    'Judges': 'Judg', '1 Samuel': '1Sam', '2 Samuel': '2Sam', '1 Kings': '1Kgs', '2 Kings': '2Kgs', '1 Chronicles': '1Chr',
    '2 Chronicles': '2Chr', 'Nehemiah': 'Neh', 'Esther': 'Esth', 'Psalm': 'Ps', 'Psalms': 'Ps', 'Proverbs': 'Prov',
    'Ecclesiastes': 'Eccl', 'Song of Songs': 'Song', 'Isaiah': 'Isa', 'Jeremiah': 'Jer', 'Lamentations': 'Lam',
    'Ezekiel': 'Ezek', 'Daniel': 'Dan', 'Hosea': 'Hos', 'Obadiah': 'Obad', 'Micah': 'Mic', 'Nahum': 'Nah',
    'Habakkuk': 'Hab', 'Zephaniah': 'Zeph', 'Haggai': 'Hag', 'Zechariah': 'Zech', 'Malachi': 'Mal',
})
NT = {
    'Matt': 'MAT', 'Mark': 'MRK', 'Luke': 'LUK', 'John': 'JHN', 'Acts': 'ACT', 'Rom': 'ROM', '1 Cor': '1CO', '2 Cor': '2CO',
    'Gal': 'GAL', 'Eph': 'EPH', 'Phil': 'PHP', 'Col': 'COL', '1 Thess': '1TH', '2 Thess': '2TH', '1 Tim': '1TI', '2 Tim': '2TI',
    'Titus': 'TIT', 'Phlm': 'PHM', 'Heb': 'HEB', 'Jas': 'JAS', '1 Pet': '1PE', '2 Pet': '2PE', '1 John': '1JN', '2 John': '2JN',
    '3 John': '3JN', 'Jude': 'JUD', 'Rev': 'REV',
    'Matthew': 'MAT', 'Romans': 'ROM', '1 Corinthians': '1CO', '2 Corinthians': '2CO', 'Galatians': 'GAL', 'Ephesians': 'EPH',
    'Philippians': 'PHP', 'Colossians': 'COL', '1 Thessalonians': '1TH', '2 Thessalonians': '2TH', '1 Timothy': '1TI',
    '2 Timothy': '2TI', 'Philemon': 'PHM', 'Hebrews': 'HEB', 'James': 'JAS', '1 Peter': '1PE', '2 Peter': '2PE',
    'Revelation': 'REV',
}


UN_CAPITULO = {'Obad', 'Obadiah', 'Phlm', 'Philemon', 'Jude', '2 John', '3 John'}


def libros(lengua):
    """Las abreviaturas de la lengua del libro: 'he' (AT) o 'gr' (NT)."""
    return AT if lengua == 'he' else NT


def _clave(nombre):
    """«1Cor» / «1 Cor» → «1 Cor»."""
    return re.sub(r'^(\d)\s*', r'\1 ', re.sub(r'\s+', ' ', nombre.strip()))


def carpeta(nombre, lengua):
    """La carpeta de nuestros datos para una abreviatura tal como apareció."""
    return libros(lengua).get(_clave(nombre))


def _alternativas(nombres):
    # «1 Cor» acepta «1Cor» y «1\nCor» (referencia partida entre líneas).
    return '|'.join(re.escape(n).replace(r'\ ', r'\s*') for n in sorted(nombres, key=len, reverse=True))


def patron_referencia(lengua):
    """
    Una referencia bíblica en sus formas de las gramáticas: «(Gen 19:22)»,
    «)1 Kgs 3:7(» (junto al hebreo la capa invierte los paréntesis),
    «in Rom 7:14» (Wallace, sin paréntesis), «Matthew 6:24» (Runge),
    «1Cor 13:4», y partida entre líneas («(1\nKgs 12:27)»).
    Grupos: libro, capítulo, versículo.
    """
    return re.compile(r'(?<![A-Za-z0-9])(?:[\(\)]\s*)?(' + _alternativas(libros(lengua)) + r')\.?\s+(\d+)[:.](\d+)')


def patron_un_capitulo(lengua):
    """«Jude 3», «Phlm 10»: libros de un solo capítulo, versículo sin capítulo. Grupos: libro, versículo."""
    nombres = [n for n in libros(lengua) if n in UN_CAPITULO]
    return re.compile(r'(?<![A-Za-z0-9])(?:[\(\)]\s*)?(' + _alternativas(nombres) + r')\.?\s+(\d+)(?![:.\d])') if nombres else None


def referencias(texto, lengua):
    """(carpeta, capítulo, versículo, posición) de cada referencia del texto."""
    out = []
    for m in patron_referencia(lengua).finditer(texto):
        c = carpeta(m.group(1), lengua)
        if c:
            out.append((c, int(m.group(2)), int(m.group(3)), m.start()))
    un = patron_un_capitulo(lengua)
    if un:
        for m in un.finditer(texto):
            c = carpeta(m.group(1), lengua)
            if c:
                out.append((c, 1, int(m.group(2)), m.start()))
    return sorted(out, key=lambda r: r[3])
