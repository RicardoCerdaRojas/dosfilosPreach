import { describe, expect, it } from 'vitest';
import { buildVocabularyBlock } from '@dosfilos/domain';
import { commonGuardrails } from '../sharedPromptBlocks';

/**
 * Etapa 4.2 (B67): el sermón, el devocional y la guía de estudio no leen la
 * guía de estilo; la regla general de vocabulario les llega por las
 * salvaguardas comunes, en su variante pastoral.
 */
describe('las salvaguardas de los compositores pastorales', () => {
    it('llevan el vocabulario pastoral en los dos idiomas', () => {
        expect(commonGuardrails('es')).toContain(buildVocabularyBlock('es', 'pastoral'));
        expect(commonGuardrails('en')).toContain(buildVocabularyBlock('en', 'pastoral'));
    });
    it('no el académico: en el púlpito no va jerga, ni siquiera glosada', () => {
        expect(commonGuardrails('es')).not.toContain('Una sola nomenclatura');
    });
});
