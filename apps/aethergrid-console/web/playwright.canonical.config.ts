import { defineConfig } from '@playwright/test';
import config from './playwright.config';

// Offline acceptance runs separately with its maintained file:// renderer settings.
export default defineConfig({ ...config, testIgnore: '**/local-file.spec.ts' });
