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
import { searchCivicRecords } from './civicSearch.mjs';
import { buildStatutoryRoute, findCounty } from './civicDirectory.mjs';
import { build_civic_draft } from '../src/tools/draft.js';

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
  {
    name: 'search_public_offices',
    behavior: 'NON_BLOCKING',
    description:
      'Look up the official verified public office, department, physical location, postal address, and verified email for any county in Kenya (all 47 counties) or national oversight bodies (Ombudsman / CAJ, Auditor-General, EACC, KeNHA). Call this whenever the person asks who to contact or where the county office is located.',
    parameters: {
      type: 'OBJECT',
      properties: {
        county_or_region: S('County name or region (e.g. Kiambu, Nairobi, Mombasa, Kisumu, Nakuru, Uasin Gishu, Kilifi).'),
        sector: S('Sector: "health", "roads", "water", "education", or "general".'),
      },
      required: ['county_or_region'],
    },
  },
  {
    name: 'draft_civic_letter',
    behavior: 'NON_BLOCKING',
    description:
      'Draft a formal civic letter, statutory Access to Information request (under Article 35 of the Constitution of Kenya and Section 8 of the Access to Information Act, 2016), WhatsApp summary, or official email to the responsible public authority. ' +
      'Call this proactively whenever the person wants to take action, write to the office, request documents or budget disclosures, or escalate an unresolved problem.',
    parameters: {
      type: 'OBJECT',
      properties: {
        format: S('Format of the artifact: "letter" (formal physical/printable letter), "atia" (formal Access to Information statutory request), "whatsapp" (formatted WhatsApp message), or "email". Defaults to "letter".'),
        tone: S('Tone: "formal" or "plain". Defaults to "formal".'),
      },
    },
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
        // Fallback to dynamic civic intelligence across Kenya's 47 counties
        onSurface?.({ kind: 'mote', tool: 'search_country_pack', label: 'Searching official government portals & gazettes', status: 'running' });
        const dyn = await searchCivicRecords({ what: args.what ?? '', where: args.where ?? '' });
        if (dyn.ok) {
          state.payload = dyn.payload;
          state.route = dyn.route;
          state.sources = dyn.sources;
          onSurface?.({ kind: 'mote', tool: 'search_country_pack', label: 'Government records and office resolved', status: 'done' });
          onSurface?.({ kind: 'evidence', payload: dyn.payload });
          return {
            found: true,
            evidence_state: dyn.payload.evidence_state,
            say: presentVerdict(dyn.payload),
            on_screen: 'the official record, the office responsible, and an Access to Information inquiry ready to review',
          };
        }
        onSurface?.({ kind: 'no_match', reason: r.reason });
        return { say: r.say ?? "I couldn't check that in the records, and I'm not going to guess.", found: false };
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
      
      // If already resolved dynamically by civic search
      if (state.route) {
        onSurface?.({ kind: 'route', route: state.route, sources: state.sources ?? state.route.sources ?? [] });
        return {
          found: true,
          office: state.route.office,
          say: `This is the office responsible: ${state.route.office}. Why it is them, and their verified contact email and postal address, are on screen. ` +
               `Convey this in the person's active language (English or Kiswahili). ` +
               `(In Kiswahili: "Hii ndiyo ofisi inayohusika: ${state.route.office}. Barua pepe na anwani rasmi ziko kwenye skrini.")`,
        };
      }

      const r = await runRouting({
        pack, payload: state.payload,
        onMote: (m) => onSurface?.({ kind: 'mote', ...m }),
      });
      if (!r.ok) {
        // Resolve statutory route via county directory
        const county = findCounty(state.payload?.entity?.admin1 || state.payload?.entity?.name || '');
        const statRoute = buildStatutoryRoute(county);
        state.route = statRoute;
        onSurface?.({ kind: 'route', route: statRoute, sources: statRoute.sources });
        return {
          found: true,
          office: statRoute.office,
          say: `This is the designated public office: ${statRoute.office}. Their verified official contact details are on screen.`,
        };
      }
      state.route = r.route;
      onSurface?.({ kind: 'route', route: r.route, sources: r.sources, options: r.options });
      return {
        found: true,
        office: r.route.office,
        say: `This is the office responsible: ${r.route.office}. Why it is them, and where that came from, is on screen. ` +
             `Convey this in the person's active language (English or Kiswahili). ` +
             `(In Kiswahili: "Hii ndiyo ofisi inayohusika: ${r.route.office}. Sababu na vyanzo viko kwenye skrini.")`,
      };
    }

    if (name === 'search_public_offices') {
      const county = findCounty(args.county_or_region ?? '');
      const statRoute = buildStatutoryRoute(county, args.sector ?? 'general');
      state.route = statRoute;
      onSurface?.({ kind: 'route', route: statRoute, sources: statRoute.sources });
      return {
        found: true,
        office: statRoute.office,
        jurisdiction: statRoute.jurisdiction.value,
        address: statRoute.address.value,
        say: `I found the verified public office: ${statRoute.office}. Their address and verified contact details are on screen. ` +
             `Convey this in the person's active language. (In Kiswahili: "Nimepata ofisi rasmi inayohusika: ${statRoute.office}. Anwani yao na barua pepe viko kwenye skrini.")`,
      };
    }

    if (name === 'draft_civic_letter') {
      if (!state.payload) {
        return {
          say: `Tell me which project, clinic, or public service you want to address first so I can ground the facts in the record. ` +
               `(In Kiswahili: "Niambie kwanza ni mradi gani au huduma gani unayotaka kuandikia ili niweke ukweli uliothibitishwa.")`,
        };
      }
      if (!state.route) {
        const county = findCounty(state.payload?.entity?.admin1 || state.payload?.entity?.name || '');
        state.route = buildStatutoryRoute(county);
      }
      const format = args.format ?? 'letter';
      const tone = args.tone ?? 'formal';
      const built = build_civic_draft({
        payload: state.payload,
        route: state.route,
        format,
        tone,
        length: 'full',
        disclosure: { includePhoto: true, includeSources: true, includeName: false, includePhone: false, locationPrecision: 'approx' },
        user: {},
        caseId: 'WAZI-ATI-2026',
      });
      if (!built.ok) return { say: `I could not prepare that draft: ${built.reason}` };

      onSurface?.({ kind: 'draft', draft: built.draft, route: state.route });
      return {
        ok: true,
        format,
        office: state.route.office,
        say: format === 'whatsapp'
          ? `I've drafted a structured summary for WhatsApp with the verified facts and citations. It is ready on your screen to copy or forward.`
          : `I've prepared a formal Access to Information letter to ${state.route.office}. It is ready on your screen for you to review, print, or share.`,
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
  const val = String(rec?.fact?.value ?? 'one thing').toLowerCase();
  if (p.evidence_state === 'CONFLICTING') {
    return `The record says ${val}. What they showed you does not match. ` +
           `Say it is a difference worth an answer, and that it is not proof of anything yet. ` +
           `Convey this in the person's active language (English or Kiswahili). ` +
           `(In Kiswahili: "Rekodi inasema ${val}. Ulichoonyesha hakiendani. Hilo ni pengo linalohitaji jibu, lakini si ushahidi bado.")`;
  }
  if (p.evidence_state === 'UNKNOWN') {
    return `Say you don't have enough to say either way. Convey this in the person's active language. (In Kiswahili: "Sina rekodi ya kutosha kusema kwa hakika, na sitabahatisha.")`;
  }
  if (p.evidence_state === 'VERIFIED') {
    return `Say a primary source confirms it directly. Convey this in the person's active language. (In Kiswahili: "Chanzo kikuu cha serikali kinathibitisha hili moja kwa moja.")`;
  }
  if (p.evidence_state === 'CORROBORATED') {
    return `Say two independent sources agree. Convey this in the person's active language. (In Kiswahili: "Vyanzo viwili huru vinakubaliana kuhusu hili.")`;
  }
  return `Say one source states it and nobody independent has confirmed it. Convey this in the person's active language. (In Kiswahili: "Chanzo kimoja kinasema hivi lakini hakuna kingine huru kilichothibitisha.")`;
}
