import { json } from "@sveltejs/kit";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import "../../../../../chunks/db-server.js";
const LOG_DIR = "/tmp/re2-score-events";
let logDirReady = false;
async function ensureLogDir() {
  if (logDirReady) return;
  if (!existsSync(LOG_DIR)) {
    await mkdir(LOG_DIR, { recursive: true });
  }
  logDirReady = true;
}
function getLogFileName() {
  const date = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  return `${LOG_DIR}/score-events-${date}.jsonl`;
}
async function getScoreEventStats() {
  try {
    await ensureLogDir();
    const file = getLogFileName();
    if (!existsSync(file)) return { todayCount: 0, logFile: file };
    const { readFile } = await import("fs/promises");
    const content = await readFile(file, "utf-8");
    const lines = content.trim().split("\n").filter((l) => l.length > 0);
    let totalLocationIQ = 0;
    let totalComputationTime = 0;
    let errorCount = 0;
    const computationTimes = [];
    const locationIQs = [];
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        const liq = event.scores?.locationIQ || 0;
        const ms = event.computationTimeMs || 0;
        totalLocationIQ += liq;
        totalComputationTime += ms;
        computationTimes.push(ms);
        locationIQs.push(liq);
        if (event.errors && event.errors.length > 0) {
          errorCount++;
        }
      } catch (e) {
      }
    }
    computationTimes.sort((a, b) => a - b);
    const p50 = computationTimes[Math.floor(computationTimes.length * 0.5)] || 0;
    const p90 = computationTimes[Math.floor(computationTimes.length * 0.9)] || 0;
    const averageLocationIQ = locationIQs.length > 0 ? totalLocationIQ / locationIQs.length : 0;
    const averageComputationTimeMs = computationTimes.length > 0 ? totalComputationTime / computationTimes.length : 0;
    const failureRate = lines.length > 0 ? errorCount / lines.length : 0;
    return {
      todayCount: lines.length,
      logFile: file,
      stats: {
        averageLocationIQ,
        averageComputationTimeMs,
        computationTimeP50Ms: p50,
        computationTimeP90Ms: p90,
        failureRate
      }
    };
  } catch {
    return { todayCount: 0, logFile: getLogFileName() };
  }
}
async function GET() {
  try {
    const stats = await getScoreEventStats();
    return json({
      success: true,
      data: stats
    });
  } catch (error) {
    return json({
      success: false,
      error: error.message || "Failed to retrieve score statistics"
    }, { status: 500 });
  }
}
export {
  GET
};
