#!/usr/bin/env node
/**
 * CREOVA
 * Validates that every file in i18n/locales/*.json has exactly the same
 * set of keys as i18n/locales/en.json (the reference locale).
 *
 * A missing key means that locale falls back to English (or shows a raw
 * key) in production — this script catches that in CI instead of a user
 * finding it. Extra keys (present in a locale but not in en.json) are
 * reported as a warning only, since they don't break anything for users.
 *
 * Usage: node scripts/validate-i18n.js
 * Exit code 0 = all locales match en.json. Exit code 1 = missing keys found.
 */

const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "i18n", "locales");
const BASE_LOCALE = "en.json";

function flattenKeys(obj, prefix = "") {
  let keys = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys = keys.concat(flattenKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}

function loadLocale(fileName) {
  const filePath = path.join(LOCALES_DIR, fileName);
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function main() {
  if (!fs.existsSync(path.join(LOCALES_DIR, BASE_LOCALE))) {
    console.error(`Base locale not found: ${BASE_LOCALE}`);
    process.exit(1);
  }

  const baseKeys = new Set(flattenKeys(loadLocale(BASE_LOCALE)));
  const files = fs
    .readdirSync(LOCALES_DIR)
    .filter((f) => f.endsWith(".json") && f !== BASE_LOCALE);

  let hasMissing = false;

  for (const file of files) {
    let localeKeys;

    try {
      localeKeys = new Set(flattenKeys(loadLocale(file)));
    } catch (err) {
      console.error(`✗ ${file}: invalid JSON (${err.message})`);
      hasMissing = true;
      continue;
    }

    const missing = [...baseKeys].filter((k) => !localeKeys.has(k));
    const extra = [...localeKeys].filter((k) => !baseKeys.has(k));

    if (missing.length > 0) {
      hasMissing = true;
      console.error(`✗ ${file}: missing ${missing.length} key(s):`);
      missing.forEach((k) => console.error(`    - ${k}`));
    }

    if (extra.length > 0) {
      console.warn(`⚠ ${file}: ${extra.length} extra key(s) not in ${BASE_LOCALE}:`);
      extra.forEach((k) => console.warn(`    - ${k}`));
    }

    if (missing.length === 0 && extra.length === 0) {
      console.log(`✓ ${file}`);
    }
  }

  if (hasMissing) {
    console.error("\ni18n check failed: one or more locales are missing keys.");
    process.exit(1);
  }

  console.log(`\ni18n check passed: all ${files.length} locales match ${BASE_LOCALE}.`);
}

main();
