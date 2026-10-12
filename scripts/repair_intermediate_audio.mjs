import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

// Grain: one audio file and one published record per level and episode number.
// Run with node --env-file=.env scripts/repair_intermediate_audio.mjs [--apply].
// The default prepares and validates files without changing remote records.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LEVEL = "intermediate";
const EPISODES = [14, 15, 16, 17, 18, 19];
const SOURCE_DIR = path.join(ROOT, "missing_audios");
const INPUT_DIR = path.join(ROOT, "inputs", "episode_audio_repair");
const CATALOG_PATH = path.join(ROOT, "pipeline", "data", "episodes.json");
const APPLY = process.argv.includes("--apply");
const BUCKET = process.env.SUPABASE_AUDIO_BUCKET || "episode-audio";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function check(condition, message) {
  if (!condition) throw new Error(message);
}

async function recoverEpisode19(sourceUrl) {
  const target = path.join(INPUT_DIR, "HT_19_FULL.mp3");
  try {
    await fs.access(target);
    return target;
  } catch {
    // Use the original episode record as the source of truth for this file.
  }
  const source = new globalThis.URL(sourceUrl);
  check(source.protocol === "https:" && source.hostname === "drive.google.com",
    "Episode 19 needs a local MP3 or its original Google Drive source");
  source.searchParams.set("confirm", "t");
  const response = await fetch(source, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(120_000),
  });
  check(response.ok && response.headers.get("content-type")?.startsWith("audio/"),
    `Episode 19 source did not return audio (${response.status})`);
  check(/HT_19_FULL\.mp3/i.test(response.headers.get("content-disposition") || ""),
    "Episode 19 source filename does not match the episode");
  const bytes = Buffer.from(await response.arrayBuffer());
  const length = Number(response.headers.get("content-length"));
  check(!length || bytes.length === length, "Episode 19 download is incomplete");
  await fs.mkdir(INPUT_DIR, { recursive: true });
  await fs.writeFile(target, bytes, { flag: "wx" });
  console.log("Recovered episode 19 from its original Google Drive source");
  return target;
}

async function main() {
  check(URL && KEY, "Missing Supabase server configuration");
  const client = createClient(URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const storage = client.storage.from(BUCKET);
  const { data: rows, error } = await client.from("episodes")
    .select("id,level_slug,episode_number,audio_url,is_published")
    .eq("level_slug", LEVEL).in("episode_number", EPISODES).order("episode_number");
  check(!error, `Episode lookup failed: ${error?.message}`);
  check(rows.length === EPISODES.length &&
    new Set(rows.map((row) => row.episode_number)).size === EPISODES.length &&
    rows.every((row) => row.is_published), "Expected six unique published episodes");
  const originalCatalog = await fs.readFile(CATALOG_PATH, "utf8");
  const catalog = JSON.parse(originalCatalog);
  const localFiles = new Map();
  for (const name of (await fs.readdir(SOURCE_DIR)).sort()) {
    if (!name.toLowerCase().endsWith(".mp3")) continue;
    const match = name.match(/_(\d+)(?:\D|$)/);
    check(match, `Missing episode number in filename: ${name}`);
    const number = Number(match[1]);
    check(EPISODES.includes(number), `Unexpected episode file: ${name}`);
    check(!localFiles.has(number), `Duplicate local audio for episode ${number}`);
    localFiles.set(number, path.join(SOURCE_DIR, name));
  }
  if (!localFiles.has(19)) {
    localFiles.set(19, await recoverEpisode19(rows.find((row) => row.episode_number === 19).audio_url));
  }
  check(localFiles.size === EPISODES.length, "Missing audio files for the requested episodes");
  const { data: objects, error: listError } = await storage.list(LEVEL, { limit: 1000 });
  check(!listError, `Storage listing failed: ${listError?.message}`);

  const plan = [];
  let updatedCatalog = originalCatalog;
  for (const row of rows) {
    const number = row.episode_number;
    const file = localFiles.get(number);
    const bytes = await fs.readFile(file);
    const info = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries",
      "format=duration:stream=codec_name,codec_type", "-of", "json", file], { encoding: "utf8" }));
    check(Number(info.format.duration) > 0 &&
      info.streams.some((stream) => stream.codec_type === "audio" && stream.codec_name === "mp3"),
    `Invalid MP3 for episode ${number}`);
    const objectPath = `${LEVEL}/${String(number).padStart(2, "0")}.mp3`;
    const audioUrl = `${URL}/storage/v1/object/public/${BUCKET}/${objectPath}`;
    const matches = catalog.filter((entry) => Number(entry.episode) === number);
    check(matches.length === 1, `Expected one catalog entry for episode ${number}`);
    const previous = matches[0].audio_url;
    const oldText = `"audio_url": ${JSON.stringify(previous)}`;
    check(updatedCatalog.split(oldText).length === 2, `Ambiguous catalog audio for episode ${number}`);
    updatedCatalog = updatedCatalog.replace(oldText, `"audio_url": ${JSON.stringify(audioUrl)}`);
    const exists = objects.some((object) => object.name === path.basename(objectPath));
    if (exists) {
      const { data, error: downloadError } = await storage.download(objectPath);
      check(!downloadError, `Cannot verify existing episode ${number}`);
      check(sha256(Buffer.from(await data.arrayBuffer())) === sha256(bytes),
        `Existing episode ${number} has different bytes; refusing to overwrite`);
    }
    plan.push({ episode: number, file: path.relative(ROOT, file), objectPath, audioUrl,
      previousDatabaseUrl: row.audio_url, previousCatalogUrl: previous,
      byteCount: bytes.length, sha256: sha256(bytes), durationSeconds: Number(info.format.duration),
      exists, id: row.id });
    console.log(`Validated episode ${number}: ${bytes.length} bytes, ${info.format.duration} seconds`);
  }

  const outputDir = path.join(ROOT, "outputs", `episode_audio_repair_${Date.now()}`);
  await fs.mkdir(outputDir, { recursive: true });
  const report = { createdAt: new Date().toISOString(), level: LEVEL, apply: APPLY,
    sourceOfTruth: "Published Supabase episodes, supplied MP3 files, original Drive source for episode 19",
    rowCountBefore: rows.length, episodes: plan, completedEpisodes: [] };
  const reportPath = path.join(outputDir, "report.json");
  const saveReport = () => fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await saveReport();
  if (!APPLY) {
    console.log(`Prepared six episodes. Report: ${path.relative(ROOT, reportPath)}`);
    return;
  }

  for (const item of plan) {
    const bytes = await fs.readFile(path.join(ROOT, item.file));
    check(sha256(bytes) === item.sha256, `Local episode ${item.episode} changed after validation`);
    if (!item.exists) {
      const { error: uploadError } = await storage.upload(item.objectPath, bytes, {
        contentType: "audio/mpeg", upsert: false, cacheControl: "3600",
      });
      check(!uploadError, `Audio upload failed for episode ${item.episode}: ${uploadError?.message}`);
    }
    const { data: uploaded, error: downloadError } = await storage.download(item.objectPath);
    check(!downloadError, `Uploaded audio unavailable for episode ${item.episode}`);
    check(sha256(Buffer.from(await uploaded.arrayBuffer())) === item.sha256,
      `Uploaded bytes differ for episode ${item.episode}`);
    const { data: changed, error: updateError } = await client.from("episodes")
      .update({ audio_url: item.audioUrl }).eq("id", item.id).eq("level_slug", LEVEL)
      .eq("episode_number", item.episode).eq("is_published", true)
      .eq("audio_url", item.previousDatabaseUrl).select("id,audio_url");
    check(!updateError && changed?.length === 1 && changed[0].audio_url === item.audioUrl,
      `Episode ${item.episode} update failed or the original record changed`);
    report.completedEpisodes.push(item.episode);
    await saveReport();
    console.log(`Uploaded and verified episode ${item.episode}`);
  }
  check(await fs.readFile(CATALOG_PATH, "utf8") === originalCatalog,
    "Catalog changed during repair; refusing to overwrite concurrent edits");
  await fs.writeFile(CATALOG_PATH, updatedCatalog);
  const { data: after, error: verifyError } = await client.from("episodes")
    .select("id,episode_number,audio_url").eq("level_slug", LEVEL)
    .in("episode_number", EPISODES).order("episode_number");
  check(!verifyError && after.length === rows.length && after.every((row) =>
    plan.some((item) => item.id === row.id && item.audioUrl === row.audio_url)),
  "Final episode verification failed");
  report.rowCountAfter = after.length;
  report.catalogUpdated = true;
  await saveReport();
  console.log(`Repaired six episodes. Report: ${path.relative(ROOT, reportPath)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
