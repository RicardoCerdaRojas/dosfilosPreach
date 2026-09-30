/**
 * Thin LLM provider port (Phase 2.5, Q7 / ADR-025) — LOCAL copy.
 *
 * The functions package deliberately does NOT depend on `@dosfilos/domain`
 * (cross-package decoupling kept throughout this package — see the duplicate
 * type notes in `validateSeedWitnesses` / `extractionVersions`). So the
 * `ILlmClient` shape, whose canonical home is `@dosfilos/domain`, is mirrored
 * here. Keep the two in sync.
 *
 * Los llamadores dependen de esta interfaz y NO del SDK de Gemini (`@google/genai`),
 * así que cambiar de modelo —o de proveedor— es escribir un adapter hermano y
 * tocar una línea de construcción. Ya hay dos adapters vivos (Gemini y
 * Anthropic), que es la prueba de que el port sirve para lo que dice servir.

 *
 * QUÉ NO CUBRE ESTE PORT, Y POR QUÉ SE QUEDA ASÍ.
 *
 * Es texto→texto de un solo turno. Tres llamadas del servidor siguen usando el
 * SDK directo porque necesitan capacidades que no caben en esa forma:
 *
 *   - `facultyChatStream` — conversación multi-turno con streaming.
 *   - `geminiExtraction` — PDFs, que es multimodal.
 *   - `runLlmPrompt` — herramientas (`fileSearch` del tutor de griego) y visión.
 *
 * NO ES DEUDA PENDIENTE: ampliar el port hasta cubrirlas lo convertiría en la
 * API del proveedor con otro nombre, y un port que expone todo lo que expone su
 * implementación ya no aísla de nada. La regla real —la que no se negocia— es
 * que la llamada salga del servidor y quede MEDIDA; el port es la comodidad que
 * hace eso fácil para el caso común, no un requisito. Las tres de arriba llaman
 * al medidor a mano.
 *
 * El id del modelo NO se escribe acá ni en los llamadores: sale del catálogo
 * (`llm/modelCatalog`), que nombra capacidades —rápido, profundo— en vez de
 * versiones. Cambiar de modelo o de proveedor se hace ahí y en ningún otro
 * lugar.
 */

export interface LlmGenerateOptions {
    /** System instruction. Sets the assistant's role/constraints. */
    system?: string;
    /** The user prompt. */
    prompt: string;
    /** 0..1. Verifier-orienter callables run low (≈0.2) for determinism. */
    temperature?: number;
    /** When `'application/json'`, the adapter requests structured output. */
    responseMimeType?: 'text/plain' | 'application/json';
    /** Hard cap on output size. */
    maxOutputTokens?: number;
}

export interface ILlmClient {
    /** Generate text (or JSON string) from a single-turn prompt. */
    generate(options: LlmGenerateOptions): Promise<string>;
}
