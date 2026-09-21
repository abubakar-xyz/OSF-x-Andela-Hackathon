/**
 * Voice Roller — Rolling Civic Collaborator & Voice Selector.
 *
 * Provides a robust, interactive horizontal rolling / carousel selector
 * for Wazi's civic collaborator personas, complete with voice sample previews,
 * Gemini Live model pairing, and instant persona switching.
 */

import { el, clear } from '../core/dom.js';
import { PERSONAS, getAllPersonas, getActivePersonaId, setActivePersonaId, getPersona } from '../voice/personas.js';
import { getLanguage } from '../i18n/strings.js';

let previewUtterance = null;
let activePlayingBtn = null;

export function stopVoicePreview() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch {}
  }
  if (activePlayingBtn) {
    activePlayingBtn.dataset.playing = 'false';
    const isSw = getLanguage() === 'sw';
    activePlayingBtn.innerHTML = `<span>▶</span> <span>${isSw ? 'Sikiliza' : 'Listen Sample'}</span>`;
    activePlayingBtn = null;
  }
}

export function createVoiceRoller({ onSelect, onCancel } = {}) {
  const isSwahili = getLanguage() === 'sw';
  const personas = getAllPersonas();
  let currentId = getActivePersonaId();

  const container = el('div', { class: 'voice-roller', role: 'region', 'aria-label': 'Voice & Collaborator Selector' });

  // Header with title and explainer
  const header = el('div', { class: 'voice-roller__header' },
    el('div', { class: 'voice-roller__titles' },
      el('h3', { class: 'voice-roller__title', text: isSwahili ? 'Chagua Mshirika na Sauti ya Kiraia' : 'Select Civic Collaborator & Voice' }),
      el('p', { class: 'voice-roller__subtitle',
        text: isSwahili
          ? 'Tembeza kuchagua mshirika anayekufaa. Kila mmoja ana sauti ya kipekee, mtindo na uzoefu wa kuchambua rekodi za umma.'
          : 'Roll to choose your collaborator. Each pairs an authentic human voice with a distinct civic perspective for checking public records.'
      })
    )
  );

  // Rolling track container
  const trackWrapper = el('div', { class: 'voice-roller__wrapper' });
  const track = el('div', { class: 'voice-roller__track' });

  // Navigation chevrons
  const prevBtn = el('button', {
    class: 'voice-roller__nav voice-roller__nav--prev',
    type: 'button',
    'aria-label': 'Previous collaborator',
    innerHTML: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 18l-6-6 6-6"/></svg>',
    onclick: () => {
      stopVoicePreview();
      track.scrollBy({ left: -280, behavior: 'smooth' });
    }
  });

  const nextBtn = el('button', {
    class: 'voice-roller__nav voice-roller__nav--next',
    type: 'button',
    'aria-label': 'Next collaborator',
    innerHTML: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 18l6-6-6-6"/></svg>',
    onclick: () => {
      stopVoicePreview();
      track.scrollBy({ left: 280, behavior: 'smooth' });
    }
  });

  // Dots indicator
  const dotsContainer = el('div', { class: 'voice-roller__dots' });
  const cards = [];
  const dots = [];

  personas.forEach((p, idx) => {
    const isActive = p.id === currentId;

    const dot = el('button', {
      class: `voice-roller__dot ${isActive ? 'voice-roller__dot--active' : ''}`,
      type: 'button',
      'aria-label': `View ${p.name}`,
      onclick: () => {
        stopVoicePreview();
        const targetCard = cards[idx];
        targetCard?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    });
    dots.push(dot);
    dotsContainer.append(dot);

    const card = el('div', {
      class: `voice-card ${isActive ? 'voice-card--active' : ''}`,
      dataset: { personaId: p.id }
    });

    // Top row: Avatar + Names + Active Badge
    const avatar = el('div', {
      class: 'voice-card__avatar',
      style: { backgroundColor: p.badgeColor || '#2ec4b6' },
      text: p.name.charAt(0)
    });

    const info = el('div', { class: 'voice-card__info' },
      el('div', { class: 'voice-card__name-row' },
        el('h4', { class: 'voice-card__name', text: p.name }),
        el('span', { class: 'voice-card__tag', text: isSwahili ? (p.tagSw || p.tag) : p.tag })
      ),
      el('p', { class: 'voice-card__title', text: isSwahili ? (p.titleSw || p.title) : p.title })
    );

    const top = el('div', { class: 'voice-card__top' }, avatar, info);

    // Meta row: Voice model & accent
    const meta = el('div', { class: 'voice-card__meta' },
      el('span', { class: 'voice-card__badge voice-card__badge--voice', text: `🎙️ Voice: ${p.voice}` }),
      el('span', { class: 'voice-card__badge voice-card__badge--accent', text: p.accent })
    );

    // Bio description
    const bio = el('p', { class: 'voice-card__bio', text: isSwahili ? (p.bioSw || p.bio) : p.bio });

    // Actions: Preview button and Select button
    const previewBtn = el('button', {
      class: 'voice-card__btn voice-card__btn--preview',
      type: 'button',
      innerHTML: `<span>▶</span> <span>${isSwahili ? 'Sikiliza' : 'Listen Sample'}</span>`,
      onclick: (e) => {
        e.stopPropagation();
        if (activePlayingBtn === previewBtn) {
          stopVoicePreview();
          return;
        }
        stopVoicePreview();
        activePlayingBtn = previewBtn;
        previewBtn.dataset.playing = 'true';
        previewBtn.innerHTML = `<span>⏹</span> <span>${isSwahili ? 'Inasoma...' : 'Playing...'}</span>`;

        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          const sampleText = isSwahili ? (p.sampleSw || p.sampleEn) : p.sampleEn;
          const u = new SpeechSynthesisUtterance(sampleText);
          u.rate = p.rate || 0.96;
          u.pitch = p.pitch || 1.0;
          u.lang = isSwahili ? 'sw' : 'en-KE';

          u.onend = () => stopVoicePreview();
          u.onerror = () => stopVoicePreview();
          previewUtterance = u;
          window.speechSynthesis.speak(u);
        } else {
          setTimeout(stopVoicePreview, 3200);
        }
      }
    });

    const selectBtn = el('button', {
      class: `voice-card__btn voice-card__btn--select ${isActive ? 'voice-card__btn--selected' : ''}`,
      type: 'button',
      text: isActive ? (isSwahili ? '✓ Inatumika Sasa' : '✓ Active Voice') : (isSwahili ? 'Chagua Mshirika' : 'Choose Collaborator'),
      onclick: () => {
        stopVoicePreview();
        setActivePersonaId(p.id);
        currentId = p.id;

        // Update card active states
        cards.forEach((c) => {
          const isThis = c.dataset.personaId === p.id;
          c.classList.toggle('voice-card--active', isThis);
          const sel = c.querySelector('.voice-card__btn--select');
          if (sel) {
            sel.classList.toggle('voice-card__btn--selected', isThis);
            sel.textContent = isThis
              ? (isSwahili ? '✓ Inatumika Sasa' : '✓ Active Voice')
              : (isSwahili ? 'Chagua Mshirika' : 'Choose Collaborator');
          }
        });

        // Update dots
        dots.forEach((d, i) => {
          d.classList.toggle('voice-roller__dot--active', personas[i].id === p.id);
        });

        onSelect?.(p);
      }
    });

    const actions = el('div', { class: 'voice-card__actions' }, previewBtn, selectBtn);
    card.append(top, meta, bio, actions);
    cards.push(card);
    track.append(card);
  });

  // Track scroll observer to update dots
  let scrollTimeout = null;
  track.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const trackCenter = track.scrollLeft + track.clientWidth / 2;
      let closestIdx = 0;
      let minDistance = Infinity;

      cards.forEach((c, idx) => {
        const cardCenter = c.offsetLeft + c.offsetWidth / 2;
        const dist = Math.abs(trackCenter - cardCenter);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = idx;
        }
      });

      dots.forEach((d, i) => {
        d.classList.toggle('voice-roller__dot--active', i === closestIdx);
      });
    }, 80);
  }, { passive: true });

  trackWrapper.append(prevBtn, track, nextBtn);
  container.append(header, trackWrapper, dotsContainer);

  // Auto scroll to active persona on initial mount
  setTimeout(() => {
    const activeIdx = personas.findIndex((p) => p.id === currentId);
    if (activeIdx >= 0 && cards[activeIdx]) {
      cards[activeIdx].scrollIntoView({ inline: 'center', block: 'nearest' });
    }
  }, 100);

  return {
    el: container,
    destroy() {
      stopVoicePreview();
      container.remove();
    },
    scrollToActive() {
      const activeIdx = personas.findIndex((p) => p.id === getActivePersonaId());
      if (activeIdx >= 0 && cards[activeIdx]) {
        cards[activeIdx].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  };
}
