const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'i18n', 'locales');
const baseFile = path.join(localesDir, 'en.json');

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(
      `Invalid JSON: ${path.basename(file)}: ${error.message}`,
    );
  }
}

function getKeys(value, prefix = '') {
  if (!value || typeof value !== 'object') {
    return [];
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (
      child &&
      typeof child === 'object' &&
      !Array.isArray(child)
    ) {
      return getKeys(child, fullKey);
    }

    return [fullKey];
  });
}

const base = readJson(baseFile);
const baseKeys = new Set(getKeys(base));

const localeFiles = fs
  .readdirSync(localesDir)
  .filter((file) => file.endsWith('.json'));

let failed = false;

for (const file of localeFiles) {
  const localePath = path.join(localesDir, file);
  const locale = readJson(localePath);
  const localeKeys = new Set(getKeys(locale));

  const missing = [...baseKeys].filter(
    (key) => !localeKeys.has(key),
  );

  if (missing.length > 0) {
    failed = true;

    console.error(
      `\n${file}: missing ${missing.length} key(s)`,
    );

    for (const key of missing) {
      console.error(`  - ${key}`);
    }
  }
}

if (failed) {
  console.error('\n❌ i18n validation failed.');
  process.exit(1);
}

console.log(
  `✅ i18n validation passed: ${localeFiles.length} locale(s).`,
);
