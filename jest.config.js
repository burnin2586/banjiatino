/** @type {import('jest').Config} */
module.exports = {
  preset: 'react-native',
  moduleNameMapper: {
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^lucide-react-native$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
};
