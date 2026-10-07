import { describe, it, expect } from 'vitest';
import { deriveCitationKeyFromAuthor, workTitleFromLabel } from '../citationKeyFromAuthor';

describe('deriveCitationKeyFromAuthor', () => {
    it('apellido según la forma del autor', () => {
        expect(deriveCitationKeyFromAuthor('Daniel B. Wallace')).toBe('Wallace');
        expect(deriveCitationKeyFromAuthor('Bauckham, Richard')).toBe('Bauckham');
        expect(deriveCitationKeyFromAuthor('deSilva')).toBe('deSilva');
        expect(deriveCitationKeyFromAuthor('David A. de Silva')).toBe('de Silva');
        // La marca de editor no es el apellido.
        expect(deriveCitationKeyFromAuthor('Joel B. Green (ed.)')).toBe('Green');
        expect(deriveCitationKeyFromAuthor('Scot McKnight, ed.')).toBe('McKnight');
    });

    it('REGRESIÓN (TP #6): una obra de dos o tres autores los nombra a todos', () => {
        expect(deriveCitationKeyFromAuthor('D. A. Carson & Douglas J. Moo')).toBe('Carson y Moo');
        expect(deriveCitationKeyFromAuthor('Carson, D. A., and Douglas J. Moo')).toBe('Carson y Moo');
        expect(deriveCitationKeyFromAuthor('Barrick & Busenitz')).toBe('Barrick y Busenitz');
        expect(deriveCitationKeyFromAuthor('Köstenberger, Andreas J.; Kellum, L. Scott; Quarles, Charles L.')).toBe('Köstenberger, Kellum y Quarles');
        expect(deriveCitationKeyFromAuthor('D. A. Carson & Douglas J. Moo', null, 'en')).toBe('Carson and Moo');
    });

    it('cuatro o más: el primero et al.', () => {
        expect(deriveCitationKeyFromAuthor('Aland, Barbara; Aland, Kurt; Karavidopoulos, Johannes; Martini, Carlo M.; Metzger, Bruce M. (eds.)'))
            .toBe('Aland et al.');
    });

    it('REGRESIÓN (TP #6): una edición crítica se cita por su sigla, no por su editor', () => {
        const eds = 'Aland, Barbara; Aland, Kurt; Karavidopoulos, Johannes; Martini, Carlo M.; Metzger, Bruce M. (eds.)';
        expect(deriveCitationKeyFromAuthor(eds, 'Novum Testamentum Graece')).toBe('NA28');
        expect(deriveCitationKeyFromAuthor(eds, 'Novum Testamentum Graece, 27th edition')).toBe('NA27');
        expect(deriveCitationKeyFromAuthor('Nestle-Aland', 'NA27')).toBe('NA27');
        expect(deriveCitationKeyFromAuthor('United Bible Societies', 'The Greek New Testament, 4th revised edition')).toBe('UBS4');
        expect(deriveCitationKeyFromAuthor('Elliger, K.; Rudolph, W.', 'Biblia Hebraica Stuttgartensia')).toBe('BHS');
        // Un libro que sólo habla del NT griego no es una edición.
        expect(deriveCitationKeyFromAuthor('Daniel B. Wallace', 'Greek Grammar Beyond the Basics')).toBe('Wallace');
    });

    it('sin autor no inventa una clave', () => {
        expect(deriveCitationKeyFromAuthor('')).toBe('');
        expect(deriveCitationKeyFromAuthor(null)).toBe('');
    });
});

/**
 * La cita salió «(McCartney, James — Baker Exegetical Commentary on the New
 * Testament, 173)»: sin título en la ficha, el rótulo del archivo entero hacía
 * de título (TP Santiago 2:14-26).
 */
describe('workTitleFromLabel', () => {
    it('corta la colección pegada al título', () => {
        expect(workTitleFromLabel('James — Baker Exegetical Commentary on the New Testament')).toBe('James');
        expect(workTitleFromLabel('Santiago – Comentario Bíblico Mundo Hispano')).toBe('Santiago');
    });

    it('un rótulo sin colección queda igual', () => {
        expect(workTitleFromLabel('A Grammar of the Greek New Testament')).toBe('A Grammar of the Greek New Testament');
        expect(workTitleFromLabel('Romanos — una lectura pastoral')).toBe('Romanos — una lectura pastoral');
    });
});
