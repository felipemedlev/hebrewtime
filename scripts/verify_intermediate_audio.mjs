import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Run with node scripts/verify_intermediate_audio.mjs outputs/<repair run>/report.json.
// Verify the actual episode API and audio API against the original file bytes.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP_ORIGIN = process.env.AUDIO_TEST_ORIGIN || "http://127.0.0.1:3000";

function check(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  check(process.argv[2], "Provide the completed repair report path");
  const reportPath = path.resolve(ROOT, process.argv[2]);
  const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
  check(report.catalogUpdated && report.completedEpisodes.length === 6,
    "The repair report is incomplete");
  const verification = { checkedAt: new Date().toISOString(), origin: APP_ORIGIN, episodes: [] };
  for (const item of report.episodes) {
    const metadata = await fetch(`${APP_ORIGIN}/api/episode/intermediate/${item.episode}`);
    check(metadata.ok, `Episode ${item.episode} metadata returned ${metadata.status}`);
    const episode = await metadata.json();
    check(episode.level === "intermediate" && episode.episode === item.episode &&
      episode.audio_url === item.audioUrl, `Episode ${item.episode} audio metadata differs`);
    const bytes = await fs.readFile(path.join(ROOT, item.file));
    const result = { episode: item.episode, metadataStatus: metadata.status, ranges: [] };
    for (const start of [0, Math.floor(bytes.length / 2), bytes.length - 1024]) {
      const end = start + 1023;
      const response = await fetch(`${APP_ORIGIN}/api/episode-audio/intermediate/${item.episode}`, {
        headers: { Range: `bytes=${start}-${end}` }, signal: AbortSignal.timeout(30_000),
      });
      check(response.status === 206, `Episode ${item.episode} range returned ${response.status}`);
      check(response.headers.get("content-type")?.startsWith("audio/"), "Expected audio content type");
      check(response.headers.get("accept-ranges") === "bytes", "Seeking is not supported");
      const contentRange = response.headers.get("content-range");
      check(contentRange === `bytes ${start}-${end}/${bytes.length}`, "Unexpected content range");
      check(Buffer.from(await response.arrayBuffer()).equals(bytes.subarray(start, end + 1)),
        `Episode ${item.episode} streamed bytes differ`);
      result.ranges.push({ status: response.status, contentRange, bytesMatch: true });
    }
    verification.episodes.push(result);
    console.log(`Verified episode ${item.episode}: metadata, start, middle and end audio bytes`);
  }
  const outputPath = path.join(path.dirname(reportPath), `verification_${Date.now()}.json`);
  await fs.writeFile(outputPath, `${JSON.stringify(verification, null, 2)}\n`, { flag: "wx" });
  console.log(`Verification saved: ${path.relative(ROOT, outputPath)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
