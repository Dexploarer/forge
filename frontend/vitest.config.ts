import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],

  test: {
    // Test environment
    globals: true,
    environment: 'jsdom',

    // Setup files
    setupFiles: ['./src/test/setup.ts'],

    // File patterns
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.git', 'build'],

    // Timeouts
    testTimeout: 10000, // 10 seconds for component tests
    hookTimeout: 5000, // 5 seconds for setup/teardown

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.d.ts',
      ],
      all: true,
      lines: 70,
      functions: 70,
      branches: 70,
      statements: 70,
    },

    // Reporters
    reporters: ['verbose'],

    // Parallel execution
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },

    // Retry failed tests
    retry: 0,

    // Isolation
    isolate: true,

    // Sequence
    sequence: {
      shuffle: false,
      concurrent: false,
    },

    // Watch mode
    watch: false,

    // CSS handling
    css: true,

    // Mock browser APIs
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
  },

  // Path resolution to match tsconfig
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/pages': path.resolve(__dirname, './src/pages'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/config': path.resolve(__dirname, './src/config'),
      '@/styles': path.resolve(__dirname, './src/styles'),
    },
  },
})
