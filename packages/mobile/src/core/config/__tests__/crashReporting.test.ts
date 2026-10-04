import { describe, expect, it, jest } from '@jest/globals';

jest.mock('expo-updates', () => ({ channel: 'production', runtimeVersion: 'abc', updateId: null }));
jest.mock('@react-native-firebase/crashlytics', () => {
    const calls: unknown[][] = [];
    const rec = (name: string) => jest.fn(async (...args: unknown[]) => void calls.push([name, ...args.slice(1)]));
    return {
        __calls: calls,
        getCrashlytics: () => ({}),
        setCrashlyticsCollectionEnabled: rec('enabled'),
        setAttributes: rec('attributes'),
        recordError: jest.fn((_c: unknown, error: Error, name: string) => void calls.push(['recordError', error.message, name])),
    };
});

import { initCrashReporting } from '../crashReporting';
import { reportWriteFailure } from '@/core/errors/writeFailures';

const calls = (jest.requireMock('@react-native-firebase/crashlytics') as { __calls: unknown[][] }).__calls;

describe('reporte de fallos (B5)', () => {
    it('en desarrollo no recolecta', async () => {
        calls.length = 0;
        await initCrashReporting(false);
        expect(calls).toEqual([['enabled', false]]);
    });

    it('publicado: atributos del build y escrituras rechazadas, sin datos personales', async () => {
        calls.length = 0;
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        await initCrashReporting(true);
        expect(calls).toContainEqual(['attributes', { channel: 'production', runtimeVersion: 'abc', updateId: 'embedded' }]);
        const conDatos = Object.assign(new Error('Missing or insufficient permissions: Jonás 4:2 de pastor@iglesia.org'), {
            name: 'FirebaseError',
        });
        reportWriteFailure('annotation', conDatos);
        const reporte = calls.find((c) => c[0] === 'recordError')!;
        expect(reporte).toEqual(['recordError', '[write:annotation] FirebaseError', 'write-annotation']);
        expect(JSON.stringify(calls)).not.toContain('pastor@iglesia.org');
    });
});
