import { describe, expect, it } from '@jest/globals';

import { formatWallTime } from '../wallTime';

const at = (h: number, m: number) => new Date(2026, 9, 4, h, m).getTime();

describe('formatWallTime', () => {
    it('da la hora corta, con dos cifras de minutos', () => {
        expect(formatWallTime(at(11, 45))).toBe('11:45');
        expect(formatWallTime(at(9, 5))).toBe('9:05');
    });

    it('en 12 horas: mediodía es 12 y la tarde vuelve a 1', () => {
        expect(formatWallTime(at(12, 0))).toBe('12:00');
        expect(formatWallTime(at(19, 30))).toBe('7:30');
        expect(formatWallTime(at(0, 10))).toBe('12:10');
    });
});
