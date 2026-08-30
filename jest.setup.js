/* eslint-env jest */
require('react-native-gesture-handler/jestSetup');

jest.mock('@react-native-async-storage/async-storage', () => {
  let store = {};
  return {
    __esModule: true,
    default: {
      setItem: jest.fn((k, v) => {
        store[k] = v;
        return Promise.resolve();
      }),
      getItem: jest.fn(k => Promise.resolve(store[k] ?? null)),
      removeItem: jest.fn(k => {
        delete store[k];
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        store = {};
        return Promise.resolve();
      }),
    },
  };
});
