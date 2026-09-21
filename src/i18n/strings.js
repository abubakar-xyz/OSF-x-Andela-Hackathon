/**
 * Language.  DESIGN.md §9.5.
 *
 * Tiers are honest: "tested" means the eval suite runs against it.
 * Never claim a language we have not evaluated — the chip says which.
 */

export const LANGUAGES = [
  /* African Languages & Regional Dialects */
  { code: 'en', name: 'English (Kenya)',   native: 'English',          tier: 'tested', bcp47: 'en-KE', region: 'Africa' },
  { code: 'sw', name: 'Kiswahili',         native: 'Kiswahili',         tier: 'tested', bcp47: 'sw-KE', region: 'Africa' },
  { code: 'sheng', name: 'Sheng (Nairobi)',native: 'Sheng',             tier: 'live',   bcp47: 'sw-KE', region: 'Africa' },
  { code: 'so', name: 'Somali',            native: 'Soomaaliga',        tier: 'live',   bcp47: 'so-SO', region: 'Africa' },
  { code: 'am', name: 'Amharic',           native: 'አማርኛ',              tier: 'live',   bcp47: 'am-ET', region: 'Africa' },
  { code: 'om', name: 'Oromo',             native: 'Afaan Oromoo',      tier: 'live',   bcp47: 'om-ET', region: 'Africa' },
  { code: 'ti', name: 'Tigrinya',          native: 'ትግርኛ',              tier: 'live',   bcp47: 'ti-ET', region: 'Africa' },
  { code: 'yo', name: 'Yoruba',            native: 'Èdè Yorùbá',        tier: 'live',   bcp47: 'yo-NG', region: 'Africa' },
  { code: 'ig', name: 'Igbo',              native: 'Ásụ̀sụ́ Ìgbò',        tier: 'live',   bcp47: 'ig-NG', region: 'Africa' },
  { code: 'ha', name: 'Hausa',             native: 'Harshen Hausa',     tier: 'live',   bcp47: 'ha-NG', region: 'Africa' },
  { code: 'zu', name: 'Zulu',              native: 'isiZulu',           tier: 'live',   bcp47: 'zu-ZA', region: 'Africa' },
  { code: 'xh', name: 'Xhosa',             native: 'isiXhosa',          tier: 'live',   bcp47: 'xh-ZA', region: 'Africa' },
  { code: 'af', name: 'Afrikaans',         native: 'Afrikaans',         tier: 'live',   bcp47: 'af-ZA', region: 'Africa' },
  { code: 'lg', name: 'Luganda',           native: 'Oluganda',          tier: 'live',   bcp47: 'lg-UG', region: 'Africa' },
  { code: 'luo', name: 'Luo (Dholuo)',     native: 'Dholuo',            tier: 'live',   bcp47: 'luo-KE', region: 'Africa' },
  { code: 'kik', name: 'Kikuyu (Gĩkũyũ)',  native: 'Gĩkũyũ',            tier: 'live',   bcp47: 'ki-KE', region: 'Africa' },
  { code: 'rw', name: 'Kinyarwanda',       native: 'Ikinyarwanda',      tier: 'live',   bcp47: 'rw-RW', region: 'Africa' },
  { code: 'ln', name: 'Lingala',           native: 'Lingála',           tier: 'live',   bcp47: 'ln-CD', region: 'Africa' },
  { code: 'sn', name: 'Shona',             native: 'chiShona',          tier: 'live',   bcp47: 'sn-ZW', region: 'Africa' },
  { code: 'mg', name: 'Malagasy',          native: 'Fiteny Malagasy',   tier: 'live',   bcp47: 'mg-MG', region: 'Africa' },

  /* Global & International Languages */
  { code: 'fr', name: 'French',            native: 'Français',          tier: 'live',   bcp47: 'fr-FR', region: 'Global' },
  { code: 'ar', name: 'Arabic',            native: 'العربية',            tier: 'live',   bcp47: 'ar-SA', region: 'Global' },
  { code: 'es', name: 'Spanish',           native: 'Español',           tier: 'live',   bcp47: 'es-ES', region: 'Global' },
  { code: 'pt', name: 'Portuguese',        native: 'Português',         tier: 'live',   bcp47: 'pt-BR', region: 'Global' },
  { code: 'de', name: 'German',            native: 'Deutsch',           tier: 'live',   bcp47: 'de-DE', region: 'Global' },
  { code: 'it', name: 'Italian',           native: 'Italiano',          tier: 'live',   bcp47: 'it-IT', region: 'Global' },
  { code: 'nl', name: 'Dutch',             native: 'Nederlands',        tier: 'live',   bcp47: 'nl-NL', region: 'Global' },
  { code: 'ru', name: 'Russian',           native: 'Русский',           tier: 'live',   bcp47: 'ru-RU', region: 'Global' },
  { code: 'tr', name: 'Turkish',           native: 'Türkçe',            tier: 'live',   bcp47: 'tr-TR', region: 'Global' },
  { code: 'pl', name: 'Polish',            native: 'Polski',            tier: 'live',   bcp47: 'pl-PL', region: 'Global' },
  { code: 'uk', name: 'Ukrainian',         native: 'Українська',        tier: 'live',   bcp47: 'uk-UA', region: 'Global' },
  { code: 'el', name: 'Greek',             native: 'Ελληνικά',          tier: 'live',   bcp47: 'el-GR', region: 'Global' },
  { code: 'sv', name: 'Swedish',           native: 'Svenska',           tier: 'live',   bcp47: 'sv-SE', region: 'Global' },
  { code: 'da', name: 'Danish',            native: 'Dansk',             tier: 'live',   bcp47: 'da-DK', region: 'Global' },
  { code: 'fi', name: 'Finnish',           native: 'Suomi',             tier: 'live',   bcp47: 'fi-FI', region: 'Global' },
  { code: 'no', name: 'Norwegian',         native: 'Norsk',             tier: 'live',   bcp47: 'no-NO', region: 'Global' },
  { code: 'hi', name: 'Hindi',             native: 'हिन्दी',             tier: 'live',   bcp47: 'hi-IN', region: 'Asia' },
  { code: 'bn', name: 'Bengali',           native: 'বাংলা',              tier: 'live',   bcp47: 'bn-BD', region: 'Asia' },
  { code: 'ur', name: 'Urdu',              native: 'اردو',              tier: 'live',   bcp47: 'ur-PK', region: 'Asia' },
  { code: 'pa', name: 'Punjabi',           native: 'ਪੰਜਾਬੀ',             tier: 'live',   bcp47: 'pa-IN', region: 'Asia' },
  { code: 'ta', name: 'Tamil',             native: 'தமிழ்',             tier: 'live',   bcp47: 'ta-IN', region: 'Asia' },
  { code: 'te', name: 'Telugu',            native: 'తెలుగు',            tier: 'live',   bcp47: 'te-IN', region: 'Asia' },
  { code: 'mr', name: 'Marathi',           native: 'मराठी',             tier: 'live',   bcp47: 'mr-IN', region: 'Asia' },
  { code: 'gu', name: 'Gujarati',          native: 'ગુજરાતી',           tier: 'live',   bcp47: 'gu-IN', region: 'Asia' },
  { code: 'fa', name: 'Persian (Farsi)',   native: 'فارسی',             tier: 'live',   bcp47: 'fa-IR', region: 'Asia' },
  { code: 'zh', name: 'Chinese (Mandarin)',native: '中文 (普通话)',     tier: 'live',   bcp47: 'zh-CN', region: 'Asia' },
  { code: 'ja', name: 'Japanese',          native: '日本語',            tier: 'live',   bcp47: 'ja-JP', region: 'Asia' },
  { code: 'ko', name: 'Korean',            native: '한국어',            tier: 'live',   bcp47: 'ko-KR', region: 'Asia' },
  { code: 'id', name: 'Indonesian',        native: 'Bahasa Indonesia',  tier: 'live',   bcp47: 'id-ID', region: 'Asia' },
  { code: 'ms', name: 'Malay',             native: 'Bahasa Melayu',     tier: 'live',   bcp47: 'ms-MY', region: 'Asia' },
  { code: 'vi', name: 'Vietnamese',        native: 'Tiếng Việt',        tier: 'live',   bcp47: 'vi-VN', region: 'Asia' },
  { code: 'th', name: 'Thai',              native: 'ไทย',               tier: 'live',   bcp47: 'th-TH', region: 'Asia' },
  { code: 'tl', name: 'Tagalog (Filipino)',native: 'Wikang Filipino',   tier: 'live',   bcp47: 'tl-PH', region: 'Asia' },
];

export const BETA_NOTE = 'Multilingual support powered by Gemini across 50+ languages.';

export function getSwitchLine(code) {
  const l = LANGUAGES.find((lang) => lang.code === code);
  if (code === 'sw') return 'Nabadilisha kwa Kiswahili.';
  if (code === 'en') return 'Switching to English.';
  if (code === 'sheng') return 'Nabadilisha kuingia Sheng.';
  if (l) return `Switching to ${l.name} (${l.native}).`;
  return 'Switching language.';
}

const EN = {
  'cold.invite': 'Tap once. After this, I’m just here.',
  'cold.why': 'Wazi needs your microphone to talk with you. You can also type.',
  'cold.type': 'Type instead',
  'open.first': 'Hello! I’m Wazi, your civic friend. Show me something, or tell me what you’d like to find out.',
  'open.return': ['Hello! What can I help you check today?', 'I’m right here. What would you like to find out?',
                  'Good to see you! What project or budget shall we look into?', 'Ready whenever you are. What’s on your mind?'],
  'open.camera': 'I can see. Point at it and tell me what it’s meant to be.',
  'open.signboard': 'That’s a project board. Want me to check what the record says about it?',
  'open.nudge': 'No rush. You can also just show me something — the camera’s bottom left.',
  'denied': 'No problem — we’ll type instead.',
  'camera.denied': 'Fine — pick a photo instead, or just describe it to me.',
  'clues.check': 'Tell me if I’ve got any of this wrong.',
  'offline': 'No connection. I can still work from what I’ve saved — I just can’t check for anything newer.',
  'chip.check': 'Check a project',
  'chip.explain': 'Explain a service',
  'chip.cases': 'My cases',
  'chip.what': 'What is this?',
  'chip.finished': 'Is this finished?',
  'chip.who': 'Who’s responsible?',
  'chip.again': 'Check again',
  'chip.write': 'Who do I write to?',
  'chip.save': 'Save this',
  'cases.empty': 'Nothing saved yet. Anything you check, I can keep here.',
  'privacy.title': 'Privacy & data',
  'privacy.body': 'Wazi keeps this on this phone only. There is no account and nothing is sent to a server.',
  'privacy.delete': 'Delete everything',
  'privacy.confirm': 'This cannot be undone. Your cases and details will be removed from this phone.',
  'what.am.i': 'A program. I read public records and help you write to the people responsible. ' +
               'I get things wrong, which is why everything on screen has its source attached.',
};

const SW = {
  'cold.invite': 'Gusa mara moja. Baada ya hapo, nipo tu.',
  'cold.why': 'Wazi anahitaji maikrofoni yako ili kuzungumza nawe. Unaweza pia kuandika.',
  'cold.type': 'Andika badala yake',
  'open.first': 'Habari yako! Mimi ni Wazi, rafiki yako wa masuala ya umma. Nionyeshe kitu au niambie ungependa kujua nini.',
  'open.return': ['Habari! Nikusaidie kuangalia nini leo?', 'Niko hapa. Ungependa tuchunguze nini?',
                  'Vizuri kukuona tena! Ni mradi gani tutakaoangalia?', 'Nipo tayari. Una swali gani akilini?'],
  'open.camera': 'Naona. Elekeza hapo na uniambie kinapaswa kuwa nini.',
  'open.signboard': 'Hiyo ni bango la mradi. Ungependa niangalie rekodi inasemaje?',
  'open.nudge': 'Hakuna haraka. Unaweza pia kunionyesha kitu — kamera iko chini kushoto.',
  'denied': 'Hakuna shida — tutaandika.',
  'camera.denied': 'Sawa — chagua picha badala yake, au nieleze tu.',
  'clues.check': 'Niambie kama nimekosea chochote.',
  'offline': 'Hakuna mtandao. Bado naweza kutumia nilichohifadhi — lakini siwezi kuangalia kipya.',
  'chip.check': 'Angalia mradi',
  'chip.explain': 'Eleza huduma',
  'chip.cases': 'Kesi zangu',
  'chip.what': 'Hii ni nini?',
  'chip.finished': 'Imekamilika?',
  'chip.who': 'Nani anahusika?',
  'chip.again': 'Angalia tena',
  'chip.write': 'Nimwandikie nani?',
  'chip.save': 'Hifadhi hii',
  'cases.empty': 'Hakuna kilichohifadhiwa bado. Chochote unachoangalia, naweza kukiweka hapa.',
  'privacy.title': 'Faragha na data',
  'privacy.body': 'Wazi anahifadhi hii kwenye simu hii pekee. Hakuna akaunti na hakuna kinachotumwa kwa seva.',
  'privacy.delete': 'Futa kila kitu',
  'privacy.confirm': 'Hii haiwezi kutenduliwa. Kesi zako na maelezo yako yataondolewa kwenye simu hii.',
  'what.am.i': 'Ni programu. Nasoma rekodi za umma na kukusaidia kuwaandikia wanaohusika. ' +
               'Nakosea mara nyingine, ndiyo maana kila kitu kwenye skrini kina chanzo chake.',
  'prompt.project': 'Jina la mradi au kituo',
  'prompt.service': 'Huduma au utaratibu',
  'btn.ask': 'Uliza Wazi',
  'btn.close': 'Funga',
};

const TABLES = { en: EN, sw: SW };
let current = 'en';

export function setLanguage(code) {
  if (LANGUAGES.some((l) => l.code === code)) {
    current = code;
  } else if (TABLES[code]) {
    current = code;
  }
  if (typeof document !== 'undefined') document.documentElement.lang = current;
  return current;
}
export const getLanguage = () => current;

export function t(key, fallback) {
  const v = TABLES[current]?.[key] ?? TABLES.en[key] ?? fallback ?? key;
  return Array.isArray(v) ? v[Math.floor(Math.random() * v.length)] : v;
}

/** Detection is announced in the NEW language, never asked about. §9.5 */
export const SWITCH_LINE = { en: 'Switching to English.', sw: 'Nabadilisha kwa Kiswahili.' };

/* Expanded East African / Kiswahili civic, grammatical and conversational markers */
const SW_CORE = new Set([
  'habari', 'jambo', 'hujambo', 'sijambo', 'shikamoo', 'marahaba', 'asante', 'tafadhali',
  'sawa', 'ndiyo', 'hapana', 'hebu', 'ngoja', 'pole', 'haya', 'karibu', 'haki', 'kweli',
  'ukweli', 'uongo', 'manze', 'rada', 'mambo', 'vipi', 'salama', 'bwana', 'nini', 'wapi',
  'nani', 'lini', 'kwanini', 'mbona', 'gani', 'je', 'mimi', 'wewe', 'yeye', 'sisi', 'wao',
  'hii', 'hiki', 'hili', 'haya', 'hapa', 'pale', 'kule', 'yangu', 'yako', 'yetu', 'wao',
  'niko', 'uko', 'yuko', 'tuko', 'wako', 'iko', 'ziko', 'liko', 'kiko', 'nataka', 'nahitaji',
  'naomba', 'nauliza', 'tafuta', 'angalia', 'ona', 'tazama', 'sema', 'eleza', 'fahamu', 'jua',
  'saidia', 'nisaidie', 'andika', 'tuma', 'anza', 'mradi', 'miradi', 'ujenzi', 'pesa',
  'fedha', 'bajeti', 'mkataba', 'serikali', 'kaunti', 'gavana', 'waziri', 'afisi', 'ofisi',
  'bunge', 'diwani', 'hospitali', 'zahanati', 'kituo', 'afya', 'dawa', 'daktari', 'barabara',
  'daraja', 'maji', 'kisima', 'bomba', 'shule', 'darasa', 'chuo', 'bango', 'rekodi', 'ripoti',
  'barua', 'lalamiko', 'kazi', 'imekamilika', 'haijakamilika', 'imeisha', 'haijaisha',
  'imekwama', 'kusimama', 'kufungwa', 'wizi', 'ufisadi', 'ushahidi', 'bado', 'zaidi', 'tena',
]);

const EN_CORE = new Set([
  'the', 'this', 'that', 'these', 'those', 'what', 'where', 'who', 'when', 'why', 'how',
  'is', 'are', 'was', 'were', 'been', 'have', 'has', 'had', 'project', 'finished',
  'completed', 'building', 'hospital', 'clinic', 'centre', 'center', 'road', 'bridge',
  'water', 'school', 'health', 'budget', 'contract', 'signboard', 'records', 'office',
  'officer', 'responsible', 'write', 'letter', 'complaint', 'stalled', 'check', 'tell',
  'explain', 'know', 'find', 'show', 'money', 'report', 'evidence', 'again', 'please',
]);

export function detectLanguage(utterance) {
  const text = String(utterance || '').toLowerCase().trim();
  if (!text) return { code: 'en', certain: false, mixed: false };

  const tokens = text.match(/[\p{L}\p{N}]+/gu) || [];
  if (!tokens.length) return { code: 'en', certain: false, mixed: false };

  let swCount = 0;
  let enCount = 0;

  for (const token of tokens) {
    if (SW_CORE.has(token)) swCount++;
    if (EN_CORE.has(token)) enCount++;
  }

  const mixed = swCount > 0 && enCount > 0;

  /* If Kiswahili markers exceed or match with strong presence, classify as sw */
  if (swCount > enCount || (swCount > 0 && enCount === 0)) {
    return { code: 'sw', certain: swCount >= 2, mixed };
  }

  if (enCount > swCount) {
    return { code: 'en', certain: enCount >= 2, mixed };
  }

  /* Fallback regex check for compound word forms (e.g. prefix verb forms like aliyejenga) */
  if (/\b(habari|asante|tafadhali|ndiyo|hapana|sawa|nini|wapi|nani|hospitali|barabara|maji|shule|serikali|imekamilika|zahanati|mradi|rekodi|kaunti)\b/i.test(text)) {
    return { code: 'sw', certain: false, mixed };
  }

  return { code: 'en', certain: false, mixed };
}

export const UNCERTAIN_LINE = (code) => ({
  sw: 'Nadhani unazungumza Kiswahili — niambie kama nimekosea.',
  en: 'I think you’re speaking English — tell me if I’ve got that wrong.',
}[code]);
