import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { normalizeDictionarySearch } from "../src/lib/dictionarySearch.ts";

// Optional first argument: an externally installed PGlite module path.
// This script only creates an in memory disposable database. No credentials.
const runtime = process.argv[2] ? pathToFileURL(resolve(process.argv[2])).href : "@electric-sql/pglite";
const { PGlite } = await import(runtime);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const db = new PGlite();
const load = (path) => readFile(resolve(root, path), "utf8");
const queries = ["מבחןקודקס", "מִבְחָןקוֹדֶקְס", "מבחןקודקסתי", "מבחןקודקסותי",
  "ובמבחןקודקס", "codexmarkre", "מבכחןקודקס", "mivhancodxe", "be lost",
  "test—codexquiz", "codexmarker", "test", "tx", "zzzxqv-not-a-word", "", "מ", "codex"];
const result = async (query, direct = false) => (await db.query(
  `SELECT * FROM public.${direct ? "search_dictionary_suggestions_direct" : "search_dictionary_suggestions"}($1, 8)`, [query]
)).rows;
const report = { source: "disposable PGlite database with synthetic dictionary fixtures", checks: [], timings: {}, plans: {} };

try {
  await db.exec("CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE public.vocabulary(id integer PRIMARY KEY);");
  await db.exec(await load("supabase/migrations/06_dictionary_entries.sql"));
  await db.exec(await load("supabase/migrations/17_dictionary_search.sql"));
  await db.exec(await load("supabase/tests/17_dictionary_search.sql"));
  const fixtures = (await load("supabase/tests/17_dictionary_search.sql")).split("DO $$")[0];
  await db.exec(fixtures + "COMMIT;");
  const baseline = new Map();
  for (const query of queries) baseline.set(query, await result(query));
  await db.exec(await load("supabase/migrations/18_dictionary_search_performance.sql"));
  // Repeated application must be safe.
  await db.exec(await load("supabase/migrations/18_dictionary_search_performance.sql"));
  for (const query of queries) {
    assert.deepEqual(await result(query), baseline.get(query), `Complete search changed for ${query}`);
    const direct = await result(query, true);
    assert.deepEqual(direct, baseline.get(query).filter((row) => !["fuzzy", "fuzzy_form"].includes(row.match_type)), `Direct ranking changed for ${query}`);
  }
  report.checks.push("migration idempotence", "17 query result and ranking comparisons");
  for (const value of ["שלום", "מִבְחָן", "Test—CODExquiz", "’be lost’", "a_b%", "test + test", "🧪test", "a\u00a0b"]) {
    const sql = (await db.query("SELECT public.normalize_dictionary_search($1) AS value", [value])).rows[0].value;
    assert.equal(normalizeDictionarySearch(value), sql, `Normalization mismatch for ${value}`);
  }
  report.checks.push("client and database normalization equivalence");
  await db.exec("DELETE FROM public.dictionary_entries;");
  await db.exec(await load("supabase/tests/17_dictionary_search.sql"));
  await db.exec(await load("supabase/tests/18_dictionary_search_performance.sql"));
  report.checks.push("existing dictionary fixture suite", "direct mode, permissions, and skipped spelling work");
  await db.exec(fixtures + "COMMIT;");
  // Shared meanings exercise deduplication before edit distance calculation.
  await db.exec(`INSERT INTO public.dictionary_entries(pealim_id,slug,url,word,word_with_nekudot,transliteration,part_of_speech,meaning)
    SELECT n, 'benchmark-' || n, 'https://example.invalid/benchmark-' || n,
      'סמן' || n, 'סמן' || n, 'marker' || n, 'Noun', 'test, benchmark, sample'
    FROM generate_series(1, 5000) n;
    ANALYZE public.dictionary_entries; ANALYZE public.dictionary_search_terms;`);
  await db.exec("VACUUM ANALYZE public.dictionary_search_terms;");
  await db.exec("VACUUM ANALYZE public.dictionary_entries;");
  const sampleQueries = ["מבחןקודקס", "test", "mivhancodxe", "codex", "tx"];
  for (const direct of [true, false]) {
    const samples = [];
    const perQuery = Object.fromEntries(sampleQueries.map((query) => [query, []]));
    for (let round = 0; round < 10; round++) {
      for (const query of sampleQueries) {
        const started = performance.now();
        await result(query, direct);
        const elapsed = performance.now() - started;
        samples.push(elapsed);
        perQuery[query].push(elapsed);
      }
    }
    samples.sort((a, b) => a - b);
    report.timings[direct ? "direct" : "complete"] = { samples: samples.length,
      p50Ms: Number(samples[Math.floor(samples.length * 0.5)].toFixed(2)),
      p95Ms: Number(samples[Math.ceil(samples.length * 0.95) - 1].toFixed(2)),
      perQueryMeanMs: Object.fromEntries(Object.entries(perQuery).map(([query, values]) => [query, Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2))])) };
  }
  for (const [name, sql] of [
    ["prefix", "SELECT pealim_id FROM public.dictionary_search_terms WHERE normalized_term COLLATE \"C\" >= 'mivhan' COLLATE \"C\" AND normalized_term COLLATE \"C\" < 'mivhao' COLLATE \"C\""],
    ["spelling", "SELECT DISTINCT t.pealim_id FROM unnest(public.dictionary_search_deletes('mivhancodxe')) q(value) JOIN public.dictionary_search_terms t ON t.delete_keys @> ARRAY[q.value]"],
  ]) {
    const rows = (await db.query(`EXPLAIN (ANALYZE, BUFFERS) ${sql}`)).rows;
    report.plans[name] = rows.map((row) => row["QUERY PLAN"]);
    assert.match(report.plans[name].join("\n"), /Index|Bitmap/, `${name} query did not use an index`);
  }
  const migration = await load("supabase/migrations/18_dictionary_search_performance.sql");
  const candidateSql = migration.slice(migration.indexOf("  WITH query_deletes AS MATERIALIZED"), migration.indexOf("  SELECT e.pealim_id", migration.indexOf("  WITH query_deletes AS MATERIALIZED")))
    .replaceAll("normalized_query", "$1").replaceAll("max_distance", "$2").replaceAll("direct_ids", "$3::integer[]")
    + " SELECT * FROM best";
  report.plans.completeCandidates = (await db.query("EXPLAIN (ANALYZE, BUFFERS) " + candidateSql, ["mivhancodxe", 2, []])).rows.map((row) => row["QUERY PLAN"]);
  assert.match(report.plans.completeCandidates.join("\n"), /dictionary_search_terms_delete_keys_idx/, "Complete candidate lookup did not use the GIN index");
  report.checks.push("prefix and spelling index plans, including the complete candidate query");
  report.rowCounts = (await db.query("SELECT (SELECT count(*)::integer FROM public.dictionary_entries) AS entries, (SELECT count(*)::integer FROM public.dictionary_search_terms) AS terms")).rows[0];
  const output = resolve(root, "outputs", `dictionary_search_validation_${new Date().toISOString().replace(/[:.]/g, "_")}.json`);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ checks: report.checks, timings: report.timings, rowCounts: report.rowCounts, output }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ error: error.message, code: error.code, where: error.where, plans: report.plans, timings: report.timings }));
  process.exitCode = 1;
} finally {
  await db.close();
}
