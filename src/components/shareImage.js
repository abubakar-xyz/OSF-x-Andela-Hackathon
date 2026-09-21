/**
 * Share as image.  DESIGN.md §13.1.
 *
 * One tap renders the Two Truths card as a 1080×1350 PNG, client-side,
 * offline, with no upload. This is the growth engine: a forwarded card is
 * how this reaches people who will never install anything.
 *
 * The evidence state word is baked in LARGE on purpose — a forwarded card
 * that says CONFLICTING cannot be re-captioned as "PROOF OF THEFT"
 * without visibly contradicting itself.
 */

import { fmtDate } from '../core/dom.js';
import { WORD } from '../evidence/ladder.js';
import { hasFixture } from '../evidence/types.js';

const W = 1080, H = 1350, PAD = 72;

/* Mirrors src/styles/tokens.css. Canvas cannot read CSS custom
   properties, so these are kept in step by hand — if a token moves,
   this moves with it. */
const C = {
  paper: '#E4E9E1', card: '#F2F4F0', rule: '#C4CEC0',
  ink: '#111E1C', muted: '#46575A',
  VERIFIED: '#267552', CORROBORATED: '#0E7569', REPORTED: '#856222',
  CONFLICTING: '#B5352B', UNKNOWN: '#596B72',
  amber: '#F2B23E', amberInk: '#3A2A05',
};

/* The same two families as the app, with the same rule: the serif is
   only ever the person's own words. Falls back cleanly if the faces
   have not loaded — the card still reads. */
const UI = (w, s) => `${w} ${s}px Archivo, ui-sans-serif, system-ui, "Segoe UI", sans-serif`;
const SERIF = (w, s) => `${w} ${s}px Fraunces, ui-serif, Georgia, serif`;

export function renderShareImage(payload, { caseId = '', scale = 1 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = W * scale; canvas.height = H * scale;
  const g = canvas.getContext('2d');
  g.scale(scale, scale);
  g.textBaseline = 'top';

  g.fillStyle = C.paper; g.fillRect(0, 0, W, H);

  let y = PAD;

  /* Claim, in the user's own words. */
  g.fillStyle = C.ink; g.font = SERIF(600, 46);
  y = wrap(g, `“${payload.claim}”`, PAD, y, W - PAD * 2, 56);
  y += 20;

  rule(g, y); y += 28;

  /* Entity */
  g.fillStyle = C.ink; g.font = UI(600, 32);
  y = wrap(g, payload.entity.name, PAD, y, W - PAD * 2, 40);
  g.fillStyle = C.muted; g.font = UI(400, 24);
  y = wrap(g, [payload.entity.admin2, payload.entity.admin1].filter(Boolean).join(' · '), PAD, y + 6, W - PAD * 2, 32);
  y += 26;

  /* Two columns */
  const colW = (W - PAD * 2 - 40) * 0.54;          /* record side is wider */
  const colWr = (W - PAD * 2 - 40) * 0.46;
  const colTop = y;

  g.fillStyle = C.muted; g.font = UI(500, 21);
  g.fillText('The record', PAD, colTop);
  g.fillText('What you showed me', PAD + colW + 40, colTop);
  /* A heavy rule under each head, the way a ruled return is set. */
  g.strokeStyle = C.ink; g.lineWidth = 2;
  for (const x of [PAD, PAD + colW + 40]) {
    const w = x === PAD ? colW : colWr;
    g.beginPath(); g.moveTo(x, colTop + 30); g.lineTo(x + w, colTop + 30); g.stroke();
  }

  let ly = colTop + 50, ry = colTop + 50;

  const rec = payload.record.find((r) => r.verbatim) ?? payload.record[0];
  if (rec?.verbatim) {
    /* Filed language, set in the grotesque behind a heavy rule. */
    g.strokeStyle = C.ink; g.lineWidth = 3;
    const quoteTop = ly - 4;
    g.fillStyle = C.ink; g.font = UI(400, 25);
    const after = wrap(g, `“${rec.verbatim}”`, PAD + 16, ly, colW - 16, 32);
    g.beginPath(); g.moveTo(PAD + 1.5, quoteTop); g.lineTo(PAD + 1.5, after - 6); g.stroke();
    ly = after + 10;
  }
  g.font = UI(400, 22); g.fillStyle = C.muted;
  for (const r of payload.record.slice(0, 3)) {
    if (r === rec && r.verbatim) continue;
    ly = wrap(g, `${r.label}: ${fmtValue(r.fact)}`, PAD, ly, colW, 30);
  }

  g.fillStyle = C.ink; g.font = UI(400, 24);
  for (const f of payload.field.slice(0, 4)) {
    ry = wrap(g, `${f.label}: ${f.fact.value}`, PAD + colW + 40, ry, colWr, 32);
  }
  if (payload.field[0]?.fact?.as_of) {
    g.fillStyle = C.muted; g.font = UI(400, 21);
    ry = wrap(g, `Observed ${fmtDate(payload.field[0].fact.as_of)}`, PAD + colW + 40, ry + 6, colWr, 28);
  }

  y = Math.max(ly, ry) + 28;
  rule(g, y); y += 34;

  /* The verdict — large, centred, unmissable. */
  const word = WORD[payload.evidence_state] ?? 'Unknown';
  const vc = C[payload.evidence_state] ?? C.UNKNOWN;
  const vTop = y - 8;
  g.fillStyle = vc; g.font = UI(700, 52);
  g.fillText(word, PAD + 20, y);
  y += 62;
  if (payload.previous_state && payload.previous_state !== payload.evidence_state) {
    g.fillStyle = C.muted; g.font = UI(400, 23);
    g.fillText(`revised — was ${payload.previous_state}`, PAD + 20, y);
    y += 34;
  }
  /* The margin mark. This is the one bold element; everything else on
     the card stays quiet. */
  g.fillStyle = vc; g.fillRect(PAD, vTop, 5, y - vTop - 8);
  y += 10;

  /* Differences, then what we still don't know. Both travel with it. */
  y = block(g, 'Where they differ', payload.differences, y);
  y = block(g, "What we still don't know", payload.missing_fields, y, 3);

  /* Footer band: the citations ride along, so the card survives scrutiny. */
  const footH = 210;
  const footY = H - footH;
  g.fillStyle = C.card; g.fillRect(0, footY, W, footH);
  g.strokeStyle = C.rule; g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, footY + 0.5); g.lineTo(W, footY + 0.5); g.stroke();

  let fy = footY + 26;
  g.fillStyle = C.ink; g.font = UI(700, 28);
  g.fillText('wazi', PAD, fy);
  if (caseId) {
    g.font = UI(400, 22); g.fillStyle = C.muted;
    g.textAlign = 'right'; g.fillText(`case ${caseId}`, W - PAD, fy + 8); g.textAlign = 'left';
  }
  fy += 46;

  g.fillStyle = C.muted; g.font = UI(400, 19);
  const cites = payload.sources.slice(0, 4)
    .map((s) => `${s.publisher} (${fmtDate(s.published_at)})`).join(';  ');
  fy = wrap(g, `Sources: ${cites}`, PAD, fy, W - PAD * 2, 26, 3);
  g.fillText(`Generated ${fmtDate(new Date().toISOString())}`, PAD, fy + 4);

  /* Law 8 — a fixture is labelled in the artifact too, not just on screen. */
  if (hasFixture(payload)) {
    /* Overprinted like a stamp on a duplicate form, so it survives a
       screenshot without looking like a banner someone can crop. */
    g.strokeStyle = C.REPORTED; g.lineWidth = 2;
    g.strokeRect(PAD, footY - 58, W - PAD * 2, 42);
    g.fillStyle = C.REPORTED; g.font = UI(700, 21);
    g.fillText('DEMO DATA — CLEARLY LABELLED FIXTURE', PAD + 16, footY - 58 + 11);
  }

  return canvas;
}

function fmtValue(fact) {
  const v = typeof fact.value === 'number' ? fact.value.toLocaleString('en-KE') : fact.value;
  return fact.unit ? `${fact.unit} ${v}` : String(v);
}

function rule(g, y) {
  g.strokeStyle = C.rule; g.lineWidth = 1;
  g.beginPath(); g.moveTo(PAD, y + 0.5); g.lineTo(W - PAD, y + 0.5); g.stroke();
}

function block(g, heading, items, y, max = 4) {
  if (!items?.length) return y;
  g.fillStyle = C.muted; g.font = UI(500, 20);
  g.fillText(heading, PAD, y); y += 28;
  g.fillStyle = C.ink; g.font = UI(400, 23);
  for (const item of items.slice(0, max)) {
    /* A hanging rule rather than a bullet glyph. */
    g.strokeStyle = C.rule; g.lineWidth = 1;
    g.beginPath(); g.moveTo(PAD, y + 12.5); g.lineTo(PAD + 10, y + 12.5); g.stroke();
    y = wrap(g, item, PAD + 20, y, W - PAD * 2 - 20, 31, 2);
  }
  return y + 16;
}

/** Word-wrap with a hard line cap. Returns the new y. */
function wrap(g, text, x, y, maxW, lh, maxLines = 6) {
  const words = String(text).split(/\s+/);
  let line = '', lines = 0;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) {
      if (++lines >= maxLines) { g.fillText(`${line}…`, x, y); return y + lh; }
      g.fillText(line, x, y); y += lh; line = w;
    } else line = test;
  }
  if (line) { g.fillText(line, x, y); y += lh; }
  return y;
}

/** Web Share where available, download everywhere else. */
export async function shareTwoTruths(payload, { caseId, filename } = {}) {
  const canvas = renderShareImage(payload, { caseId, scale: 1 });
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('could not render the image');
  const name = filename ?? `wazi-${caseId || 'case'}.png`;
  const file = new File([blob], name, { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Wazi' }); return { shared: true }; }
    catch (err) { if (err?.name === 'AbortError') return { shared: false, cancelled: true }; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { shared: false, downloaded: true };
}
