import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    resolve: {
        alias: {
            '@dosfilos/domain': fileURLToPath(new URL('../domain/src', import.meta.url)),
            '@/': fileURLToPath(new URL('../web/src/', import.meta.url)),
        },
    },
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
    },
});
