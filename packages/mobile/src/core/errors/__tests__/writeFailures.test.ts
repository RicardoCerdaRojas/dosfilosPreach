import { describe, expect, it, jest } from '@jest/globals';
import { onWriteFailure, reportWriteFailure } from '../writeFailures';

describe('aviso de escrituras fallidas', () => {
    it('quien escucha recibe el tipo; al desuscribirse deja de recibir', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const vistos: string[] = [];
        const off = onWriteFailure((kind) => vistos.push(kind));
        reportWriteFailure('preaching_log', new Error('permission-denied'));
        off();
        reportWriteFailure('annotation', new Error('x'));
        expect(vistos).toEqual(['preaching_log']);
        warn.mockRestore();
    });
});
