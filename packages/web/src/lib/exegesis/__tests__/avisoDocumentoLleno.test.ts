import { beforeEach, describe, expect, it, vi } from 'vitest';
import es from '@/i18n/locales/es/exegesis.json';
import en from '@/i18n/locales/en/exegesis.json';

const error = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => error(...a) } }));
vi.mock('@/i18n', () => ({ i18n: { t: (k: string) => k } }));
const { avisarSiDocumentoLleno } = await import('../avisoDocumentoLleno');

describe('avisar que el trabajo no cabe', () => {
    beforeEach(() => error.mockClear());

    it.each([
        'Document "x" cannot be written because its size (1,048,600 bytes) exceeds the maximum allowed size of 1,048,576 bytes.',
        'The value of property "steps" is longer than 1048487 bytes.',
        '3 INVALID_ARGUMENT: maximum entity size is 1048576 bytes',
        '3 INVALID_ARGUMENT: Property steps contains an invalid nested entity.',
    ])('dice por qué no se guardó: %s', mensaje => {
        avisarSiDocumentoLleno(new Error(mensaje));
        expect(error).toHaveBeenCalledWith('exegesis:detail.documentFull', expect.anything());
    });

    it('otros errores siguen con el aviso de su botón', () => {
        avisarSiDocumentoLleno(new Error('otra cosa'));
        avisarSiDocumentoLleno('texto');
        expect(error).not.toHaveBeenCalled();
    });

    it('el texto existe en los dos idiomas', () => {
        for (const lengua of [es, en]) expect((lengua as { detail: { documentFull: string } }).detail.documentFull).toBeTruthy();
    });
});
