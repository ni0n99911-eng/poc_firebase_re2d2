import { r as resilientFetch } from "./retry.js";
async function socrataFetch(url, label, options) {
  try {
    const res = await resilientFetch(url, {
      timeout: options?.timeout ?? 12e3,
      maxRetries: 2,
      headers: { "Accept": "application/json" },
      label
    });
    if (!res.ok) {
      console.error(`[${label}] Socrata API error: ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`[${label}] Fetch failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}
export {
  socrataFetch
};
