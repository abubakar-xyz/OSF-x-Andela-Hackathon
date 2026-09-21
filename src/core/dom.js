/** Minimal DOM helpers. No framework, no build step — DESIGN.md §28
 *  budgets leave no room for one, and a static PWA cannot fail to build
 *  on stage. See DECISIONS.md. */

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  append(node, children);
  return node;
}

export function append(parent, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    parent.appendChild(typeof c === 'string' || typeof c === 'number'
      ? document.createTextNode(String(c)) : c);
  }
  return parent;
}

export const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); return node; };
export const $ = (sel, root = document) => root.querySelector(sel);

/** Relative, plain-language time. Freshness is stated in words; the
 *  absolute date lives on the source sheet. §12.5 */
export function relTime(iso, now = Date.now()) {
  if (!iso) return 'undated';
  const diff = now - Date.parse(iso);
  if (Number.isNaN(diff)) return 'undated';
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  if (days < 31) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  if (months < 24) return `${months} month${months === 1 ? '' : 's'} ago`;
  return `${Math.round(months / 12)} years ago`;
}

export function fmtDate(iso) {
  if (!iso) return 'undated';
  const d = new Date(iso);
  if (Number.isNaN(+d)) return 'undated';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
