export interface QAReportData {
	analysisAddress: string;
	coordinates?: string;
	visionBizType: string;
	priceLevel: string;
	differentiator?: string;
	visionTier: string;
	avgTicket: number | string;
	startupBudget?: string;
	maxMonthlyRent?: string;
	visionTargetSize: string;
	conceptAnswers?: Record<string, string>;
	sixScores: Record<string, any>;
	rawIntelData?: Record<string, any>;
	dynamicVisionWeights?: Record<string, any>;
	locationIQ: number;
	visionIQ: number;
	fitIQ: number;
}

export function exportQAReport(data: QAReportData) {
	const rows = [
		['Category', 'Parameter', 'Value', 'Score', 'Data Source'],
		['Test Inputs', 'Address', `"${data.analysisAddress}"`, '', 'User Input'],
		['Test Inputs', 'Coordinates', data.coordinates || '', '', 'Geocoding'],
		['Test Inputs', 'Concept Type', data.visionBizType, '', 'User Input'],
		['Test Inputs (General)', 'Price Positioning', data.priceLevel || 'standard', '', 'User Input'],
		['Test Inputs (General)', 'Differentiator', data.differentiator || '', '', 'User Input'],
		['Test Inputs (General)', 'Concept Uniqueness (Vision Tier)', data.visionTier || 'standard', '', 'User Input'],
		['Test Inputs (General)', 'Avg Ticket Price', data.avgTicket, '', 'User Input'],
		['Test Inputs (General)', 'Startup Budget', data.startupBudget || '', '', 'User Input'],
		['Test Inputs (General)', 'Max Monthly Rent', data.maxMonthlyRent || '', '', 'User Input'],
		...Object.entries(data.conceptAnswers || {}).map(([k, v]) => ['Test Inputs (Vision)', k, v, '', 'User Input']),
		['Location Indices', 'Transit', data.sixScores?.transit ?? data.sixScores?.dailyRitualDensity ?? '', '', 'MTA Ridership / Google Places'],
		['Location Indices', 'Vibrancy', data.sixScores?.vibrancy ?? data.sixScores?.blockActivity ?? '', '', 'Google Places / US Census'],
		['Location Indices', 'Competition', data.sixScores?.competition ?? data.sixScores?.coffeeCompetition ?? '', '', 'Overpass API / Google Places'],
		['Location Indices', 'Momentum', data.sixScores?.momentum ?? data.sixScores?.marketTrajectory ?? '', '', 'RE² Historical Data'],
		['Location Indices', 'Demographics', data.sixScores?.demographics ?? data.sixScores?.spendVibrancy ?? '', '', 'US Census Bureau'],
		['Location Indices', 'Safety', data.sixScores?.safety ?? data.sixScores?.streetSafety ?? '', '', 'NYPD / NYCOpenData'],
		['Location Indices', 'Neighborhoodhealth', data.sixScores?.neighborhoodHealth ?? '', '', 'RE² Block Group Data'],
		['Location Indices', 'Survivalrate', data.sixScores?.survivalRate ?? '', '', 'DOHMH (NYC Dept of Health)'],
		...Object.entries(data.rawIntelData || {}).map(([k, v]) => ['Raw Intel Data', k, typeof v === 'object' ? JSON.stringify(v) : v, '', 'API/Canonical Engine']),
		['Final Output', 'Location IQ', data.locationIQ, '', "RE² Composite (20 sources)"],
		['Final Output', 'Vision IQ', data.visionIQ, '', "Dynamic Questionnaire / RE² Logic"],
		...Object.entries(data.dynamicVisionWeights || {}).map(([k, v]) => ['Dynamic Vision Weights', k, `${((v as number) * 100).toFixed(1)}%`, '', 'RE² Dynamic Concept Config']),
		['Final Output', 'Canonical Fit IQ', data.fitIQ, '', "RE² Canonical Engine (Blend)"],
	];
	const csvContent = rows.map(e => e.join(",")).join("\n");
	const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.setAttribute("href", url);
	const safeName = (data.analysisAddress || 'location').replace(/[^a-zA-Z0-9]/g, '_');
	link.setAttribute("download", `${safeName}_QA_Report.csv`);
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
}
