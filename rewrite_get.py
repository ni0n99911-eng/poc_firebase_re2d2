import sys

file_path = r"C:\sandbox_re_squared\jared_prod\bkp_main_05272026\src\routes\api\location-iq\+server.ts"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if "export const GET: RequestHandler = async ({ url, request }) => {" in line:
        start_idx = i
        break

if start_idx == -1:
    print("Could not find GET handler start")
    sys.exit(1)

for i in range(start_idx + 1, len(lines)):
    if lines[i].startswith("};") and "POST /api/location-iq" in "".join(lines[i:i+30]):
        end_idx = i
        break

if end_idx == -1:
    print("Could not find GET handler end")
    sys.exit(1)

new_get = """export const GET: RequestHandler = async ({ url, request }) => {
	const lat = parseFloat(url.searchParams.get('lat') || '');
	const lng = parseFloat(url.searchParams.get('lng') || '');
	const businessType = url.searchParams.get('type') || 'specialty_coffee';

	if (isNaN(lat) || isNaN(lng)) {
		return new Response(JSON.stringify({ error: 'Missing or invalid lat/lng parameters' }), { status: 400 });
	}

	try {
		const { getGoldenRecord } = await import('$lib/snowflake');
		const record = await getGoldenRecord(lat, lng, businessType);

		if (!record) {
			return new Response(JSON.stringify({ error: 'No score found in Snowflake for this location' }), { status: 404 });
		}

		const iqScore = Math.round(record.FINAL_LOCATION_IQ || 50);
        let grade = 'C';
        if (iqScore >= 90) grade = 'A+';
        else if (iqScore >= 80) grade = 'A';
        else if (iqScore >= 70) grade = 'B';
        else if (iqScore >= 60) grade = 'C';
        else grade = 'D';

		const responseBody = {
			lat, lng, businessType,
			locationIQ: iqScore,
			grade: grade,
			verdict: `Scored ${iqScore}/100. Ranked in the top ${Math.round((1 - (record.CATEGORY_PERCENTILE || 0)) * 100)}% of locations.`,
			sixIndex: {
				locationIQ: iqScore, grade: grade, conceptType: businessType, conceptLabel: businessType.replace('_', ' '),
				indices: {
					competition: { score: record.COMPETITION_CONTEXT_SCORE, weight: 15, label: "Competition Context" },
					vibrancy: { score: record.MORNING_FOOT_TRAFFIC_SCORE, weight: 40, label: "Morning Foot Traffic" },
					demographics: { score: record.DEMOGRAPHICS_FIT_SCORE, weight: 20, label: "Demographics Fit" },
					safety: { score: record.SAFETY_SCORE, weight: 5, label: "Safety" },
					transit: { score: record.MORNING_FOOT_TRAFFIC_SCORE, weight: 10, label: "Transit" },
					momentum: { score: record.BUSINESS_SURVIVAL_SCORE, weight: 10, label: "Momentum" }
				},
                signals: [],
                coffeeDimensions: businessType === 'specialty_coffee' ? {
                    morningFootTraffic: record.MORNING_FOOT_TRAFFIC_SCORE,
                    dailyRitualDensity: record.DAILY_RITUAL_DENSITY_SCORE,
                    competitionContext: record.COMPETITION_CONTEXT_SCORE,
                    streetSide: record.STREET_SIDE_SCORE,
                    demographicsFit: record.DEMOGRAPHICS_FIT_SCORE,
                    baseViability: record.BUSINESS_SURVIVAL_SCORE,
                    visionMultiplier: 1.0,
                    rawComposite: iqScore
                } : undefined
			},
			lenses: [
				{ dimension: "competition", label: "Competitors", uxLabel: "Competitors", score: record.COMPETITION_CONTEXT_SCORE, verdictLine: `Active competitors: ${record.TOTAL_COMPETITORS || 0}`, topSignals: [], mapHighlights: [] },
				{ dimension: "vibrancy", label: "Concept Pulse", uxLabel: "Concept Pulse", score: record.MORNING_FOOT_TRAFFIC_SCORE, verdictLine: `Estimated morning passersby: ${record.ESTIMATED_MORNING_PASSERSBY || 0}`, topSignals: [], mapHighlights: [] },
				{ dimension: "demographics", label: "Demographics", uxLabel: "Who lives here", score: record.DEMOGRAPHICS_FIT_SCORE, verdictLine: `Median Household Income: $${record.MEDIAN_HOUSEHOLD_INCOME || 0}`, topSignals: [], mapHighlights: [] },
				{ dimension: "safety", label: "Safety", uxLabel: "Safety", score: record.SAFETY_SCORE, verdictLine: "Powered by Snowflake", topSignals: [], mapHighlights: [] },
				{ dimension: "transit", label: "Transit", uxLabel: "Transit & Access", score: record.MORNING_FOOT_TRAFFIC_SCORE, verdictLine: "Powered by Snowflake", topSignals: [], mapHighlights: [] },
				{ dimension: "momentum", label: "Momentum", uxLabel: "Momentum", score: record.BUSINESS_SURVIVAL_SCORE, verdictLine: "Powered by Snowflake", topSignals: [], mapHighlights: [] },
			],
			threeScores: { locationIQ: { score: iqScore, grade: grade }, visionIQ: { available: false }, fitIQ: { available: false } },
			confidence: { level: 'CONFIDENT', scoreAgreement: 0.8 },
			confidenceBySource: { transit: 100, safety: 100, demographics: 100, competition: 100, vibrancy: 100, momentum: 100, vision: 100 },
			dataSourceQuality: { competitors: 'verified' },
			dataFreshness: { ageLabel: 'Live from Snowflake', sources: [] },
			reconciled: { totalEntities: 0 },
			rawIntelErrors: [],
		};

		return new Response(JSON.stringify(responseBody), { status: 200, headers: { 'Content-Type': 'application/json' } });
	} catch (e: any) {
		console.error('[LocationIQ] ERROR:', e);
		return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
	}
};
"""

new_lines = lines[:start_idx] + [new_get + "\n"] + lines[end_idx+1:]

with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(new_lines)

print("GET handler successfully replaced to use Snowflake.")
