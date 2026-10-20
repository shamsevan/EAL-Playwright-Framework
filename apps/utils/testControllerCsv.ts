/* 
 * Author: EAL IT Solutions Automation Team
 * Description: Master TestController CSV theke data read kore Playwright ke instruct kore kon test gulo cholbe.
 */

import path from 'path';
import { readCSVFile } from './csvReader';

/**
 * (English - TestControllerRow): Defines the columns expected in a test-controller CSV row.
 * Execute and SpecFileName determine which spec files run; testCaseID identifies a case,
 * while the optional columns provide test-plan, suite, status, note, and assignment details.
 *
 * (Bangla - TestControllerRow): test-controller CSV-এর একটি row-তে থাকা column-গুলোর structure নির্ধারণ করে।
 * Execute ও SpecFileName দিয়ে কোন spec file চলবে তা ঠিক হয়, testCaseID test case শনাক্ত করে,
 * আর optional column-গুলোতে test plan, suite, status, note ও assignment-এর তথ্য থাকতে পারে।
 */
export interface TestControllerRow {
  Execute: string;
  testCaseID: string;
  testDescription: string;
  Module: string;
  SpecFileName: string;
  TotalSpecFileTestCases?: string;
  TestPlanID?: string;
  SuiteID?: string;
  Status?: string;
  Note?: string;
  'Assigned To'?: string;
}

/**
 * @description
 * (English - isDirectSpecRun): Checks command-line arguments after the script name for a .spec.ts
 * or .spec.js file argument. Returns true when a spec file was passed directly; otherwise returns false.
 *
 * (Bangla - isDirectSpecRun): script name-এর পরের command-line argument-গুলোতে .spec.ts বা .spec.js
 * file দেওয়া হয়েছে কি না দেখে। সরাসরি spec file দেওয়া থাকলে true, না থাকলে false ফেরত দেয়।
 */
export function isDirectSpecRun(): boolean {
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (arg.toLowerCase().endsWith('.spec.ts') || arg.toLowerCase().endsWith('.spec.js')) {
      return true;
    }
  }
  return false;
}

/**
 * @description
 * (English - getExecutableTestMatchPatterns): Reads the CSV configured by TEST_CONTROLLER and builds
 * Playwright glob patterns for each non-empty SpecFileName on rows whose Execute value is Y.
 * Returns undefined when no controller path or active rows are available, or when reading the CSV fails.
 *
 * (Bangla - getExecutableTestMatchPatterns): TEST_CONTROLLER-এ নির্ধারিত CSV পড়ে Execute-এর মান Y
 * এমন row-গুলোর non-empty SpecFileName থেকে Playwright glob pattern তৈরি করে।
 * controller path বা active row না থাকলে, কিংবা CSV পড়তে ব্যর্থ হলে undefined ফেরত দেয়।
 */
export function getExecutableTestMatchPatterns(): string[] | undefined {
  const controllerPath = process.env.TEST_CONTROLLER;
  if (!controllerPath) return undefined;

  try {
    const data = readCSVFile<TestControllerRow>(controllerPath);
    const activeRows = data.filter(row => row.Execute && row.Execute.trim().toUpperCase() === 'Y');

    if (activeRows.length === 0) return undefined;

    const specFiles = new Set<string>();
    for (const row of activeRows) {
      const specName = (row.SpecFileName || '').trim();
      if (specName) {
        specFiles.add(`**/${specName}.spec.ts`);
        specFiles.add(`**/${specName}.spec.js`);
      }
    }

    return Array.from(specFiles);
  } catch (error) {
    console.warn(`\x1b[33m[EAL-Warning] Controller CSV read korte pareni: ${error}\x1b[0m`);
    return undefined;
  }
}

/**
 * @description
 * (English - getExecutableTestCaseGrep): Reads TEST_CONTROLLER and creates a regular expression
 * matching the escaped, non-empty testCaseID values on rows where Execute is Y.
 * Returns undefined when no controller path, active rows, or usable IDs are available, or when CSV reading fails.
 *
 * (Bangla - getExecutableTestCaseGrep): TEST_CONTROLLER-এর CSV থেকে Execute-এর মান Y এমন row-গুলোর
 * non-empty testCaseID নিয়ে escaped regular expression তৈরি করে।
 * controller path, active row বা ব্যবহারযোগ্য ID না থাকলে, কিংবা CSV পড়তে ব্যর্থ হলে undefined ফেরত দেয়।
 */
export function getExecutableTestCaseGrep(): RegExp | undefined {
  const controllerPath = process.env.TEST_CONTROLLER;
  if (!controllerPath) return undefined;

  try {
    const data = readCSVFile<TestControllerRow>(controllerPath);
    const activeRows = data.filter(row => row.Execute && row.Execute.trim().toUpperCase() === 'Y');

    if (activeRows.length === 0) return undefined;

    const testCaseIds = activeRows
      .map(row => (row.testCaseID || '').trim())
      .filter(id => id.length > 0)
      .map(id => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); 

    if (testCaseIds.length === 0) return undefined;

    return new RegExp(`(${testCaseIds.join('|')})`);
  } catch (error) {
    return undefined;
  }
}

/**
 * @description
 * (English - getTestCasesByGroup): Returns rows from TEST_CONTROLLER whose trimmed SpecFileName
 * matches the requested spec name and whose Execute value is Y.
 * Returns an empty array when TEST_CONTROLLER is unset or the CSV cannot be read.
 *
 * (Bangla - getTestCasesByGroup): TEST_CONTROLLER-এর CSV থেকে যেসব row-এর trim করা SpecFileName
 * দেওয়া spec name-এর সঙ্গে মেলে এবং Execute-এর মান Y, সেগুলো ফেরত দেয়।
 * TEST_CONTROLLER নির্ধারিত না থাকলে বা CSV পড়া না গেলে খালি array ফেরত দেয়।
 */
export function getTestCasesByGroup(specFileName: string): TestControllerRow[] {
  const controllerPath = process.env.TEST_CONTROLLER;
  if (!controllerPath) return [];

  try {
    const data = readCSVFile<TestControllerRow>(controllerPath);
    return data.filter(row =>
      row.Execute && row.Execute.trim().toUpperCase() === 'Y' &&
      row.SpecFileName && row.SpecFileName.trim() === specFileName.trim()
    );
  } catch (error) {
    return [];
  }
}