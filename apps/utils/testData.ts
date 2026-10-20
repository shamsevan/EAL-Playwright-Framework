/* 
 * Author: EAL IT Solutions Automation Team
 * Description: Global test data lookup utility.
 */ 

import path from 'path'; 
import { readCSVFile } from './csvReader'; 

/**
 * (English - TestDataRow): Defines the CSV columns for a UI page, test-data name and value, data type,
 * where to find the value, its test-case usage, and the navigation method.
 * (Bangla - TestDataRow): UI page, test-data name ও value, data type, value কোথায় পাওয়া যাবে,
 * কোন test case-এ ব্যবহৃত এবং সেখানে যাওয়ার পদ্ধতি—CSV-র এই কলামগুলোর type নির্ধারণ করে।
 */
interface TestDataRow { 
  'Ui Page Title': string; 
  'TestData Name': string; 
  'TestData Value': string; 
  'Static / Dynamic': string; 
  'Note - Where to Find': string; 
  'TC ID used in': string; 
  'Possible Navigation Method to that variable': string; 
} 

/**
 * (English - cache): Stores the parsed key/value map for each CSV file so the same file is not loaded repeatedly.
 * (Bangla - cache): প্রতিটি CSV file-এর parsed key/value map সংরক্ষণ করে, যাতে একই file বারবার load করতে না হয়।
 */
const cache = new Map<string, Map<string, string>>(); 

/**
 * (English - editDistance): Calculates how many single-character insertions, deletions, or substitutions
 * are needed to transform one string into another; this supports spelling suggestions for missing keys.
 * (Bangla - editDistance): একটি string-কে অন্য string-এ রূপান্তর করতে কতটি অক্ষর যোগ, বাদ বা বদলাতে হয়
 * তা হিসাব করে; missing key-এর বানান-সাজেশন তৈরিতে এই হিসাব কাজে লাগে।
 */
function editDistance(a: string, b: string): number { 
  const rows = a.length + 1; 
  const cols = b.length + 1; 
  const dist: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0)); 
  for (let i = 0; i < rows; i++) dist[i][0] = i; 
  for (let j = 0; j < cols; j++) dist[0][j] = j; 
  for (let i = 1; i < rows; i++) { 
    for (let j = 1; j < cols; j++) { 
      const cost = a[i - 1] === b[j - 1] ? 0 : 1; 
      dist[i][j] = Math.min(dist[i - 1][j] + 1, dist[i][j - 1] + 1, dist[i - 1][j - 1] + cost); 
    } 
  } 
  return dist[a.length][b.length]; 
} 

/**
 * (English - findClosestNames): Sorts candidate keys by case-insensitive spelling distance and returns
 * up to limit close matches as suggestions for a key that was not found.
 * (Bangla - findClosestNames): অক্ষরের বড়-ছোট পার্থক্য উপেক্ষা করে candidate key-গুলোকে বানানের মিল অনুযায়ী সাজায়
 * এবং না-পাওয়া key-এর জন্য কাছাকাছি সর্বোচ্চ limit সংখ্যক নাম সাজেস্ট করে।
 */
function findClosestNames(target: string, candidates: string[], limit = 3): string[] { 
  const lowerTarget = target.toLowerCase(); 
  return candidates 
    .map(name => ({ name, distance: editDistance(lowerTarget, name.toLowerCase()) })) 
    .sort((a, b) => a.distance - b.distance) 
    .filter(entry => entry.distance <= Math.max(3, Math.ceil(target.length * 0.4))) 
    .slice(0, limit) 
    .map(entry => entry.name); 
} 

/**
 * (English - getCallerLocation): Reads the error stack and returns the first source location outside this file,
 * helping identify which test or helper requested a missing value.
 * (Bangla - getCallerLocation): error stack থেকে এই file-এর বাইরের প্রথম source location বের করে,
 * যাতে missing value কোন test বা helper থেকে চাওয়া হয়েছে তা জানা যায়।
 */
function getCallerLocation(): string { 
  const stack = new Error().stack ?? ''; 
  const lines = stack.split('\n').slice(1); 
  for (const line of lines) { 
    if (line.includes('testData.ts')) continue; 
    // FIXED: Corrected the regex from (?:ts\vert{}js) to (?:ts|js)
    const match = line.match(/\(?([^(]+\.(?:ts\vert{}js):\d+:\d+)\)?\s*$/); 
    if (match && match[1]) return match[1].trim(); 
  } 
  return 'unknown location'; 
} 

/**
 * (English - loadCsv): Reads the named CSV from apps/test-data, maps each non-empty TestData Name
 * to its trimmed TestData Value, and caches the map for subsequent calls.
 * (Bangla - loadCsv): apps/test-data থেকে নির্দিষ্ট CSV পড়ে, non-empty TestData Name-এর সঙ্গে trim করা
 * TestData Value map করে এবং পরের call-গুলোর জন্য map-টি cache করে।
 */
function loadCsv(fileName: string): Map<string, string> { 
  const cached = cache.get(fileName); 
  if (cached) return cached; 

  const csvPath = path.resolve(process.cwd(), `apps/test-data/${fileName}`); 
  const rows = readCSVFile<TestDataRow>(csvPath); 

  const map = new Map<string, string>(); 
  for (const row of rows) { 
    const name = row['TestData Name']?.trim(); 
    const value = row['TestData Value']?.trim() ?? ''; 
    if (name) map.set(name, value); 
  } 
  cache.set(fileName, map); 
  console.log(`\x1b[32m[EAL-TestData] Loaded ${map.size} variables from ${fileName}\x1b[0m`); 
  return map; 
} 

/**
 * @description
 * (English - lookupValue): Looks up a test-data name in the specified CSV file. If the name is missing,
 * it logs the calling location, suggests similar names when available, and throws an error.
 * 
 * (Bangla - lookupValue): নির্দিষ্ট CSV file-এ test-data name খোঁজে। নামটি না পেলে কোন location থেকে
 * চাওয়া হয়েছে তা log করে, কাছাকাছি নাম থাকলে সাজেস্ট করে এবং error throw করে।
 */
function lookupValue(fileName: string, variableName: string): string { 
  const map = loadCsv(fileName); 
  const value = map.get(variableName); 
  if (value === undefined) { 
    const caller = getCallerLocation(); 
    const suggestions = findClosestNames(variableName, Array.from(map.keys())); 
    const didYouMean = suggestions.length > 0 
      ? `Did you mean: ${suggestions.map(s => `"${s}"`).join(', ')}?` 
      : 'No similar variable names found.'; 

    const message = 
      `\n============================ TEST DATA LOOKUP FAILED ============================\n` + 
      `  Variable   : "${variableName}"\n` + 
      `  In file    : ${fileName}\n` + 
      `  Called from : ${caller}\n` + 
      `  ${didYouMean}\n` + 
      `  Fix: correct the variable name in the caller, or add "${variableName}" to ${fileName}.\n` + 
      `================================================================================\n`; 

    console.error(`\x1b[31m${message}\x1b[0m`); 
    throw new Error(`[EAL-TestData] Variable "${variableName}" not found in ${fileName} (called from ${caller}). ${didYouMean}`); 
  } 
  return value; 
} 

/**
 * @description
 * (English): Pulls a specific piece of data from the SmokeTestData.csv file.
 * (Bangla): SmokeTestData.csv ফাইল থেকে কাঙ্ক্ষিত ডেটা (যেমন: ইউজারনেম বা অ্যাকাউন্টের নাম) টেনে আনে।
 */
export function smokeTestData(variableName: string): string { 
  return lookupValue('SmokeTestData.csv', variableName); 
} 

/**
 * @description
 * (English): Pulls a specific piece of data from the CustomizationTestData.csv file.
 * (Bangla): CustomizationTestData.csv ফাইল থেকে কাঙ্ক্ষিত ডেটা টেনে আনে।
 */
export function customizationTestData(variableName: string): string { 
  return lookupValue('CustomizationTestData.csv', variableName); 
}