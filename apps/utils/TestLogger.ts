/* 
 * Author: EAL IT Solutions Automation Team 
 * Description: Structured test execution logger for clear visibility and reporting.
 */ 

import { type Page, type TestInfo } from '@playwright/test'; 

/**
 * @description
 * (English - TestLogger): Provides consistently formatted terminal logs for a test, including its name,
 * numbered steps, actions, data, verifications, results, errors, and failure diagnostics.
 *
 * (Bangla - TestLogger): একটি test-এর জন্য একই format-এ terminal log তৈরি করে—যেমন test name,
 * নম্বরসহ ধাপ, action, data, verification, result, error এবং failure-এর diagnostic তথ্য।
 */ 
export class TestLogger { 
  /**
   * (English - stepCount): Tracks how many numbered steps have been logged by this logger.
   * (Bangla - stepCount): এই logger দিয়ে কতটি নম্বরযুক্ত ধাপ log হয়েছে, তার হিসাব রাখে।
   */
  private stepCount = 0; 

  /**
   * (English - testName): Stores the test name displayed in the start banner.
   * (Bangla - testName): test শুরুর banner-এ দেখানোর জন্য test-এর নাম সংরক্ষণ করে।
   */
  private readonly testName: string; 

  /**
   * (English - separator): Provides the repeated-character line used to frame test status banners.
   * (Bangla - separator): test status banner-এর ওপরে ও নিচে দেখানোর repeated-character line তৈরি করে।
   */
  private readonly separator = '='.repeat(60); 

  /**
   * (English - constructor): Creates a logger for the supplied test name; step numbering starts at zero.
   * (Bangla - constructor): দেওয়া test name-এর জন্য logger তৈরি করে; শুরুতে step count শূন্য থাকে।
   */
  constructor(testName: string) { 
    this.testName = testName; 
  } 

  /** 
   * @description 
   * (English - testStarted): Prints a framed start banner containing this logger's test name.
   * (Bangla - testStarted): এই logger-এর test name-সহ আলাদা করে ঘেরা start banner টার্মিনালে দেখায়।
   */ 
  testStarted(): void { 
    console.log(''); 
    console.log(this.separator); 
    console.log(`TEST STARTED: ${this.testName}`); 
    console.log(this.separator); 
    console.log(''); 
  } 

  /**
   * (English - testPassed): Prints a green pass status banner after the test succeeds.
   * (Bangla - testPassed): test সফল হলে সবুজ রঙে pass status banner দেখায়।
   */
  testPassed(): void { 
    console.log(''); 
    console.log(this.separator); 
    console.log('\x1b[32mTEST PASSED\x1b[0m'); // Green text for pass
    console.log(this.separator); 
    console.log(''); 
  } 

  /**
   * (English - testFailed): Prints a red failure status banner and, when provided, the error message.
   * (Bangla - testFailed): লাল রঙে failure status banner দেখায় এবং error message দেওয়া থাকলে সেটিও প্রিন্ট করে।
   */
  testFailed(errorMessage?: string): void { 
    console.log(''); 
    console.log(this.separator); 
    console.log('\x1b[31mTEST FAILED\x1b[0m'); // Red text for fail
    if (errorMessage) { 
      console.log(`[ERROR] ${errorMessage}`); 
    } 
    console.log(this.separator); 
    console.log(''); 
  } 

  /** 
   * @description 
   * (English - step): Increments the step counter and prints the description with its step number.
   * (Bangla - step): step counter এক বাড়িয়ে description-সহ নম্বরযুক্ত ধাপটি প্রিন্ট করে।
   * 
   * @param description - What is this step about? (e.g., 'Login to the portal')
   */ 
  step(description: string): void { 
    this.stepCount++; 
    console.log(''); 
    console.log(`\x1b[33m\x1b[1m[STEP ${this.stepCount}] ${description}\x1b[0m`); // Yellow Bold
  } 

  /**
   * @description
   * (English - action): Prints a blue ACTION log for an operation performed during the test.
   * (Bangla - action): test চলাকালে করা কোনো operation-এর জন্য নীল রঙে ACTION log প্রিন্ট করে।
   */
  action(description: string): void { 
    console.log(`  \x1b[34m[ACTION]\x1b[0m ${description}`); // Blue
  } 

  /**
   * @description
   * (English - data): Prints a labeled DATA log; objects are JSON-serialized and nullish values display as empty text.
   * (Bangla - data): label-সহ DATA log প্রিন্ট করে; object-কে JSON string বানায় এবং null বা undefined-কে খালি text দেখায়।
   */
  data(label: string, value: unknown): void { 
    const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value ?? ''); 
    console.log(`  \x1b[36m[DATA]\x1b[0m ${label}: ${displayValue}`); // Cyan
  } 

  /**
   * @description
   * (English - verify): Prints a magenta VERIFY log describing a check performed by the test.
   * (Bangla - verify): test-এর কোনো যাচাইয়ের বর্ণনা magenta রঙে VERIFY log হিসেবে প্রিন্ট করে।
   */
  verify(description: string): void { 
    console.log(`  \x1b[35m[VERIFY]\x1b[0m ${description}`); // Magenta
  } 

  /**
   * (English - result): Prints a RESULT log for a test outcome or other noteworthy result.
   * (Bangla - result): test-এর outcome বা উল্লেখযোগ্য কোনো ফলাফল RESULT log হিসেবে প্রিন্ট করে।
   */
  result(description: string): void { 
    console.log(`  [RESULT] ${description}`); 
  } 

  /**
   * (English - error): Prints an error message and any supplied locator, actual value, and expected value.
   * (Bangla - error): error message প্রিন্ট করে; দেওয়া থাকলে locator, actual value ও expected value-ও দেখায়।
   */
  error(message: string, details?: { locator?: string; actual?: unknown; expected?: unknown }): void { 
    console.log(`  \x1b[31m[ERROR]\x1b[0m ${message}`); // Red
    if (details?.locator) { 
      console.log(`  \x1b[31m[ERROR]\x1b[0m   Locator: ${details.locator}`); 
    } 
    if (details?.actual !== undefined) { 
      console.log(`  \x1b[31m[ERROR]\x1b[0m   Actual: ${JSON.stringify(details.actual)}`); 
    } 
    if (details?.expected !== undefined) { 
      console.log(`  \x1b[31m[ERROR]\x1b[0m   Expected: ${JSON.stringify(details.expected)}`); 
    } 
  } 

  /**
   * (English - currentStep): Returns the number of steps logged so far for this test.
   * (Bangla - currentStep): এই test-এর জন্য এখন পর্যন্ত log করা step-এর সংখ্যা ফেরত দেয়।
   */
  get currentStep(): number { 
    return this.stepCount; 
  } 

  /**
   * (English - reset): Resets this logger's step counter to zero.
   * (Bangla - reset): এই logger-এর step counter আবার শূন্য করে।
   */
  reset(): void { 
    this.stepCount = 0; 
  } 

  /** 
   * @description 
   * (English - captureFailure): Logs the supplied failure, attempts to attach a full-page screenshot to the
   * test report, and logs the page URL when available. Screenshot failure is logged without hiding the original error.
   * 
   * (Bangla - captureFailure): দেওয়া failure log করে, পেজের full-page screenshot test report-এ যোগ করার চেষ্টা করে
   * এবং পাওয়া গেলে page URL দেখায়। screenshot তোলা ব্যর্থ হলেও মূল error আড়াল না করে failure log করে।
   */ 
  async captureFailure(page: Page, testInfo: TestInfo, error: unknown): Promise<void> { 
    const errorMessage = error instanceof Error ? error.message : String(error); 
    this.error(errorMessage); 

    try { 
      const screenshot = await page.screenshot({ fullPage: true }); 
      await testInfo.attach('failure-screenshot', { body: screenshot, contentType: 'image/png' }); 
      console.log(`  \x1b[31m[ERROR]\x1b[0m Screenshot captured: failure-screenshot`); 
    } catch { 
      console.log(`  \x1b[31m[ERROR]\x1b[0m Failed to capture screenshot`); 
    } 

    try { 
      const url = page.url(); 
      console.log(`  \x1b[31m[ERROR]\x1b[0m Page URL at failure: ${url}`); 
    } catch { 
      // page may already be closed 
    } 
  } 
} 

/** 
 * @description 
 * (English - createLogger): Creates and returns a TestLogger for the supplied test name.
 * Use this helper in a spec file when setting up logging for a test.
 * (Bangla - createLogger): দেওয়া test name-এর জন্য একটি TestLogger তৈরি করে ফেরত দেয়।
 * কোনো spec file-এ test logging শুরু করতে এই helper ব্যবহার করুন।
 */ 
export function createLogger(testName: string): TestLogger { 
  return new TestLogger(testName); 
}