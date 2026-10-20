/* 
 * Author: EAL IT Solutions Automation Team 
 * Created (yyyy-mm-dd): 2026-04-22 
 * Description: Common utility functions for Playwright test automation 
 */ 

import fs from 'fs'; 
import path from 'path'; 
import { type Locator, type Page, type TestInfo, expect, test } from '@playwright/test'; 

/**
 * (English - PendingShot): Defines the data stored for one captured screenshot: its report name, image bytes, and content type.
 * (Bangla - PendingShot): একটি screenshot-এর রিপোর্টের নাম, image data এবং content type রাখার data structure নির্ধারণ করে।
 */
interface PendingShot { name: string; body: Buffer; contentType: string; } 

/**
 * (English - ShotStore): Adds an optional per-test screenshot buffer to Playwright's test metadata.
 * (Bangla - ShotStore): প্রতি টেস্টের screenshot buffer রাখার জন্য Playwright test metadata-তে একটি ঐচ্ছিক property যোগ করে।
 */
type ShotStore = TestInfo & { __pendingShots?: PendingShot[] }; 

/**
 * (English - SCREENSHOT_* settings): Reads screenshot format, quality, size, and attachment limits from environment variables.
 * (Bangla - SCREENSHOT_* settings): এনভায়রনমেন্ট ভ্যারিয়েবল থেকে স্ক্রিনশটের ফরম্যাট, মান, আকার ও সংরক্ষণের সীমা নেয়।
 */
const SCREENSHOT_FORMAT = (process.env.SCREENSHOT_FORMAT ?? 'webp').trim().toLowerCase(); 
const SCREENSHOT_USE_WEBP = SCREENSHOT_FORMAT === 'webp'; 
const SCREENSHOT_QUALITY = Number(process.env.SCREENSHOT_QUALITY ?? (SCREENSHOT_USE_WEBP ? 72 : 50)); 
const SCREENSHOT_MAX_WIDTH = Number(process.env.SCREENSHOT_MAX_WIDTH ?? 1600); 
const SCREENSHOT_FULLPAGE_DEFAULT = process.env.SCREENSHOT_FULLPAGE === 'true'; 
const MAX_FAILURE_SHOTS = Number(process.env.MAX_FAILURE_SHOTS ?? 10); 

/**
 * (English - SharpFactory): Describes the Sharp API methods used to resize and encode screenshots as WebP.
 * (Bangla - SharpFactory): screenshot resize ও WebP encode করতে ব্যবহৃত Sharp API method-গুলোর type নির্ধারণ করে।
*/
type SharpFactory = (input: Buffer) => { 
  resize(opts: { width: number; withoutEnlargement: boolean }): ReturnType<SharpFactory>; 
  webp(opts: { quality: number; effort: number }): { toBuffer(): Promise<Buffer> }; 
}; 
let sharpModule: SharpFactory | null | undefined; 

/**
 * (English - getSharp): Loads the optional Sharp image processor once; returns null when it is unavailable.
 * (Bangla - getSharp): ঐচ্ছিক Sharp image processor একবার লোড করে; পাওয়া না গেলে null ফেরত দেয়।
 */
function getSharp(): SharpFactory | null { 
  if (sharpModule !== undefined) return sharpModule; 
  try { 
    sharpModule = require('sharp') as SharpFactory; 
  } catch { 
    sharpModule = null; 
    console.log('[takeScreenShot] sharp not available - falling back to native JPEG capture'); 
  } 
  return sharpModule; 
} 

/**
 * (English): Captures and compresses a page screenshot, returning null if capture or processing fails.
 * (Bangla): পেজের স্ক্রিনশট তুলে কমপ্রেস করে; ক্যাপচার বা প্রসেসিং ব্যর্থ হলে null ফেরত দেয়।
 */
async function captureCompressedShot( 
  page: Page, 
  fullPage: boolean, 
  timeout: number 
): Promise<{ body: Buffer; contentType: string } | null> { 
  const sharp = SCREENSHOT_USE_WEBP ? getSharp() : null; 
  try { 
    if (sharp) { 
      const png = await page.screenshot({ fullPage, type: 'png', timeout, animations: 'disabled' }); 
      let pipeline = sharp(png); 
      if (SCREENSHOT_MAX_WIDTH > 0) { 
        pipeline = pipeline.resize({ width: SCREENSHOT_MAX_WIDTH, withoutEnlargement: true }); 
      } 
      const body = await pipeline.webp({ quality: SCREENSHOT_QUALITY, effort: 4 }).toBuffer(); 
      return { body, contentType: 'image/webp' }; 
    } 
    const jpg = await page.screenshot({ 
      fullPage, 
      type: 'jpeg', 
      quality: SCREENSHOT_QUALITY, 
      timeout, 
      animations: 'disabled' 
    }); 
    return { body: jpg, contentType: 'image/jpeg' }; 
  } catch { 
    return null; 
  } 
} 

/**
 * (English): Checks whether successful tests should also attach their buffered screenshots to the report.
 * (Bangla): সফল টেস্টের স্ক্রিনশটও রিপোর্টে যোগ করা হবে কি না, তা এনভায়রনমেন্ট সেটিংস দেখে নির্ধারণ করে।
 */
function shouldAttachOnPass(): boolean { 
  return process.env.ALWAYS_ATTACH_SCREENSHOTS === 'true' 
    || process.env.TAKE_SCREENSHOTS === 'true'; 
} 

/** 
 * @description 
 * (English): Captures the current page and buffers the image for the test report. By default, it is attached
 * only when the test fails; environment settings can also enable attachments for passing tests.
 * 
 * (Bangla): বর্তমান পেজের ছবি তুলে টেস্ট রিপোর্টের জন্য সাময়িকভাবে রাখে। ডিফল্টভাবে টেস্ট ব্যর্থ হলেই
 * ছবিটি রিপোর্টে যোগ হয়; এনভায়রনমেন্ট সেটিংস দিয়ে সফল টেস্টের ছবিও যোগ করা যায়।
 * 
 * @param page - Playwright Page instance 
 * @param testInfo - Information about the current test 
 * @param stepName - Name of the step (e.g., "After Login") 
 * @param fullPage - Set true to capture the entire scrolling page 
 */ 
export async function takeScreenShot( 
  page: Page, 
  testInfo: TestInfo, 
  stepName: string, 
  fullPage = SCREENSHOT_FULLPAGE_DEFAULT 
): Promise<void> { 
  if (page.isClosed()) { 
    console.log(`[takeScreenShot] Skipped "${stepName}" - page is already closed`); 
    return; 
  } 

  await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {}); 
  await page.locator('#busy-div').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {}); 

  const store = testInfo as ShotStore; 
  const shots = (store.__pendingShots ??= []); 

  let shot = await captureCompressedShot(page, fullPage, 15000); 
  if (!shot) { 
    shot = await captureCompressedShot(page, false, 10000); 
    if (shot) { 
      console.log(`[takeScreenShot] Full-page capture failed for "${stepName}"; buffered viewport-only screenshot instead`); 
    } 
  } 
  if (!shot) { 
    console.log(`[takeScreenShot] Screenshot skipped for "${stepName}" - capture failed`); 
    return; 
  } 
  shots.push({ name: stepName, body: shot.body, contentType: shot.contentType }); 

  if (shots.length > MAX_FAILURE_SHOTS) shots.splice(0, shots.length - MAX_FAILURE_SHOTS); 
} 

/**
 * (English): Captures the full scrolling page, with a viewport-only screenshot as a fallback, for the test report.
 * (Bangla): টেস্ট রিপোর্টের জন্য পুরো স্ক্রলযোগ্য পেজের ছবি তোলে; তা ব্যর্থ হলে শুধু দৃশ্যমান অংশের ছবি নেয়।
 */
export async function takeFullPageScreenShot( 
  page: Page, 
  testInfo: TestInfo, 
  stepName: string 
): Promise<void> { 
  if (page.isClosed()) { 
    console.log(`[takeFullPageScreenShot] Skipped "${stepName}" - page is already closed`); 
    return; 
  } 

  await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {}); 
  await page.locator('#busy-div').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {}); 

  const store = testInfo as ShotStore; 
  const shots = (store.__pendingShots ??= []); 

  let shot = await captureCompressedShot(page, true, 20000); 
  let label = `[FullPage] ${stepName}`; 
  if (!shot) { 
    shot = await captureCompressedShot(page, false, 10000); 
    if (shot) { 
      label = `[FullPage-Fallback] ${stepName}`; 
      console.log(`[takeFullPageScreenShot] Full-page capture failed for "${stepName}"; attached viewport-only screenshot instead`); 
    } 
  } 
  if (!shot) { 
    console.log(`[takeFullPageScreenShot] Screenshot skipped for "${stepName}" - capture failed`); 
    return; 
  } 
  shots.push({ name: label, body: shot.body, contentType: shot.contentType }); 

  if (shots.length > MAX_FAILURE_SHOTS) shots.splice(0, shots.length - MAX_FAILURE_SHOTS); 
} 

/**
 * (English): Attaches buffered screenshots to the test report after the test. Failed tests attach all
 * captured screenshots. Passing tests attach screenshots only when enabled by environment settings,
 * or attach just the latest screenshot when attachLatestOnPass is requested.
 * (Bangla): test শেষে buffer-এ থাকা screenshot report-এ যোগ করে। ব্যর্থ test-এর সব screenshot যোগ হয়।
 * সফল test-এ environment setting চালু থাকলে সব screenshot, আর attachLatestOnPass চাইলে শুধু সর্বশেষটি যোগ হয়।
 */
export async function flushFailureScreenShots(
  testInfo: TestInfo,
  options: { attachLatestOnPass?: boolean } = {}
): Promise<void> { 
  const store = testInfo as ShotStore; 
  const shots = store.__pendingShots; 
  store.__pendingShots = []; 
  if (!shots?.length) return; 
  const testPassed = testInfo.status === testInfo.expectedStatus; 
  const attachAllOnPass = shouldAttachOnPass();
  if (testPassed && !attachAllOnPass && !options.attachLatestOnPass) return; 
  const shotsToAttach = testPassed && !attachAllOnPass && options.attachLatestOnPass
    ? shots.slice(-1)
    : shots;
  for (const shot of shotsToAttach) { 
    await testInfo.attach(shot.name, { body: shot.body, contentType: shot.contentType }); 
  } 
} 

/** 
 * @description 
 * (English): Verifies something on the page (like checking if a text exists). But if it fails, 
 * it does NOT stop or crash the whole test. It just logs the error and continues.
 * 
 * (Bangla): এটি পেজের কোনো কিছু ভেরিফাই বা চেক করে। মজার বিষয় হলো, যদি চেকটি ফেইলও করে, 
 * তবু এটি পুরো টেস্টকে মাঝপথে বন্ধ করে দেয় না। এটি শুধু লাল রঙে এরর লিখে রাখে এবং পরের ধাপে চলে যায়।
 */ 
export async function verifySoft(assertionPromise: void | Promise<void>, logMessage: string): Promise<void> { 
  const errorCountBefore = test.info().errors.length; 
  await assertionPromise; 
  const errorCountAfter = test.info().errors.length; 

  if (errorCountAfter > errorCountBefore) { 
    const lastError = test.info().errors[errorCountAfter - 1]; 
    console.error(`\x1b[31m[SOFT ASSERT FAILED] ${logMessage}\x1b[0m`); 
    console.error(`\x1b[31mDetails: ${lastError.message}\x1b[0m\n`); 
  } else { 
    console.log(`\x1b[32m[VERIFIED] ${logMessage}\x1b[0m`); 
  } 
} 

/**
 * (English): Prints a highlighted step message and, in GitHub Actions, publishes it as a workflow notice.
 * (Bangla): ধাপের বার্তা হাইলাইট করে টার্মিনালে দেখায় এবং GitHub Actions-এ workflow notice হিসেবে পাঠায়।
 */
export function stepLogger(message: string): void { 
  const YELLOW = '\x1b[33m'; 
  const BOLD = '\x1b[1m'; 
  const RESET = '\x1b[0m'; 
  console.log(`${BOLD}${YELLOW}${message}${RESET}`); 

  if (process.env.GITHUB_ACTIONS === 'true') { 
    const oneLine = message.replace(/^\s+/, '').replace(/\s+/g, ' ').trim(); 
    if (oneLine.length > 0) { 
      const escaped = oneLine.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A'); 
      console.log(`::notice title=STEP::${escaped}`); 
    } 
  } 
} 

/** 
 * @description 
 * (English): Prints a clean message in the terminal showing exactly what the robot is currently doing.
 * 
 * (Bangla): অটোমেশন রোবটটি এই মুহূর্তে স্ক্রিনে কী কাজ করছে (যেমন: লগইন বাটনে ক্লিক করছে), 
 * তা টার্মিনাল এবং রিপোর্টে সুন্দরভাবে প্রিন্ট করার জন্য এটি ব্যবহৃত হয়।
 */ 
export async function logAction( 
  testInfo: TestInfo, 
  actionName: string, 
  description?: string, 
  action?: () => Promise<void> 
): Promise<void> { 
  const BLUE = '\x1b[34m'; 
  const RED    = '\x1b[31m'; 
  const BOLD   = '\x1b[1m'; 
  const RESET  = '\x1b[0m'; 

  const logText = description 
    ? `▶ SpecAction: ${actionName} → ${description}` 
    : `▶ SpecAction: ${actionName}`; 

  console.log(`${BLUE}${logText}${RESET}`); 
  await testInfo.attach(logText, { body: description ?? actionName, contentType: 'text/plain' }); 

  if (action) { 
    try { 
      await action(); 
    } catch (error) { 
      const errorMsg = error instanceof Error ? error.message : String(error); 
      const failLabel = `✖ FAILED: ${actionName}`; 
      console.error(`${BOLD}${RED}${failLabel} — ${errorMsg}${RESET}`); 
      await testInfo.attach(failLabel, { body: errorMsg, contentType: 'text/plain' }); 
      throw error; 
    } 
  } 
} 

/**
 * (English): Returns true only when the value is present and is not an empty or whitespace-only string.
 * (Bangla): ভ্যালু থাকলে এবং সেটি খালি বা শুধু whitespace না হলে true ফেরত দেয়।
 */
export function hasValue(value: string | undefined | null): boolean { 
  return value !== undefined && value !== null && value.trim() !== ''; 
} 

/**
 * (English): Builds a portal page URL by replacing the sign-in page portion with the requested page path.
 * (Bangla): সাইন-ইন পেজের অংশটি চাওয়া পেজের path দিয়ে বদলে portal-এর URL তৈরি করে।
 */
export function buildPortalPageUrl(portalUrl: string, pagePath: string): string { 
  return portalUrl.replace(/SignIn\.aspx/i, pagePath); 
} 

/**
 * (English): Creates a case-insensitive menu-label pattern that also accepts an optional trailing “s”.
 * (Bangla): মেনুর নামের জন্য case-insensitive pattern বানায়, যাতে শেষে ঐচ্ছিক “s” থাকলেও মিলে যায়।
 */
function buildFlexibleMenuLabelPattern(label: string): RegExp { 
  const escaped = label.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
  const pattern = escaped.endsWith('s') ? `${escaped.slice(0, -1)}s?` : `${escaped}s?`; 
  return new RegExp(`^${pattern}$`, 'i'); 
} 

/** 
 * @description 
 * (English): Clicks deeply nested menu items (like navigating through a side-bar: Transfers > Make a Transfer).
 * It handles hidden menus automatically.
 * 
 * (Bangla): এটি ওয়েবসাইটের যেকোনো মেনু বা সাব-মেনুতে (যেমন: Settings এর ভেতর Profile) ক্লিক করতে সাহায্য করে। 
 * মেনুটি লুকানো থাকলেও এটি নিজে থেকেই খুঁজে বের করে ক্লিক করে।
 */ 
export async function selectMenuItem( 
  page: Page, 
  menuName: string, 
  subMenuName?: string, 
  nestedSubMenuName?: string 
): Promise<void> { 
  if (subMenuName === undefined) { 
    const directLink = page.getByRole('link', { name: menuName }); 
    if (await directLink.count() > 1) { 
      await directLink.first().click(); 
    } else { 
      await directLink.click(); 
    } 
    await page.waitForLoadState('domcontentloaded'); 
    return; 
  } 

  const menuButton = page.getByRole('button', { name: new RegExp(`expand_more ${menuName}`, 'i') }); 
  const hasExpandableMenu = await menuButton.isVisible({ timeout: 3000 }).catch(() => false); 

  if (hasExpandableMenu) { 
    const isExpanded = await menuButton.getAttribute('aria-expanded') === 'true'; 
    if (!isExpanded) { 
      try { 
        await menuButton.click(); 
      } catch (error) { 
        const message = error instanceof Error ? error.message : String(error); 
        if (!message.includes('intercepts pointer events')) throw error; 
        console.log(`selectMenuItem: retrying "${menuName}" menu expansion with force after pointer interception`); 
        await menuButton.click({ force: true }); 
      } 
      await page.waitForLoadState('domcontentloaded'); 
    } 

    if (nestedSubMenuName) { 
      const subMenuButton = page.getByRole('button', { name: new RegExp(`chevron_right ${subMenuName}`, 'i') }); 
      await subMenuButton.waitFor({ state: 'visible', timeout: 10000 }); 
      const subMenuContainer = page.locator('li').filter({ has: subMenuButton }).first(); 
      const nestedLinkInSubMenu = subMenuContainer.getByRole('link', { name: buildFlexibleMenuLabelPattern(nestedSubMenuName) }); 
      const alreadyExpanded = await nestedLinkInSubMenu.first().isVisible({ timeout: 2000 }).catch(() => false); 
      if (!alreadyExpanded) { 
        await subMenuButton.click(); 
        await page.waitForLoadState('domcontentloaded'); 
      } 
      const nestedLink = nestedLinkInSubMenu.or(page.getByRole('link', { name: buildFlexibleMenuLabelPattern(nestedSubMenuName) })); 
      const nestedLinkVisible = await nestedLink.first().isVisible({ timeout: 5000 }).catch(() => false); 
      if (nestedLinkVisible) { 
        await nestedLink.first().click(); 
      } else { 
        console.log(`selectMenuItem: nested link "${nestedSubMenuName}" not visible after sub-menu expansion - may already be on target page`); 
      } 
    } else { 
      const subMenuLink = page.getByRole('link', { name: buildFlexibleMenuLabelPattern(subMenuName) }); 
      if (await subMenuLink.count() > 1) { 
        await subMenuLink.first().click(); 
      } else { 
        await subMenuLink.click(); 
      } 
    } 
  } else { 
    const plainButton = page.getByRole('button', { name: new RegExp(`^${menuName}$`, 'i') }); 
    const hasPlainButton = await plainButton.isVisible({ timeout: 3000 }).catch(() => false); 

    if (hasPlainButton) { 
      await plainButton.click(); 
      await page.waitForLoadState('domcontentloaded'); 
    } else { 
      const altNames: Record<string, string[]> = { 
        transfers: ['Move Money', 'Pay/Transfer'], 
        accounts: ['My Accounts'], 
        ach: ['Move Money', 'Payments'], 
      }; 
      const alts = altNames[menuName.toLowerCase()] ?? []; 
      let altClicked = false; 
      for (const alt of alts) { 
        const altBtn = page.getByRole('button', { name: new RegExp(`^${alt}$`, 'i') }); 
        if (await altBtn.isVisible({ timeout: 2000 }).catch(() => false)) { 
          await altBtn.click(); 
          await page.waitForLoadState('domcontentloaded'); 
          altClicked = true; 
          break; 
        } 
      } 
    } 

    if (nestedSubMenuName) { 
      const subToggleBtn = page.getByRole('button', { name: new RegExp(`chevron_right ${subMenuName}`, 'i') }); 
      const hasSubToggle = await subToggleBtn.isVisible({ timeout: 5000 }).catch(() => false); 
      if (hasSubToggle) { 
        await subToggleBtn.click(); 
        await page.waitForLoadState('domcontentloaded'); 
        const nestedLink = page.getByRole('link', { name: buildFlexibleMenuLabelPattern(nestedSubMenuName) }); 
        const nestedLinkVisible = await nestedLink.first().isVisible({ timeout: 3000 }).catch(() => false); 
        if (nestedLinkVisible) await nestedLink.first().click(); 
      } else { 
        const subLink = page.getByRole('link', { name: buildFlexibleMenuLabelPattern(subMenuName) }); 
        if (await subLink.first().isVisible({ timeout: 3000 }).catch(() => false)) { 
          await subLink.first().click(); 
          await page.waitForLoadState('domcontentloaded'); 
        } 
        const nestedLink = page.getByRole('link', { name: buildFlexibleMenuLabelPattern(nestedSubMenuName) }); 
        if (await nestedLink.count() > 1) await nestedLink.first().click(); 
        else await nestedLink.click(); 
      } 
    } else { 
      const subMenuLink = page.getByRole('link', { name: buildFlexibleMenuLabelPattern(subMenuName) }); 
      const isLinkVisible = await subMenuLink.first().isVisible({ timeout: 5000 }).catch(() => false); 
      if (isLinkVisible) { 
        await subMenuLink.first().click(); 
      } else { 
        const targetLink = page.locator('a').filter({ hasText: buildFlexibleMenuLabelPattern(subMenuName) }); 
        const isDirectlyVisible = await targetLink.first().isVisible({ timeout: 5000 }).catch(() => false); 
        if (isDirectlyVisible) { 
          await targetLink.first().click(); 
        } else { 
          const linkHref = await targetLink.first().getAttribute('href').catch(() => null); 
          if (linkHref) { 
            const currentUrl = new URL(page.url()); 
            const resolvedUrl = new URL(linkHref, currentUrl.origin).href; 
            await page.goto(resolvedUrl); 
          } else { 
            const menuLink = page.getByRole('link', { name: menuName }); 
            await menuLink.first().click(); 
          } 
        } 
      } 
    } 
  } 
  await page.waitForLoadState('domcontentloaded'); 
} 

/**
 * (English): Converts supported date keywords (such as “today” or “Plus 3 Business Days”) to MM/DD/YYYY.
 * (Bangla): “today” বা “Plus 3 Business Days”-এর মতো নির্দিষ্ট শব্দকে MM/DD/YYYY তারিখে রূপান্তর করে।
 */
export function resolveDateKeyword(keyword: string): string { 
  const lowerKeyword = keyword.trim().toLowerCase(); 
  if (lowerKeyword === 'today' || lowerKeyword === 'current business day') return formatDateMMDDYYYY(new Date()); 
  if (lowerKeyword === 'next business day') { 
    const date = new Date(); 
    date.setDate(date.getDate() + 1); 
    while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1); 
    return formatDateMMDDYYYY(date); 
  } 
  const plusMatch = keyword.match(/^Plus\s+(\d+)$/i); 
  if (plusMatch) { 
    const days = parseInt(plusMatch[1], 10); 
    const date = new Date(); 
    date.setDate(date.getDate() + days); 
    return formatDateMMDDYYYY(date); 
  } 
  const plusBizMatch = keyword.match(/^Plus\s+(\d+)\s+Business\s+Days?$/i); 
  if (plusBizMatch) { 
    const bizDays = parseInt(plusBizMatch[1], 10); 
    const date = new Date(); 
    let added = 0; 
    while (added < bizDays) { 
      date.setDate(date.getDate() + 1); 
      const day = date.getDay(); 
      if (day !== 0 && day !== 6) added++; 
    } 
    return formatDateMMDDYYYY(date); 
  } 
  const nextDayMatch = keyword.match(/^Next\s+(Saturday|Sunday)$/i); 
  if (nextDayMatch) { 
    const targetDay = nextDayMatch[1].toLowerCase() === 'saturday' ? 6 : 0; 
    const date = new Date(); 
    const currentDay = date.getDay(); 
    const daysUntil = (targetDay - currentDay + 7) % 7 || 7; 
    date.setDate(date.getDate() + daysUntil); 
    return formatDateMMDDYYYY(date); 
  } 
  return keyword; 
} 

/**
 * (English): Formats a date as a zero-padded MM/DD/YYYY string.
 * (Bangla): তারিখকে শূন্য-প্যাডসহ MM/DD/YYYY ফরম্যাটে সাজায়।
 */
function formatDateMMDDYYYY(date: Date): string { 
  const mm = String(date.getMonth() + 1).padStart(2, '0'); 
  const dd = String(date.getDate()).padStart(2, '0'); 
  const yyyy = date.getFullYear(); 
  return `${mm}/${dd}/${yyyy}`; 
} 

/**
 * (English): Opens a dropdown and selects the option whose text exactly matches the requested value.
 * (Bangla): dropdown খুলে যে option-এর লেখা চাওয়া মানের সঙ্গে পুরোপুরি মেলে, সেটি নির্বাচন করে।
 */
export async function selectDropdownvalue( 
  page: Page, 
  dropdownButtonLocator: import('@playwright/test').Locator, 
  optionText: string 
): Promise<void> { 
  await dropdownButtonLocator.click(); 
  await page.locator('div.ui-menu-item-wrapper[role="option"]').first().waitFor({ state: 'visible', timeout: 10000 }); 
  await page.locator('div.ui-menu-item-wrapper[role="option"]') 
    .filter({ hasText: new RegExp(`^${optionText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) }) 
    .click(); 
} 

/**
 * (English): Opens a dropdown and selects the first option containing the requested text, ignoring letter case.
 * (Bangla): dropdown খুলে অক্ষরের বড়-ছোট পার্থক্য না করে চাওয়া লেখা থাকা প্রথম option নির্বাচন করে।
 */
export async function selectDropdownvalueByPartialText( 
  page: Page, 
  dropdownButtonLocator: import('@playwright/test').Locator, 
  partialText: string 
): Promise<void> { 
  await dropdownButtonLocator.click(); 
  const escaped = partialText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
  const option = page.locator('div.ui-menu-item-wrapper[role="option"]') 
    .filter({ hasText: new RegExp(escaped, 'i') }); 
  await option.first().click(); 
} 

/**
 * (English): Selects the first dropdown option containing the requested text, scrolling it into view when needed.
 * (Bangla): চাওয়া লেখা থাকা প্রথম dropdown option নির্বাচন করে; প্রয়োজন হলে option-টিকে স্ক্রল করে দৃশ্যমান করে।
 */
export async function selectDropdownvalueByPartialTextWithScroll( 
  page: Page, 
  dropdownButtonLocator: import('@playwright/test').Locator, 
  partialText: string 
): Promise<void> { 
  await dropdownButtonLocator.click(); 
  const escaped = partialText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
  const menuOptions = page.locator('div.ui-menu-item-wrapper[role="option"]'); 
  await menuOptions.first().waitFor({ state: 'visible', timeout: 10000 }); 

  const matchingOption = menuOptions.filter({ hasText: new RegExp(escaped, 'i') }); 
  const optionCount = await matchingOption.count(); 
  if (optionCount === 0) throw new Error(`Dropdown option containing "${partialText}" was not found.`); 

  const optionToClick = matchingOption.first(); 
  try { 
    await optionToClick.scrollIntoViewIfNeeded(); 
    await optionToClick.click({ timeout: 5000 }); 
  } catch { 
    await optionToClick.evaluate((el) => { 
      (el as HTMLElement).scrollIntoView({ block: 'nearest' }); 
      const scrollContainer = el.closest('ul.ui-menu, div.ui-menu, div[role="listbox"]') as HTMLElement | null; 
      if (scrollContainer) { 
        const targetTop = (el as HTMLElement).offsetTop - Math.floor(scrollContainer.clientHeight / 2); 
        scrollContainer.scrollTop = Math.max(0, targetTop); 
      } 
    }); 
    await optionToClick.click(); 
  } 
} 

/**
 * (English): Opens the user information menu, optionally expands a submenu, and clicks the requested visible link.
 * (Bangla): User Info menu খোলে, প্রয়োজনে সাবমেনু প্রসারিত করে, চাওয়া দৃশ্যমান লিংকে ক্লিক করে।
 */
export async function selectUserInfoMenuItem( 
  page: Page, 
  linkName: string | RegExp, 
  subMenuName?: string 
): Promise<void> { 
  const userInfoMenuButton = page.getByRole('button', { name: /User Info Menu|Menú de la información del usuario/i }); 
  await userInfoMenuButton.click(); 
  await page.waitForLoadState('domcontentloaded'); 

  if (subMenuName) { 
    const escaped = subMenuName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
    const expandSub = page.getByRole('button', { name: new RegExp(`expand_more.*${escaped}`, 'i') }); 
    const plainSub = page.getByRole('button', { name: new RegExp(`^${escaped}$`, 'i') }); 
    const subMenuButton = await expandSub.isVisible({ timeout: 3000 }).catch(() => false) ? expandSub : plainSub; 
    await subMenuButton.click(); 
    await page.waitForLoadState('domcontentloaded'); 
  } 

  const targetLink = page.getByRole('link', { name: linkName }).and(page.locator(':visible')); 
  await targetLink.first().click({ noWaitAfter: true }); 
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => { }); 
} 

/**
 * (English): Waits for the page's busy overlay to disappear, then logs and continues if the timeout expires.
 * (Bangla): পেজের busy overlay অদৃশ্য হওয়া পর্যন্ত অপেক্ষা করে; সময় শেষ হলে বার্তা দিয়ে পরের ধাপে যায়।
 */
export async function waitForBusyOverlay(page: Page, timeout = 15000): Promise<void> { 
  await page.locator('#busy-div').waitFor({ state: 'hidden', timeout }).catch(() => { 
    console.log('busy-div did not become hidden within timeout, proceeding'); 
  }); 
} 

/**
 * (English): Verifies that a visible dropdown's selected value uses normal (400) font weight.
 * (Bangla): দৃশ্যমান dropdown-এর নির্বাচিত মানের font weight স্বাভাবিক (400) কি না যাচাই করে।
 */
export async function verifyDropdownSelectedValueNotBold( 
  page: Page, 
  dropdownLocator: import('@playwright/test').Locator, 
  label: string 
): Promise<void> { 
  await expect(dropdownLocator).toBeVisible(); 
  const fontWeight = await dropdownLocator.evaluate(el => getComputedStyle(el).fontWeight); 
  expect.soft(fontWeight, `${label} font-weight should be normal (400), got ${fontWeight}`).toMatch(/^(400|normal)$/); 
} 

/**
 * (English): Checks whether text follows the MM/DD/YYYY date shape.
 * (Bangla): লেখাটি MM/DD/YYYY তারিখের কাঠামো অনুসরণ করে কি না যাচাই করে।
 */
export function verifyDateFormat(dateText: string): boolean { 
  return /^\d{2}\/\d{2}\/\d{4}$/.test(dateText.trim()); 
} 

/**
 * (English): Checks up to maxRows table rows for non-empty dates in a column and returns the values found.
 * (Bangla): টেবিলের সর্বোচ্চ maxRows সারিতে নির্দিষ্ট কলামের খালি নয় এমন তারিখ যাচাই করে এবং পাওয়া মান ফেরত দেয়।
 */
export async function verifyAllCellDatesInColumn( 
  tableLocator: import('@playwright/test').Locator, 
  columnIndex: number, 
  maxRows = 10 
): Promise<string[]> { 
  const rows = tableLocator.locator('tr'); 
  const rowCount = await rows.count(); 
  const limit = Math.min(rowCount, maxRows); 
  const dates: string[] = []; 
  for (let i = 0; i < limit; i++) { 
    const cellText = (await rows.nth(i).locator('td').nth(columnIndex).textContent()) ?? ''; 
    const trimmed = cellText.trim(); 
    if (trimmed.length > 0) { 
      dates.push(trimmed); 
      expect.soft(verifyDateFormat(trimmed), `Row ${i} date "${trimmed}" should match MM/DD/YYYY`).toBe(true); 
    } 
  } 
  return dates; 
} 

/**
 * (English): Confirms that clicking a disabled date does not change the date input, then closes the picker.
 * (Bangla): নিষ্ক্রিয় তারিখে ক্লিক করলে date input বদলায় না তা যাচাই করে, এরপর date picker বন্ধ করে।
 */
export async function verifyDatePickerDisabledDates(page: Page, dateInputLocator: import('@playwright/test').Locator): Promise<void> { 
  const disabledCells = page.locator('td.ui-datepicker-unselectable'); 
  const disabledCount = await disabledCells.count(); 

  if (disabledCount > 0) { 
    const valueBefore = await dateInputLocator.inputValue(); 
    await disabledCells.first().click({ force: true }); 
    const valueAfter = await dateInputLocator.inputValue(); 
    expect.soft(valueAfter, 'Clicking a disabled date should not change the input value').toBe(valueBefore); 
  } 
  await page.keyboard.press('Escape'); 
} 

/**
 * (English): Softly checks whether the page HTML contains the expected currency text.
 * (Bangla): পেজের HTML-এ প্রত্যাশিত currency-এর লেখা আছে কি না soft assertion দিয়ে যাচাই করে।
 */
export async function verifyCurrencyOnPage(page: Page, expectedCurrency: string): Promise<void> { 
  const pageContent = await page.content(); 
  const hasCurrency = pageContent.includes(expectedCurrency); 
  expect.soft(hasCurrency, `Currency "${expectedCurrency}" should be present on page`).toBe(true); 
} 

/**
 * (English): Navigates directly to a settings URL relative to the portal base URL and waits for DOM content.
 * (Bangla): portal-এর base URL-এর সঙ্গে settings path জুড়ে সরাসরি পেজে যায় এবং DOM লোড হওয়া পর্যন্ত অপেক্ষা করে।
 */
export async function navigateToSettingsPage(page: Page, portalUrl: string, settingsPageUrl: string): Promise<void> { 
  const baseUrl = portalUrl.replace(/\/SignIn\.aspx$/i, ''); 
  await page.goto(`${baseUrl}${settingsPageUrl}`); 
  await page.waitForLoadState('domcontentloaded'); 
} 

/** 
 * @description 
 * (English): Automatically closes annoying success banners or error popups (like "Updated Successfully") 
 * that cover the screen and block the robot from clicking other buttons.
 * 
 * (Bangla): টেস্ট রান করার সময় পেজে অনেক সময় "সাকসেস" বা "এরর" পপআপ মেসেজ আসে যা স্ক্রিন ঢেকে দেয়। 
 * এটি নিজে থেকেই সেই পপআপগুলোর 'Close' বাটনে ক্লিক করে স্ক্রিন ক্লিয়ার করে দেয়।
 */ 
export async function dismissAlertIfPresent(page: Page): Promise<void> { 
  const banners = page.locator( 
    '[role="alert"]:not(#busy-div-start):not(.sr-only), ' + 
    '[role="status"]:not(.sr-only), ' + 
    '.alert-success:not(.sr-only), ' + 
    '[class*="success"]:not(.sr-only), ' + 
    '[class*="confirm"]:not(.sr-only)' 
  ); 
  for (let i = 0; i < 5; i++) { 
    const banner = banners.first(); 
    if (!(await banner.isVisible({ timeout: 2000 }).catch(() => false))) break; 
    const closeBtn = banner.locator('button, .close, [aria-label="Close"]').first(); 
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) { 
      await closeBtn.click().catch(() => {}); 
    } else { 
      await banner.evaluate(el => el.remove()).catch(() => {}); 
    } 
    await banner.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {}); 
  } 
} 

/**
 * (English): Opens Account Summary through its visible link, or navigates to the route directly if unavailable.
 * (Bangla): দৃশ্যমান লিংক দিয়ে Account Summary খোলে; লিংক না থাকলে সরাসরি route-এ যায়।
 */
export async function navigateToAccountSummary(page: Page): Promise<void> { 
  const homeLink = page.getByRole('link', { name: /Account Summary|Home/i }).first(); 
  const homeVisible = await homeLink.isVisible({ timeout: 3000 }).catch(() => false); 
  if (homeVisible) { 
    await homeLink.click(); 
    await page.waitForLoadState('domcontentloaded'); 
  } else { 
    const baseUrl = new URL(page.url()).origin; 
    await page.goto(`${baseUrl}${PAGE_ROUTES.accountSummary}`); 
    await page.waitForLoadState('domcontentloaded'); 
  } 
} 

/**
 * (English): Returns a locator for ACH-related alert, success, confirmation, and message elements.
 * (Bangla): ACH-সম্পর্কিত alert, success, confirmation এবং message element খুঁজতে locator ফেরত দেয়।
 */
export function getAchAlertMessageLocator(page: Page, additionalAlertExclusions?: string): Locator { 
  const extra = additionalAlertExclusions ?? ''; 
  return page.locator( 
    `[role="alert"]:not(#busy-div-start):not(.sr-only):not(.icon_error_small)${extra}, ` + 
    `[class*="success"]:not(.sr-only), ` + 
    `[class*="confirm"]:not(.sr-only), ` + 
    `[id*="lblMessage"]` 
  ); 
} 

/**
 * (English): Deletes files directly inside the given directory whose names match the supplied pattern.
 * (Bangla): নির্দিষ্ট directory-র ভেতরের যেসব ফাইলের নাম দেওয়া pattern-এর সঙ্গে মেলে, সেগুলো মুছে দেয়।
 */
export function cleanupTempFiles(directory: string, pattern: RegExp): void { 
  try { 
    const files = fs.readdirSync(directory); 
    for (const file of files) { 
      if (pattern.test(file)) fs.unlinkSync(path.join(directory, file)); 
    } 
  } catch (e) { 
    console.log(`Temp file cleanup failed in ${directory}:`, e); 
  } 
} 

/**
 * (English): Maps URL-pattern keys to regular-expression strings used to recognize destination pages.
 * (Bangla): গন্তব্য পেজ শনাক্ত করতে URL pattern key-কে regular-expression string-এর সঙ্গে মিলিয়ে রাখে।
 */
export const PAGE_URL_PATTERNS = { 
  changePassword: 'ChangePassword', 
  profile: 'Profile\\.aspx', 
  signIn: 'SignIn\\.aspx', 
  accountSummary: 'AccountSummary', 
  eStatements: 'eStatements', 
  contactInformation: 'ContactInformation', 
  forgotPassword: 'ForgotPassword\\.aspx', 
  registrationDisclosure: 'RegistrationDisclosure\\.aspx', 
  register: 'Register\\.aspx', 
  rememberDevice: 'RememberDevice\\.aspx', 
  supportedBrowsers: 'SupportedBrowsers\\.aspx', 
  faqs: 'FAQs\\.aspx', 
  acceptedDisclosures: 'AcceptedDisclosures', 
  disclosureViewer: 'DisclosureViewer', 
  fastBalances: 'FastBalances', 
  changeLanguage: 'ChangeLanguage|Language', 
  userActivity: 'UserActivity', 
  advancedAlerts: 'BasicAlerts\\.aspx', 
  basicAlerts: 'BasicAlerts|AccountAlerts', 
  manageEmail: 'ManageEmail', 
  secureForms: 'SecureForms\\.aspx', 
  submitSecureForm: 'SubmitSecureForm\\.aspx', 
  myFinances: 'MyFinances', 
  achTemplates: 'ACH\\/(Templates|BatchTemplatesApprovalNotRequired)\\.aspx', 
  achHistory: 'History\\.aspx', 
  externalTransfers: 'ExternalTransfers', 
  transferActivity: 'TransferActivity|MakeTransfer', 
  signInOrLogin: 'SignIn|Login', 
  accountSummaryOrAccounts: 'AccountSummary|accounts', 
  registrationPages: 'RegistrationDisclosure\\.aspx|Register\\.aspx|OnlineMobileRegistrationDisclosure\\.aspx', 
  zelle: 'Zelle\\.aspx', 
  forgotUserID: 'ForgotUserID', 
  onlineMobileRegistrationDisclosure: 'OnlineMobileRegistrationDisclosure\\.aspx', 
  changeAddressPhoneNumber: 'ChangeAddressPhoneNumber', 
  changeAddressOrContactInfo: 'ChangeAddressPhoneNumber|ContactInformation', 
  allDataSso: 'alldata|cashedge|AllDataSSO', 
  messages: 'Messages', 
  messageDetail: 'MessageDetail', 
  zelleDirect: 'ZelleDirect', 
  openAnAccount: 'OpenAnAccount', 
  reorderChecks: 'ReorderChecks', 
  singleWire: 'SingleWire\\.aspx', 
  loggedOut: 'SignIn\\.aspx|loggedout|logout|clientdomain\\.com', 
} as const; 

export type UrlPatternKey = keyof typeof PAGE_URL_PATTERNS; 

/**
 * (English): Waits until the page URL matches the pattern registered for the supplied key.
 * (Bangla): দেওয়া key-এর জন্য নির্ধারিত pattern-এর সঙ্গে পেজের URL মেলা পর্যন্ত অপেক্ষা করে।
 */
export async function waitForPageUrl(page: Page, patternKey: UrlPatternKey, timeout = 15000): Promise<void> { 
  const pattern = PAGE_URL_PATTERNS[patternKey]; 
  await page.waitForURL(new RegExp(pattern, 'i'), { timeout }); 
} 

/**
 * (English): Maps named page-route keys to portal-relative paths for direct navigation.
 * (Bangla): সরাসরি পেজে যাওয়ার জন্য নামযুক্ত route key-গুলোকে portal-relative path-এর সঙ্গে মিলিয়ে রাখে।
 */
export const PAGE_ROUTES = { 
  accountSummary: '/Accounts/AccountSummary.aspx', 
  eStatements: '/Accounts/eStatements.aspx', 
  makeTransfer: '/Transfers/MakeTransfer.aspx', 
  transferActivity: '/TransferFunds/TransferActivity.aspx', 
  transferTemplates: '/TransferFunds/TransferTemplates.aspx', 
  changeEmail: '/Profile/ChangeEmail.aspx', 
  changeUserId: '/Profile/ChangeUserID.aspx', 
  changeLanguage: '/Profile/ChangeLanguage.aspx', 
  securityQuestions: '/AOP/ChangeProfile.aspx', 
  basicAlerts: '/Settings/BasicAlerts.aspx', 
  achPassThru: '/ACH/PassThru.aspx', 
  achActivity: '/ACH/Activity.aspx', 
  achHistory: '/ACH/History.aspx', 
  webConnect: '/Accounts/WebConnect.aspx', 
  cardHub: '/CardHubCards.aspx', 
  orderChecks: '/ReorderChecks.aspx', 
  mortgageApplication: '/MortgageApplication.aspx', 
  portalHome: '/default.aspx', 
  messages: '/Messages.aspx', 
  userActivity: '/Settings/UserActivity.aspx', 
  acceptedDisclosures: '/Settings/AcceptedDisclosures.aspx', 
  contactInformation: '/Profile/ContactInformation.aspx', 
  advancedAlerts: '/Settings/BasicAlerts.aspx', 
  externalTransfers: '/ExternalTransfers.aspx', 
  myFinances: '/MyFinances.aspx', 
  secureForms: '/Settings/SecureForms.aspx', 
} as const; 

/**
 * (English): Removes the sign-in page and its query string from a portal URL to get the base URL.
 * (Bangla): portal URL থেকে sign-in পেজ ও তার query string বাদ দিয়ে base URL তৈরি করে।
 */
export function getBaseUrl(portalUrl: string): string { 
  return portalUrl.replace(/\/SignIn\.aspx.*$/i, ''); 
} 

/**
 * (English): Navigates to the portal-relative route registered under routeKey and waits for DOM content.
 * (Bangla): routeKey-তে নিবন্ধিত portal-relative path-এ যায় এবং DOM লোড হওয়া পর্যন্ত অপেক্ষা করে।
 */
export async function navigateToRoute(page: Page, portalUrl: string, routeKey: keyof typeof PAGE_ROUTES): Promise<void> { 
  const baseUrl = getBaseUrl(portalUrl); 
  const routePath = PAGE_ROUTES[routeKey]; 
  await page.goto(`${baseUrl}${routePath}`); 
  await page.waitForLoadState('domcontentloaded'); 
} 

/**
 * (English): Maps stable menu keys to the menu, submenu, and optional nested item used for navigation.
 * (Bangla): navigation-এ ব্যবহৃত স্থায়ী menu key-গুলোকে menu, submenu ও ঐচ্ছিক nested item-এর সঙ্গে মিলিয়ে রাখে।
 */
export const MENU_ITEMS = { 
  accountSummary:      { menu: 'Accounts', sub: 'Accounts Summary' }, 
  accountSummaryAlt:   { menu: 'Accounts', sub: 'Account Summary' }, 
  ficoScore:           { menu: 'Accounts', sub: 'FICO Score' }, 
  eStatements:         { menu: 'Accounts', sub: 'Statements' }, 
  statementsNotices:   { menu: 'Accounts', sub: 'Statements' }, 
  statementPreference: { menu: 'Accounts', sub: 'Statement Preference' }, 
  statements:          { menu: 'Accounts', sub: 'Statements' }, 
  stopPayment:         { menu: 'Accounts', sub: 'Additional Services', nested: 'Stop Payment' }, 
  stopPaymentNested:   { menu: 'Accounts', sub: 'Additional Services', nested: 'Stop Payment' }, 
  makeTransfer:        { menu: 'Transfers', sub: 'Make a Transfer' }, 
  transferActivity:    { menu: 'Transfers', sub: 'Transfer Activity' }, 
  externalTransfers:   { menu: 'Transfers', sub: 'External Transfers' }, 
  transfersManageUnlinked: { menu: 'Transfers', sub: 'Manage Unlinked Accounts' }, 
  achTemplates:        { menu: 'Business Services', sub: 'ACH', nested: 'Batches' }, 
  achActivity:         { menu: 'Business Services', sub: 'ACH', nested: 'ACH Activity' }, 
  achParticipants:     { menu: 'Business Services', sub: 'ACH', nested: 'ACH Participants' }, 
  achBatchImport:      { menu: 'Business Services', sub: 'ACH', nested: 'Validator' }, 
  achImportCustom:     { menu: 'ACH', sub: 'Import', nested: 'Import From CSV File' }, 
  achImportParticipants: { menu: 'ACH', sub: 'Import File', nested: 'Import NACHA Template' }, 
  wireActivity:        { menu: 'Wire Transfers', sub: 'Personal Wires', nested: 'Activity' }, 
  wirePayees:          { menu: 'Wire Transfers', sub: 'Personal Wires', nested: 'Beneficiary' }, 
  personalBeneficiary: { menu: 'Wire Transfers', sub: 'Personal Wires', nested: 'Beneficiary' }, 
  businessBeneficiary: { menu: 'Wire Transfers', sub: 'Business Wires', nested: 'Beneficiary' }, 
  singleWire:          { menu: 'Wire Transfers',  sub: 'Personal Wires', nested: 'One Time' }, 
  businessSingleWire:  { menu: 'Wire Transfers', sub: 'Business Wires', nested: 'One Time' }, 
  businessWireActivity:{ menu: 'Wire Transfers', sub: 'Business Wires', nested: 'Activity' }, 
  recurringWire:       { menu: 'Wire Transfers', sub: 'Personal Wires', nested: 'Recurring' }, 
  achHistory:         { menu: 'ACH', sub: 'ACH History' }, 
  achHistoryBusiness: { menu: 'Business Services', sub: 'ACH', nested: 'ACH History' }, 
  multipleWires:       { menu: 'Wire Transfers',  sub: 'Personal Wires', nested: 'Multiple Wires' }, 
  businessMultipleWires: { menu: 'Wire Transfers', sub: 'Business Wires', nested: 'Multiple Wires' }, 
  oneTimeWire:         { menu: 'Wire Transfers', sub: 'Personal Wires', nested: 'One Time' }, 
  wireActivityAlt:     { menu: 'Wire Transfers',  sub: 'Personal Wires', nested: 'Activity' }, 
  zelle:               { menu: 'Pay and Transfers', sub: 'Send Money with Zelle' }, 
  zelleStandalone:     { menu: 'Zelle', sub: 'Zelle' }, 
  myFinances:          { menu: 'My Finances', sub: 'My Finances' }, 
  selfServiceStopPay:  { menu: 'Self Service', sub: 'Stop Payments' }, 
  eServicesStopPay:    { menu: 'eServices', sub: 'Stop Payment' }, 
  eServicesRequestServices: { menu: 'eServices', sub: 'Request Services' }, 
  eServicesWebConnect: { menu: 'eServices', sub: 'Quicken/Quickbooks WebConnect' }, 
  moveMoneyAccounts:   { menu: 'Transfers', sub: 'Make a Transfer' }, 
  moveMoneyActivity:   { menu: 'Transfers', sub: 'Transfer Activity' }, 
  moveMoneyActivityAlt:{ menu: 'Transfers', sub: 'Transfer Activity' }, 
  payTransferCreate:   { menu: 'Pay/Transfer', sub: 'Create Transfers' }, 
  payTransferActivity: { menu: 'Pay/Transfer', sub: 'Transfer Activity' }, 
  webConnect:      { menu: 'Accounts', sub: 'Additional Services', nested: 'Export Account History - WebConnect' }, 
  stopPaymentsStopPay: { menu: 'Stop Payments', sub: 'Stop Payment' }, 
  createTransfers:     { menu: 'Transfers', sub: 'Create Transfers' }, 
  accountAlerts:       { menu: 'Alerts', sub: 'Account Alerts' }, 
  messageAlerts:       { menu: 'Messages', sub: 'Message Alerts' }, 
  billPay:             { menu: 'Payments'}, 
  payBills:            { menu: 'Pay Bills', sub: 'My Other Bills' }, 
  payBillsPayments:    { menu: 'Payments', sub: 'Pay Bills' }, 
  selfServiceOpenAccount: { menu: 'Self Service', sub: 'Open an Account' }, 
  selfServiceOrderChecks: { menu: 'Self Service', sub: 'Order Checks' }, 
  moveMoneyExternal:   { menu: 'Move Money', sub: 'My External Accounts' }, 
  openNewAccount:      { menu: 'Accounts', sub: 'Open a New Account' }, 
  creditSense:         { menu: 'Tools', sub: 'Credit Sense' }, 
  creditScore:         { menu: 'Credit Score', sub: 'Credit Score' }, 
  cards:               { menu: 'Cards', sub: 'Cards' }, 
} as const; 

export type MenuItemKey = keyof typeof MENU_ITEMS; 

/**
 * (English): Resolves a menu key, handles known navigation fallbacks, and opens the corresponding page.
 * (Bangla): menu key খুঁজে সংশ্লিষ্ট পেজ খোলে এবং পরিচিত navigation fallback-গুলো প্রয়োগ করে।
 */
export async function navigateToMenu(page: Page, itemKey: MenuItemKey | (string & {})): Promise<void> { 
  const item = MENU_ITEMS[itemKey as MenuItemKey]; 
  if (!item) throw new Error(`navigateToMenu: unknown key "${itemKey}". Add it to MENU_ITEMS in CommonFunctions.ts`); 

  if (itemKey === 'accountSummary') { 
    await navigateToAccountSummary(page); 
    return; 
  } 

  const transferConfirmationVisible = await page.getByText(/Your transfer has been successfully (submitted|scheduled)/i) 
    .isVisible({ timeout: 1000 }).catch(() => false); 
  if (transferConfirmationVisible) { 
    const confirmationCloseButton = page.locator('.message-queue-close-button').first(); 
    if (await confirmationCloseButton.isVisible({ timeout: 2000 }).catch(() => false)) { 
      await confirmationCloseButton.click({ force: true }); 
      await page.waitForLoadState('domcontentloaded'); 
    } 
  } 

  const sub = 'sub' in item ? item.sub : undefined; 
  const nested = 'nested' in item ? item.nested : undefined; 
  try { 
    await selectMenuItem(page, item.menu, sub, nested); 
  } catch (error) { 
    if (itemKey === 'businessSingleWire') { 
      const fallback = MENU_ITEMS.oneTimeWire; 
      await selectMenuItem(page, fallback.menu, fallback.sub, fallback.nested); 
      return; 
    } 
    if (itemKey === 'businessWireActivity') { 
      const fallback = MENU_ITEMS.wireActivityAlt; 
      await selectMenuItem(page, fallback.menu, fallback.sub, fallback.nested); 
      return; 
    } 
    throw error; 
  } 
} 

/**
 * (English): Maps user-information navigation keys to their target link labels and optional submenus.
 * (Bangla): User Info navigation key-গুলোকে গন্তব্য link label ও ঐচ্ছিক submenu-এর সঙ্গে মিলিয়ে রাখে।
 */
export const USER_INFO_ITEMS = { 
  emailAddress:       { link: /Change Email Address|Contact Information/i, sub: 'Profile' }, 
  userId:             { link: 'User ID', sub: 'Profile' }, 
  password:           { link: 'Password', sub: 'Profile' }, 
  phoneNumber:        { link: 'Phone Number', sub: 'Profile' }, 
  securityQuestions:  { link: 'Security Questions', sub: 'Profile' }, 
  contactInformation: { link: 'Contact Information', sub: 'Profile' }, 
  languageSettings:       { link: /Language Settings|Language|Idioma/i, sub: 'Settings' }, 
  authorizedDevices:      { link: /Manage Authorized Devices|Authorized Biometric Devices|Biometric Authentication/i, sub: 'Settings' }, 
  quickBalanceSettings:   { link: /Quick Balance Settings|Fast Balances/i, sub: 'Settings' }, 
  textMessageBanking:     { link: /Text Message Banking Phone List|Text Banking/i, sub: 'Settings' }, 
  myAlerts:               { link: /My Alerts|Alerts/i, sub: 'Settings' }, 
  secureForms:            { link: 'Secure Forms', sub: 'Settings' }, 
  authorizedApps:         { link: 'Authorized Apps', sub: 'Settings' }, 
  alerts:                 { link: 'Alerts', sub: 'Settings' }, 
  advancedAlerts:         { link: 'Alerts', sub: 'Settings' }, 
  acceptedDisclosures:    { link: /Documents|Accepted Disclosures/i, sub: 'Settings' }, 
  userActivity:           { link: 'User Activity', sub: 'Settings' }, 
  mobileDevices:          { link: 'Mobile Devices', sub: 'Profile' }, 
  messageCenter:      { link: 'Message Center' }, 
  emailMessageCenter: { link: /email Message Center|Messages/i }, 
  messages:           { link: 'Messages' }, 
} as const; 

export type UserInfoItemKey = keyof typeof USER_INFO_ITEMS; 

/**
 * (English): Resolves a user-information menu key and navigates to its configured destination.
 * (Bangla): User Info menu key খুঁজে কনফিগার করা গন্তব্যে নেভিগেট করে।
 */
export async function navigateToUserInfoMenu(page: Page, itemKey: UserInfoItemKey | (string & {})): Promise<void> { 
  const item = USER_INFO_ITEMS[itemKey as UserInfoItemKey]; 
  if (!item) throw new Error(`navigateToUserInfoMenu: unknown key "${itemKey}". Add it to USER_INFO_ITEMS in CommonFunctions.ts`); 
  const sub = 'sub' in item ? (item as { link: string | RegExp; sub: string }).sub : undefined; 
  await selectUserInfoMenuItem(page, item.link, sub); 
} 

/**
 * (English): Navigates by a key from either menu map, trying configured fallbacks before reporting failure.
 * (Bangla): দুই menu map-এর যেকোনো key দিয়ে নেভিগেট করে; ব্যর্থ হলে error দেওয়ার আগে নির্ধারিত fallback চেষ্টা করে।
 */
export async function navigateByKey(page: Page, key: string): Promise<void> { 
  if (key in MENU_ITEMS) { 
    try { 
      await navigateToMenu(page, key as MenuItemKey); 
      return; 
    } catch (error) { 
      const fallbackMenuKeys: Partial<Record<MenuItemKey, MenuItemKey[]>> = { 
        stopPayment: ['stopPaymentNested', 'stopPaymentsStopPay'], 
      }; 
      const fallbacks = fallbackMenuKeys[key as MenuItemKey] ?? []; 
      for (const fallbackKey of fallbacks) { 
        try { 
          await navigateToMenu(page, fallbackKey); 
          return; 
        } catch { /* Continue trying next fallback key */ } 
      } 
      throw error; 
    } 
  } else if (key in USER_INFO_ITEMS) { 
    await navigateToUserInfoMenu(page, key as UserInfoItemKey); 
  } else { 
    throw new Error(`navigateByKey: key "${key}" not found in MENU_ITEMS or USER_INFO_ITEMS. Add it to CommonFunctions.ts`); 
  } 
} 

/**
 * (English): Defines the shared temporary JSON file path used to pass runtime key-value data between test processes.
 * (Bangla): টেস্ট প্রক্রিয়াগুলোর মধ্যে runtime key-value data আদান-প্রদানের জন্য ব্যবহৃত shared temporary JSON file-এর path নির্ধারণ করে।
 */
const TEMP_FILE_PATH = path.resolve(__dirname, '../../Temp/TempFileRuntimeValue.txt'); 
  
/**
 * (English): Saves a runtime value by key, preserving other values already stored in the temporary JSON file.
 * (Bangla): temporary JSON file-এ key অনুযায়ী runtime value লেখে এবং আগের অন্য value-গুলো অক্ষত রাখে।
 */
export function writeRuntimeValueToTempFile(key: string, value: string): void { 
  const dir = path.dirname(TEMP_FILE_PATH); 
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); 
  let existing: Record<string, string> = {}; 
  if (fs.existsSync(TEMP_FILE_PATH)) { 
    try { existing = JSON.parse(fs.readFileSync(TEMP_FILE_PATH, 'utf-8')); } catch { existing = {}; } 
  } 
  existing[key] = value; 
  fs.writeFileSync(TEMP_FILE_PATH, JSON.stringify(existing, null, 2)); 
} 

/**
 * (English): Reads a runtime value by key; returns null when the file, key, or valid JSON is unavailable.
 * (Bangla): key অনুযায়ী runtime value পড়ে; file, key বা সঠিক JSON না থাকলে null ফেরত দেয়।
 */
export function readRuntimeValueFromTempFile(key: string): string | null { 
  if (!fs.existsSync(TEMP_FILE_PATH)) return null; 
  try { 
    const data = JSON.parse(fs.readFileSync(TEMP_FILE_PATH, 'utf-8')); 
    return data[key] ?? null; 
  } catch { 
    return null; 
  } 
} 

/**
 * (English): Converts a minute value to milliseconds and adds the supplied buffer duration.
 * (Bangla): মিনিটের মানকে millisecond-এ রূপান্তর করে তার সঙ্গে দেওয়া buffer সময় যোগ করে।
 */
export function calculateTimeoutMs(minutes: string, bufferMs = 120_000): number { 
  const waitMs = parseInt(minutes || '0', 10) * 60 * 1000; 
  return waitMs + bufferMs; 
}