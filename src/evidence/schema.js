/**
 * Wazi — a very small schema validator.  DESIGN.md §19.
 *
 * Zero dependencies on purpose: this runs at both boundaries (server
 * response in, component render out) and on a phone with 200MB of data
 * left. The failure mode it guards against is not a bug — it is a model
 * helpfully inventing a plausible contract value. A payload that does not
 * validate becomes `tool_failed`; it never reaches a component.
 */

const ISO = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/;

const def = (check, name) => ({ __schema: true, name, check });

export const S = {
  str: (opts = {}) => def((v, p, e) => {
    if (typeof v !== 'string') return e.push(`${p}: expected string, got ${typeof v}`);
    if (opts.min != null && v.length < opts.min) e.push(`${p}: shorter than ${opts.min}`);
    if (opts.nonEmpty && !v.trim()) e.push(`${p}: must not be blank`);
  }, 'string'),

  num: (opts = {}) => def((v, p, e) => {
    if (typeof v !== 'number' || Number.isNaN(v)) return e.push(`${p}: expected number`);
    if (opts.min != null && v < opts.min) e.push(`${p}: below ${opts.min}`);
  }, 'number'),

  bool: () => def((v, p, e) => {
    if (typeof v !== 'boolean') e.push(`${p}: expected boolean`);
  }, 'boolean'),

  /** ISO date. `null` is legal and must be DISPLAYED as "undated" — an
   *  undated source is a fact about the source, not a missing field. §19 */
  iso: () => def((v, p, e) => {
    if (typeof v !== 'string' || !ISO.test(v)) e.push(`${p}: expected ISO date, got ${JSON.stringify(v)}`);
  }, 'iso'),

  oneOf: (vals) => def((v, p, e) => {
    if (!vals.includes(v)) e.push(`${p}: expected one of ${vals.join('|')}, got ${JSON.stringify(v)}`);
  }, 'oneOf'),

  arr: (inner, opts = {}) => def((v, p, e) => {
    if (!Array.isArray(v)) return e.push(`${p}: expected array`);
    if (opts.min != null && v.length < opts.min) e.push(`${p}: needs at least ${opts.min} item(s)`);
    v.forEach((item, i) => inner.check(item, `${p}[${i}]`, e));
  }, 'array'),

  obj: (shape, opts = {}) => def((v, p, e) => {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) {
      return e.push(`${p}: expected object`);
    }
    for (const [k, sub] of Object.entries(shape)) {
      /* An explicitly-undefined key is absent, not present-and-wrong.
         Otherwise `{ unit: undefined }` fails a perfectly valid payload. */
      const present = Object.prototype.hasOwnProperty.call(v, k) && v[k] !== undefined;
      if (!present) {
        if (!sub.__optional) e.push(`${p}.${k}: missing`);
        continue;
      }
      sub.check(v[k], `${p}.${k}`, e);
    }
    if (opts.strict) {
      for (const k of Object.keys(v)) {
        if (!(k in shape)) e.push(`${p}.${k}: unexpected key`);
      }
    }
  }, 'object'),

  opt: (inner) => ({ ...inner, __optional: true }),
  nullable: (inner) => def((v, p, e) => { if (v !== null) inner.check(v, p, e); }, 'nullable'),
  any: () => def(() => {}, 'any'),
};

export function validate(schema, value, path = 'value') {
  const errors = [];
  schema.check(value, path, errors);
  return { ok: errors.length === 0, errors, value };
}

/** Throws on invalid. Used at the boundary where a bad payload must not
 *  be allowed to continue into the interface. */
export function assertValid(schema, value, label = 'payload') {
  const r = validate(schema, value, label);
  if (!r.ok) {
    const err = new Error(`${label} failed validation:\n  ${r.errors.join('\n  ')}`);
    err.name = 'SchemaError';
    err.errors = r.errors;
    throw err;
  }
  return value;
}
