/**
 * (English - Playwright test API): Imports `test` to declare and run the login test with
 * Playwright's browser-page fixture and test metadata.
 * (Bangla - Playwright test API): Playwright-এর `test` import করে login test declare ও চালানো হয়;
 * এর browser-page fixture এবং test metadata-ও এই test-এ পাওয়া যায়।
 */
import { test } from '@playwright/test';

/**
 * (English - test-controller helper): Imports `getTestCasesByGroup` to select the enabled
 * ParaBank login cases from the configured controller CSV.
 * (Bangla - test-controller helper): configured controller CSV থেকে চালু ParaBank login case
 * বেছে নিতে `getTestCasesByGroup` import করা হয়েছে।
 */
import { getTestCasesByGroup } from '../utils/testControllerCsv';

/**
 * (English - smoke-test data helper): Imports `smokeTestData` to read the login credentials
 * and expected success heading from the shared smoke-test data source.
 * (Bangla - smoke-test data helper): shared smoke-test data source থেকে login credential ও
 * প্রত্যাশিত success heading পড়তে `smokeTestData` import করা হয়েছে।
 */
import { smokeTestData } from '../utils/testData';

/**
 * (English - login page object): Imports `ParaBankLoginPage` for opening the login page,
 * filling in credentials, and submitting the login form.
 * (Bangla - login page object): login page খোলা, credential পূরণ এবং login form submit করার
 * জন্য `ParaBankLoginPage` import করা হয়েছে।
 */
import { ParaBankLoginPage } from '../pages/ParaBankLogin.page';

/**
 * (English - overview page object): Imports `ParaBankOverviewPage` to verify the account
 * overview after login, keeping post-login page behavior separate from login-form behavior.
 * (Bangla - overview page object): login-এর পর account overview যাচাই করতে `ParaBankOverviewPage`
 * import করা হয়েছে; এতে login form ও post-login page-এর কাজ আলাদা থাকে।
 */
import { ParaBankOverviewPage } from '../pages/ParaBankOverview.page';

/**
 * (English - test logger factory): Imports `createLogger` to create a logger for each
 * controller-driven test case.
 * (Bangla - test logger factory): controller থেকে তৈরি প্রতিটি test case-এর জন্য logger
 * বানাতে `createLogger` import করা হয়েছে।
 */
import { createLogger } from '../utils/TestLogger';

/**
 * (English - common test utilities): Imports `stepLogger` to label the major login-flow steps
 * in the terminal, and `flushFailureScreenShots` to attach captured screenshots after each test.
 * (Bangla - common test utilities): terminal-এ login flow-এর প্রধান ধাপ label করতে `stepLogger`
 * এবং প্রতিটি test শেষে তোলা screenshot report-এ যোগ করতে `flushFailureScreenShots` import করা হয়েছে।
 */
import { flushFailureScreenShots, stepLogger } from '../utils/CommonFunctions';

/**
 * (English - testCases): Gets the controller rows enabled for the `paraBankLogin` spec group.
 * The loop below creates one Playwright test for each returned row.
 * (Bangla - testCases): `paraBankLogin` spec group-এর জন্য controller-এ চালু থাকা row-গুলো আনে।
 * নিচের loop-এ পাওয়া প্রতিটি row-এর জন্য একটি করে Playwright test তৈরি হয়।
 */
const testCases = getTestCasesByGroup('paraBankLogin');

/**
 * (English - shared login test data): Loads the username and password used by the login form,
 * plus the expected heading used to verify the account overview.
 * (Bangla - shared login test data): login form-এ ব্যবহারের username ও password এবং account
 * overview যাচাইয়ের প্রত্যাশিত heading load করে।
 */
const username = smokeTestData('PB_Login_username');
const password = smokeTestData('PB_Login_password');
const expectedSuccessMsg = smokeTestData('PB_Login_expectedSuccessMessage');

/**
 * (English - controller-driven test registration): Registers one test for every enabled
 * controller row, using its test case ID and description as the test title.
 * (Bangla - controller-driven test registration): controller-এর প্রতিটি চালু row-এর জন্য একটি
 * test register করে এবং test title-এ row-এর test case ID ও description ব্যবহার করে।
 */
for (const data of testCases) {

    /**
     * (English - login test): Runs one complete login scenario using the Playwright page fixture
     * and this test's metadata for logging, screenshots, and report attachments.
     * (Bangla - login test): Playwright page fixture ব্যবহার করে একটি সম্পূর্ণ login scenario চালায়;
     * এই test-এর metadata logging, screenshot ও report attachment-এর কাজে লাগে।
     */
    test(`${data.testCaseID} - ${data.testDescription}`, async ({ page }, testInfo) => {
        
        /**
         * (English - per-test setup): Creates a logger identified by the test case ID, prints
         * the test-start banner and case details, then creates page objects for login and overview.
         * (Bangla - per-test setup): test case ID দিয়ে logger তৈরি করে, test শুরুর banner ও case-এর
         * তথ্য দেখায়, এরপর login ও overview-এর page object তৈরি করে।
         */
        const logger = createLogger(data.testCaseID);
        logger.testStarted();
        console.log(`  [DATA] Test: ${data.testCaseID} | ${data.testDescription}`);
        
        const loginPage = new ParaBankLoginPage(page, logger);
        const overviewPage = new ParaBankOverviewPage(page, logger);

        /**
         * (English - navigation step): Logs and runs the first named Playwright step, opening the
         * portal URL supplied by the USER_PORTAL_URL environment variable.
         * (Bangla - navigation step): প্রথম নামযুক্ত Playwright step log করে চালায় এবং
         * USER_PORTAL_URL environment variable-এ দেওয়া portal URL খোলে।
         */
        stepLogger('\n[STEP 1] Navigate to ParaBank Portal');
        await test.step('Step 1: Open Login Page', async () => {
            await loginPage.navigateToLogin(process.env.USER_PORTAL_URL!, testInfo);
        });

        /**
         * (English - credential submission step): Logs and runs the step that fills the centrally
         * loaded username and password, captures the pre-submit screenshot, and submits the form.
         * (Bangla - credential submission step): centralized source থেকে load করা username ও
         * password পূরণ, submit-এর আগের screenshot capture এবং form submit করার ধাপটি log করে চালায়।
         */
        stepLogger('\n[STEP 2] Enter Credentials & Submit');
        await test.step('Step 2: Fill Form and Click Login', async () => {
            await loginPage.performLogin(username, password, testInfo);
        });

        /**
         * (English - account overview verification step): Logs and runs the post-login check
         * through the overview page object, comparing the heading with the expected test data.
         * (Bangla - account overview verification step): overview page object দিয়ে login-এর পরের
         * যাচাইটি log করে চালায় এবং heading-কে প্রত্যাশিত test data-এর সঙ্গে মেলায়।
         */
        stepLogger('\n[STEP 3] Verify Successful Login');
        await test.step('Step 3: Verify Accounts Overview Page', async () => {
            await overviewPage.verifySuccessfulLogin(expectedSuccessMsg, testInfo);
        });

        /**
         * (English - completion log): Prints the test-passed banner after all login and
         * account-overview steps complete.
         * (Bangla - completion log): login ও account overview-এর সব ধাপ শেষ হলে test-passed
         * banner দেখায়।
         */
        logger.testPassed();
    });
}

/**
 * (English - screenshot attachment hook): Flushes screenshots buffered by the page objects after
 * each test. A passing login test attaches its latest screenshot (the post-login result); failed
 * tests attach every captured screenshot for debugging.
 * (Bangla - screenshot attachment hook): প্রতিটি test শেষে page object-এ buffer হওয়া screenshot report-এ
 * যোগ করে। login test pass করলে সর্বশেষ post-login screenshot যোগ হয়; fail করলে debugging-এর জন্য
 * capture করা সব screenshot যোগ হয়।
 */
test.afterEach(async ({}, testInfo) => {
    await flushFailureScreenShots(testInfo, { attachLatestOnPass: true });
});
