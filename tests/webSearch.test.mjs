/** Live web search grounding — honesty contract. Never a network call in
 *  this file; a fake `ai` client stands in, exactly the seam
 *  server/webSearch.mjs was written to expose. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { searchPublicRecords, trustTier } from '../server/webSearch.mjs';

const fakeAI = (response) => ({ models: { generateContent: async () => response } });

test('a grounded result carries only real sources, tiered by domain', async () => {
  const ai = fakeAI({
    text: 'Reports from the Ministry say the clinic was completed in 2024.',
    candidates: [{
      groundingMetadata: {
        groundingChunks: [
          { web: { uri: 'https://health.go.ke/notice/123', title: 'Ministry notice' } },
          { web: { uri: 'https://example-blog.com/rumor', title: 'A random blog' } },
        ],
      },
    }],
  });
  const r = await searchPublicRecords({ ai, model: 'gemini-flash-latest', query: 'X clinic' });
  assert.equal(r.ok, true);
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0].tier, 'credible');   // .go.ke
  assert.equal(r.sources[1].tier, 'unverified'); // arbitrary domain
  /* Never 'primary' — that word is earned by pack curation, not a search hit. */
  assert.ok(r.sources.every((s) => s.tier !== 'primary'));
});

test('no grounding chunks means refuse, not answer from memory', async () => {
  const ai = fakeAI({ text: 'I believe this was completed.', candidates: [{}] });
  const r = await searchPublicRecords({ ai, model: 'gemini-flash-latest', query: 'X clinic' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /no grounded result/);
});

test('a search failure is reported, never thrown past the caller', async () => {
  const ai = { models: { generateContent: async () => { throw new Error('quota exceeded'); } } };
  const r = await searchPublicRecords({ ai, model: 'gemini-flash-latest', query: 'X clinic' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /quota exceeded/);
});

test('no client configured refuses instead of crashing', async () => {
  const r = await searchPublicRecords({ ai: null, model: 'gemini-flash-latest', query: 'X clinic' });
  assert.equal(r.ok, false);
});

test('duplicate source URLs across chunks are not repeated', async () => {
  const ai = fakeAI({
    text: 'Two chunks pointing at the same page.',
    candidates: [{
      groundingMetadata: {
        groundingChunks: [
          { web: { uri: 'https://ppra.go.ke/tender/1' } },
          { web: { uri: 'https://ppra.go.ke/tender/1' } },
        ],
      },
    }],
  });
  const r = await searchPublicRecords({ ai, model: 'gemini-flash-latest', query: 'tender' });
  assert.equal(r.sources.length, 1);
});

test('the real API shape: an opaque redirect URI with the domain in `title` is tiered by title, not by the redirect host', async () => {
  /* Confirmed against a live call with a real key: the direct Gemini API
     never populates web.domain, web.uri is always an opaque
     vertexaisearch.cloud.google.com redirect, and web.title reliably
     carries the bare source domain — including for non-government sites
     like facebook.com, which is exactly why this still has to check the
     real domain rather than trusting the search result at face value. */
  const ai = fakeAI({
    text: 'PPRA is the procurement regulator; also indexed on Facebook.',
    candidates: [{
      groundingMetadata: {
        groundingChunks: [
          { web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AAA', title: 'ppra.go.ke' } },
          { web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/BBB', title: 'facebook.com' } },
        ],
      },
    }],
  });
  const r = await searchPublicRecords({ ai, model: 'gemini-flash-latest', query: 'PPRA' });
  assert.equal(r.ok, true);
  assert.equal(r.sources[0].domain, 'ppra.go.ke');
  assert.equal(r.sources[0].tier, 'credible');
  assert.equal(r.sources[1].domain, 'facebook.com');
  assert.equal(r.sources[1].tier, 'unverified');
  /* The clickable link stays the real (working) redirect URI either way. */
  assert.match(r.sources[0].url, /^https:\/\/vertexaisearch\.cloud\.google\.com\//);
});

test('trustTier: only a government suffix earns credible, everything else is unverified', () => {
  assert.equal(trustTier('health.go.ke'), 'credible');
  assert.equal(trustTier('ppra.go.ke'), 'credible');
  assert.equal(trustTier('example.com'), 'unverified');
  assert.equal(trustTier('blog.wordpress.com'), 'unverified');
  assert.equal(trustTier(''), 'unverified');
});
