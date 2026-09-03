module.exports = {
  rootDir: '..',
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-url-polyfill|@react-native-async-storage)/)',
  ],
};
