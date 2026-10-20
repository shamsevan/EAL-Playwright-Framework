#!/usr/bin/env node 

/* 
 * Author: EAL IT Solutions Automation Team
 * 
 * @description
 * (English): 
 * This is the Master Test Runner. Think of it as the "Manager" of our tests. 
 * Instead of running tests blindly, it first checks WHAT to run based on a CSV file 
 * (TestController.csv) where we set Execute=Y or N. It can also run a single test file directly if asked.
 * 
 * (Bangla): 
 * এটি আমাদের টেস্ট রানার বা টেস্টের "ম্যানেজার"। অন্ধের মতো সব টেস্ট রান না করে, এটি 
 * প্রথমে TestController.csv ফাইল পড়ে সিদ্ধান্ত নেয় কোন টেস্টগুলো (যেগুলোতে Execute=Y দেওয়া আছে) 
 * রান করতে হবে। আবার চাইলে এটি নির্দিষ্ট একটি টেস্ট ফাইলও সরাসরি রান করতে পারে।
 */ 

import 'dotenv/config'; 
import { spawnSync } from 'node:child_process'; 
import fs from 'node:fs'; 
import path from 'node:path'; 
import { fileURLToPath } from 'node:url'; 

const __dirname = path.dirname(fileURLToPath(import.meta.url)); 

/** 
 * @description
 * (English): Cleans up temporary junk files. Sometimes older test runs leave behind 
 * temporary text files. This function deletes them automatically so our workspace stays clean.
 * 
 * (Bangla): আগের টেস্ট রান করার পর যে অপ্রয়োজনীয় টেক্সট ফাইল বা আবর্জনা (junk) তৈরি হয়, 
 * এটি সেগুলো মুছে ফেলে আমাদের প্রজেক্ট ফোল্ডার পরিষ্কার রাখে।
 */ 
function cleanTransientTextOutputs() { 
  const workspaceRoot = path.resolve(__dirname, '../..'); 
  const patterns = [ 
    /^test-output.*healed.*\.txt$/i, 
    /^test-output.*spanish.*\.txt$/i, 
    /^test.*spanish.*final.*\.txt$/i, 
    /^test-outpute.*healed.*\.txt$/i, 
  ]; 

  const files = fs.readdirSync(workspaceRoot, { withFileTypes: true }) 
    .filter(entry => entry.isFile()) 
    .map(entry => entry.name) 
    .filter(name => patterns.some(pattern => pattern.test(name))); 

  for (const name of files) { 
    const filePath = path.join(workspaceRoot, name); 
    try { 
      fs.unlinkSync(filePath); 
      console.log(`[run-tests] Removed transient file: ${name}`); 
    } catch (error) { 
      console.warn(`[run-tests] Could not remove transient file: ${name}`); 
    } 
  } 
} 

cleanTransientTextOutputs(); 

// Default controller is configured in .env via DEFAULT_TEST_CONTROLLER. 
// Falls back to RegressionTestController.csv when the env var is unset. 
const DEFAULT_CONTROLLER = (process.env.DEFAULT_TEST_CONTROLLER ?? '').trim() || 'RegressionTestController.csv'; 
const SEARCH_DIRS = ['../test-controllers', '../ManualQA-TestControllers']; 

// Minimal ANSI helpers for colored terminal text. 
const C = { 
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', 
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', 
  cyan: '\x1b[36m', gray: '\x1b[90m', 
}; 

/** 
 * @description
 * (English): Keeps the text colors (red for errors, green for success) visible in the terminal 
 * even when running inside automated pipelines like Jenkins or GitHub Actions.
 * 
 * (Bangla): আমরা যখন CI/CD বা পাইপলাইনে টেস্ট চালাই, তখন অনেক সময় লেখার রঙ (সাদাকালো হয়ে যায়) 
 * মুছে যায়। এটি নিশ্চিত করে যেন টার্মিনালে পাস হওয়া টেস্ট সবুজ এবং ফেইল হওয়া টেস্ট লাল রঙেই দেখায়।
 */ 
function withColorEnv(baseEnv) { 
  const nextEnv = { ...baseEnv }; 
  if (nextEnv.FORCE_COLOR !== '0') { 
    delete nextEnv.NO_COLOR; 
    if (!nextEnv.FORCE_COLOR) nextEnv.FORCE_COLOR = '3'; 
    if (!nextEnv.npm_config_color) nextEnv.npm_config_color = 'always'; 
    if (!nextEnv.CLICOLOR_FORCE) nextEnv.CLICOLOR_FORCE = '1'; 
    if (!nextEnv.PLAYWRIGHT_FORCE_TTY) nextEnv.PLAYWRIGHT_FORCE_TTY = '1'; 
  } 
  return nextEnv; 
} 

/** 
 * @description
 * (English): Searches for the CSV controller file. If the user types a name without ".csv", 
 * this function automatically adds it and finds the exact file path on the computer.
 * 
 * (Bangla): এটি কম্পিউটারে আমাদের CSV ফাইলটি খুঁজে বের করে। ইউজার যদি নামের শেষে '.csv' 
 * লিখতে ভুলেও যায়, এটি নিজে থেকেই তা যোগ করে ফাইলটি ঠিকমতো খুঁজে নেয়।
 */ 
function resolveController(name) { 
  if (/[\\/]/.test(name)) { 
    const abs = path.isAbsolute(name) ? name : path.resolve(process.cwd(), name); 
    return fs.existsSync(abs) ? abs : undefined; 
  } 
  const target = name.toLowerCase().endsWith('.csv') ? name : `${name}.csv`; 
  for (const dir of SEARCH_DIRS) { 
    const absDir = path.resolve(__dirname, dir); 
    if (!fs.existsSync(absDir)) continue; 
    const match = fs.readdirSync(absDir).find(file => file.toLowerCase() === target.toLowerCase()); 
    if (match) return path.join(absDir, match); 
  } 
  return undefined; 
} 

/** 
 * @description
 * (English): Acts as a traffic cop. It decides if the user wants to run a full CSV file 
 * (Controller Mode) or just one specific test script (Direct Spec Mode).
 * 
 * (Bangla): এটি ট্রাফিক পুলিশের মতো কাজ করে। ইউজারের দেওয়া কমান্ড দেখে সে বুঝে নেয় যে, 
 * ইউজার কি পুরো CSV ধরে অনেকগুলো টেস্ট রান করতে চাচ্ছে, নাকি সরাসরি কোনো একটি নির্দিষ্ট টেস্ট রান করতে চাচ্ছে।
 */ 
function isControllerArg(arg) { 
  if (!arg) return false; 
  if (/\.spec\.[tj]s$/i.test(arg)) return false;      
  if (arg.toLowerCase().endsWith('.csv')) return true; 
  if (/[\\/]/.test(arg)) return false;                 
  return Boolean(resolveController(arg));               
} 

/** 
 * @description
 * (English): Carefully reads one line of a CSV. It's smart enough to not split text 
 * if there is a comma inside quotation marks (e.g., "Dallas, Texas").
 * 
 * (Bangla): এটি CSV ফাইলের একটি লাইনকে নিখুঁতভাবে পড়ে। যদি কোনো লেখার ভেতর কমা (,) থাকে 
 * কিন্তু লেখাটি কোটেশনের ("") ভেতর থাকে, তবে সে এটিকে ভুল করে ভেঙে ফেলে না।
 */
function parseCsvLine(line) { 
  const cells = []; 
  let inQuote = false; 
  let cell = ''; 

  for (const ch of line) { 
    if (ch === '"') { 
      inQuote = !inQuote; 
    } else if (ch === ',' && !inQuote) { 
      cells.push(cell.trim()); 
      cell = ''; 
    } else { 
      cell += ch; 
    } 
  } 

  cells.push(cell.trim()); 
  return cells; 
} 

/** 
 * @description
 * (English): If you want to run a specific Test Case by its ID (e.g., TC-1234), 
 * this searches all CSVs to find out which test file actually contains that ID.
 * 
 * (Bangla): আপনি যদি কোনো নির্দিষ্ট টেস্ট কেস আইডি (যেমন: TC-123) দিয়ে টেস্ট রান করতে চান, 
 * তখন এটি সবগুলো CSV ফাইলে খুঁজে দেখে যে ওই আইডিটি আসলে কোন টেস্ট ফাইলের ভেতর আছে।
 */
function findGroupForTestCaseId(testCaseId) { 
  for (const dir of SEARCH_DIRS) { 
    const absDir = path.resolve(__dirname, dir); 
    if (!fs.existsSync(absDir)) continue; 

    const csvFiles = fs.readdirSync(absDir) 
      .filter(file => file.toLowerCase().endsWith('.csv')) 
      .sort(); 

    for (const file of csvFiles) { 
      const lines = fs.readFileSync(path.join(absDir, file), 'utf-8') 
        .replace(/\r\n/g, '\n') 
        .replace(/\r/g, '\n') 
        .split('\n') 
        .filter(Boolean); 

      if (lines.length < 2) continue; 

      const headers = parseCsvLine(lines[0]); 
      const testCaseIdIndex = headers.findIndex(header => header.toLowerCase() === 'testcaseid'); 
      const groupIndex = headers.findIndex(header => header.toLowerCase() === 'specfilename'); 
      if (testCaseIdIndex < 0 || groupIndex < 0) continue; 

      for (const line of lines.slice(1)) { 
        const cells = parseCsvLine(line); 
        if ((cells[testCaseIdIndex] ?? '').trim() !== testCaseId) continue; 

        const group = (cells[groupIndex] ?? '').trim(); 
        if (group) return group; 
      } 
    } 
  } 

  return null; 
} 

// Logic to determine what the user typed in the terminal
let firstArg = ''; 
const passthrough = []; 
for (const arg of process.argv.slice(2)) { 
  if (!firstArg && !arg.startsWith('-')) firstArg = arg; 
  else passthrough.push(arg); 
} 

const forcedTestCaseId = (process.env.FORCE_RUN_TC_IDS ?? '').trim(); 
if (forcedTestCaseId && !firstArg) { 
  const discoveredGroup = findGroupForTestCaseId(forcedTestCaseId); 
  if (!discoveredGroup) { 
    console.error(`\n[run-tests] FORCE_RUN_TC_IDS="${forcedTestCaseId}" not found in any controller CSV.\n`); 
    process.exit(1); 
  } 
  console.log(`[run-tests] Auto-discovered group "${discoveredGroup}" for TC ID "${forcedTestCaseId}"`); 
  firstArg = discoveredGroup; 
} 

const controllerMode = !firstArg || isControllerArg(firstArg); 

let env; 
let playwrightArgs; 

// Main Engine Execution Flow
if (controllerMode) { 
  const requested = firstArg || DEFAULT_CONTROLLER; 
  const resolved = resolveController(requested); 

  if (!resolved) { 
    console.error(`\n[run-tests] Controller "${requested}" not found.`); 
    console.error(`[run-tests] Searched: ${SEARCH_DIRS.join(', ')} (relative to apps/utils).`); 
    process.exit(1); 
  } 

  env = withColorEnv({ ...process.env, TEST_CONTROLLER: resolved, CONTROLLER_CLI: 'true' }); 
  playwrightArgs = ['playwright', 'test', ...passthrough]; 

  const brokenSpecs = printControllerExecutionPlan(resolved, env); 

  if (brokenSpecs.length > 0) { 
    env = { ...env, TEST_CONTROLLER_IGNORE_SPECS: brokenSpecs.join(',') }; 
    console.log(`${C.yellow}${C.bold}[run-tests] Excluding ${brokenSpecs.length} broken spec file(s) so the remaining Execute=Y tests can run:${C.reset}`); 
    console.log(`  ${C.dim}${brokenSpecs.join(', ')}${C.reset}\n`); 
  } 
} else { 
  console.log(`[run-tests] Direct spec run: "${firstArg}" (controller selection bypassed)`); 
  env = withColorEnv({ ...process.env, RUN_SPEC_DIRECTLY: 'true' }); 
  playwrightArgs = ['playwright', 'test', firstArg, ...passthrough]; 
} 

// This line actually starts the Playwright tests
const result = spawnSync('npx', playwrightArgs, { 
  stdio: 'inherit', 
  env, 
  shell: true, 
}); 

// Generate our beautiful HTML report after tests finish
generateAllTestResultsReport(); 

process.exit(resolveExitCodeFromPlaywrightResult(result.status)); 

/** 
 * @description
 * (English): Sometimes pipelines (like Jenkins) fail even if we intentionally skipped a test. 
 * This function double-checks the final result JSON to ensure we only report a real failure 
 * when something actually broke.
 * 
 * (Bangla): আমরা ইচ্ছা করে কোনো টেস্ট স্কিপ (Skip) করলে অনেক সময় জেনকিন্স বা গিটহাব একশন 
 * পুরো বিল্ড ফেইল করিয়ে দেয়। এটি ফাইনাল রেজাল্ট চেক করে নিশ্চিত করে যেন শুধুমাত্র আসল কোনো এরর 
 * হলেই পাইপলাইন ফেইল দেখায়।
 */ 
function resolveExitCodeFromPlaywrightResult(rawExitCode) { 
  if ((rawExitCode ?? 0) === 0) { 
    return 0; 
  } 

  const jsonPath = path.resolve(process.cwd(), 'test-results.json'); 
  if (!fs.existsSync(jsonPath)) { 
    return rawExitCode ?? 1; 
  } 

  try { 
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')); 
    const stats = data?.stats ?? {}; 
    const unexpected = Number(stats.unexpected ?? 0); 
    const reportErrors = Array.isArray(data?.errors) ? data.errors.length : 0; 

    if (unexpected === 0 && reportErrors === 0) { 
      console.log('[run-tests] Normalizing exit code to 0 (no unexpected failures in test-results.json).'); 
      return 0; 
    } 
  } catch (error) { 
    console.warn(`[run-tests] Could not evaluate test-results.json for exit normalization: ${error.message}`); 
  } 

  return rawExitCode ?? 1; 
} 

// --------------------------------------------------------------------------- 
// Pre-flight execution plan (Checking things BEFORE running)
// --------------------------------------------------------------------------- 

/** 
 * @description
 * (English): Reads all the data from our Master CSV file and organizes it row by row.
 * (Bangla): এটি আমাদের মাস্টার CSV ফাইলের সম্পূর্ণ ডেটা পড়ে এবং প্রতিটি লাইনকে সাজিয়ে গুছিয়ে মেমোরিতে রাখে।
 */ 
function readControllerRows(csvPath) { 
  const lines = fs.readFileSync(csvPath, 'utf-8') 
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n') 
    .split('\n').filter(Boolean); 
  if (lines.length < 2) return []; 
  const headers = parseCsvLine(lines[0]); 
  return lines.slice(1).map(line => { 
    const cells = parseCsvLine(line); 
    const row = {}; 
    headers.forEach((h, i) => { row[h] = (cells[i] ?? '').trim(); }); 
    return row; 
  }); 
} 

/** 
 * @description
 * (English): Looks at our computer folder and makes a list of all actual test files that exist.
 * (Bangla): এটি কম্পিউটারের ফোল্ডারে গিয়ে খুঁজে বের করে যে বাস্তবে আমাদের কাছে কী কী টেস্ট ফাইল আছে।
 */ 
function collectSpecFileNamesOnDisk(testDir) { 
  const names = new Set(); 
  if (!fs.existsSync(testDir)) return names; 
  const stack = [testDir]; 
  while (stack.length) { 
    const dir = stack.pop(); 
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { 
      const full = path.join(dir, entry.name); 
      if (entry.isDirectory()) stack.push(full); 
      else if (/\.spec\.ts$/i.test(entry.name)) names.add(entry.name.replace(/\.spec\.ts$/i, '')); 
    } 
  } 
  return names; 
} 

/** 
 * @description
 * (English): If a developer made a typing mistake in a code file, that file won't even open. 
 * This function detects exactly which file is broken so the rest of the tests can still run.
 * 
 * (Bangla): যদি কোনো ডেভেলপার কোড লিখতে গিয়ে স্পেলিং বা সিনট্যাক্স ভুল করে, তবে ওই ফাইলটি ওপেন 
 * হতে চাইবে না। এটি ঠিক সেই ভাঙা ফাইলটিকে খুঁজে বের করে আলাদা করে দেয়, যাতে বাকি ভালো টেস্টগুলো নির্বিঘ্নে চলতে পারে।
 */ 
function parseLoadErrors(output) { 
  if (!output) return []; 
  const stripAnsi = s => s.replace(/\u001b\[[0-9;]*m/g, ''); 
  const lines = output.split(/\r?\n/).map(stripAnsi); 
  const errorHeader = /^\s*(Error|SyntaxError|TypeError|ReferenceError|RangeError):\s*(.*)$/; 
  const specRe = /([A-Za-z]:\\[^\s'"()]+?\.spec\.ts|[^\s'"()]+?\.spec\.ts)/g; 
  const rootRe = /([A-Za-z]:\\[^\s'"()]+?\.(?:page\.ts|csv|ts))(?::\d+)?/; 
  const csvReqRe = /Requested\s*:\s*([^\r\n]+\.csv)/; 

  const blocks = []; 
  let current = null; 
  const flush = () => { if (current) { blocks.push(current); current = null; } }; 

  for (const line of lines) { 
    const m = line.match(errorHeader); 
    if (m) { 
      flush(); 
      current = { message: `${m[1]}: ${m[2]}`.trim(), raw: [line] }; 
    } else if (current) { 
      current.raw.push(line); 
    } 
  } 
  flush(); 

  const entries = []; 
  for (const block of blocks) { 
    const text = block.raw.join('\n'); 
    const dewrapped = text.replace(/\r?\n/g, ''); 
    const specPaths = [ 
      ...new Set([...text.matchAll(specRe), ...dewrapped.matchAll(specRe)].map(x => x[1])), 
    ]; 
    if (specPaths.length === 0) continue; 
    const csvReq = text.match(csvReqRe) || dewrapped.match(csvReqRe); 
    const rootMatch = block.message.match(rootRe) || dewrapped.match(rootRe); 
    const rootCauseFile = csvReq ? csvReq[1].trim() : (rootMatch ? rootMatch[1] : null); 
    for (const specPath of specPaths) { 
      const specBaseName = specPath.replace(/^.*[\\/]/, '').replace(/\.spec\.ts$/i, ''); 
      entries.push({ specBaseName, specPath, rootCauseFile, message: block.message }); 
    } 
  } 

  const seen = new Map(); 
  for (const e of entries) if (!seen.has(e.specBaseName)) seen.set(e.specBaseName, e); 
  return [...seen.values()]; 
} 

/** 
 * @description
 * (English): Runs a "fake" test run in the background (dry run) to see exactly which tests 
 * are planning to execute based on our CSV.
 * 
 * (Bangla): এটি ব্রাউজার ওপেন না করেই ব্যাকগ্রাউন্ডে একটি "ফেক" বা "ড্রাই রান" করে চেক করে যে 
 * আমাদের দেওয়া CSV অনুযায়ী আজকে আসলেই কোন কোন টেস্ট রান করার কথা।
 */ 
function collectPlannedTestCaseIds(env) { 
  const outFile = path.resolve(__dirname, '../test-results/_execplan.json'); 
  try { 
    fs.mkdirSync(path.dirname(outFile), { recursive: true }); 
    if (fs.existsSync(outFile)) fs.rmSync(outFile); 
  } catch { /* ignore */ } 

  const listEnv = { 
    ...env, 
    PLAYWRIGHT_JSON_OUTPUT_NAME: outFile, 
    PLAYWRIGHT_FORCE_TTY: '2000', 
  }; 
  const res = spawnSync('npx', ['playwright', 'test', '--list', '--reporter=list,json'], { 
    env: listEnv, shell: true, encoding: 'utf-8', 
  }); 
  const combinedOutput = `${res.stdout ?? ''}\n${res.stderr ?? ''}`; 
  const loadErrors = parseLoadErrors(combinedOutput); 

  let ids = null; 
  let error = null; 
  if (fs.existsSync(outFile)) { 
    try { 
      const data = JSON.parse(fs.readFileSync(outFile, 'utf-8')); 
      ids = new Set(); 
      const walk = suite => { 
        for (const spec of suite.specs ?? []) { 
          const id = (spec.title ?? '').split(/[\s:]+/)[0].trim(); 
          if (id) ids.add(id); 
        } 
        for (const sub of suite.suites ?? []) walk(sub); 
      }; 
      for (const suite of data.suites ?? []) walk(suite); 
      if (ids.size === 0) ids = null; 
    } catch (e) { 
      error = e.message; 
    } finally { 
      try { fs.rmSync(outFile); } catch { /* ignore */ } 
    } 
  } 

  if (!ids && !error) { 
    error = res.error ? res.error.message : 'no collectable tests (a file failed to load)'; 
  } 
  return { ids, error, loadErrors }; 
} 

/** 
 * @description
 * (English): Prints a clean summary in the terminal BEFORE testing starts. It tells you 
 * exactly how many tests will run and if any files are missing or broken.
 * 
 * (Bangla): টেস্ট শুরু হওয়ার ঠিক আগ মুহূর্তে এটি টার্মিনালে একটি সামারি দেখায়। 
 * আজ কয়টি টেস্ট রান করবে এবং কোনো ফাইল মিসিং বা ব্রোকেন আছে কিনা, তা সুন্দরভাবে জানিয়ে দেয়।
 */ 
function printControllerExecutionPlan(controllerPath, env) { 
  try { 
    const rows = readControllerRows(controllerPath); 
    const yRows = rows.filter(r => (r.Execute ?? '').trim().toUpperCase() === 'Y'); 
    const controllerName = path.basename(controllerPath); 
    const testDir = path.resolve(__dirname, '../test'); 
    const specsOnDisk = collectSpecFileNamesOnDisk(testDir); 

    console.log(`\n${C.cyan}${C.bold}====================== TEST EXECUTION PLAN ======================${C.reset}`); 
    console.log(`${C.bold}Controller:${C.reset} ${controllerName}`); 
    console.log(`${C.bold}Total Execute=Y test cases:${C.reset} ${C.cyan}${yRows.length}${C.reset}`); 

    let { ids: plannedIds, error, loadErrors } = collectPlannedTestCaseIds(env); 
    const brokenBaseNames = new Set((loadErrors ?? []).map(e => e.specBaseName)); 

    if (brokenBaseNames.size > 0) { 
      const retryEnv = { ...env, TEST_CONTROLLER_IGNORE_SPECS: [...brokenBaseNames].join(',') }; 
      const retry = collectPlannedTestCaseIds(retryEnv); 
      if (retry.ids) { plannedIds = retry.ids; error = null; } 
    } 

    printLoadErrors(loadErrors); 

    if (!plannedIds) { 
      const brokenOrMissing = yRows.filter( 
        r => brokenBaseNames.has((r.SpecFileName ?? '').trim()) || !specsOnDisk.has((r.SpecFileName ?? '').trim()), 
      ); 
      const willRun = yRows.length - brokenOrMissing.length; 
      console.log(`${C.bold}Will run:${C.reset} ${C.green}${willRun}${C.reset} ${C.gray}(static estimate - dry run unavailable: ${error})${C.reset}`); 
      printProblemRows(brokenOrMissing.map(r => ({ 
        ...r, 
        reason: brokenBaseNames.has((r.SpecFileName ?? '').trim()) 
          ? 'spec file FAILED TO LOAD (fix the file listed above)' 
          : 'missing spec file', 
      }))); 
      console.log(`${C.cyan}${C.bold}================================================================${C.reset}\n`); 
      return [...brokenBaseNames]; 
    } 

    const willRunRows = yRows.filter(r => plannedIds.has((r.testCaseID ?? '').trim())); 
    const problemRows = yRows 
      .filter(r => !plannedIds.has((r.testCaseID ?? '').trim())) 
      .map(r => { 
        const spec = (r.SpecFileName ?? '').trim(); 
        let reason; 
        if (brokenBaseNames.has(spec)) { 
          reason = 'spec file FAILED TO LOAD (fix the file listed above)'; 
        } else if (!specsOnDisk.has(spec)) { 
          reason = 'missing spec file (SpecFileName has no matching .spec.ts on disk)'; 
        } else { 
          reason = 'not emitted by spec (folded into another test, ID mismatch, or filtered out)'; 
        } 
        return { ...r, reason }; 
      }); 

    const runColor = problemRows.length === 0 ? C.green : C.yellow; 
    console.log(`${C.bold}Will run:${C.reset} ${runColor}${willRunRows.length}${C.reset}`); 
    console.log(`${C.bold}Will NOT run:${C.reset} ${problemRows.length === 0 ? C.green : C.red}${problemRows.length}${C.reset}`); 

    printProblemRows(problemRows); 
    console.log(`${C.cyan}${C.bold}================================================================${C.reset}\n`); 
    return [...brokenBaseNames]; 
  } catch (e) { 
    console.warn(`${C.yellow}[run-tests] Could not build execution plan: ${e.message}${C.reset}`); 
    return []; 
  } 
} 

function printLoadErrors(loadErrors) { 
  if (!loadErrors || loadErrors.length === 0) return; 
  console.log( 
    `\n${C.red}${C.bold}[X] ${loadErrors.length} file(s) FAILED TO LOAD${C.reset} ` + 
    `${C.gray}(these block only themselves — healthy Execute=Y tests still run):${C.reset}`, 
  ); 
  for (const e of loadErrors) { 
    console.log(`  ${C.red}${C.bold}${e.specPath}${C.reset}`); 
    if (e.rootCauseFile && e.rootCauseFile !== e.specPath) { 
      console.log(`      ${C.gray}root cause:${C.reset} ${C.yellow}${e.rootCauseFile}${C.reset}`); 
    } 
    if (e.message) console.log(`      ${C.gray}${e.message}${C.reset}`); 
  } 
  console.log(''); 
} 

function printProblemRows(problemRows) { 
  if (problemRows.length === 0) { 
    console.log(`${C.green}[OK] Every Execute=Y test case maps to a runnable Playwright test.${C.reset}`); 
    return; 
  } 

  const bySpec = new Map(); 
  for (const r of problemRows) { 
    const spec = (r.SpecFileName ?? '').trim() || '(blank SpecFileName)'; 
    if (!bySpec.has(spec)) bySpec.set(spec, { reason: r.reason, ids: [] }); 
    bySpec.get(spec).ids.push((r.testCaseID ?? '').trim() || '(blank testCaseID)'); 
  } 

  console.log(`\n${C.red}${C.bold}[!] ${problemRows.length} Execute=Y test case(s) will NOT run:${C.reset}`); 
  for (const [spec, info] of bySpec) { 
    console.log(`  ${C.bold}${spec}${C.reset} ${C.gray}(${info.ids.length})${C.reset} - ${C.yellow}${info.reason}${C.reset}`); 
    console.log(`      ${C.dim}${info.ids.join(', ')}${C.reset}`); 
  } 
} 

// --------------------------------------------------------------------------- 
// AllTestResults report generator (Building the HTML Dashboard)
// --------------------------------------------------------------------------- 

// Formatting helpers
function escHtml(str) { 
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); 
} 
function escCsv(str) { 
  const value = String(str ?? ''); 
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value; 
} 
function extractTestCaseId(title) { 
  const raw = String(title ?? '').trim(); 
  const colonIndex = raw.indexOf(':'); 
  return colonIndex > 0 ? raw.slice(0, colonIndex).trim() : raw; 
} 
function fmtMs(ms) { 
  const pad2 = n => String(Math.floor(n)).padStart(2, '0'); 
  const totalSec = Math.max(0, Math.floor(ms / 1000)); 
  return `${pad2(totalSec / 3600)}:${pad2((totalSec % 3600) / 60)}:${pad2(totalSec % 60)}`; 
} 

function resolveBranchName() { 
  const envBranch = [ 
    process.env.GITHUB_HEAD_REF, process.env.GITHUB_REF_NAME, 
    process.env.BUILD_SOURCEBRANCHNAME, process.env.BRANCH_NAME, 
  ].find(value => value && value.trim()); 
  if (envBranch) return envBranch.trim(); 
  try { 
    const result = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: process.cwd(), encoding: 'utf-8', shell: true }); 
    const branch = (result.stdout ?? '').trim(); 
    if (branch && branch !== 'HEAD') return branch; 
  } catch { /* ignore */ } 
  return 'Unknown'; 
} 

/** 
 * @description
 * (English): Digs into Playwright's raw, hard-to-read JSON output file and extracts 
 * only the meaningful information (Test name, pass/fail status, time taken) to show in our dashboard.
 * 
 * (Bangla): Playwright টেস্টের পর যে হিজিবিজি JSON ডেটা বানায়, এটি সেখান থেকে 
 * শুধু আমাদের দরকারি তথ্যগুলো (যেমন: টেস্টের নাম, পাস নাকি ফেইল, কত সময় লেগেছে) বের করে আনে।
 */ 
function extractTestsFromJson(data, assignedByTestCaseId = new Map()) { 
  const tests = []; 

  function walk(suite, fileHint) { 
    const file = suite.file || fileHint || ''; 
    const specName = path.basename(file).replace(/\.spec\.[tj]s$/i, ''); 

    for (const spec of suite.specs ?? []) { 
      const firstTest  = spec.tests?.[0]; 
      const firstResult = firstTest?.results?.[0]; 
      const rawStatus = firstResult?.status ?? (spec.ok ? 'passed' : 'failed'); 
      const badgeClass = ['timedout', 'interrupted'].includes(rawStatus.toLowerCase()) ? 'failed' : rawStatus.toLowerCase(); 
      const testCaseId = (spec.title ?? '').split(/[\s:]+/)[0].trim(); 

      tests.push({ 
        title:     spec.title, 
        specName, 
        rawStatus, 
        badgeClass, 
        assignedTo: assignedByTestCaseId.get(testCaseId) ?? '', 
        duration:  firstResult?.duration ?? 0, 
        testId:    spec.id ?? '', 
      }); 
    } 
    for (const sub of suite.suites ?? []) walk(sub, file); 
  } 

  for (const suite of data.suites ?? []) walk(suite, suite.file); 
  return tests; 
} 

/** 
 * @description
 * (English): Reads the controller CSV to find out WHICH QA Engineer is responsible 
 * for WHICH test, so their name appears on the final HTML report.
 * 
 * (Bangla): এটি আমাদের CSV ফাইল চেক করে বের করে যে কোন টেস্টের দায়িত্ব কোন QA ইঞ্জিনিয়ারের। 
 * এরপর সেই নামটি সরাসরি HTML রিপোর্টের 'Assigned To' কলামে বসিয়ে দেয়।
 */ 
function buildAssignedToMap() { 
  const map = new Map(); 
  try { 
    if (!controllerMode) return map; 
    const controllerPath = (env && env.TEST_CONTROLLER) || resolveController(DEFAULT_CONTROLLER); 
    if (!controllerPath || !fs.existsSync(controllerPath)) return map; 

    for (const row of readControllerRows(controllerPath)) { 
      const id = (row.testCaseID ?? '').trim(); 
      if (id) map.set(id, (row['Assigned To'] ?? '').trim()); 
    } 
  } catch { /* ignore */ } 
  return map; 
} 

/** 
 * @description
 * (English): The master reporting function. It takes all the pass/fail results and generates 
 * the beautiful 'AllTestResults' HTML dashboard and a mini CSV summary for management.
 * 
 * (Bangla): এটি রিপোর্টিং এর মূল কারিগর। টেস্ট শেষ হওয়ার পর এটি পাস/ফেইলের সব ডেটা নিয়ে 
 * ম্যানেজমেন্টের জন্য একটি সুন্দর HTML ড্যাশবোর্ড (যেখানে চার্ট থাকে) এবং একটি মিনি CSV রিপোর্ট তৈরি করে।
 */ 
function generateAllTestResultsReport() { 
  const cwd               = process.cwd(); 
  const jsonPath          = path.resolve(cwd, 'test-results.json'); 
  const playwrightSrcDir  = path.resolve(cwd, 'apps/playwright-report'); 
  const allResultsBase    = path.resolve(cwd, 'AllTestResults/HTMLReports'); 

  if (!fs.existsSync(jsonPath)) { 
    console.warn('\n[report] test-results.json not found — skipping AllTestResults report.'); 
    return; 
  } 

  let data; 
  try { 
    data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')); 
  } catch (e) { 
    console.warn(`\n[report] Could not parse test-results.json: ${e.message}`); 
    return; 
  } 

  const now  = new Date(); 
  const pad2 = n => String(n).padStart(2, '0'); 
  const timestamp = [ 
    now.getFullYear(), pad2(now.getMonth() + 1), pad2(now.getDate()), 
  ].join('-') + '_' + [ 
    pad2(now.getHours()), pad2(now.getMinutes()), pad2(now.getSeconds()), 
  ].join('-'); 

  const resultDir = path.join(allResultsBase, `Results_${timestamp}`); 
  fs.mkdirSync(resultDir, { recursive: true }); 

  const tests   = extractTestsFromJson(data, buildAssignedToMap()); 
  const stats   = data.stats ?? {}; 

  const total   = tests.length; 
  const passed  = tests.filter(t => t.badgeClass === 'passed').length; 
  const failed  = tests.filter(t => t.badgeClass === 'failed').length; 
  const skipped = tests.filter(t => t.badgeClass === 'skipped').length; 

  const passRate = total > 0 ? ((passed  / total) * 100).toFixed(1) : '0.0'; 
  const failRate = total > 0 ? ((failed  / total) * 100).toFixed(1) : '0.0'; 

  const startTime  = stats.startTime ? new Date(stats.startTime) : now; 
  const durationMs = stats.duration  ?? 0; 
  const endTime    = new Date(startTime.getTime() + durationMs); 

  const specFiles = [...new Set(tests.map(t => t.specName))]; 
  const branchName = resolveBranchName(); 

  const reportRelPath = 'playwright-report'; 
  const reportDstDir  = path.join(resultDir, reportRelPath); 
  if (fs.existsSync(playwrightSrcDir)) { 
    try { 
      fs.cpSync(playwrightSrcDir, reportDstDir, { recursive: true }); 
    } catch (e) { 
      console.warn(`\n[report] Could not copy playwright-report: ${e.message}`); 
    } 
  } else { 
    console.warn('\n[report] apps/playwright-report not found — report link will be inactive.'); 
  } 

  const tableRows = tests.map((t, i) => { 
    const deepLink = t.testId 
      ? `${reportRelPath}/index.html#?testId=${encodeURIComponent(t.testId)}` 
      : `${reportRelPath}/index.html`; 
    return ` 
                    <tr data-status="${t.badgeClass}" data-name="${escHtml(t.title.toLowerCase())}" data-duration="${t.duration}" data-sequence="${i + 1}" data-assignee="${escHtml((t.assignedTo ?? '').trim())}"> 
                        <td>${i + 1}</td> 
                        <td>${escHtml(t.specName)}</td> 
                        <td>${escHtml(t.title)}</td> 
                        <td><span class="status-badge status-${t.badgeClass}">${escHtml(t.rawStatus)}</span></td> 
                        <td>${escHtml(t.assignedTo)}</td> 
                        <td>${fmtMs(t.duration)}</td> 
                        <td><a href="${deepLink}" class="report-link" target="_blank">View Test →</a></td> 
                    </tr>`; 
  }).join(''); 

  const assigneeCounts = new Map(); 
  for (const t of tests) { 
    const owner = (t.assignedTo ?? '').trim(); 
    assigneeCounts.set(owner, (assigneeCounts.get(owner) ?? 0) + 1); 
  } 
  const namedAssignees = [...assigneeCounts.entries()] 
    .filter(([owner]) => owner !== '') 
    .sort((a, b) => a[0].localeCompare(b[0])); 
  const blankCount = assigneeCounts.get('') ?? 0; 
  const assigneeOptionsHtml = [ 
    `<option value="__all__">All Tests (${total})</option>`, 
    ...namedAssignees.map(([owner, count]) => 
      `<option value="${escHtml(owner)}">${escHtml(owner)} (${count})</option>`), 
    ...(blankCount > 0 ? [`<option value="__blank__">Unassigned (${blankCount})</option>`] : []), 
  ].join(''); 

  const html = `<!DOCTYPE html> 
<html lang="en"> 
<head> 
    <meta charset="UTF-8"> 
    <meta name="viewport" content="width=device-width, initial-scale=1.0"> 
    <title>Test Execution Summary Report</title> 
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script> 
    <style> 
        * { margin: 0; padding: 0; box-sizing: border-box; } 
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; min-height: 100vh; } 
        .container { max-width: 1400px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,.2); overflow: hidden; } 
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; } 
        .header h1 { font-size: 2.5em; margin-bottom: 10px; text-shadow: 2px 2px 4px rgba(0,0,0,.3); } 
        .header p { font-size: 1.1em; opacity: .95; } 
        .stats-container { display: flex; gap: 30px; padding: 30px; background: #f8f9fa; align-items: center; } 
        .chart-container { flex: 0 0 300px; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,.1); } 
        .chart-container canvas { max-width: 100%; height: auto !important; } 
        .stats-grid { flex: 1; display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 15px; } 
        .stat-card { background: white; padding: 20px; border-radius: 10px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,.1); transition: transform .3s, box-shadow .3s; } 
        .stat-card:hover { transform: translateY(-5px); box-shadow: 0 8px 15px rgba(0,0,0,.2); } 
        .stat-card .number { font-size: 2.2em; font-weight: bold; margin-bottom: 8px; } 
        .stat-card .label { font-size: .85em; color: #666; text-transform: uppercase; letter-spacing: .5px; } 
        .stat-card.total .number { color: #3498db; } 
        .stat-card.passed .number { color: #2ecc71; } 
        .stat-card.failed .number { color: #e74c3c; } 
        .stat-card.skipped .number { color: #f39c12; } 
        .stat-card.duration .number { font-size: 1.6em; } 
        .stat-card.pass-rate .number { color: #2ecc71; } 
        .stat-card.failure-rate .number { color: #e74c3c; } 
        .stat-card.spec-files .number { color: #9b59b6; } 
        .stat-card.total-elapsed .number { color: #16a085; font-size: 1.6em; } 
        .info-section { padding: 20px 30px; background: white; border-bottom: 1px solid #eee; } 
        .info-row { display: flex; justify-content: space-between; padding: 10px 0; font-size: .95em; } 
        .info-label { font-weight: bold; color: #555; } 
        .info-value { color: #333; } 
        .search-sort-container { padding: 20px 30px; background: white; display: flex; gap: 15px; align-items: center; border-bottom: 1px solid #eee; } 
        .search-box { flex: 1; max-width: 400px; } 
        .search-box input { width: 100%; padding: 10px 15px; border: 2px solid #ddd; border-radius: 6px; font-size: .95em; transition: border-color .3s; } 
        .search-box input:focus { outline: none; border-color: #667eea; } 
        .sort-box { display: flex; gap: 10px; align-items: center; } 
        .sort-box label { font-weight: 600; color: #555; } 
        .sort-box select { padding: 10px 15px; border: 2px solid #ddd; border-radius: 6px; font-size: .95em; cursor: pointer; background: white; } 
        .sort-box select:focus { outline: none; border-color: #667eea; } 
        .results-section { padding: 30px; } 
        .results-section h2 { color: #333; margin-bottom: 20px; font-size: 1.8em; border-bottom: 3px solid #667eea; padding-bottom: 10px; } 
        .filter-buttons { margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap; } 
        .filter-btn { padding: 10px 20px; border: 2px solid #ddd; background: white; border-radius: 6px; cursor: pointer; font-size: .95em; transition: all .3s; } 
        .filter-btn:hover { background: #f0f0f0; } 
        .filter-btn.active { background: #667eea; color: white; border-color: #667eea; } 
        table { width: 100%; border-collapse: collapse; background: white; box-shadow: 0 2px 8px rgba(0,0,0,.1); border-radius: 8px; overflow: hidden; } 
        thead { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; } 
        th { padding: 15px; text-align: center; font-weight: 600; text-transform: uppercase; font-size: .9em; letter-spacing: .5px; } 
        td { padding: 15px; border-bottom: 1px solid #eee; text-align: center; } 
        td:nth-child(2), td:nth-child(3) { text-align: left; } 
        tbody tr:hover { background: #f8f9fa; } 
        .status-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-weight: 600; font-size: .85em; text-transform: uppercase; letter-spacing: .5px; } 
        .status-passed  { background: #d4edda; color: #155724; } 
        .status-failed  { background: #f8d7da; color: #721c24; } 
        .status-skipped { background: #fff3cd; color: #856404; } 
        .report-link { color: #667eea; text-decoration: none; font-weight: 600; } 
        .report-link:hover { color: #764ba2; text-decoration: underline; } 
        .full-report-section { padding: 25px 30px; background: #f0f2ff; border-top: 3px solid #667eea; border-bottom: 3px solid #667eea; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; } 
        .full-report-section h2 { color: #333; font-size: 1.4em; margin: 0; } 
        .full-report-section p { color: #555; font-size: .95em; margin: 4px 0 0; } 
        .full-report-section .text-block { flex: 1; } 
        .btn-full-report { display: inline-flex; align-items: center; gap: 10px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 1em; font-weight: 700; box-shadow: 0 4px 15px rgba(102,126,234,.45); transition: all .3s; white-space: nowrap; } 
        .btn-full-report:hover { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(102,126,234,.6); } 
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: .9em; } 
        .nav-buttons { position: fixed; right: 30px; bottom: 30px; display: flex; flex-direction: column; gap: 10px; z-index: 1000; } 
        .nav-btn { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 16px; border-radius: 50px; cursor: pointer; font-size: .9em; font-weight: 600; box-shadow: 0 4px 15px rgba(102,126,234,.4); transition: all .3s; display: flex; align-items: center; gap: 8px; text-decoration: none; } 
        .nav-btn:hover { transform: translateY(-3px); box-shadow: 0 6px 20px rgba(102,126,234,.6); } 
    </style> 
</head> 
<body> 
    <div class="container" id="top"> 
        <div class="header"> 
            <h1>🎯 Test Execution Summary</h1> 
            <p>Automated Test Results - EAL IT Solutions Framework</p> 
        </div> 

        <div class="stats-container"> 
            <div class="chart-container"> 
                <canvas id="testChart"></canvas> 
            </div> 
            <div class="stats-grid"> 
                <div class="stat-card total"><div class="number">${total}</div><div class="label">Total Tests</div></div> 
                <div class="stat-card total-elapsed"><div class="number">${fmtMs(durationMs)}</div><div class="label">Total Elapsed Time</div></div> 
                <div class="stat-card duration"><div class="number">${fmtMs(tests.reduce((s, t) => s + t.duration, 0))}</div><div class="label">Total Execution Time</div></div> 
                <div class="stat-card spec-files"><div class="number">${specFiles.length}</div><div class="label">Spec Files</div></div> 
                <div class="stat-card passed"><div class="number">${passed}</div><div class="label">Passed</div></div> 
                <div class="stat-card failed"><div class="number">${failed}</div><div class="label">Failed</div></div> 
                <div class="stat-card skipped"><div class="number">${skipped}</div><div class="label">Skipped</div></div> 
                <div class="stat-card pass-rate"><div class="number">${passRate}%</div><div class="label">Pass Rate</div></div> 
                <div class="stat-card failure-rate"><div class="number">${failRate}%</div><div class="label">Failure Rate</div></div> 
            </div> 
        </div> 

        <div class="info-section"> 
            <div class="info-row"><span class="info-label">📁 Results Directory:</span><span class="info-value">Results_${timestamp}</span></div> 
            <div class="info-row"><span class="info-label">🌐 Environment URL:</span><span class="info-value">${escHtml(process.env.USER_PORTAL_URL ?? 'Not specified')}</span></div> 
            <div class="info-row"><span class="info-label">🕐 Execution Start Time:</span><span class="info-value">${startTime.toLocaleString()}</span></div> 
            <div class="info-row"><span class="info-label">🕑 Execution End Time:</span><span class="info-value">${endTime.toLocaleString()}</span></div> 
            <div class="info-row"><span class="info-label">📋 Controller:</span><span class="info-value">${escHtml(controllerMode ? (env.TEST_CONTROLLER ? path.basename(env.TEST_CONTROLLER) : DEFAULT_CONTROLLER) : 'Direct spec run')}</span></div> 
            <div class="info-row"><span class="info-label">🌿 Branch Name:</span><span class="info-value">${escHtml(branchName)}</span></div> 
        </div> 

        <div class="results-section"> 
            <h2>📊 Detailed Test Results</h2> 
            <div class="search-sort-container"> 
                <div class="search-box"><input type="text" id="searchInput" placeholder="🔍 Search test names..." onkeyup="searchTests()"></div> 
                <div class="sort-box"> 
                    <label>Sort by:</label> 
                    <select id="sortSelect" onchange="sortTests()"> 
                        <option value="sequence">Sequence</option> 
                        <option value="name">Name (A-Z)</option> 
                        <option value="name-desc">Name (Z-A)</option> 
                        <option value="duration">Duration (Low to High)</option> 
                        <option value="duration-desc">Duration (High to Low)</option> 
                        <option value="status">Status</option> 
                    </select> 
                </div> 
                <div class="sort-box"> 
                    <label>Assigned To:</label> 
                    <select id="assigneeFilter" onchange="filterByAssignee()"> 
                        ${assigneeOptionsHtml} 
                    </select> 
                </div> 
            </div> 
            <div class="filter-buttons"> 
                <button class="filter-btn active" onclick="filterTests('all', this)">All Tests</button> 
                <button class="filter-btn" onclick="filterTests('passed', this)">Passed Tests</button> 
                <button class="filter-btn" onclick="filterTests('failed', this)">Failed Tests</button> 
                <button class="filter-btn" onclick="filterTests('skipped', this)">Skipped Tests</button> 
            </div> 
            <table id="resultsTable"> 
                <thead> 
                    <tr> 
                        <th>#</th> 
                        <th>Spec File Name</th> 
                        <th>Test Name</th> 
                        <th>Status</th> 
                        <th>Assigned To</th> 
                        <th>Execution Time</th> 
                        <th>Report</th> 
                    </tr> 
                </thead> 
                <tbody>${tableRows} 
                </tbody> 
            </table> 
        </div> 

        <div class="full-report-section" id="full-report"> 
            <div class="text-block"> 
                <h2>📋 Detailed Playwright Report</h2> 
                <p>Open the full interactive Playwright HTML report to browse all tests, traces, screenshots, and step-level details.</p> 
            </div> 
            <a href="${reportRelPath}/index.html" class="btn-full-report" target="_blank"> 
                🔍 Open Full Playwright Report 
            </a> 
        </div> 

        <div class="footer" id="bottom"> 
            <p>Generated on ${now.toLocaleString()} | EAL IT Solutions Test Framework</p> 
        </div> 
    </div> 

    <div class="nav-buttons"> 
        <a href="#top"    class="nav-btn" title="Go to Top">    <span>↑</span><span>Top</span>    </a> 
        <a href="#bottom" class="nav-btn" title="Go to Bottom"> <span>↓</span><span>Bottom</span> </a> 
    </div> 

    <script> 
        const ctx = document.getElementById('testChart').getContext('2d'); 
        new Chart(ctx, { 
            type: 'pie', 
            data: { 
                labels: ['Passed', 'Failed', 'Skipped'], 
                datasets: [{ data: [${passed}, ${failed}, ${skipped}], backgroundColor: ['#2ecc71', '#e74c3c', '#f39c12'], borderWidth: 2, borderColor: '#fff' }] 
            }, 
            options: { 
                responsive: true, 
                maintainAspectRatio: true, 
                plugins: { 
                    legend: { position: 'bottom', labels: { padding: 15, font: { size: 12 } } }, 
                    title: { display: true, text: 'Test Results Distribution', font: { size: 14, weight: 'bold' }, padding: { bottom: 10 } } 
                } 
            } 
        }); 

        const filterState = { status: 'all', assignee: '__all__', query: '' }; 

        function applyFilters() { 
            document.querySelectorAll('#resultsTable tbody tr').forEach(row => { 
                const owner = row.dataset.assignee || ''; 
                const matchesAssignee = 
                    filterState.assignee === '__all__'   ? true : 
                    filterState.assignee === '__blank__' ? owner === '' : 
                                                           owner === filterState.assignee; 
                const matchesStatus = filterState.status === 'all' || row.dataset.status === filterState.status; 
                const matchesQuery  = row.dataset.name.includes(filterState.query); 
                row.style.display = (matchesAssignee && matchesStatus && matchesQuery) ? '' : 'none'; 
            }); 
        } 

        function filterTests(status, element) { 
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active')); 
            element.classList.add('active'); 
            filterState.status = status; 
            applyFilters(); 
        } 

        function searchTests() { 
            filterState.query = document.getElementById('searchInput').value.toLowerCase(); 
            applyFilters(); 
        } 

        function filterByAssignee() { 
            filterState.assignee = document.getElementById('assigneeFilter').value; 
            applyFilters(); 
        } 

        function sortTests() { 
            const val   = document.getElementById('sortSelect').value; 
            const tbody = document.querySelector('#resultsTable tbody'); 
            const rows  = [...tbody.querySelectorAll('tr')]; 
            rows.sort((a, b) => { 
                switch (val) { 
                    case 'name':          return a.dataset.name.localeCompare(b.dataset.name); 
                    case 'name-desc':     return b.dataset.name.localeCompare(a.dataset.name); 
                    case 'duration':      return Number(a.dataset.duration) - Number(b.dataset.duration); 
                    case 'duration-desc': return Number(b.dataset.duration) - Number(a.dataset.duration); 
                    case 'status':        return a.dataset.status.localeCompare(b.dataset.status); 
                    default:              return Number(a.dataset.sequence) - Number(b.dataset.sequence); 
                } 
            }); 
            rows.forEach(r => tbody.appendChild(r)); 
        } 
    </script> 
</body> 
</html>`; 

  const summaryPath = path.join(resultDir, 'TestExecutionSummary.html'); 
  fs.writeFileSync(summaryPath, html, 'utf-8'); 

  const csvHeader = 'TestCaseID,Status'; 
  const csvBody = tests.map(t => { 
    const testCaseId = extractTestCaseId(t.title); 
    const status = t.badgeClass === 'passed' 
      ? 'PASSED' 
      : t.badgeClass === 'skipped' 
        ? 'SKIPPED' 
        : 'FAILED'; 
    return `${escCsv(testCaseId)},${status}`; 
  }); 
  const csvPath = path.join(resultDir, 'TestResults.csv'); 
  fs.writeFileSync(csvPath, [csvHeader, ...csvBody].join('\r\n') + '\r\n', 'utf-8'); 

  console.log(`\n[report] ✅ AllTestResults report generated:`); 
  console.log(`[report]    ${summaryPath}`); 
  console.log(`[report]    ${csvPath}`); 
  console.log(`[report]    Playwright detail report copied to: ${reportDstDir}`); 
}