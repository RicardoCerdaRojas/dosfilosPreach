import { describe, expect, it } from 'vitest';
import { partirPorEscritura } from '../escrituras';

describe('partirPorEscritura', () => {
    it('separa el griego en un tramo con sus espacios internos', () => {
        const t = partirPorEscritura('15. ἡ εὐχή. The prayer is');
        expect(t).toEqual([
            { texto: '15. ', escritura: null },
            { texto: 'ἡ εὐχή', escritura: 'griego' },
            { texto: '. The prayer is', escritura: null },
        ]);
    });
    it('el hebreo con niqud y cantilación queda entero', () => {
        const t = partirPorEscritura('valle: בְּגֵ֪יא צַלְמָ֡וֶת (23:4)');
        expect(t.find(x => x.escritura === 'hebreo')?.texto).toBe('בְּגֵ֪יא צַלְמָ֡וֶת');
    });
    it('un texto sin griego ni hebreo es un solo tramo', () => {
        expect(partirPorEscritura('la oración por los enfermos')).toEqual([{ texto: 'la oración por los enfermos', escritura: null }]);
    });
    it('no se pierde ni se repite ningún carácter', () => {
        const s = 'ver ἐξομολογεῖσθε οὖν ἀλλήλοις y luego וַיֹּאמֶר — fin';
        expect(partirPorEscritura(s).map(x => x.texto).join('')).toBe(s);
    });
});
