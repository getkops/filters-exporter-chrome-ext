#!/usr/bin/env node
/**
 * anonymize-export.mjs — deterministic anonymizer for raw V-Tools / Souk.to API
 * captures, so example exports can be committed as fixtures without leaking the
 * source account.
 *
 * Threat model: V-Tools or Souk must NOT be able to trace a committed fixture
 * back to the account it came from. The account is identifiable by:
 *   - strong IDs:   user_id, client_id, alert/filter UUIDs
 *   - correlatable: created_at / updated_at timestamps
 *   - free text:    alert/filter names and the user's actual keyword terms
 * All of those are replaced with deterministic synthetic values. Public Vinted
 * catalog data (catalog/color/material/status/country IDs + their generic
 * titles) is kept because it identifies a *category*, not an account — but brand
 * and model titles (which reflect the account's specific interests) are
 * genericized to "Brand <id>" / "Model <id>" while keeping their numeric IDs.
 *
 * The transform preserves STRUCTURE exactly (array lengths, keyword group counts
 * and sizes, operator types, facet IDs), so the output still exercises every
 * parser code path. It is deterministic (no randomness, fixed timestamps), so
 * re-running yields identical output.
 *
 * Usage:
 *   node scripts/anonymize-export.mjs <input.json> [more.json ...] [--out <file>]
 *   # one input + --out  → writes <file>
 *   # otherwise          → writes <input>.anon.json next to each input
 */

import { readFileSync, writeFileSync } from 'node:fs';

const FIXED_TS_ISO = '2020-01-01T00:00:00Z';
const FIXED_TS_EPOCH = 1577836800; // 2020-01-01T00:00:00Z

// Neutral wordlist for keyword/name synthesis; deterministic by first-seen order.
const WORDS = [
  'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel',
  'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa',
  'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey',
  'xray', 'yankee', 'zulu',
];

/** A per-file deterministic real-token → synthetic-token map. */
function makeTokenizer() {
  const seen = new Map();
  return (raw) => {
    const key = String(raw);
    if (!seen.has(key)) {
      const n = seen.size;
      seen.set(key, n < WORDS.length ? WORDS[n] : `term${n}`);
    }
    return seen.get(key);
  };
}

function isObj(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

/** Genericize an array of {id/value, title} facet items by setting title=prefix+id. */
function genericizeTitles(arr, prefix, idKey) {
  if (!Array.isArray(arr)) return arr;
  return arr.map((item) => {
    if (!isObj(item)) return item;
    const id = item[idKey];
    return { ...item, title: id != null ? `${prefix} ${id}` : `${prefix}` };
  });
}

// ─── Souk ──────────────────────────────────────────────────────────

function anonymizeSouk(resp) {
  const alerts = resp?.body?.alerts;
  if (!Array.isArray(alerts)) throw new Error('not a Souk response (body.alerts missing)');

  const out = structuredClone(resp);
  out.body.alerts = alerts.map((alert, i) => {
    const tok = makeTokenizer(); // per-alert: tokens need only be consistent within a filter
    const a = { ...alert };

    a.id = `example-souk-${i + 1}`;
    if ('user_id' in a) a.user_id = 0;
    if ('folder_id' in a) a.folder_id = 'default';
    if ('created_at' in a) a.created_at = FIXED_TS_ISO;
    if ('updated_at' in a) a.updated_at = FIXED_TS_ISO;
    if ('name' in a) a.name = `Example alert ${i + 1}`;

    if (Array.isArray(a.keyword_groups_v2)) {
      a.keyword_groups_v2 = a.keyword_groups_v2.map((g) => (Array.isArray(g) ? g.map(tok) : g));
    }
    if (Array.isArray(a.negative_keywords_v2)) {
      a.negative_keywords_v2 = a.negative_keywords_v2.map(tok);
    }
    if (typeof a.search_text === 'string' && a.search_text.trim() !== '') {
      a.search_text = a.search_text
        .trim()
        .split(/\s+/)
        .map((w) => (w.startsWith('-') && w.length > 1 ? `-${tok(w.slice(1))}` : tok(w)))
        .join(' ');
    }

    // Brand/model titles reflect the account's specific interests → genericize.
    a.brands = genericizeTitles(a.brands, 'Brand', 'id');
    a.models = genericizeTitles(a.models, 'Model', 'id');
    // catalogs/colors/materials/status/countries: public category data — kept.

    return a;
  });
  return out;
}

// ─── V-Tools V2 ────────────────────────────────────────────────────

function anonymizeVTools(resp) {
  const list = resp?.data?.list;
  if (!Array.isArray(list)) throw new Error('not a V-Tools V2 response (data.list missing)');

  const out = structuredClone(resp);
  out.data.list = list.map((filter, i) => {
    const tok = makeTokenizer();
    const f = { ...filter };

    if ('client_id' in f) f.client_id = 'clt_example';
    f.filter_id = `flt_example${i + 1}`;
    if ('created_at' in f) f.created_at = FIXED_TS_EPOCH;
    if ('updated_at' in f) f.updated_at = FIXED_TS_EPOCH;
    if ('name' in f) f.name = `Example filter ${i + 1}`;

    if (Array.isArray(f.components)) {
      f.components = f.components.map((c) => {
        if (!isObj(c)) return c;
        if (c.type === 'keyword' && Array.isArray(c.value)) {
          return { ...c, value: c.value.map(tok) };
        }
        if (c.type === 'brand' && Array.isArray(c.value)) {
          return { ...c, value: genericizeTitles(c.value, 'Brand', 'value') };
        }
        return c;
      });
    }
    return f;
  });
  return out;
}

// ─── CLI ───────────────────────────────────────────────────────────

function anonymize(raw) {
  if (raw?.body?.alerts) return anonymizeSouk(raw);
  if (raw?.data?.list) return anonymizeVTools(raw);
  throw new Error('unrecognized export shape (expected Souk body.alerts or V-Tools data.list)');
}

function main(argv) {
  const args = argv.slice(2);
  const outIdx = args.indexOf('--out');
  let outFile = null;
  if (outIdx !== -1) {
    outFile = args[outIdx + 1];
    args.splice(outIdx, 2);
  }
  if (args.length === 0) {
    console.error('usage: node scripts/anonymize-export.mjs <input.json> [more.json ...] [--out <file>]');
    process.exit(2);
  }
  if (outFile && args.length > 1) {
    console.error('--out can only be used with a single input file');
    process.exit(2);
  }

  for (const input of args) {
    const raw = JSON.parse(readFileSync(input, 'utf8'));
    const anon = anonymize(raw);
    const dest = outFile ?? input.replace(/\.json$/i, '') + '.anon.json';
    writeFileSync(dest, JSON.stringify(anon, null, 2) + '\n');
    console.log(`anonymize: ${input} → ${dest}`);
  }
}

main(process.argv);
