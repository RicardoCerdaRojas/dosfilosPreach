/**
 * Catálogo de modelos — COPIA LOCAL.
 *
 * El canónico vive en `packages/domain/src/llm/modelCatalog.ts`. Se duplica
 * porque `packages/functions` NO puede importar `@dosfilos/domain` sin reventar
 * el build con ~180 errores TS6059 — el mismo decoupling deliberado que obliga
 * a duplicar el port `ILlmClient`.
 *
 * `__tests__/modelCatalog.test.ts` compara las dos listas y, sobre todo,
 * verifica que TODO MODELO OFRECIBLE TENGA PRECIO en `LLM_PRICING`. Esa segunda
 * comprobación no es ceremonia: el proxy rechaza cualquier modelo sin precio
 * conocido, así que un modelo ofrecido sin precio es una opción de la pantalla
 * de ajustes que rompe toda generación. Ya pasó.
 */

export interface LlmModel {
    id: string;
    label: string;
    selectable: boolean;
    hint?: string;
}

export const MODEL_FAST = 'gemini-2.5-flash';
export const MODEL_DEEP = 'gemini-2.5-pro';
export const MODEL_EMBEDDING = 'gemini-embedding-001';
export const DEFAULT_MODEL = MODEL_FAST;

export const LLM_MODELS: readonly LlmModel[] = [
    {
        id: MODEL_FAST,
        label: 'Rápido',
        selectable: true,
        hint: 'Recomendado. Responde rápido y alcanza para casi todo.',
    },
    {
        id: MODEL_DEEP,
        label: 'Profundo',
        selectable: true,
        hint: 'Piensa más y tarda más. Útil en pasajes difíciles.',
    },
    { id: MODEL_EMBEDDING, label: 'Índice de biblioteca', selectable: false },
];

export function selectableModels(): LlmModel[] {
    return LLM_MODELS.filter((m) => m.selectable);
}

export function isKnownModel(id: string | undefined): boolean {
    return LLM_MODELS.some((m) => m.id === id);
}

export function resolveUserModel(stored: string | undefined): string {
    if (!stored) return DEFAULT_MODEL;
    const found = LLM_MODELS.find((m) => m.id === stored);
    return found?.selectable ? found.id : DEFAULT_MODEL;
}
