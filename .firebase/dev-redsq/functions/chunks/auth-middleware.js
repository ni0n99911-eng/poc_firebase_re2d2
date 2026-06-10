const __vite_import_meta_env__ = {};
let _jwksCache = null;
const JWKS_CACHE_TTL_MS = 60 * 60 * 1e3;
const _cryptoKeyCache = /* @__PURE__ */ new Map();
async function getJWKS() {
  if (_jwksCache && Date.now() - _jwksCache.fetchedAt < JWKS_CACHE_TTL_MS) {
    return _jwksCache.keys;
  }
  const clerkSecretKey = process.env.CLERK_SECRET_KEY || __vite_import_meta_env__?.CLERK_SECRET_KEY || "";
  const res = await fetch("https://api.clerk.dev/v1/jwks", {
    headers: {
      "Authorization": `Bearer ${clerkSecretKey}`
    },
    signal: AbortSignal.timeout(5e3)
  });
  if (!res.ok) {
    console.warn("[Auth] JWKS fetch failed:", res.status);
    throw new Error("Failed to fetch JWKS");
  }
  const data = await res.json();
  const keys = data.keys || [];
  _jwksCache = { keys, fetchedAt: Date.now() };
  return keys;
}
async function getCryptoKey(kid) {
  if (_cryptoKeyCache.has(kid)) return _cryptoKeyCache.get(kid);
  const jwks = await getJWKS();
  const jwk = jwks.find((k) => k.kid === kid);
  if (!jwk) return null;
  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  _cryptoKeyCache.set(kid, cryptoKey);
  return cryptoKey;
}
function base64UrlDecode(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function decodeJWTPayload(token) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  const payload = new TextDecoder().decode(base64UrlDecode(parts[1]));
  return JSON.parse(payload);
}
function decodeJWTHeader(token) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  const header = new TextDecoder().decode(base64UrlDecode(parts[0]));
  return JSON.parse(header);
}
async function verifyJWT(token) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  const header = decodeJWTHeader(token);
  if (header.alg !== "RS256") throw new Error("Unsupported algorithm: " + header.alg);
  const payload = decodeJWTPayload(token);
  if (payload.exp && payload.exp * 1e3 < Date.now()) {
    throw new Error("Token expired");
  }
  if (payload.nbf && payload.nbf * 1e3 > Date.now() + 6e4) {
    throw new Error("Token not yet valid");
  }
  const clerkSecretKey = process.env.CLERK_SECRET_KEY || __vite_import_meta_env__?.CLERK_SECRET_KEY;
  if (clerkSecretKey && header.kid) {
    try {
      const cryptoKey = await getCryptoKey(header.kid);
      if (cryptoKey) {
        const signatureInput = new TextEncoder().encode(parts[0] + "." + parts[1]);
        const signature = base64UrlDecode(parts[2]);
        const isValid = await crypto.subtle.verify(
          "RSASSA-PKCS1-v1_5",
          cryptoKey,
          signature,
          signatureInput
        );
        if (!isValid) throw new Error("Invalid JWT signature");
      } else {
        _jwksCache = null;
        const retryKey = await getCryptoKey(header.kid);
        if (retryKey) {
          const signatureInput = new TextEncoder().encode(parts[0] + "." + parts[1]);
          const signature = base64UrlDecode(parts[2]);
          const isValid = await crypto.subtle.verify(
            "RSASSA-PKCS1-v1_5",
            retryKey,
            signature,
            signatureInput
          );
          if (!isValid) throw new Error("Invalid JWT signature");
        } else {
          console.warn("[Auth] JWT kid not found in JWKS after refresh:", header.kid);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("signature")) throw err;
      console.warn("[Auth] JWKS verification failed, falling back to payload check:", err instanceof Error ? err.message : err);
    }
  } else if (!clerkSecretKey) {
    console.warn("[Auth] CLERK_SECRET_KEY not set — JWT signature NOT verified. Set it for production security.");
  }
  const userId = payload.sub;
  if (!userId || typeof userId !== "string") {
    throw new Error("Missing sub claim");
  }
  return { userId };
}
async function extractUserId(request) {
  const authHeader = request.headers.get("Authorization");
  let token = null;
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }
  if (!token) {
    const cookies = request.headers.get("Cookie") || "";
    const match = cookies.match(/__session=([^;]+)/);
    if (match) token = match[1];
  }
  if (!token) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  try {
    const result = await verifyJWT(token);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid token";
    const status = message.includes("expired") ? 401 : 401;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }
}
async function requireAuth(request) {
  const result = await extractUserId(request);
  if (result instanceof Response) {
    return { response: result };
  }
  return { userId: result.userId };
}
export {
  requireAuth as r
};
