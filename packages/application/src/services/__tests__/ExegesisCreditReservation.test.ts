import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist-safe mock: vi.mock is hoisted to the top of the file by
// Vitest, so the factory cannot reference outer variables. We use
// vi.hoisted to declare the mock fns inside the hoisted block so
// they exist at mock evaluation time AND at test time.
const { consumeExegesisMock, refundExegesisMock } = vi.hoisted(() => ({
    consumeExegesisMock: vi.fn(),
    refundExegesisMock: vi.fn(),
}));

vi.mock('../ProcessingBalanceService', async () => {
    const actual = await vi.importActual<typeof import('../ProcessingBalanceService')>(
        '../ProcessingBalanceService',
    );
    return {
        ...actual,
        processingBalanceService: {
            consumeExegesis: consumeExegesisMock,
            refundExegesis: refundExegesisMock,
        },
    };
});

import { ExegesisCreditReservation } from '../ExegesisCreditReservation';
import { InsufficientExegesisCreditsError } from '../ProcessingBalanceService';
import { setExegesisPricingTracker, type ExegesisPricingEvent } from '../exegesisPricingTracker';

describe('ExegesisCreditReservation', () => {
    let trackerCalls: Array<{ event: ExegesisPricingEvent; metadata: Record<string, unknown> }>;
    // ts: ExegesisPricingEventMetadata isn't a Record<string, unknown>;
    // wrap to a plain object for the test snapshot.
    beforeEach(() => {
        consumeExegesisMock.mockReset();
        refundExegesisMock.mockReset();
        trackerCalls = [];
        setExegesisPricingTracker((event, metadata) => {
            trackerCalls.push({ event, metadata: { ...metadata } });
        });
    });

    it('opens by consuming the catalog cost for the operation', async () => {
        consumeExegesisMock.mockResolvedValue(undefined);
        const reservation = await ExegesisCreditReservation.open(
            'user-1',
            'analyzeVerseCanonically',
        );
        // analyzeVerseCanonically catalog cost = $0.10. El servidor cobra por
        // la OPERACIÓN (su catálogo); el id hace idempotente un reintento.
        expect(consumeExegesisMock).toHaveBeenCalledWith('user-1', 0.10, {
            operation: 'analyzeVerseCanonically',
            reservaId: reservation.reservaId,
        });
        expect(reservation.costUsd).toBe(0.10);
        expect(reservation.reservaId).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    });

    it('una clave de costo cero (fuera del catálogo) no reserva ni reembolsa', async () => {
        consumeExegesisMock.mockResolvedValue(undefined);
        const reservation = await ExegesisCreditReservation.open('user-1', 'totallyMadeUpOperation' as any);
        expect(reservation.costUsd).toBe(0);
        expect(consumeExegesisMock).not.toHaveBeenCalled();
        await reservation.refundIfPreLlm();
        expect(refundExegesisMock).not.toHaveBeenCalled();
    });

    it('cada reserva tiene su id (operaciones en paralelo no se confunden)', async () => {
        consumeExegesisMock.mockResolvedValue(undefined);
        const a = await ExegesisCreditReservation.open('user-1', 'analyzeVerseCanonically');
        const b = await ExegesisCreditReservation.open('user-1', 'analyzeVerseCanonically');
        expect(a.reservaId).not.toBe(b.reservaId);
    });

    it('propagates InsufficientExegesisCreditsError from consume', async () => {
        consumeExegesisMock.mockRejectedValue(
            new InsufficientExegesisCreditsError(0.10, 0.05),
        );
        await expect(
            ExegesisCreditReservation.open('user-1', 'analyzeVerseCanonically'),
        ).rejects.toBeInstanceOf(InsufficientExegesisCreditsError);
    });

    it('refunds when refundIfPreLlm runs without markLlmContacted', async () => {
        consumeExegesisMock.mockResolvedValue(undefined);
        refundExegesisMock.mockResolvedValue(undefined);
        const reservation = await ExegesisCreditReservation.open(
            'user-1',
            'composeAcademicPaper',
        );
        await reservation.refundIfPreLlm();
        // composeAcademicPaper cost = $0.20; el servidor devuelve por id.
        expect(refundExegesisMock).toHaveBeenCalledWith('user-1', 0.20, { reservaId: reservation.reservaId });
    });

    it('does NOT refund when markLlmContacted was called', async () => {
        consumeExegesisMock.mockResolvedValue(undefined);
        refundExegesisMock.mockResolvedValue(undefined);
        const reservation = await ExegesisCreditReservation.open(
            'user-1',
            'composeAcademicPaper',
        );
        reservation.markLlmContacted();
        await reservation.refundIfPreLlm();
        expect(refundExegesisMock).not.toHaveBeenCalled();
    });

    it('refundIfPreLlm is idempotent (safe to call twice from nested catches)', async () => {
        consumeExegesisMock.mockResolvedValue(undefined);
        refundExegesisMock.mockResolvedValue(undefined);
        const reservation = await ExegesisCreditReservation.open(
            'user-1',
            'composeAcademicPaper',
        );
        await reservation.refundIfPreLlm();
        await reservation.refundIfPreLlm();
        expect(refundExegesisMock).toHaveBeenCalledTimes(1);
    });

    it('swallows refund errors instead of propagating (preserves the original throw)', async () => {
        consumeExegesisMock.mockResolvedValue(undefined);
        refundExegesisMock.mockRejectedValue(new Error('firestore unavailable'));
        const reservation = await ExegesisCreditReservation.open(
            'user-1',
            'composeAcademicPaper',
        );
        // Should NOT throw — refund failures only get logged.
        await expect(reservation.refundIfPreLlm()).resolves.toBeUndefined();
    });

    it('skips refund call when cost was 0 (no reservation to refund)', async () => {
        const reservation = await ExegesisCreditReservation.open(
            'user-1',
            'unknownOperation' as any,
        );
        await reservation.refundIfPreLlm();
        expect(refundExegesisMock).not.toHaveBeenCalled();
    });

    it('fires reserve_attempted + reserve_succeeded on a happy-path open', async () => {
        consumeExegesisMock.mockResolvedValue(undefined);
        await ExegesisCreditReservation.open('user-1', 'analyzeVerseCanonically');
        const events = trackerCalls.map(c => c.event);
        expect(events).toEqual([
            'exegesis.quota.reserve_attempted',
            'exegesis.quota.reserve_succeeded',
        ]);
    });

    it('fires exceeded when consume throws InsufficientExegesisCreditsError', async () => {
        consumeExegesisMock.mockRejectedValue(
            new InsufficientExegesisCreditsError(0.10, 0.05),
        );
        await expect(
            ExegesisCreditReservation.open('user-1', 'analyzeVerseCanonically'),
        ).rejects.toBeInstanceOf(InsufficientExegesisCreditsError);
        const events = trackerCalls.map(c => c.event);
        expect(events).toEqual([
            'exegesis.quota.reserve_attempted',
            'exegesis.quota.exceeded',
        ]);
        expect(trackerCalls[1].metadata).toMatchObject({
            ownerId: 'user-1',
            requiredUsd: 0.10,
            availableUsd: 0.05,
        });
    });

    it('fires refunded only on successful pre-LLM refund', async () => {
        consumeExegesisMock.mockResolvedValue(undefined);
        refundExegesisMock.mockResolvedValue(undefined);
        const reservation = await ExegesisCreditReservation.open(
            'user-1',
            'composeAcademicPaper',
        );
        await reservation.refundIfPreLlm();
        const events = trackerCalls.map(c => c.event);
        expect(events).toContain('exegesis.quota.refunded');
    });

    it('does NOT fire refunded when refund itself fails', async () => {
        consumeExegesisMock.mockResolvedValue(undefined);
        refundExegesisMock.mockRejectedValue(new Error('firestore down'));
        const reservation = await ExegesisCreditReservation.open(
            'user-1',
            'composeAcademicPaper',
        );
        await reservation.refundIfPreLlm();
        const events = trackerCalls.map(c => c.event);
        expect(events).not.toContain('exegesis.quota.refunded');
    });
});
