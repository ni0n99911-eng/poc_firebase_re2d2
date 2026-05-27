// ──────────────────────────────────────────────
// Space Einstein — Lease Term Benchmarks
// NYC retail averages, used for green/yellow/red comparison
// ──────────────────────────────────────────────

export type BenchmarkRating = 'green' | 'yellow' | 'red';

export interface LeaseBenchmark {
	key: string;
	label: string;
	nycAverage: string;
	goodForTenant: string;
	redFlag: string;
	/** Evaluation function: takes the actual value and returns a rating */
	evaluate: (value: number | string | boolean | null) => BenchmarkRating;
	/** Format function for display */
	format: (value: number | string | boolean | null) => string;
}

export const LEASE_BENCHMARKS: LeaseBenchmark[] = [
	{
		key: 'escalation',
		label: 'Rent Escalation',
		nycAverage: '3% annual',
		goodForTenant: '≤2.5% or CPI-capped',
		redFlag: '>4% or uncapped CPI',
		evaluate: (v) => {
			const rate = Number(v) || 0;
			if (rate <= 2.5) return 'green';
			if (rate <= 4) return 'yellow';
			return 'red';
		},
		format: (v) => `${Number(v) || 0}% annual`
	},
	{
		key: 'tiAllowance',
		label: 'TI Allowance',
		nycAverage: '$35–$55/sqft',
		goodForTenant: '>$45/sqft',
		redFlag: '<$25/sqft or $0',
		evaluate: (v) => {
			const amount = Number(v) || 0;
			if (amount >= 45) return 'green';
			if (amount >= 25) return 'yellow';
			return 'red';
		},
		format: (v) => `$${Number(v) || 0}/sqft`
	},
	{
		key: 'personalGuarantee',
		label: 'Personal Guarantee',
		nycAverage: '12–24 months',
		goodForTenant: '≤12 months or burndown',
		redFlag: '>24 months, no burndown',
		evaluate: (v) => {
			const months = Number(v) || 0;
			if (months <= 12) return 'green';
			if (months <= 24) return 'yellow';
			return 'red';
		},
		format: (v) => `${Number(v) || 0} months`
	},
	{
		key: 'leaseTerm',
		label: 'Lease Term',
		nycAverage: '5–10 years',
		goodForTenant: '5yr with renewal options',
		redFlag: '>10yr no exit clause',
		evaluate: (v) => {
			const years = Number(v) || 0;
			if (years >= 5 && years <= 10) return 'green';
			if (years > 10) return 'red';
			return 'yellow';
		},
		format: (v) => `${Number(v) || 0} years`
	},
	{
		key: 'rentFreeBuildout',
		label: 'Rent-Free Buildout',
		nycAverage: '2–4 months',
		goodForTenant: '≥3 months',
		redFlag: '0 months',
		evaluate: (v) => {
			const months = Number(v) || 0;
			if (months >= 3) return 'green';
			if (months >= 1) return 'yellow';
			return 'red';
		},
		format: (v) => `${Number(v) || 0} months`
	},
	{
		key: 'exclusivity',
		label: 'Exclusivity Radius',
		nycAverage: '500ft–1000ft',
		goodForTenant: '≥1000ft for your category',
		redFlag: 'No exclusivity clause',
		evaluate: (v) => {
			const ft = parseInt(String(v) || '0', 10);
			if (ft >= 1000) return 'green';
			if (ft >= 500) return 'yellow';
			return 'red';
		},
		format: (v) => {
			const ft = parseInt(String(v) || '0', 10);
			return ft > 0 ? `${ft}ft` : 'None';
		}
	},
	{
		key: 'assignment',
		label: 'Assignment Rights',
		nycAverage: 'With landlord consent',
		goodForTenant: 'Consent not unreasonably withheld',
		redFlag: 'No assignment allowed',
		evaluate: (v) => {
			if (v === true || v === 'yes' || v === 'allowed') return 'green';
			if (v === 'conditional' || v === 'with consent') return 'yellow';
			return 'red';
		},
		format: (v) => {
			if (v === true || v === 'yes' || v === 'allowed') return 'Allowed';
			if (v === false || v === 'no') return 'Not allowed';
			return String(v || 'Unknown');
		}
	},
	{
		key: 'camCharges',
		label: 'CAM Charges',
		nycAverage: '$2–$5/sqft/yr',
		goodForTenant: 'Fixed CAM with cap',
		redFlag: 'Open-ended, no cap',
		evaluate: (v) => {
			const perSqFt = Number(v) || 0;
			if (perSqFt <= 3) return 'green';
			if (perSqFt <= 5) return 'yellow';
			return 'red';
		},
		format: (v) => `$${Number(v) || 0}/sqft/yr`
	}
];

/** Get color for benchmark rating */
export function getBenchmarkColor(rating: BenchmarkRating): string {
	switch (rating) {
		case 'green': return '#00ff88';
		case 'yellow': return '#ffbb00';
		case 'red': return '#ff4444';
	}
}
