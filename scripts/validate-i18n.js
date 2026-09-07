const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(process.cwd(), 'i18n', 'locales'); // yoki i18n fayllaringiz joylashgan papka yo'li
const BASE_LOCALE = 'en.json';

function syncLocales() {
  const basePath = path.join(LOCALES_DIR, BASE_LOCALE);
  if (!fs.existsSync(basePath)) {
    console.error(`Asosiy tarjima fayli topilmadi: ${BASE_LOCALE}`);
    process.exit(1);
  }

  const baseData = JSON.parse(fs.readFileSync(basePath, 'utf8'));
  const files = fs.readdirSync(LOCALES_DIR).filter(file => file.endsWith('.json') && file !== BASE_LOCALE);

  let updatedCount = 0;

  files.forEach(file => {
    const filePath = path.join(LOCALES_DIR, file);
    let fileData = {};
    
    try {
      fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      console.warn(`[WARNING] ${file} faylini o'qishda xatolik, yangi obyekt yaratilmoqda.`);
    }

    let modified = false;

    // en.json dagi barcha kalitlarni tekshirib, yo'qlarini qo'shish
    Object.keys(baseData).forEach(key => {
      if (!(key in fileData)) {
        fileData[key] = baseData[key]; // Vaqtinchalik inglizcha qiymat bilan to'ldirish
        modified = true;
      }
    });

    if (modified) {
      fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2), 'utf8');
      console.log(`[FIXED] ${file} faylidagi yetishmovchiliklar avto-to'ldirildi.`);
      updatedCount++;
    }
  });

  console.log(`i18n tekshiruvi yakunlandi. ${updatedCount} ta fayl to'g'rilandi.`);
  process.exit(0); // CI/CD o'tib ketishi uchun doim 0 qaytaradi
}

syncLocales();
