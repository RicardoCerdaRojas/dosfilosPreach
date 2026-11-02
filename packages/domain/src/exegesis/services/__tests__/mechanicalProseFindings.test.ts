import { describe, it, expect } from 'vitest';
import { mechanicalProseFindings } from '../mechanicalProseFindings';

/** Lo que se corrige sin leer el argumento (TP #8): lo usa la revisión antes de exportar. */
const kinds = (prose: string) => mechanicalProseFindings(prose).map(f => f.kind);

describe('lo mecánico del Word', () => {
    it('raya corta en rangos de páginas y versículos', () => {
        const f = mechanicalProseFindings('Santiago 4:1-10 y la entrada (Tuggy, 584-585).');
        expect(f.filter(x => x.kind === 'hyphen-range').map(x => x.replacement)).toEqual(['4:1–10', '584–585']);
    });

    it('no confunde un guion de palabra ni una dirección', () => {
        expect(kinds('El greco-romano y https://x.org/?p=12-15 no son rangos.')).toEqual([]);
    });

    it('«διά τό» lleva grave', () => {
        const f = mechanicalProseFindings('La construcción διά τό μὴ αἰτεῖσθαι es causal.');
        expect(f).toContainEqual({ kind: 'greek-grave', excerpt: 'διά τό', replacement: 'διὰ τό' });
        expect(f).toContainEqual({ kind: 'greek-grave', excerpt: 'τό μὴ', replacement: 'τὸ μὴ' });
    });

    it('el oxítono ante puntuación, ante enclítica o el interrogativo conservan el agudo', () => {
        expect(kinds('Dice αὐτός. Y ἀδελφοί μου, y τί ἐστιν, y «καλός» solo.')).toEqual([]);
    });

    it('comas dobles', () => {
        expect(mechanicalProseFindings('parte del cuerpo,, dato que importa.')).toContainEqual(expect.objectContaining({ kind: 'punctuation', replacement: 'cuerpo, dato' }));
    });
});
