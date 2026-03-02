/**
 * Jest setup file — loaded before each test suite.
 */
import * as dotenv from 'dotenv';
dotenv.config();

// Increase default timeout for integration tests
jest.setTimeout(30_000);

// Global error handler for unhandled promise rejections in tests
process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled Rejection in test:', reason);
});
