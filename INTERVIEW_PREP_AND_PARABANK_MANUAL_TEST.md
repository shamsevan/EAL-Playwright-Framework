# Playwright Framework: Final-Round Interview Prep

এই guide-এর প্রথম অংশে interviewer-এর জন্য repository-কেন্দ্রিক technical প্রশ্ন আছে, যাতে candidate framework-টি সত্যিই বুঝেছেন কি না যাচাই করা যায়। দ্বিতীয় অংশে আলাদা একটি manual test case-এর ধাপ ও expected result দেওয়া আছে; interviewer চাইলে candidate-কে পরে এই case automate করতে দিতে পারেন।

## Framework-টি এক নজরে

এই project-এ Playwright Test, TypeScript, Page Object Model, CSV-ভিত্তিক test data এবং CSV-ভিত্তিক test controller ব্যবহার করা হয়েছে।

| দায়িত্ব | Project-এর উদাহরণ |
|---|---|
| Test scenario ও Playwright steps | `apps/test/paraBankLogin.spec.ts` |
| Login page object | `apps/pages/ParaBankLogin.page.ts` |
| Accounts Overview page object | `apps/pages/ParaBankOverview.page.ts` |
| Shared screenshot, logging, dropdown ও navigation helpers | `apps/utils/CommonFunctions.ts` |
| Structured test logger | `apps/utils/TestLogger.ts` |
| CSV থেকে test data পড়া | `apps/utils/testData.ts` |
| Controller CSV থেকে test নির্বাচন | `apps/utils/testControllerCsv.ts` |
| Browser, timeout, worker, reporter configuration | `playwright.config.ts` |
| Master test runner | `apps/utils/runTests.mjs` |
| Existing ParaBank test data | `apps/test-data/SmokeTestData.csv` |
| Existing ParaBank test controller | `apps/test-controllers/SmokeTestController.csv` |

Framework-এর সাধারণ flow:

1. Runner/configuration environment ও controller settings পড়ে।
2. Controller CSV-তে `Execute=Y` থাকা test case নির্বাচন করা হয়।
3. Spec shared CSV থেকে test data নেয় এবং Page Object-এর মাধ্যমে UI-তে কাজ করে।
4. Playwright assertions, structured logs ও screenshot attachments ফলাফল report-এ রাখে।
5. HTML, JSON ও terminal reporter test result দেখায়।

## Part 1: Interviewer-এর Technical Question Bank

প্রশ্নগুলো candidate-কে সরাসরি করা যাবে। “ভালো উত্তরে যা থাকা উচিত” কলামটি interviewer-এর মূল্যায়নের সহায়িকা; candidate-কে আগে থেকে দেখানোর প্রয়োজন নেই।

| # | Candidate-কে প্রশ্ন | ভালো উত্তরে যা থাকা উচিত |
|---|---|---|
| 1 | এই repository-তে একটি ParaBank test শুরু থেকে শেষ পর্যন্ত কীভাবে নির্বাচন ও execute হয়? | `playwright.config.ts`/runner, controller CSV, `getTestCasesByGroup`, spec registration ও Playwright reporter-এর ভূমিকা আলাদা করে ব্যাখ্যা করতে পারে। |
| 2 | `SmokeTestController.csv` এবং `SmokeTestData.csv`—দুটির কাজ কী, এবং একটি test চালাতে কীভাবে একসঙ্গে লাগে? | Controller-এ Execute, test ID/description ও SpecFileName; test-data CSV-তে key/value data। Existing login spec-এর `paraBankLogin` group ও data key-র উদাহরণ দিতে পারে। |
| 3 | Controller-এ test-এর `Execute` বন্ধ থাকলে বা `SpecFileName` না মিললে কী হতে পারে? | Test নির্বাচিত হবে না/সেই spec-এ test registration হবে না—এটি controller-driven framework-এর operational risk হিসেবে ধরতে পারে; execution নিশ্চিত করতে controller, env path ও grep/filter যাচাইয়ের কথা বলে। |
| 4 | `ParaBankLogin.page.ts` এবং `ParaBankOverview.page.ts`-এ কী দায়িত্ব রাখা হয়েছে? এগুলো spec থেকে আলাদা রাখার সুবিধা কী? | Login form action ও overview verification page object-এ; user journey spec-এ। Locator/UI change-কে localized রাখা ও duplication কমানোর কথা বলে। |
| 5 | `CommonFunctions.ts`-এর shared helper-গুলোর মধ্যে কোনগুলো login test-এ, আর কোনগুলো অন্য UI flow-তে কাজে লাগতে পারে? | Login spec-এর `stepLogger`, `flushFailureScreenShots`; login page-এর `logAction`, `takeScreenShot`; অন্যান্য flow-তে menu/dropdown/navigation helper-এর নির্দিষ্ট উদাহরণ উল্লেখ করে। |
| 6 | `test.step`, `stepLogger` এবং `TestLogger` কি একই কাজ করে? | না। Report-এর named step, terminal/GitHub Actions message, এবং structured test/action/verification/result logging—তিনটির আলাদা উদ্দেশ্য ব্যাখ্যা করে। |
| 7 | `verifySoft` ব্যবহার করলে assertion ব্যর্থতার পর test-এর কী হয়? কোন ক্ষেত্রে hard assertion বেছে নেবেন? | Soft assertion failure record করে test-কে পরের check-এ যেতে দেয়; অপরিহার্য precondition বা পরের action নিরাপদ নয় এমন অবস্থায় hard assertion দরকার। |
| 8 | এই framework-এ screenshot কখন তোলা ও report-এ attach করা হয়? | Capture/buffer করা এবং `afterEach`-এ flush করার পার্থক্য, failure/pass attachment option এবং screenshot-এ secret থাকার ঝুঁকি ব্যাখ্যা করে। |
| 9 | `Browser`, `BrowserContext` ও `Page`-এর সম্পর্ক কী? দ্বিতীয় tab খুললে কোন object-টি ব্যবহার করবেন? | Browser process, isolated session/context, এবং tab/page-এর পার্থক্য বোঝায়; একই context-এর নতুন page, নতুন context-এর isolation, ও নির্দিষ্ট page handle ব্যবহারের কথা বলে। |
| 10 | নতুন tab খোলার ক্ষেত্রে কীভাবে race condition এড়াবেন এবং সঠিক tab-এ আছেন কীভাবে নিশ্চিত করবেন? | Action-এর আগে page/popup event অপেক্ষা, নতুন page handle, URL/title/heading assertion, যথাযথ cleanup; fixed sleep বা বর্তমানে active tab অনুমানের ওপর নির্ভর না করার কথা বলে। |
| 11 | ParaBank-এর native account dropdown automate করলে কীভাবে নির্বাচন ও যাচাই করবেন? | UI-র label/role ও `<select>` semantics দেখে locator বেছে নেয়; option select করে selected value এবং প্রাসঙ্গিক outcome যাচাই করে; account option dynamic হলে hard-code না করার কথা বলে। |
| 12 | Overview-তে account rows দেরিতে এলে কীভাবে wait করবেন? কেন `waitForTimeout` এড়িয়ে যাবেন? | Locator/web-first assertion বা নির্দিষ্ট UI state/URL-এ wait; arbitrary sleep ধীর ও flaky—এ কথা বলে। |
| 13 | এই demo user দিয়ে Transfer/Open Account test লিখলে কী ঝুঁকি এবং কী guardrail দরকার? | Shared mutable financial state, balance/account পরিবর্তন, parallel test interference; isolated data, precondition/cleanup এবং অনুমোদন ছাড়া transaction submit না করার কথা বলে। |
| 14 | এই project-এ test-এর ফলাফল কোথায় দেখা যায়, এবং retry/parallel execution কোথায় configure হয়? | HTML, JSON ও list reporter; `playwright.config.ts`-এ CI retry/`forbidOnly`, environment-controlled parallel mode/worker-এর উল্লেখ করে। |
| 15 | Login credential ও URL test-এ কীভাবে ব্যবহার করবেন এবং কী কখনো log/report-এ রাখবেন না? | URL environment variable (`USER_PORTAL_URL`), login test data key/helper; password কখনো source, console log, attachment বা screenshot-এ না রাখার কথা বলে। Secret store/environment secret-এর উপযোগিতাও বলতে পারে। |
| 16 | Test মাঝপথে ব্যর্থ হলে এই framework-এর কোন evidence দেখে root cause খুঁজবেন? | Playwright error/step, URL, trace/screenshot, logger output, HTML/JSON report; locator ambiguity, async rendering ও shared test data আলাদা করে তদন্ত করবে। |
| 17 | এই framework-এ নতুন test যোগ করলে বিদ্যমান run mechanism-এর সঙ্গে কীভাবে যুক্ত করবেন? | Spec/Page Object/test data-এর যথাযথ ব্যবহার, controller CSV-তে Execute ও SpecFileName, test ID/title/group, test command/config, report ও targeted validation—এসব বিবেচনা করে। |
| 18 | `CommonFunctions.ts`-এ helper অনেক ধরনের হলে নতুন helper যোগ করার আগে কী যাচাই করবেন? | Existing helper/prior art ও caller খোঁজা, project convention/type/interface দেখা, duplicate এড়ানো, responsibility/scope ঠিক রাখা; behavior change হলে সংশ্লিষ্ট test/validation-এর কথা বলে। |

## Part 1A: Candidate-এর প্রস্তুতির জন্য Sample Answers

### 1. এই framework-এর architecture কীভাবে ব্যাখ্যা করবেন?

**নমুনা উত্তর:** Test specification, Page Object, common utilities, test data, controller এবং Playwright configuration আলাদা দায়িত্বে রাখা হয়েছে। Spec user journey ও assertions সাজায়; Page Object page-specific locator/action রাখে; `CommonFunctions` reusable operation দেয়; CSV data ও execution selection আলাদা রাখে। এতে test flow পড়া ও পরিবর্তন করা সহজ হয়।

### 2. Page Object Model কেন ব্যবহার করা হয়েছে?

**নমুনা উত্তর:** Locator এবং page interaction page-specific class-এ থাকলে একই page-এর locator পরিবর্তন এক জায়গায় করা যায়। Spec business flow-কেন্দ্রিক থাকে, আর UI implementation detail page class-এ থাকে। তবে Page Object-এ অপ্রয়োজনীয় wrapper বানানো উচিত নয়; reusable behavior এবং page-এর দায়িত্বের মধ্যে ভারসাম্য রাখা দরকার।

### 3. `paraBankLogin.spec.ts`-এর test execution কীভাবে controller-driven?

**নমুনা উত্তর:** Spec `getTestCasesByGroup('paraBankLogin')` দিয়ে controller থেকে enabled row নেয়। প্রতিটি row-এর `testCaseID` ও description দিয়ে একটি Playwright test তৈরি হয়। Controller CSV-তে `Execute=Y` এবং সঠিক `SpecFileName` থাকতে হয়; ফলে test registration-ও controller data-এর ওপর নির্ভরশীল।

### 4. Test controller এবং test data CSV-এর পার্থক্য কী?

**নমুনা উত্তর:** Controller CSV বলে কোন test case চলবে এবং case-এর metadata কী। Test data CSV UI-তে ব্যবহারের data—যেমন login-এর username, password ও expected heading—দেয়। দুটির schema এবং উদ্দেশ্য আলাদা; একটি দিয়ে অন্যটির দায়িত্ব পালন করানো উচিত নয়।

### 5. Login credentials ও portal URL কোথা থেকে আসে?

**নমুনা উত্তর:** বর্তমান ParaBank spec `SmokeTestData.csv`-এর `PB_Login_username`, `PB_Login_password` ও expected-message key ব্যবহার করে। Portal URL `USER_PORTAL_URL` environment variable থেকে আসে। Credential report, console output বা source code-এ পুনরায় লিখব না; production-like secret হলে CSV-র বদলে approved secret store/environment secret ব্যবহার করা উচিত।

### 6. Playwright-এ `page`, `browserContext` এবং `browser`-এর পার্থক্য কী?

**নমুনা উত্তর:** `browser` browser process; `BrowserContext` আলাদা session/storage boundary; `Page` একটি tab। একই context-এর একাধিক page সাধারণত একই context session/cookie share করে। আলাদা user/session isolate করতে আলাদা context দরকার। নতুন tab-এর জন্য context-এর page collection/new page ব্যবহার করা যায়; popup-এর ক্ষেত্রে originating page-এর popup event-ও বিবেচনা করতে হয়।

### 7. Browser tab switch কীভাবে automate করবেন?

**নমুনা উত্তর:** প্রথমে কোন action নতুন page খুলবে তা স্পষ্ট করব, তারপর action-এর আগে context page event অপেক্ষা করব, নতুন `Page`-এ URL/title/content যাচাই করব এবং নির্দিষ্ট page handle-এ পরবর্তী action করব। শুধু `bringToFront()`-এর ওপর নির্ভর না করে সঠিক page reference ব্যবহার করব; test শেষে extra page বন্ধ করব। এই ParaBank flow-তে app নিজে নতুন tab খোলে না, তাই exercise-এ একই browser context-এ দ্বিতীয় ParaBank tab স্পষ্টভাবে খোলার ধাপ আছে।

### 8. Playwright locator এবং auto-wait কীভাবে flaky test কমায়?

**নমুনা উত্তর:** `getByRole`, `getByLabel` বা উপযুক্ত test id-এর মতো user-facing locator অগ্রাধিকার দেব। Playwright action-এর আগে element actionable হওয়া পর্যন্ত অপেক্ষা করে, আর web-first assertion condition সত্য হওয়া পর্যন্ত retry করে। তাই fixed `waitForTimeout` সাধারণত এড়িয়ে যাব; দরকার হলে নির্দিষ্ট locator, URL বা load condition-এর জন্য অপেক্ষা করব।

### 9. Dropdown test কীভাবে লিখবেন?

**নমুনা উত্তর:** আগে dropdown দৃশ্যমান ও enabled কি না যাচাই করব। Native `<select>` হলে `selectOption` দিয়ে value/label বেছে নিয়ে selected value assert করব। Custom dropdown হলে role/name দিয়ে খুঁজে option click করব। Selected value-এর পাশাপাশি সংশ্লিষ্ট ফলাফলও যাচাই করব—শুধু click হয়েছে কি না নয়।

### 10. Hard assertion ও soft assertion-এর পার্থক্য কী?

**নমুনা উত্তর:** Hard assertion ব্যর্থ হলে test-এর পরের কাজ থেমে যায়—যে condition ছাড়া পরবর্তী step অর্থহীন সেখানে এটি ভালো। Soft assertion ব্যর্থতা record করে test চালাতে দেয়, যাতে related check-গুলো একসঙ্গে দেখা যায়। Soft assertion-ও final result-এ failure হিসেবে ধরা উচিত; গুরুত্বপূর্ণ precondition-এ soft assertion দিয়ে test ভুল অবস্থায় চালানো ঠিক নয়।

### 11. `test.step`, `stepLogger` এবং `TestLogger`-এর কাজ কী?

**নমুনা উত্তর:** `test.step` Playwright report-এ ধাপগুলো group করে। `stepLogger` terminal/GitHub Actions-এ highlighted step দেখায়। `TestLogger` test start/pass/fail, action, verification ও diagnostic information structured format-এ লেখে। এগুলো পরস্পরের বিকল্প নয়—প্রতিটির reporting surface আলাদা।

### 12. Screenshot flow কীভাবে কাজ করে?

**নমুনা উত্তর:** Page Object/common helper প্রয়োজনীয় মুহূর্তে screenshot buffer করে। Spec-এর `afterEach` hook `flushFailureScreenShots` দিয়ে সেগুলো report-এ attach করে। Failure-এর সময় debugging-এর জন্য screenshot রাখা হয়; pass-এর সময় attachment policy option/environment-এর মাধ্যমে নিয়ন্ত্রিত হয়। Screenshot-এ credential বা sensitive data আছে কি না সেটিও বিবেচনা করতে হবে।

### 13. এই repository-তে কোন report পাওয়া যায়?

**নমুনা উত্তর:** Playwright config HTML report, JSON result এবং terminal list reporter configure করেছে। HTML report UI-তে step/result দেখতে সাহায্য করে; JSON downstream parsing/CI integration-এ কাজে লাগে; terminal output দ্রুত feedback দেয়।

### 14. Local ও CI run-এর আচরণে কী পার্থক্য আছে?

**নমুনা উত্তর:** Config-এ CI-তে retry এবং `forbidOnly` সক্রিয়; parallel mode environment variable দিয়ে চালু হয়, নইলে default worker count এক। Headless/browser channel-ও configuration-এ নির্ধারিত। CI-তে test repeatable রাখতে environment, browser binary, credentials ও test data নিয়ন্ত্রিত হওয়া জরুরি।

### 15. Test data বা account ID কেন hard-code করা উচিত নয়?

**নমুনা উত্তর:** Demo account-এর সংখ্যা, balance ও transaction সময়ের সঙ্গে বদলাতে পারে; account row asynchronous-ও হতে পারে। UI বা controlled test data থেকে runtime value নেব, state-sensitive test-এ deterministic fixture/user চাইব, এবং কেবল সেই test-এর প্রয়োজনীয় assertion করব। বর্তমান case-এ balance/account number-এর নির্দিষ্ট মান ধরে নেওয়া যাবে না।

### 16. এই exercise-এ কেন Transfer বা Open Account submit করা হবে না?

**নমুনা উত্তর:** দুটিই account state/balance বদলাতে পারে। বর্তমান test data shared demo user-এ ব্যবহৃত হতে পারে; তাই dropdown ও input যাচাই করে submit না করা নিরাপদ। Mutating workflow পরীক্ষা করতে হলে isolated user/account, precondition, cleanup/reset strategy এবং parallel-test isolation আগে নিশ্চিত করব।

### 17. Flaky test ব্যর্থ হলে debugging কীভাবে করবেন?

**নমুনা উত্তর:** প্রথমে failure message, trace/screenshot, বর্তমান URL ও report step দেখি। তারপর locator ambiguity, timing, async rendering, session state, external dependency এবং shared test data আলাদা করে পরীক্ষা করি। Fixed sleep যোগ করার বদলে সঠিক UI condition-এ wait এবং দৃশ্যমান evidence দিয়ে root cause ঠিক করি।

### 18. Framework-এ ছোট কিন্তু মূল্যবান উন্নতি কী হতে পারে?

**নমুনা উত্তর:** প্রথমে test execution-এর reproducibility ও secret handling শক্ত করব—credentials repository-তে রাখা এড়ানো, config-এর required environment variable validate করা, এবং CI secret ব্যবহার করা। এরপর account data isolation, typed fixtures, direct test selection/documented commands, এবং critical success precondition-এর hard assertion বিবেচনা করব। পরিবর্তনগুলো targeted test/build দিয়ে যাচাই করব এবং একসঙ্গে unrelated refactor করব না।

### 19. একটি ভালো UI test-এর acceptance criteria কী?

**নমুনা উত্তর:** Test-এর উদ্দেশ্য স্পষ্ট; stable locator এবং deterministic input আছে; গুরুত্বপূর্ণ outcome assert করা হয়; state mutation নিয়ন্ত্রিত; cleanup/isolation ভাবা হয়েছে; failure হলে report থেকে কারণ খুঁজে পাওয়া যায়; এবং test একাধিক run/CI-তে একইভাবে চলে। শুধু click বা page load হলেই test সফল—এমন নয়।

## Part 2: Candidate-দের জন্য Manual Test Case

> **Automation assignment:** নিচের manual case-টি বিদ্যমান framework pattern অনুসরণ করে automate করুন। Credential value report/console-এ লিখবেন না। Account transfer বা account-opening request submit করবেন না।

### Test Case

| Field | Value |
|---|---|
| Test Case ID | `TC-PB-INTERVIEW-001` |
| Title | Login, keyboard navigation, multi-tab, account table/filter ও form controls যাচাই |
| Priority | High |
| Type | End-to-end / UI |
| Application | ParaBank |

### Preconditions ও Test Data

1. Project-এর configured ParaBank URL (`USER_PORTAL_URL`) চালু এবং accessible।
2. বিদ্যমান test user-এর key-গুলো `apps/test-data/SmokeTestData.csv`-এ আছে: `PB_Login_username` ও `PB_Login_password`। মানগুলো test code-এ duplicate করবেন না।
3. Chromium browser ব্যবহার করুন; user ইতিমধ্যে authenticated থাকলে logout করে fresh login দিয়ে শুরু করুন।
4. Account number, balance এবং transaction count runtime-এ UI থেকে পড়ুন। কোনো নির্দিষ্ট account number বা balance expected value হিসেবে লিখবেন না।
5. Manual tab-opening ধাপের জন্য Chromium/Edge browser ব্যবহার করুন। Application নিজে নতুন tab না খুললে browser-এর address-bar keyboard shortcut ব্যবহার করা হবে।

### Observed UI Notes

- Login-এর পরে “Accounts Overview” ও “Account Services” দেখা যায়।
- Overview table-এ Account, Balance ও Available Amount থাকে; account rows delayed/asynchronous ভাবে দেখা দিতে পারে।
- “Open New Account” page-এ `CHECKING` এবং `SAVINGS` account type dropdown, funding account dropdown এবং minimum `$100.00` deposit notice আছে।
- “Transfer Funds” page-এ amount input, From account dropdown, To account dropdown ও Transfer button আছে।
- Account Activity page-এ Activity Period (`All`/months) ও Type (`All`/`Credit`/`Debit`) dropdown এবং `Go` button আছে; result table-এ Date, Transaction, Debit, Credit column থাকে।
- পর্যবেক্ষিত ParaBank flow নিজে নতুন browser tab খোলে না। তাই test-এ browser keyboard shortcut দিয়ে একই ParaBank URL দ্বিতীয় tab-এ খুলে tab switch যাচাই করা হবে।
- Demo account-এর data সময়/ব্যবহারে বদলাতে পারে। Manual observation-এ account ও balance পরিবর্তিত হতে দেখা গেছে; নির্দিষ্ট account ID/balance নির্ভর assertion ব্যবহার করবেন না।
- Account-opening এবং transfer operation data পরিবর্তন করে। এই case-এ form প্রস্তুত করা পর্যন্ত পরীক্ষা করুন; submit নয়।
- এই flow-তে application alert/dialog দেখা যায়নি। Test-এ অকারণে alert তৈরি বা dismiss করার চেষ্টা করবেন না; test চলাকালে dialog এলে সেটি নথিভুক্ত করে সঠিকভাবে handle করুন।

### Steps ও Expected Results

| # | Action | Expected Result |
|---|---|---|
| 1 | Configured ParaBank URL-এ যান এবং page title ও login form পর্যবেক্ষণ করুন। | Login page load হয়; Customer Login, Username, Password ও Log In control দৃশ্যমান; সঠিক URL/title নিশ্চিত হয়। |
| 2 | Username field-এ focus দিন, বিদ্যমান `SmokeTestData.csv` login data লিখুন; `Tab` দিয়ে Password field-এ যান, password লিখে `Enter` চাপুন। | Keyboard focus Username → Password → Log In ক্রমে যায়; Enter-এ form submit হয়; password masked থাকে; login সফল হলে authenticated page দেখা যায়। Credential screen/report/console-এ প্রকাশ করবেন না। |
| 3 | Accounts Overview load হওয়া পর্যন্ত অপেক্ষা করে heading, table header এবং account row যাচাই করুন। | Overview heading ও Account/Balance/Available Amount column দেখা যায়; অন্তত একটি account row load হয়। নির্দিষ্ট account ID, balance বা row count ধরে নেবেন না; fixed sleep নয়, UI condition-এ অপেক্ষা করুন। |
| 4 | Overview table-এর একটি account link খুলুন এবং Account Details/Activity heading যাচাই করুন। তারপর app-এর Accounts Overview link দিয়ে ফিরে আসুন। | UI থেকে বেছে নেওয়া account-এর activity page খোলে; ফিরে এলে overview heading/table আবার দৃশ্যমান হয়। Account number runtime-এ নিন, hard-code নয়। |
| 5 | Windows Chromium/Edge-এ `Ctrl+L` চাপুন, configured ParaBank URL লিখুন, তারপর `Alt+Enter` চাপুন। | একই browser window/context-এ নতুন tab খোলে এবং ParaBank load হয়। নতুন tab-এর URL/title পরীক্ষা করুন; shared session বজায় আছে কি না যাচাই করুন। Login redirect হলে সেটি fail হিসেবে report ও evidence করুন, pass ধরে নেবেন না। |
| 6 | `Ctrl+Tab` দিয়ে দ্বিতীয় tab-এ যান; page title/URL এবং authenticated heading যাচাই করুন। `Ctrl+Shift+Tab` দিয়ে প্রথম tab-এ ফিরে তার আগের page/URL যাচাই করুন। | দুই tab-ই আলাদা page হিসেবে খোলা থাকে; keyboard switch-এ সঠিক tab active হয় এবং প্রতিটি tab-এ প্রত্যাশিত page চেনা যায়। |
| 7 | প্রথম tab থেকে “Find Transactions” page খুলুন। Account dropdown-এ একটি account নির্বাচন করুন; Transaction ID search field-এ অস্তিত্বহীন ID `INTERVIEW-NOT-FOUND` দিয়ে সংশ্লিষ্ট Find Transactions button চাপুন। | নির্বাচিত account dropdown-এ থাকে; ফলাফলে no-match/empty state সঠিকভাবে দেখা যায়; অপ্রাসঙ্গিক transaction দেখায় না। Test শেষে filter/search value clear করুন বা page reload করুন। |
| 8 | দ্বিতীয় tab-এ Accounts Overview খুলে প্রথম account link-এ যান। Activity Period dropdown-এ একটি মাস এবং Type dropdown-এ `Credit` নির্বাচন করে `Go` চাপুন। | দুই dropdown-এ নির্বাচিত value দেখা যায়; activity result/table refresh হয়। Transaction থাকলে row-গুলো দেখায়, না থাকলে empty-state/zero result স্পষ্ট থাকে; date/amount dynamic বলে নির্দিষ্ট record ধরে নেবেন না। |
| 9 | Activity table-এর column header, row/cell সম্পর্ক, visible row count এবং empty state—যেটি বাস্তবে আসে—যাচাই করুন। | Table header ও rendered result একই account/filter-এর সঙ্গে সম্পর্কিত; empty state-কে failure নয়, valid no-data outcome হিসেবে report করা হয়। |
| 10 | দ্বিতীয় tab-এ “Transfer Funds” খুলুন। Amount-এ `1.00` লিখুন; From ও To dropdown-এ সম্ভব হলে আলাদা account নির্বাচন করুন। | Amount field ও দুই selected option সঠিকভাবে দেখা যায়; account দুইটির কম হলে available option অনুযায়ী সীমাবদ্ধতা নথিভুক্ত হয়। **Transfer চাপবেন না।** |
| 11 | “Open New Account” খুলুন। Account type dropdown-এ `SAVINGS`, funding account dropdown-এ একটি বিদ্যমান account নির্বাচন করুন; minimum-deposit notice যাচাই করুন। | নির্বাচিত account type/funding account field-এ প্রতিফলিত হয় এবং minimum `$100.00` notice দৃশ্যমান। **Open New Account চাপবেন না।** |
| 12 | দ্বিতীয় tab বন্ধ করুন; প্রথম tab-এ ফিরে সঠিক ParaBank page নিশ্চিত করুন। এরপর app-এর “Log Out” ব্যবহার করুন। | দ্বিতীয় tab বন্ধ হলেও প্রথমটি অক্ষত থাকে; logout-এর পর login/unauthenticated page আসে; test data বা balance কোনোভাবেই বদলায়নি। |

**Automation note:** উপরকার `Ctrl+L`/`Alt+Enter` browser-chrome shortcut manual browser-এ নতুন tab খোলার জন্য। Playwright test-এ browser address bar-এ keystroke পাঠানো নির্ভরযোগ্য page automation নয়; একই browser context-এ `context.newPage()` তৈরি করে configured URL navigate করুন, তারপর page handle, URL/title/heading assertions এবং `bringToFront()`/page-specific action দিয়ে tab-switch behavior যাচাই করুন।

### Overall Expected Result

একটি end-to-end flow-তে keyboard form submission/focus order, dynamic table ও link navigation, browser tab creation/switching, native dropdown selection, search input ও empty state, activity filtering/table outcome, transfer/open-account form fill, assertions এবং cleanup যাচাই হবে। Test-টি নির্দিষ্ট account/balance/transaction ধরে নেবে না এবং কোনো financial mutation submit করবে না।

### Interviewer-এর Evaluation Checklist

- [ ] Candidate আগে manual flow পড়ে precondition, test data ও risk বুঝেছে।
- [ ] Test-টি project-এর controller/data/Page Object pattern-এর সঙ্গে যুক্ত করতে পেরেছে।
- [ ] Credentials log, report বা source-এ প্রকাশ করেনি।
- [ ] Tab handling, dynamic account rows ও dropdown selection ঠিকভাবে যাচাই করেছে।
- [ ] Fixed sleep ও hard-coded account/balance এড়িয়ে গেছে।
- [ ] Transfer বা Open New Account submit করেনি।
- [ ] Failure evidence, tab cleanup ও logout/teardown সঠিকভাবে সামলেছে।
