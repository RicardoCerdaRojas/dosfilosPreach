// AsyncStorage en memoria: el módulo trae su propio mock para pruebas.
jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
