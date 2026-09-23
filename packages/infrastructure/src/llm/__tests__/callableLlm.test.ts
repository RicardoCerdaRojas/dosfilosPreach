import { beforeEach, describe, expect, it, vi } from 'vitest';

const llamar = vi.fn();
const getIdToken = vi.fn();
let usuario: { getIdToken: typeof getIdToken } | null = null;

vi.mock('firebase/functions', () => ({
    getFunctions: () => ({}),
    httpsCallable: () => llamar,
}));
vi.mock('firebase/auth', () => ({
    getAuth: () => ({ get currentUser() { return usuario; } }),
}));

const { runLlmPromptWithUsage } = await import('../callableLlm');

const faltaDeSesion = Object.assign(new Error('User must be authenticated'), {
    code: 'functions/unauthenticated',
});
const respuesta = { data: { text: 'hola', tokens: 7, finishReason: 'STOP' } };
const opciones = { feature: 'exegesis.readBibliography', prompt: 'x' };

/**
 * El reintento del proxy cuando la sesión todavía no está.
 *
 * Medido en producción: dos análisis de hebreo salieron sin token y
 * volvieron con 401; el tercero funcionó. El servidor rechaza por falta
 * de sesión antes de llamar al modelo y antes de contabilizar gasto, así
 * que reintentar no cobra dos veces.
 */
describe('runLlmPromptWithUsage', () => {
    beforeEach(() => {
        llamar.mockReset();
        getIdToken.mockReset().mockResolvedValue('token-nuevo');
        usuario = { getIdToken };
    });

    it('devuelve la respuesta cuando no hay nada que reintentar', async () => {
        llamar.mockResolvedValue(respuesta);
        await expect(runLlmPromptWithUsage(opciones)).resolves.toEqual({
            text: 'hola', tokensUsed: 7, finishReason: 'STOP',
        });
        expect(llamar).toHaveBeenCalledTimes(1);
    });

    it('renueva el token y reintenta UNA vez cuando falta la sesión', async () => {
        llamar.mockRejectedValueOnce(faltaDeSesion).mockResolvedValueOnce(respuesta);
        await expect(runLlmPromptWithUsage(opciones)).resolves.toMatchObject({ text: 'hola' });
        expect(getIdToken).toHaveBeenCalledWith(true);
        expect(llamar).toHaveBeenCalledTimes(2);
    });

    it('no reintenta más de una vez: dos fallos son un fallo', async () => {
        llamar.mockRejectedValue(faltaDeSesion);
        await expect(runLlmPromptWithUsage(opciones)).rejects.toThrow();
        expect(llamar).toHaveBeenCalledTimes(2);
    });

    it('no reintenta sin usuario: no hay token que renovar', async () => {
        usuario = null;
        llamar.mockRejectedValue(faltaDeSesion);
        await expect(runLlmPromptWithUsage(opciones)).rejects.toThrow();
        expect(llamar).toHaveBeenCalledTimes(1);
    });

    it('no reintenta los demás errores: solo la falta de sesión es inocua', async () => {
        // Un modelo sobrecargado o una cuota agotada SÍ pueden haber
        // trabajado y cobrado. Reintentarlos a ciegas duplicaría el gasto.
        for (const code of ['functions/resource-exhausted', 'functions/internal', 'functions/invalid-argument']) {
            llamar.mockReset().mockRejectedValue(Object.assign(new Error('no'), { code }));
            await expect(runLlmPromptWithUsage(opciones), code).rejects.toThrow();
            expect(llamar, code).toHaveBeenCalledTimes(1);
        }
    });

    it('si la renovación del token falla, el error original llega a la pantalla', async () => {
        getIdToken.mockRejectedValue(new Error('sin red'));
        llamar.mockRejectedValue(faltaDeSesion);
        await expect(runLlmPromptWithUsage(opciones)).rejects.toThrow('User must be authenticated');
        expect(llamar).toHaveBeenCalledTimes(1);
    });
});
