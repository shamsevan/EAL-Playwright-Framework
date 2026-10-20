/* 
 * Author: EAL IT Solutions Automation Team 
 * Description: Main Playwright Configuration File.
 */ 

import { defineConfig } from '@playwright/test'; 
import dotenv from 'dotenv'; 
import { getExecutableTestCaseGrep, getExecutableTestMatchPatterns, isDirectSpecRun } from './apps/utils/testControllerCsv'; 

// Load environment variables from the .env file
dotenv.config({ override: true }); 

/**
 * @description
 * (English): Checks if the user wants to run a specific test file directly (bypassing the CSV controller).
 * (Bangla): ইউজার যদি CSV কন্ট্রোলারের বদলে সরাসরি কোনো নির্দিষ্ট টেস্ট ফাইল (Spec) রান করতে চায়, তবে এটি তা ডিটেক্ট করে।
 */
const directSpecRun = isDirectSpecRun(); 
if (directSpecRun) { 
  process.env.RUN_SPEC_DIRECTLY = 'true'; 
} 

/**
 * @description
 * (English): Connects our custom CSV Controller logic to Playwright's native test matching system.
 * (Bangla): আমাদের বানানো CSV কন্ট্রোলারের লজিকগুলোকে Playwright-এর মেইন সিস্টেমের সাথে যুক্ত করে।
 */
const controllerCli = process.env.CONTROLLER_CLI === 'true'; 
const applyControllerFilter = controllerCli && !directSpecRun; 

const testControllerMatch = applyControllerFilter ? getExecutableTestMatchPatterns() : undefined; 
const testControllerGrep = applyControllerFilter ? getExecutableTestCaseGrep() : undefined; 

/**
 * @description
 * (English): Broken-file isolation. If one test file has a syntax error, it ignores that file and runs the rest.
 * (Bangla): ব্রোকেন-ফাইল আইসোলেশন। কোনো ফাইলে ভুল কোড থাকলে পুরো টেস্ট বন্ধ না করে, এটি শুধু ওই ফাইলটি ইগনোর করে বাকিগুলো রান করে।
 */
const ignoreSpecsRaw = (process.env.TEST_CONTROLLER_IGNORE_SPECS ?? '').trim(); 
const testControllerIgnore = ignoreSpecsRaw 
  ? ignoreSpecsRaw.split(',').map(name => name.trim()).filter(Boolean).map(name => `**/${name}.spec.ts`) 
  : undefined; 

function isEnvEnabled(value: string | undefined): boolean { 
  return ['true', '1', 'yes', 'y', 'on'].includes((value ?? '').trim().toLowerCase()); 
} 

function parseWorkerCount(value: string | undefined): number | undefined { 
  const parsed = Number.parseInt((value ?? '').trim(), 10); 
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined; 
} 

const parallelEnabled = isEnvEnabled(process.env.TEST_PARALLEL); 
const parallelWorkers = parallelEnabled ? parseWorkerCount(process.env.TEST_PARALLEL_WORKERS) : 1; 

export default defineConfig({ 
  testDir: './apps/test', // Where all our test scripts live
  testMatch: testControllerMatch, 
  testIgnore: testControllerIgnore, 
  grep: testControllerGrep, 
  outputDir: './apps/test-results', 
  timeout: 60_000, // Max 60 seconds per test
  
  // Graceful whole-run budget (minutes).
  globalTimeout: Number(process.env.GLOBAL_TIMEOUT_MINUTES ?? 0) * 60_000, 
  fullyParallel: parallelEnabled, 
  forbidOnly: !!process.env.CI, 
  retries: process.env.CI ? 1 : 0, 
  workers: parallelWorkers, 
  
  reporter: [ 
    ['html', { outputFolder: './apps/playwright-report', open: 'never' }], 
    ['json', { outputFile: 'test-results.json' }], 
    ['list'], 
  ], 
  
  use: { 
    headless: false, // Set to true if you don't want to see the browser UI
    viewport: { width: 1920, height: 1080 }, // Full HD resolution
    actionTimeout: 30000, // Wait max 30 seconds for an element to appear
    navigationTimeout: 30000, 
    trace: 'on-first-retry', 
    screenshot: 'only-on-failure', // Take pictures only when a test fails
    ignoreHTTPSErrors: true, 
  }, 
  
  projects: [ 
    { 
      name: 'chromium', 
      use: { 
        browserName: 'chromium', 
        /* 
         * Offline / CI Pipeline support for EAL IT Solutions.
         * Launches system-installed Chrome if needed for secure proxy networks.
         */ 
        ...(process.env.PW_CHROME_EXECUTABLE 
          ? { launchOptions: { executablePath: process.env.PW_CHROME_EXECUTABLE } } 
          : process.env.PW_USE_BUNDLED_CHROMIUM === 'true' 
            ? {} 
            : { channel: 'chrome' }), 
      }, 
    }, 
  ], 
});