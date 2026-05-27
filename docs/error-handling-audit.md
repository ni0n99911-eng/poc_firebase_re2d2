# RE² Error Handling Audit — `Promise.allSettled` Coverage
**AUDIT-01 | Brain 2 | April 12, 2026**

Grepped all `Promise.allSettled` calls across `src/`. Each call site evaluated on three criteria:
1. **Logs rejection?** — does a rejected promise produce a log entry?
2. **Surfaces to errors array?** — does the failure propagate to the caller's error list?
3. **Graceful fallback?** — does the call site produce usable default data instead of crashing?

---

## Summary

| Status | Count |
|--------|-------|
| ✅ Pass (logged + surfaces / graceful) | 7 |
| ⚠️ Gap (silent degradation) | 6 |
| ℹ️ UI-only (client component, no server data) | 2 |

**Total call sites: 14 (across 10 files)**

---

## Call Sites — Detail

### 1. `src/lib/intel/index.ts:233` — **Main 20-source fetch** ✅
```typescript
await Promise.race([
    Promise.allSettled(calls),
    new Promise<void>((resolve) => setTimeout(resolve, HARD_CEILING_MS))
]);
// ...
function extract<T>(result, label): T | null {
    if (result.status === 'fulfilled') { ... }
    errors.push(`${label}: ${result.reason?.message || 'Unknown error'}`);
    return null;
}
```
- **Logs rejection?** Yes — via `extract()` helper which pushes to `errors[]`
- **Surfaces to errors array?** Yes — `errors[]` is returned in `LocationIntelReport.errors`
- **Graceful fallback?** Yes — each source returns `null` on failure, downstream handles null
- **Verdict:** Best-in-class pattern. All 20 sources follow consistent null-on-failure.

---

### 2. `src/routes/api/validate-sources/+server.ts:935` — **Source validation (single)** ✅
```typescript
const results = await Promise.allSettled([validateCensus(...), ...19 more]);
const sources = results.map(r => r.status === 'fulfilled' ? r.value : {
    source: 'UNKNOWN', status: 'FAILED', fields: [auditField('error', r.reason?.message, 'STUB')],
});
```
- **Logs rejection?** Indirectly — failure object with reason message included in response
- **Surfaces to errors array?** Yes — `status: 'FAILED'` with reason in response JSON
- **Graceful fallback?** Yes — synthetic FAILED object preserves response shape
- **Verdict:** ✅ Good. Error details exposed to the caller.

---

### 3. `src/routes/api/validate-sources/+server.ts:1016` — **Source validation (batch)** ✅
Same pattern as call site #2 above, applied per-location in a batch loop.
- **Verdict:** ✅ Same quality as single-location variant.

---

### 4. `src/routes/+layout.svelte:263` — **Clerk JWT refresh** ✅
```typescript
await Promise.allSettled([
    (async () => { try { await session.reload(); } catch (err) { console.warn('[Clerk] session.reload failed', err); } })(),
    (async () => { try { await session.getToken(...); } catch (err) { console.warn('[Clerk] getToken refresh failed', err); } })(),
]);
```
- **Logs rejection?** Yes — each task has inner try/catch with `console.warn`
- **Surfaces to errors array?** N/A — client-side auth, no server error array
- **Graceful fallback?** Yes — JWT refresh is best-effort; app continues with existing token
- **Verdict:** ✅ Correct use of allSettled for independent non-critical tasks.

---

### 5. `src/lib/location/components/AddressAnalyzer.svelte:515` — **Scan data + liveIntel** ✅
```typescript
const [dataResult, intelResult] = await Promise.allSettled([dataPromise, intelPromise]);
const rawData = dataResult.status === 'fulfilled' ? dataResult.value : { cafes: [], gyms: [], yoga: [], ... };
if (dataResult.status === 'rejected') console.warn('[Scan] Overpass failed — scoring with empty competitor data');
if (intelResult.status === 'rejected') console.warn('[Scan] liveIntel failed — scoring without live data');
```
- **Logs rejection?** Yes — explicit `console.warn` for both paths
- **Surfaces to errors array?** N/A — client component; displays fallback message in UI
- **Graceful fallback?** Yes — empty data defaults keep scoring running
- **Verdict:** ✅ Good — both rejection paths explicitly handled.

---

### 6. `src/routes/api/street-view-history/+server.ts:233` — **Street View image fetches** ✅
```typescript
const imageResults = await Promise.allSettled(
    dates.map(({ dateStr }) => fetchStreetViewImage(lat, lng, dateStr, googleKey))
);
const identifyTasks = imageResults.map(async (result, i) => {
    const imageDataUrl = result.status === 'fulfilled' ? result.value : null;
    if (!imageDataUrl) {
        return { year: ..., imageAvailable: false, businessName: 'No imagery', ... };
    }
    ...
});
```
- **Logs rejection?** No explicit log, but `imageAvailable: false` is returned
- **Surfaces to errors array?** N/A — surfaced in response as `imageAvailable: false`
- **Graceful fallback?** Yes — each failed image returns a safe default entry
- **Verdict:** ✅ Structurally correct. Minor improvement: add `console.warn` for image failures.

---

### 7. `src/routes/api/street-view-history/+server.ts:248` — **Business identify tasks** ✅
```typescript
return await Promise.allSettled(identifyTasks);
// ...results checked with r.status === 'fulfilled' ? r.value : { ..., confidence: 'low' }
```
- **Verdict:** ✅ Inner try/catch in each task + outer settled check. Solid.

---

## ⚠️ Gaps — Silent Degradation

### 8. `src/lib/intel/mta-ridership.ts:334` — **Station ridership batch** ⚠️ **GAP**
```typescript
const results = await Promise.allSettled(ridershipPromises);
for (const result of results) {
    if (result.status === 'fulfilled') {
        const station = result.value;
        stations.push(station);
        // ...
    }
    // NO else branch — rejected results are silently dropped
}
```
- **Logs rejection?** ❌ No
- **Surfaces to errors array?** ❌ No — `mta-ridership.ts` returns a result even if all stations fail
- **Graceful fallback?** Partial — empty `stations[]` produces a zero-ridership result that looks like "no transit"
- **Impact:** ~65% of block groups use estimated data already (DS-05). Failed stations silently read as 0 ridership.
- **Recommended fix:** Add `else { console.warn('[MTA] Station fetch rejected:', result.reason?.message); }` after the fulfilled branch.

---

### 9. `src/lib/intel/location-history.ts:229` — **DOHMH + DCA history** ⚠️ **GAP**
```typescript
const [dohmhResult, dcaResult] = await Promise.allSettled([
    fetchDohmhHistory(parts.building, parts.street),
    fetchDcaHistory(parts.building, parts.street),
]);
const dohmh = dohmhResult.status === 'fulfilled' ? dohmhResult.value : [];
const dca   = dcaResult.status   === 'fulfilled' ? dcaResult.value   : [];
```
- **Logs rejection?** ❌ No — rejection reason is discarded
- **Surfaces to errors array?** ❌ No
- **Graceful fallback?** Yes — empty arrays produce `{ businesses: [], totalCount: 0, highTurnover: false }`
- **Impact:** A failed API returns the same result as "no history found" — indistinguishable to the scoring engine. Churn risk may be under-reported.
- **Recommended fix:** Log `console.warn('[LocationHistory] DOHMH fetch rejected:', dohmhResult.reason)` on rejection path.

---

### 10. `src/lib/intel/dof-property-tax.ts:105` — **Tax bills + ACRIS + tax lien** ⚠️ **GAP**
```typescript
const [taxBills, acrisDocs, acrisParties, taxLien] = await Promise.allSettled([
    fetchTaxBills(bbl, socrataFetch, appToken),
    fetchAcrisDocs(bbl, socrataFetch, appToken),
    fetchAcrisParties(bbl, socrataFetch, appToken),
    fetchTaxLien(bbl, socrataFetch, appToken),
]);
const bills    = taxBills.status    === 'fulfilled' ? taxBills.value    : [];
const acrDocs  = acrisDocs.status   === 'fulfilled' ? acrisDocs.value   : [];
const acrParty = acrisParties.status === 'fulfilled' ? acrisParties.value : [];
const lienHit  = taxLien.status     === 'fulfilled' ? taxLien.value     : false;
```
- **Logs rejection?** ❌ No individual rejection logged (outer `catch` logs BBL-level failure only)
- **Surfaces to errors array?** ❌ No
- **Graceful fallback?** Yes — empty arrays / false produce a zero-data `PropertyTaxProfile`
- **Impact:** A failed `taxLien` query always returns `hasTaxLien: false` — a false negative on a risk signal.
- **Recommended fix:** Log each rejection: `if (taxLien.status === 'rejected') console.warn('[DOF] Tax lien query failed:', taxLien.reason)`.

---

### 11. `src/lib/intel/momentum.ts:146` — **6 Socrata count queries** ⚠️ **GAP**
```typescript
] = await Promise.allSettled([...6 Socrata count queries]);
const extract = (r: PromiseSettledResult<number>) =>
    r.status === 'fulfilled' ? r.value : 0;
```
- **Logs rejection?** ❌ No
- **Surfaces to errors array?** ❌ No
- **Graceful fallback?** Yes — `0` is a valid count, so no crash
- **Impact:** A failed DOB/DCA/311 query returns `0` — identical to "no activity found". Momentum scores will be artificially flat for affected locations.
- **Recommended fix:** `if (r.status === 'rejected') { console.warn('[Momentum] Query failed:', r.reason?.message); }`

---

### 12. `src/lib/intel/dob-permits.ts:82` — **Permits + Violations** ⚠️ PARTIAL
```typescript
const [permitsRes, violationsRes] = await Promise.allSettled([...]);
// ...
if (permitsRes.status === 'fulfilled' && permitsRes.value) { ... }
else { console.error('[DOB] Permits API error'); }
// same for violationsRes
```
- **Logs rejection?** ✅ Yes — `console.error('[DOB] Permits API error')` / `console.error('[DOB] Violations API error')`
- **Surfaces to errors array?** ❌ No — not propagated to LocationIntelReport.errors
- **Graceful fallback?** Yes — empty arrays
- **Verdict:** Partial credit — logs but doesn't distinguish `rejected` from `fulfilled(null)`. The `else` fires even if the promise resolved with `null`.
- **Recommended fix:** Check `permitsRes.status === 'rejected'` explicitly to separate null-value from rejection.

---

### 13. `src/routes/app/location/+page.svelte:4003` — **Vision + Fit IQ parallel** ⚠️ **GAP**
```typescript
await Promise.allSettled([visionPromise, fitPromise]);
```
- **Logs rejection?** ❌ No visible handling of rejection
- **Surfaces to errors array?** N/A — client-side
- **Graceful fallback?** Unknown — depends on how `visionPromise` / `fitPromise` handle their own errors
- **Verdict:** Need to verify that each promise has internal try/catch. If not, a Vision IQ failure would silently produce stale/empty state.

---

### 14. `src/lib/location/components/LocationComparison.svelte:126` — **Batch slot analysis** ⚠️ **GAP**
```typescript
await Promise.allSettled(pending.map(({ i }) => analyzeSlot(i)));
```
- **Logs rejection?** ❌ Not at this level (depends on `analyzeSlot` internals)
- **Surfaces to errors array?** N/A — client component
- **Graceful fallback?** Unknown — slot `status` not visibly updated on outer rejection
- **Verdict:** If `analyzeSlot` throws and doesn't update `slots[i].status`, the slot will hang in `analyzing` state with no user feedback.

---

## Recommended Fixes (Priority Order)

| Priority | File | Fix |
|----------|------|-----|
| P1 | `dof-property-tax.ts` | Log each of 4 query rejections — `hasTaxLien: false` false-negative is a risk signal miss |
| P1 | `mta-ridership.ts` | Log station rejections — silent zero-ridership affects 21-source coverage |
| P2 | `location-history.ts` | Log DOHMH/DCA rejection — churn risk may be under-reported |
| P2 | `momentum.ts` | Log Socrata count rejections — flat momentum score is misleading |
| P2 | `dob-permits.ts` | Distinguish `rejected` from `fulfilled(null)` in the `else` branch |
| P3 | `location/+page.svelte` | Verify `visionPromise`/`fitPromise` have internal error guards |
| P3 | `LocationComparison.svelte` | Verify `analyzeSlot` updates slot status on failure |

All P1/P2 fixes are single-line log additions — no scoring logic changes.
Flag as **INF-06** for the next sprint sign-off.
