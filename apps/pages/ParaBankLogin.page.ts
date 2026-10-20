/**
 * (English - Playwright types): Imports `Page` for the browser tab and `Locator` for typed
 * element selectors used by this page object.
 * (Bangla - Playwright types): browser tab-এর জন্য `Page` এবং এই page object-এর element selector
 * type করার জন্য `Locator` import করা হয়েছে।
 */
import { Page, Locator } from '@playwright/test';

/**
 * (English - TestLogger): Imports the project logger so login actions can be reported through
 * the shared test-logging interface.
 * (Bangla - TestLogger): login action-গুলো shared test-logging interface দিয়ে report করতে
 * project-এর logger import করা হয়েছে।
 */
import { TestLogger } from '../utils/TestLogger';

/**
 * (English - common utilities): Imports `takeScreenShot` to capture the pre-submit page and
 * `logAction` to log and execute navigation/login actions.
 * (Bangla - common utilities): submit-এর আগের page capture করতে `takeScreenShot` এবং navigation/login
 * action log করে চালাতে `logAction` import করা হয়েছে।
 */
import { takeScreenShot, logAction } from '../utils/CommonFunctions';

/**
 * (English - ParaBankLoginPage): Page object responsible for the ParaBank login form.
 * It owns the login-field locators and methods for opening the login URL and submitting credentials.
 *
 * (Bangla - ParaBankLoginPage): ParaBank login form-এর দায়িত্বে থাকা page object।
 * login field-এর locator এবং login URL খোলা ও credential submit করার method এখানে রাখা হয়েছে।
 */
export class ParaBankLoginPage {

    /**
     * (English - login form locators):
     * - usernameInput: Locates the username input used to enter the account username.
     * - passwordInput: Locates the password input used to enter the account password.
     * - loginButton: Locates the Log In submit control that sends the form.
     *
     * (Bangla - login form locator):
     * - usernameInput: account username লেখার input খুঁজে পায়।
     * - passwordInput: account password লেখার input খুঁজে পায়।
     * - loginButton: form submit করার Log In control খুঁজে পায়।
     */
    readonly usernameInput: Locator;
    readonly passwordInput: Locator;
    readonly loginButton: Locator;

    /**
     * (English - constructor): Receives the active Playwright page and test logger, then builds
     * locators for the username, password, and Log In controls on that page.
     * (Bangla - constructor): সক্রিয় Playwright page ও test logger গ্রহণ করে, তারপর সেই page-এর
     * username, password এবং Log In control-এর locator তৈরি করে।
     */
    constructor(private page: Page, private logger: TestLogger) {
        this.usernameInput = this.page.locator('input[name="username"]');
        this.passwordInput = this.page.locator('input[name="password"]');
        this.loginButton = this.page.locator('input[type="submit"][value="Log In"]');
    }

    /**
     * (English - navigateToLogin): Uses `logAction` to report the navigation, opens the supplied
     * URL, and waits until the DOM content is loaded.
     *
     * (Bangla - navigateToLogin): navigation report করতে `logAction` ব্যবহার করে, দেওয়া URL খোলে
     * এবং DOM content load হওয়া পর্যন্ত অপেক্ষা করে।
     *
     * @param url - The ParaBank login URL to open.
     * @param testInfo - Playwright test metadata passed to the action logger.
     */
    async navigateToLogin(url: string, testInfo: any) {
        await logAction(testInfo, 'navigateToLogin', `Opening URL: ${url}`, async () => {
            await this.page.goto(url);
            await this.page.waitForLoadState('domcontentloaded');
        });
    }

    /**
     * (English - performLogin): Runs the credential-entry action through `logAction`, fills the
     * username and password, captures a screenshot before submission, clicks Log In, and waits
     * for DOM content to load.
     *
     * (Bangla - performLogin): `logAction` দিয়ে credential-entry action চালায়, username ও password
     * পূরণ করে, submit-এর আগে screenshot নেয়, Log In-এ click করে এবং DOM content load হওয়া পর্যন্ত অপেক্ষা করে।
     *
     * @param username - The username to enter in the login form.
     * @param pass - The password to enter in the login form.
     * @param testInfo - Playwright test metadata used for action logging and screenshot attachment.
     */
    async performLogin(username: string, pass: string, testInfo: any) {
        await logAction(testInfo, 'performLogin', 'Entering credentials and clicking login', async () => {
            await this.usernameInput.fill(username);
            await this.passwordInput.fill(pass);
            
            await takeScreenShot(this.page, testInfo, 'Before-Login-Click');
            
            await this.loginButton.click();
            await this.page.waitForLoadState('domcontentloaded');
        });
    }
}