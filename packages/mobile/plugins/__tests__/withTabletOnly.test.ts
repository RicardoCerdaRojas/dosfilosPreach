import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { applyTabletOnly } = require('../withTabletOnly');

describe('sólo tablet (B7)', () => {
    it('Android: el manifiesto no admite pantallas chicas ni normales (teléfonos)', () => {
        const out = applyTabletOnly({ manifest: { $: {} } });
        const screens = out.manifest['supports-screens'][0].$;
        expect(screens['android:smallScreens']).toBe('false');
        expect(screens['android:normalScreens']).toBe('false');
        expect(screens['android:largeScreens']).toBe('true');
    });

    it('iOS sólo iPad y el plugin de Android registrado en app.json', () => {
        const app = JSON.parse(readFileSync(join(__dirname, '../../app.json'), 'utf8')).expo;
        expect(app.ios.isTabletOnly).toBe(true);
        expect(app.plugins).toContain('./plugins/withTabletOnly');
    });
});
