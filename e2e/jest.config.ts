import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/tests/api/**/*.test.ts',
    '**/tests/multi-user/**/*.test.ts',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@helpers/(.*)$': '<rootDir>/helpers/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
    '^@page-objects/(.*)$': '<rootDir>/page-objects/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/helpers/jest-setup.ts'],
  testTimeout: 30000,
  verbose: true,
  reporters: [
    'default',
    ['jest-allure2-reporter', {
      resultsDir: 'reports/allure-results',
    }],
  ],
};

export default config;
