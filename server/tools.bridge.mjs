/**
 * Wazi's tool contracts, declared to the Live model.  DESIGN.md §23.1, §24.
 *
 * Every declaration is NON_BLOCKING, which is required by
 * gemini-3.8-live-extended-thinking and is the default on
 * gemini-3.8-live. That is what lets Wazi keep talking while the
 * evidence worker runs — the conversational fillers the model speaks
 * during background reasoning are the audible half of the motes in §8.4.
 *
 * These execute HERE, on the server. If they ran in the browser the
 * browser would decide what counts as evidence, which is the one thing
 * the architecture exists to prevent.
 */

import { runVerification, runChallenge, runRouting } from '../src/evidence/pipeline.js';
import { classify_civic_intent } from '../src/tools/index.js';
import { DANGER_LINE } from '../src/evidence/safety.js';

const S = (description) => ({ type: 'STRING', description });

export const DECLARATIONS = [
  {
    name: 'check_public_record',
    behavior: 'NON_BLOCKING',
    description:
      'Look up what the official public record says about a project, facility or service the ' +
      'person is asking about, and compare it with anything they have shown you. Call this ' +
      'whenever the person asks whether something was built, finished, funded or delivered. ' +
      'Returns a presentation payload only — never raw evidence.',
    parameters: {
      type: 'OBJECT',
      properties: {
        what: S('The project, facility or service in the person\'s own words.'),
        where: S('Any location clue they gave. Empty string if none.'),
      },
      required: ['what'],
    },
  },
  {
    name: 'challenge_last_finding',
    behavior: 'NON_BLOCKING',
    description:
      'Run a second, adversarial pass over the last finding that actively tries to prove it ' +
      'wrong — a newer record, a mistaken identity, a wrong jurisdiction. Call this when the ' +
      'person questions the answer, or asks you to check again. It is allowed to change the ' +
      'verdict, and saying so plainly is the point.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'find_who_is_responsible',
    behavior: 'NON_BLOCKING',
    description:
      'Find the public office responsible for the thing that was last checked, and a contact ' +
      'route that has been verified. Call this when the person wants to act, complain, or write ' +
      'to someone. If no route has been verified, this returns a refusal — read it out; do not ' +
      'invent an address.',
    parameters: { type: 'OBJECT', properties: {} },
  },
];

/**
 * A tool's return value is a SHORT presentation payload: one or two
 * sentences of already-decided language plus a pointer to what is now on
 * screen. The Live model never receives the evidence itself, so it is
 * never in a position to invent a figure from it. §23.1
 */
export function createToolRunner({ pack, onSurface, online = false }) {
  const state = { payload: null, route: null };

  const run = async (name, args = {}) => {
    if (name === 'check_public_record') {
      const intent = classify_civic_intent(args.what ?? '', {});
      if (intent.intent === 'danger') {
        onSurface?.({ kind: 'safety' });
        return { say: DANGER_LINE, stop_investigation: true };
      }
      const r = await runVerification({
        pack, utterance: args.what ?? '', online,
        onMote: (m) => onSurface?.({ kind: 'mote', ...m }),
      });
      if (!r.ok) {
        onSurface?.({ kind: 'no_match', reason: r.reason });
        return { say: r.say ?? "I couldn't check that, and I'm not going to guess.", found: false };
      }
      state.payload = r.payload;
      onSurface?.({ kind: 'evidence', payload: r.payload });
      return {
        found: true,
        evidence_state: r.payload.evidence_state,
        say: presentVerdict(r.payload),
        on_screen: 'the record, your photograph, where they differ, and every source with its date',
      };
    }

    if (name === 'challenge_last_finding') {
      if (!state.payload) return { say: 'There is nothing checked yet to challenge.' };
      const r = await runChallenge({
        pack, payload: state.payload, online,
        onMote: (m) => onSurface?.({ kind: 'mote', ...m }),
      });
      if (!r.ok) return { say: r.say };
      state.payload = r.payload;
      onSurface?.({ kind: 'evidence', payload: r.payload });
      return { changed: r.changed, say: r.say, evidence_state: r.payload.evidence_state };
    }

    if (name === 'find_who_is_responsible') {
      if (!state.payload) return { say: 'Nothing has been checked yet, so there is nobody to write to.' };
      const r = await runRouting({
        pack, payload: state.payload,
        onMote: (m) => onSurface?.({ kind: 'mote', ...m }),
      });
      if (!r.ok) {
        onSurface?.({ kind: 'no_route', reason: r.reason });
        return { found: false, say: r.say };
      }
      state.route = r.route;
      onSurface?.({ kind: 'route', route: r.route, sources: r.sources, options: r.options });
      return {
        found: true,
        office: r.route.office,
        say: 'This is the office responsible. Why it is them, and where that came from, is on screen.',
      };
    }

    return { say: `Unknown tool ${name}.` };
  };

  return { run, state };
}

/** The verdict sentence is decided here, from the payload — not
 *  generated by the conversational model. §23.1 */
function presentVerdict(p) {
  const rec = p.record.find((r) => r.verbatim);
  if (p.evidence_state === 'CONFLICTING') {
    return `The record says ${String(rec?.fact?.value ?? 'one thing').toLowerCase()}. ` +
           `What they showed you does not match. Say it is a difference worth an answer, ` +
           `and that it is not proof of anything yet.`;
  }
  if (p.evidence_state === 'UNKNOWN') return "Say you don't have enough to say either way.";
  if (p.evidence_state === 'VERIFIED') return 'Say a primary source confirms it directly.';
  if (p.evidence_state === 'CORROBORATED') return 'Say two independent sources agree.';
  return 'Say one source states it and nobody independent has confirmed it.';
}
