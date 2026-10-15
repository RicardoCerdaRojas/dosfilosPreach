import { AnthropicLlmClient } from '../AnthropicLlmClient';
import type { ILlmClient } from '../LlmClient';
import { OpenAiLlmClient, type EsfuerzoDeRazonamiento } from '../OpenAiLlmClient';

/**
 * El cliente de las pruebas «en vivo», elegido por `EVAL_MODELO`:
 *
 *   (sin definir)                → Claude Sonnet, como siempre
 *   openai:gpt-6.1-sol:low       → Sol
 *   openai:gpt-6-luna:none       → Luna
 *
 * Así las mismas pruebas comparan modelos antes de mover una función en el
 * ruteo (2026-10-15).
 */
export function clienteDeEval(): { cliente: ILlmClient; nombre: string } | null {
    const elegido = process.env.EVAL_MODELO ?? '';
    if (elegido.startsWith('openai:')) {
        const [, modelo, razonamiento] = elegido.split(':');
        const clave = process.env.OPENAI_API_KEY;
        if (!clave || !modelo) return null;
        return { cliente: new OpenAiLlmClient(clave, modelo, undefined, (razonamiento ?? 'none') as EsfuerzoDeRazonamiento), nombre: elegido };
    }
    const clave = process.env.ANTHROPIC_API_KEY;
    return clave ? { cliente: new AnthropicLlmClient(clave), nombre: 'claude-sonnet-4-6' } : null;
}
