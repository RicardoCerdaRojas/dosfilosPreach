import { beforeEach, describe, expect, it, vi } from 'vitest';

const llamar = vi.fn();
const getIdToken = vi.fn();
const pedirTokenDeAppCheck = vi.fn();
let usuario: { getIdToken: typeof getIdToken } | null = null;
let appCheckActivo: object | undefined = { nombre: 'appCheck' };

vi.mock('firebase/functions', () => ({
    getFunctions: () => ({}),
    httpsCallable: () => llamar,
}));
vi.mock('firebase/auth', () => ({
    getAuth: () => ({ get currentUser() { return usuario; } }),
}));
vi.mock('firebase/app-check', () => ({
    getToken: (...args: unknown[]) => pedirTokenDeAppCheck(...args),
}));
vi.mock('../../config/firebase', () => ({
    get appCheck() { return appCheckActivo; },
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
        pedirTokenDeAppCheck.mockReset().mockResolvedValue({ token: 'appcheck-nuevo' });
        usuario = { getIdToken };
        appCheckActivo = { nombre: 'appCheck' };
    });

    it('devuelve la respuesta cuando no hay nada que reintentar', async () => {
        llamar.mockResolvedValue(respuesta);
        await expect(runLlmPromptWithUsage(opciones)).resolves.toEqual({
            text: 'hola', tokensUsed: 7, finishReason: 'STOP',
        });
        expect(llamar).toHaveBeenCalledTimes(1);
    });

    it('renueva LAS DOS credenciales y reintenta UNA vez', async () => {
        // El mismo código de error lo producen tres cosas: el manejador
        // sin sesión, el framework con la sesión inválida y el framework
        // con App Check inválido o ausente. La primera versión de este
        // arreglo solo renovaba la sesión, y el fallo real del analizador
        // de hebreo venía del framework.
        llamar.mockRejectedValueOnce(faltaDeSesion).mockResolvedValueOnce(respuesta);
        await expect(runLlmPromptWithUsage(opciones)).resolves.toMatchObject({ text: 'hola' });
        expect(getIdToken).toHaveBeenCalledWith(true);
        expect(pedirTokenDeAppCheck).toHaveBeenCalledWith({ nombre: 'appCheck' }, true);
        expect(llamar).toHaveBeenCalledTimes(2);
    });

    it('reintenta cuando el fallo es de App Check y la sesión está perfecta', async () => {
        // Es el caso que de verdad ocurrió: mensaje «Unauthenticated» a
        // secas, que es el del framework y no el del manejador.
        const appCheckInvalido = Object.assign(new Error('Unauthenticated'), {
            code: 'functions/unauthenticated',
        });
        llamar.mockRejectedValueOnce(appCheckInvalido).mockResolvedValueOnce(respuesta);
        await expect(runLlmPromptWithUsage(opciones)).resolves.toMatchObject({ text: 'hola' });
        expect(pedirTokenDeAppCheck).toHaveBeenCalledWith({ nombre: 'appCheck' }, true);
    });

    it('reintenta aunque no haya usuario, si App Check sí se puede renovar', async () => {
        usuario = null;
        llamar.mockRejectedValueOnce(faltaDeSesion).mockResolvedValueOnce(respuesta);
        await expect(runLlmPromptWithUsage(opciones)).resolves.toMatchObject({ text: 'hola' });
        expect(llamar).toHaveBeenCalledTimes(2);
    });

    it('no reenvía una imagen adjunta: pesa megabytes', async () => {
        // El reintento del servidor existe precisamente para no volver a
        // subir un prompt grande desde el navegador. La foto de una
        // rúbrica llega a varios megabytes.
        llamar.mockRejectedValue(faltaDeSesion);
        const conFoto = { ...opciones, inlineImage: { mimeType: 'image/png', base64: 'x'.repeat(1000) } };
        await expect(runLlmPromptWithUsage(conFoto)).rejects.toThrow();
        expect(llamar).toHaveBeenCalledTimes(1);
    });

    it('no reintenta más de una vez: dos fallos son un fallo', async () => {
        llamar.mockRejectedValue(faltaDeSesion);
        await expect(runLlmPromptWithUsage(opciones)).rejects.toThrow();
        expect(llamar).toHaveBeenCalledTimes(2);
    });

    it('no reintenta cuando no hay NINGUNA credencial que renovar', async () => {
        usuario = null;
        appCheckActivo = undefined;
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

    it('si las dos renovaciones fallan, el error original llega a la pantalla', async () => {
        getIdToken.mockRejectedValue(new Error('sin red'));
        pedirTokenDeAppCheck.mockRejectedValue(new Error('sin red'));
        llamar.mockRejectedValue(faltaDeSesion);
        await expect(runLlmPromptWithUsage(opciones)).rejects.toThrow('User must be authenticated');
        expect(llamar).toHaveBeenCalledTimes(1);
    });
});
