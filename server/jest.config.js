module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        '**/*.js',
        '!**/node_modules/**',
        '!**/tests/**',
        '!jest.config.js',
        '!coverage/**'
    ],
    testMatch: [
        '**/tests/**/*.test.js'
    ],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    verbose: true,
    testTimeout: 30000
};
