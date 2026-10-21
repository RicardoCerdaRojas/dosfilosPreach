import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** TP #8 (2026-10-21, #41): el panel no sabía dar US$ de exégesis. */
const grant = vi.fn(async () => true);
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }));
vi.mock('@/hooks/admin/useGrantUserCredits', () => ({ useGrantUserCredits: () => ({ grant, isLoading: false }) }));
const { GrantCreditsDialog, MAX_EXEGESIS_USD } = await import('../GrantCreditsDialog');

const user = {
    id: 'u1',
    email: 'a@b.c',
    displayName: 'Ricardo',
    processingBalance: { standardPagesAvailable: 0, premiumPagesAvailable: 0, standardSpentTotal: 0, premiumSpentTotal: 0, exegesisUsdAvailable: 0.04 },
};

function abrir() {
    render(<GrantCreditsDialog user={user as never} isOpen onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('users.grantCreditsDialog.reason'), { target: { value: 'cuota agotada' } });
}

describe('GrantCreditsDialog · US$ de exégesis', () => {
    beforeEach(() => grant.mockClear());

    it('manda sólo los US$ de exégesis, sin páginas', () => {
        abrir();
        fireEvent.change(screen.getByLabelText('users.grantCreditsDialog.exegesisUsd'), { target: { value: '20' } });
        fireEvent.click(screen.getByText('users.grantCreditsDialog.confirm'));
        expect(grant).toHaveBeenCalledWith({ userId: 'u1', standardPages: undefined, premiumPages: undefined, exegesisUsd: 20, reason: 'cuota agotada' });
    });

    it('no deja pasar un monto sobre el tope, y lo dice', () => {
        abrir();
        fireEvent.change(screen.getByLabelText('users.grantCreditsDialog.exegesisUsd'), { target: { value: '2000' } });
        expect(screen.getByText('users.grantCreditsDialog.confirm').closest('button')).toBeDisabled();
        expect(screen.getByRole('alert')).toHaveTextContent('users.grantCreditsDialog.overMax');
    });

    it('muestra el saldo de exégesis que trae el usuario', () => {
        abrir();
        expect(screen.getByText(/0,04/)).toBeInTheDocument();
    });

    it('el tope es el mismo que el del servidor', () => {
        const aqui = dirname(fileURLToPath(import.meta.url));
        const servidor = readFileSync(resolve(aqui, '../../../../../functions/src/admin/grantUserCreditsInput.ts'), 'utf8');
        const tope = Number(servidor.match(/MAX_EXEGESIS_USD_POR_OTORGAMIENTO\s*=\s*(\d+)/)?.[1]);
        expect(tope).toBe(MAX_EXEGESIS_USD);
    });
});
