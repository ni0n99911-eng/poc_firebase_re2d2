const MAX_RETRIES = 1;
const DEFAULT_TIMEOUT = 25e3;
async function getFreshToken() {
  try {
    if (typeof window !== "undefined" && window.Clerk?.session) {
      return await window.Clerk.session.getToken({ skipCache: true });
    }
  } catch (err) {
    console.warn("[authedFetch] Could not get Clerk token:", err);
  }
  return null;
}
async function refreshSession() {
  try {
    if (typeof window !== "undefined" && window.Clerk?.session) {
      const token = await window.Clerk.session.getToken({ skipCache: true });
      return !!token;
    }
    const res = await fetch("/", {
      method: "HEAD",
      credentials: "same-origin",
      cache: "no-cache"
    });
    return res.ok;
  } catch {
    return false;
  }
}
async function authedFetch(url, init) {
  const timeout = init?.timeout ?? DEFAULT_TIMEOUT;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const token = await getFreshToken();
      const headers = new Headers(init?.headers);
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      if (!headers.has("Content-Type") && init?.body && typeof init.body === "string") {
        headers.set("Content-Type", "application/json");
      }
      const res = await fetch(url, {
        ...init,
        headers,
        signal: controller.signal
      });
      clearTimeout(timer);
      if (res.status === 401 && attempt < MAX_RETRIES) {
        console.warn("[authedFetch] Got 401, refreshing session...");
        const refreshed = await refreshSession();
        if (refreshed) continue;
        return res;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error(`Request timed out (${timeout / 1e3}s)`);
      }
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Unexpected: all retries exhausted");
}
export {
  authedFetch as a
};
