import fs from 'fs';   // importing File System full library to handle file System/ file explorer.
import path from 'path';  // importing Path full library to handle File Paths
import { parse } from 'csv-parse/sync';   // importing only parse logic from csv-parse/sync library.

/**
 * @description Replaces values like ${MY_ENV} with the real value from process.env.
 * Example:
 *   value = "https://${HOST}/login"
 *   process.env.HOST = "example.com"
 *   result = "https://example.com/login"
 * If the env var is missing, it becomes an empty string.
 * @param value - Text that may contain ${ENV_VAR} placeholders
 * @returns The text after replacing all environment variables
 */
function resolveEnvVars(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_match, varName) => {
    return process.env[varName] ?? '';
  });
}

/**
 * @description Reads a CSV file and turns it into an array of objects.
 * Example CSV:
 *   name,role,api_url
 *   Alice,admin,${BASE_URL}/users
 * After reading, it becomes:
 *   [{ name: "Alice", role: "admin", api_url: "https://example.com/users" }]
 * This function:
 * - reads the file from the given path
 * - parses CSV safely, including quoted values and multiline text
 * - resolves ${ENV_VAR} values in each cell
 * @param filePath - CSV file location. It can be absolute or relative.
 * @returns Array of objects with keys matching the CSV headers
 */
export function readCSVFile<T>(filePath: string): T[] {
  // 1) Convert the given path to a full absolute path.
  // Java idea: Path fullPath = Paths.get(filePath).toAbsolutePath();
  const resolvedPath = path.resolve(filePath);

  // 2) Check whether the file really exists.
  // If not, stop immediately and show a useful error message.
  // Java idea: if (!Files.exists(fullPath)) { ... }
  if (!fs.existsSync(resolvedPath)) {
    const message =
      `[csvReader] CSV file NOT FOUND.\n` +
      `           Requested : ${filePath}\n` +
      `           Resolved  : ${resolvedPath}\n` +
      `           Check the path/spelling of the CSV file passed to readCSVFile().`;
    console.error(`\x1b[31m${message}\x1b[0m`);
    throw new Error(message);
  }

  // 3) Read the full CSV content as text.
  const content = fs.readFileSync(resolvedPath, 'utf-8');

  // 4) Parse CSV into an array of objects.
  // Example:
  //   name,age
  //   Alice,30
  // becomes:
  //   [{ name: "Alice", age: "30" }]
  // In Java, this is similar to using OpenCSV or Apache Commons CSV.
  let records: Record<string, string>[];
  try {
    records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true,
      comment: '#',
    }) as Record<string, string>[];
  } catch (error) {
    const message =
      `[csvReader] Failed to PARSE CSV file: ${resolvedPath}\n` +
      `           ${error instanceof Error ? error.message : String(error)}`;
    console.error(`\x1b[31m${message}\x1b[0m`);
    throw new Error(message);
  }

  // 5) Replace values like ${BASE_URL} with actual environment values.
  // Example:
  //   "https://${HOST}/login" -> "https://example.com/login"
  // Java idea: loop each row and replace placeholders one by one.
  for (const record of records) {
    for (const key of Object.keys(record)) {
      record[key] = resolveEnvVars(record[key]);
    }
  }

  return records as T[];
}

/**
 * @description Groups an array of test data records by the value of a specified column.
 * Use this instead of .filter() in spec files to partition data by a discriminator column.
 * @param data - Array of test data records
 * @param column - The column/key name to group by
 * @returns Map of column values to arrays of matching records
 */
export function groupByColumn<T>(data: T[], column: keyof T): Map<string, T[]> {
  const map = new Map<string, T[]>(); 
  for (const row of data) { 
    const key = String(row[column] ?? ''); 
    const group = map.get(key); 
    if (group) { 
      group.push(row); 
    } else { 
      map.set(key, [row]); 
    } 
  } 
  return map; 
}

/**
 * @description Filters an array of CSV data objects by a field value.
 * Use this instead of inline .filter() in spec files.
 * @param data - Array of parsed CSV data objects
 * @param field - The field name to filter on
 * @param value - The value to match
 * @returns Filtered array of matching objects
 */
export function filterCSVData<T>(data: T[], field: keyof T, value: string): T[] {
  return data.filter(d => d[field] === value); 
}