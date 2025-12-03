import path from 'node:path';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'smart-load-manager': path.resolve(__dirname, '../smart-load-manager/src')
    }
  },
  test: {
    environment: 'happy-dom'
  },
});
