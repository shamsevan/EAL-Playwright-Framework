/* 
 * Author: EAL IT Solutions Automation Team 
 * Created (yyyy-mm-dd): 2026-07-15 
 * Description: Dedupe test-controller CSV rows with priority rules. 
 */ 

import fs from 'fs'; 
import path from 'path'; 
import { parse } from 'csv-parse/sync'; 

/**
 * (English - ROOT): Captures the current working directory as the base for resolving controller CSV paths.
 * (Bangla - ROOT): controller CSV file-এর path resolve করার base হিসেবে বর্তমান working directory রাখে।
 */
const ROOT = process.cwd(); 

/**
 * (English - CONTROLLERS): Lists the controller CSV files to process, the duplicate key used for each,
 * and the function that builds that key from a row.
 * (Bangla - CONTROLLERS): যে controller CSV-গুলো process হবে, প্রতিটির duplicate key এবং row থেকে
 * সেই key তৈরি করার function-এর তথ্য রাখে।
 */
const CONTROLLERS = [ 
  { 
    path: 'apps/test-controllers/RegressionTestController.csv', 
    keyMode: 'testCaseID+SpecFileName', 
    keySelector: (row) => `${normalize(row.testCaseID)}\u001F${normalize(row.SpecFileName)}`, 
  }, 
  { 
    path: 'apps/test-controllers/Pipeline_RegressionTestController.csv', 
    keyMode: 'testCaseID', 
    keySelector: (row) => normalize(row.testCaseID), 
  }, 
]; 

/**
 * (English - CHECK_ONLY): Enables validation mode when the command includes --check; this mode reports
 * duplicate keys but does not rewrite the CSV files.
 * (Bangla - CHECK_ONLY): command-এ --check থাকলে validation mode চালু করে; এই mode duplicate key জানায়,
 * কিন্তু CSV file-এ কোনো পরিবর্তন লেখে না।
 */
const CHECK_ONLY = process.argv.includes('--check'); 

/**
 * (English - normalize): Converts a value to trimmed text, treating null and undefined as an empty string.
 * (Bangla - normalize): value-কে string-এ রূপান্তর করে চারপাশের whitespace বাদ দেয়; null বা undefined হলে খালি string দেয়।
 */
function normalize(value) { 
  return (value ?? '').toString().trim(); 
} 

/**
 * (English - isBlank): Checks whether a value is nullish, empty, or contains only surrounding whitespace.
 * (Bangla - isBlank): value nullish, খালি, অথবা trim করার পর খালি কি না যাচাই করে।
 */
function isBlank(value) { 
  return normalize(value) === ''; 
} 

/**
 * (English - hasMojibake): Detects selected text patterns that indicate garbled character encoding.
 * (Bangla - hasMojibake): encoding সমস্যায় লেখা বিকৃত হওয়ার পরিচিত কয়েকটি pattern আছে কি না পরীক্ষা করে।
 */
function hasMojibake(text) { 
  const v = normalize(text); 
  return v.includes('???') || v.includes('ΓÇö') || v.includes('∩┐╜'); 
} 

/** 
 * @description
 * (English - rowScore): Assigns a priority score to a controller row using its status, note, execute flag,
 * description encoding, and available metadata. A higher-scoring row is preferred when duplicates are removed.
 * 
 * (Bangla - rowScore): row-এর status, note, execute flag, description-এর encoding এবং metadata দেখে
 * priority score দেয়। duplicate সরানোর সময় বেশি score পাওয়া row-টিকে অগ্রাধিকার দেওয়া হয়।
 */
function rowScore(row) { 
  let score = 0; 

  const status = normalize(row.Status).toLowerCase(); 
  const note = normalize(row.Note).toLowerCase(); 
  const execute = normalize(row.Execute).toUpperCase(); 

  // Highest priority: keep Passed + Done first. 
  if (status === 'passed') score += 200; 
  if (note === 'done') score += 150; 

  // Lower priority candidates: blank status/note and Execute=N. 
  if (isBlank(row.Status)) score -= 80; 
  if (isBlank(row.Note)) score -= 60; 
  if (execute === 'Y') score += 40; 
  if (execute === 'NA') score += 10; 
  if (execute === 'N') score -= 20; 

  // Prefer cleaner text when duplicates have encoding-garbled descriptions. 
  if (hasMojibake(row.testDescription)) score -= 15; 

  // Keep richer metadata when available. 
  if (!isBlank(row.TestPlanID)) score += 5; 
  if (!isBlank(row.SuiteID)) score += 5; 

  return score; 
} 

/** 
 * @description
 * (English - dedupeRows): Groups rows by the supplied key and returns one preferred row per key.
 * The highest score wins; if scores tie, the earlier row is retained.
 * (Bangla - dedupeRows): দেওয়া key অনুযায়ী row-গুলো group করে প্রতি key-এর জন্য একটি অগ্রাধিকারপ্রাপ্ত row ফেরত দেয়।
 * সর্বোচ্চ score জেতে; score সমান হলে আগের row-টি রাখা হয়।
 */
function dedupeRows(rows, keySelector) { 
  const byKey = new Map(); 
  const keyOrder = []; 

  for (let i = 0; i < rows.length; i++) { 
    const row = rows[i]; 
    const key = keySelector(row); 
    const candidate = { row, score: rowScore(row), index: i }; 

    if (!byKey.has(key)) { 
      byKey.set(key, candidate); 
      keyOrder.push(key); 
      continue; 
    } 

    const current = byKey.get(key); 
    if (candidate.score > current.score) { 
      byKey.set(key, candidate); 
      continue; 
    } 

    if (candidate.score === current.score) { 
      // Stable tie-break: keep the earlier row. 
      if (candidate.index < current.index) { 
        byKey.set(key, candidate); 
      } 
    } 
  } 

  return keyOrder.map((key) => byKey.get(key).row); 
} 

/**
 * (English - toCsv): Serializes rows using the supplied header order and escapes values containing quotes,
 * commas, or line breaks so the result can be written as CSV.
 * (Bangla - toCsv): দেওয়া header-এর ক্রমে row-গুলো CSV-তে রূপান্তর করে এবং quote, comma বা line break থাকা
 * value-গুলো escape করে, যাতে ফলাফলটি বৈধ CSV হিসেবে লেখা যায়।
 */
function toCsv(rows, headers) { 

  /**
   * (English - escapeField): Converts one field to text and quotes/escapes it only when CSV syntax requires it.
   * (Bangla - escapeField): একটি field-কে text-এ রূপান্তর করে এবং CSV syntax অনুযায়ী প্রয়োজন হলে quote বা escape করে।
   */
  const escapeField = (value) => { 
    const raw = (value ?? '').toString(); 
    if (raw.includes('"')) { 
      const escaped = raw.replace(/"/g, '""'); 
      return `"${escaped}"`; 
    } 
    if (raw.includes(',') || raw.includes('\n') || raw.includes('\r')) { 
      return `"${raw}"`; 
    } 
    return raw; 
  }; 

  const lines = []; 
  lines.push(headers.join(',')); 
  for (const row of rows) { 
    lines.push(headers.map((h) => escapeField(row[h])).join(',')); 
  } 
  return `${lines.join('\n')}\n`; 
} 

/**
 * (English - parseCsv): Reads and parses a controller CSV with tolerant quote/column settings, returning
 * its rows and headers; supplies the expected controller columns when the file has no data rows.
 * (Bangla - parseCsv): tolerant quote/column setting দিয়ে controller CSV পড়ে parse করে rows ও headers ফেরত দেয়;
 * file-এ data row না থাকলে প্রত্যাশিত controller column-গুলো ব্যবহার করে।
 */
function parseCsv(filePath) { 
  const text = fs.readFileSync(filePath, 'utf8'); 
  const rows = parse(text, { 
    columns: true, 
    skip_empty_lines: true, 
    bom: true, 
    relax_quotes: true, 
    relax_column_count: true, 
  }); 

  const headers = rows.length > 0 
    ? Object.keys(rows[0]) 
    : [ 
        'Execute', 
        'testCaseID', 
        'testDescription', 
        'Module', 
        'SpecFileName', 
        'TotalSpecFileTestCases', 
        'TestPlanID', 
        'SuiteID', 
        'Status', 
        'Note', 
      ]; 

  return { rows, headers }; 
} 

/**
 * (English - summarizeActualCount): Counts distinct non-empty test case IDs and distinct ID/description pairs
 * in the supplied rows for the summary printed after deduplication.
 * (Bangla - summarizeActualCount): dedupe-এর পর summary দেখানোর জন্য non-empty test case ID এবং
 * ID/description pair-এর distinct সংখ্যা গণনা করে।
 */
function summarizeActualCount(rows) { 
  const byTestId = new Set(); 
  const byIdAndDesc = new Set(); 

  for (const row of rows) { 
    const id = normalize(row.testCaseID); 
    const desc = normalize(row.testDescription); 
    if (id) byTestId.add(id); 
    if (id || desc) byIdAndDesc.add(`${id}\u001F${desc}`); 
  } 

  return { 
    uniqueTestCaseIds: byTestId.size, 
    uniqueIdDescriptionPairs: byIdAndDesc.size, 
  }; 
} 

/**
 * (English - execution totals): Accumulates the number of rows removed and duplicate-key groups found
 * across all configured controller files.
 * (Bangla - execution totals): সব configured controller file মিলিয়ে কত row সরানো হয়েছে এবং
 * কতটি duplicate-key group পাওয়া গেছে তার মোট হিসাব রাখে।
 */
let totalRemoved = 0; 
let totalDuplicateGroupsBefore = 0; 

/**
 * (English - controller processing loop): Resolves and reads each configured controller file, counts duplicate
 * keys, deduplicates rows, optionally writes the cleaned CSV, and prints per-file counts. Missing files are skipped.
 * (Bangla - controller processing loop): প্রতিটি configured controller file-এর path resolve করে file পড়ে,
 * duplicate key গোনে, row dedupe করে, প্রয়োজনমতো পরিষ্কার CSV লেখে এবং file-ভিত্তিক হিসাব দেখায়।
 * file না থাকলে সেটি skip করে।
 */
for (const relPath of CONTROLLERS) { 
  const filePath = path.resolve(ROOT, relPath.path); 
  
  // Skip gracefully if the controller file doesn't exist yet (for initial setup)
  if (!fs.existsSync(filePath)) {
    console.log(`[EAL-Warning] Controller not found (Skipping): ${relPath.path}`);
    continue;
  }

  const { rows, headers } = parseCsv(filePath); 

  const groups = new Map(); 
  for (const row of rows) { 
    const key = relPath.keySelector(row); 
    groups.set(key, (groups.get(key) ?? 0) + 1); 
  } 

  const duplicateGroupsBefore = [...groups.values()].filter((c) => c > 1).length; 
  totalDuplicateGroupsBefore += duplicateGroupsBefore; 

  const deduped = dedupeRows(rows, relPath.keySelector); 
  const removed = rows.length - deduped.length; 
  totalRemoved += removed; 

  if (!CHECK_ONLY && removed > 0) { 
    fs.writeFileSync(filePath, toCsv(deduped, headers), 'utf8'); 
  } 

  const counts = summarizeActualCount(deduped); 

  console.log(`\n[${relPath.path}]`); 
  console.log(`  dedupe_key_mode=${relPath.keyMode}`); 
  console.log(`  rows_before=${rows.length}`); 
  console.log(`  rows_after=${deduped.length}`); 
  console.log(`  removed=${removed}`); 
  console.log(`  duplicate_groups_before=${duplicateGroupsBefore}`); 
  console.log(`  actual_unique_testCaseID=${counts.uniqueTestCaseIds}`); 
  console.log(`  actual_unique_testCaseID_and_description=${counts.uniqueIdDescriptionPairs}`); 
} 

/**
 * (English - check-mode result): In --check mode, exits with status 1 when duplicates exist, or status 0
 * when all configured files have unique controller keys.
 * (Bangla - check-mode result): --check mode-এ duplicate থাকলে exit status 1 দেয়; সব configured file-এ
 * controller key unique হলে exit status 0 দিয়ে সফলতা জানায়।
 */
if (CHECK_ONLY) { 
  if (totalDuplicateGroupsBefore > 0) { 
    console.error(`\n[EAL-Error] Duplicate controller keys found: ${totalDuplicateGroupsBefore} group(s). Run: node apps/utils/dedupeTestControllers.mjs`); 
    process.exit(1); 
  } 

  console.log('\n[EAL-Success] No duplicate controller keys found.'); 
  process.exit(0); 
} 

/**
 * (English - final summary): Prints the total number of rows removed after normal deduplication completes.
 * This summary is not printed in --check mode because that mode exits above.
 * (Bangla - final summary): স্বাভাবিক dedupe শেষ হলে মোট কতটি row সরানো হয়েছে তা দেখায়।
 * --check mode-এ এর আগে exit হওয়ায় এই summary দেখানো হয় না।
 */
console.log(`\nTotal rows removed=${totalRemoved}`); 