/**
 * Language.  DESIGN.md §9.5.
 *
 * Tiers are honest: "tested" means the eval suite runs against it.
 * Never claim a language we have not evaluated — the chip says which.
 */

export const LANGUAGES = [
  { code: 'en', name: 'English',   native: 'English',   tier: 'tested', bcp47: 'en-KE' },
  { code: 'sw', name: 'Kiswahili', native: 'Kiswahili', tier: 'tested', bcp47: 'sw-KE' },
];

export const BETA_NOTE = 'Other languages are not claimed yet. Wazi will say so rather than guess.';

const EN = {
  'cold.invite': 'Tap once. After this, I’m just here.',
  'cold.why': 'Wazi needs your microphone to talk with you. You can also type.',
  'cold.type': 'Type instead',
  'open.first': 'Hey. I’m Wazi — it means open. Show me something, or just tell me what’s bothering you.',
  'open.return': ['Morning. What are we looking into?', 'I’m here. What do you want to find out?',
                  'Something on your mind, or something you want me to look at?', 'Go on then. What is it?'],
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
  'open.first': 'Habari. Mimi ni Wazi — maana yake ni wazi. Nionyeshe kitu, au niambie kinachokusumbua.',
  'open.return': ['Habari. Tunachunguza nini?', 'Nipo. Unataka kujua nini?',
                  'Kuna jambo akilini, au kitu unataka nikiangalie?', 'Haya basi. Ni nini?'],
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
};

const TABLES = { en: EN, sw: SW };
let current = 'en';

export function setLanguage(code) {
  if (TABLES[code]) current = code;
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

const SW_HINT = /\b(habari|asante|tafadhali|ndiyo|hapana|sawa|nini|wapi|nani|hospitali|barabara|maji|shule|serikali|imekamilika|zahanati)\b/i;

export function detectLanguage(utterance) {
  if (SW_HINT.test(String(utterance || ''))) return { code: 'sw', certain: false };
  return { code: 'en', certain: false };
}

export const UNCERTAIN_LINE = (code) => ({
  sw: 'Nadhani unazungumza Kiswahili — niambie kama nimekosea.',
  en: 'I think you’re speaking English — tell me if I’ve got that wrong.',
}[code]);
