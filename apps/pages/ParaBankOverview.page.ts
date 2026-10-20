/**
 * (English - Playwright types): Imports `Page` for the active browser tab, `Locator` for the
 * overview heading selector, and `expect` for asserting the expected heading text.
 * (Bangla - Playwright types): সক্রিয় browser tab-এর জন্য `Page`, overview heading selector-এর জন্য
 * `Locator` এবং প্রত্যাশিত heading text যাচাই করতে `expect` import করা হয়েছে।
 */
import { Page, Locator, expect } from '@playwright/test';

/**
 * (English - TestLogger): Imports the project logger to record the post-login verification step.
 * (Bangla - TestLogger): login-এর পর verification step log করতে project-এর logger import করা হয়েছে।
 */
import { TestLogger } from '../utils/TestLogger';

/**
 * (English - common utilities): Imports `takeScreenShot` to capture the overview after verification
 * and `verifySoft` to report assertion failures without immediately stopping the test.
 * (Bangla - common utilities): verification-এর পর overview-এর screenshot নিতে `takeScreenShot` এবং
 * assertion ব্যর্থ হলেও সঙ্গে সঙ্গে test না থামিয়ে ফল report করতে `verifySoft` import করা হয়েছে।
 */
import { takeScreenShot, verifySoft } from '../utils/CommonFunctions';

/**
 * (English - ParaBankOverviewPage): Page object for the account overview shown after login.
 * It provides the overview heading locator and a method to verify a successful login.
 *
 * (Bangla - ParaBankOverviewPage): login-এর পর দেখা account overview page-এর page object।
 * overview heading-এর locator এবং login সফল হয়েছে কি না যাচাই করার method এখানে রাখা হয়েছে।
 */
export class ParaBankOverviewPage {

    /**
     * (English - accountsOverviewHeading): Locates the heading inside the account overview section;
     * its text is compared with the expected post-login message.
     * (Bangla - accountsOverviewHeading): account overview section-এর heading খুঁজে পায়;
     * login-এর পর এর text প্রত্যাশিত message-এর সঙ্গে তুলনা করা হয়।
     */
    readonly accountsOverviewHeading: Locator;

    /**
     * (English - constructor): Receives the active Playwright page and test logger, then creates
     * the locator for the account overview heading on that page.
     * (Bangla - constructor): সক্রিয় Playwright page ও test logger গ্রহণ করে, তারপর সেই page-এ
     * account overview heading-এর locator তৈরি করে।
     */
    constructor(private page: Page, private logger: TestLogger) {
        this.accountsOverviewHeading = this.page.locator('#showOverview h1.title');
    }

    /**
     * (English - verifySuccessfulLogin): Logs the verification, softly checks that the overview
     * heading exactly matches `expectedMessage`, and captures a screenshot of the resulting page.
     *
     * (Bangla - verifySuccessfulLogin): verification log করে, overview heading `expectedMessage`-এর
     * সঙ্গে হুবহু মেলে কি না soft assertion দিয়ে যাচাই করে এবং ফলাফলের page-এর screenshot নেয়।
     *
     * @param expectedMessage - The exact account overview heading expected after login.
     * @param testInfo - Playwright test metadata used when attaching the screenshot.
     */
    async verifySuccessfulLogin(expectedMessage: string, testInfo: any) {
        this.logger.verify(`Checking if heading contains: ${expectedMessage}`);
        
        await verifySoft(
            expect.soft(this.accountsOverviewHeading).toHaveText(expectedMessage),
            `User should see '${expectedMessage}' after login`
        );
        
        await takeScreenShot(this.page, testInfo, 'After-Login-Success');
    }
}