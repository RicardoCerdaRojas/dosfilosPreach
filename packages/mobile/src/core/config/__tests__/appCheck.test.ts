import { describe, expect, it, jest } from '@jest/globals';

import { appCheckReady, initAppCheck } from '../appCheck';

// jest sube los mocks por encima de los imports.

jest.mock('@react-native-firebase/app', () => ({ getApp: () => ({}) }));
jest.mock('@react-native-firebase/app-check', () => {
    const initializeAppCheck = jest.fn(async () => ({}));
    return {
        __init: initializeAppCheck,
        initializeAppCheck,
        getToken: jest.fn(async () => ({ token: 't' })),
        ReactNativeFirebaseAppCheckProvider: jest.fn().mockImplementation(() => ({ configure: () => undefined })),
    };
});

const init = (jest.requireMock('@react-native-firebase/app-check') as { __init: jest.Mock<any> }).__init;

describe('App Check (B4)', () => {
    it('se configura UNA vez aunque se pida varias; las llamadas al servidor esperan esa misma configuración', async () => {
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
        await Promise.all([initAppCheck(), initAppCheck(), appCheckReady()]);
        expect(init).toHaveBeenCalledTimes(1);
    });
});
