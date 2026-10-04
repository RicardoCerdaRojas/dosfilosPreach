/**
 * Pruebas de la app (A0 de la fase Púlpito premium). Hasta acá había cero.
 *
 * `jest-expo` resuelve React Native y los módulos de Expo; los alias son los
 * mismos de tsconfig. `@dosfilos/domain` se compila desde el código fuente,
 * igual que lo hace Metro.
 */
module.exports = {
    preset: 'jest-expo',
    setupFiles: ['<rootDir>/jest.setup.js'],
    testMatch: ['<rootDir>/**/__tests__/**/*.test.ts?(x)'],
    testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/', '/dist/'],
    moduleNameMapper: {
        '^@dosfilos/domain$': '<rootDir>/../domain/src',
        '^@dosfilos/domain/(.*)$': '<rootDir>/../domain/src/$1',
        '^@/core/(.*)$': '<rootDir>/src/core/$1',
        '^@/data/(.*)$': '<rootDir>/src/data/$1',
        '^@/domain/(.*)$': '<rootDir>/src/domain/$1',
        '^@/presentation/(.*)$': '<rootDir>/src/presentation/$1',
        '^@/(.*)$': '<rootDir>/$1',
    },
};
