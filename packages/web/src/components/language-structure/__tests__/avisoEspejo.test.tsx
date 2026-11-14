import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Revisión adversarial (etapa 2): el aviso de la repetición en espejo con la interpolación REAL. Con el t
 * simulado de las otras pruebas no se veía «πίστιν.. Puede ser…» (la puntuación del texto pegada).
 */
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, string>) => (o ? `${k}|${o.a}·${o.b}|${o.b2}·${o.a2}` : k) }),
}));
const { StructureSection } = await import('../StructureSection');
const { useVerseStructure } = await import('../useVerseStructure');
const archivo = (rel: string) => readFileSync(join(__dirname, '..', '..', '..', '..', 'public', 'language-data', 'v1', rel), 'utf8');
const Seccion = () => <StructureSection lang="gr" structure={useVerseStructure('gr', 'JAS', 2, 18)} />;

describe('aviso de la repetición en espejo', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(archivo(url.replace('/language-data/v1/', '')), { status: 200, headers: { 'content-type': 'application/json' } })));
    });

    it('Stg 2:18: las cuatro palabras sin la puntuación del texto («πίστιν.» → «πίστιν»)', async () => {
        render(<Seccion />);
        await waitFor(() => expect(screen.getByTestId('mirror-notice')).toBeInTheDocument());
        expect(screen.getByTestId('mirror-notice').textContent).toBe('mirrorNotice|πίστιν·ἔργων|ἔργων·πίστιν');
    });

    it('en hebreo también (lista curada del AT): Gn 9:6 «שֹׁפֵךְ דַּם | דָּמוֹ יִשָּׁפֵךְ»', async () => {
        const Hebreo = () => <StructureSection lang="he" structure={useVerseStructure('he', 'Gen', 9, 6)} />;
        render(<Hebreo />);
        await waitFor(() => expect(screen.getByTestId('mirror-notice')).toBeInTheDocument());
        const sinAcentos = (t: string) => t.normalize('NFD').replace(/[\u0591-\u05AF\u05BD]/g, '').normalize('NFC');
        expect(sinAcentos(screen.getByTestId('mirror-notice').textContent ?? '')).toBe(sinAcentos('mirrorNotice|שֹׁפֵךְ·דַּם|דָּמוֹ·יִשָּׁפֵךְ'));
    });
});
