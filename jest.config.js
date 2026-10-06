module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/**/*.test.js', '<rootDir>/tests/**/*.test.jsx'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  collectCoverageFrom: [
    'src/utils/validateOrder.js',
    'src/lib/offlineQueue.js',
    'src/contexts/CartContext.jsx',
    'src/components/pos/ModifierPicker.jsx',
    'src/utils/monitoringPrivacy.js',
    'src/lib/monitoring.js',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: { statements: 80, branches: 70, functions: 70, lines: 80 },
  },
  clearMocks: true,
}
