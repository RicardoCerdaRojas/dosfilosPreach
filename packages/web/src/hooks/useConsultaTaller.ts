import { useCallback, useState } from 'react';
import { createProxyLlmClient } from '@dosfilos/infrastructure';
import { buildConsultPrompt, CONSULT_SYSTEM, type ConsultInput, type ConsultTurn } from '@dosfilos/domain';

/**
 * El chat de consulta del Taller (hallazgo 32 del ejercicio de Jonás). Una
 * conversación por sesión de redacción; nada se guarda en el sermón hasta que
 * el pastor lleva una respuesta a sus ideas.
 */
export function useConsultaTaller() {
    const [turns, setTurns] = useState<ConsultTurn[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    const ask = useCallback(async (input: Omit<ConsultInput, 'history'>) => {
        const question = input.question.trim();
        if (!question) return;
        setError(false);
        setLoading(true);
        const history = turns;
        setTurns(prev => [...prev, { role: 'pastor', text: question }]);
        try {
            const out = await createProxyLlmClient('sermon.consult').generate({
                system: CONSULT_SYSTEM,
                prompt: buildConsultPrompt({ ...input, question, history }),
                temperature: 0.4,
            });
            const text = (out ?? '').trim();
            if (!text) throw new Error('respuesta vacía');
            setTurns(prev => [...prev, { role: 'asistente', text }]);
        } catch (err) {
            console.warn('[consulta] no se pudo responder', err);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [turns]);

    const reset = useCallback(() => { setTurns([]); setError(false); }, []);

    return { turns, ask, loading, error, reset };
}
