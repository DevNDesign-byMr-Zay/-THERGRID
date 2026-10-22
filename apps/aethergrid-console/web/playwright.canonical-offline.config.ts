import { defineConfig } from '@playwright/test';
import offline from './playwright.local.config';
import canonical from './playwright.config';

// Keep canonical deadlines while using the maintained file:// WebGL backend.
export default defineConfig({ ...offline, timeout: canonical.timeout, expect: canonical.expect });
