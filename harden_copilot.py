import os

filepath = 'src/routes/api/copilot/business/+server.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    orig = f.read()

import_statement = "import { computeFinancialProjection, computeWhatIf, type FinancialProjection, type FinancialInputs } from '$lib/financial-projections';"
orig = orig.replace(
    "import { computeFinancialProjection, computeWhatIf, type FinancialProjection } from '$lib/financial-projections';",
    import_statement
)

start_idx = orig.find('const changes: Record<string, any> = {};')
end_idx = orig.find('const baseInputs = {')

hardened_code = """const changes: Partial<FinancialInputs> = {};
	const qLower = question.toLowerCase();

	// Hardened numeric extractor: handles 10k, 1.5, 1,000
	const extractNum = (str: string): number | null => {
		const match = str.match(/([\\d,.]+)[\\s]*(k|m)?/i);
		if (!match) return null;
		let val = parseFloat(match[1].replace(/,/g, ''));
		if (match[2]?.toLowerCase() === 'k') val *= 1000;
		if (match[2]?.toLowerCase() === 'm') val *= 1000000;
		return val;
	};

	if (qLower.includes('rent')) {
		const moneyMatch = question.match(/\\$?\\s*([\\d,.]+[kK]?)/);
		if (moneyMatch && !qLower.includes('%')) {
			const val = extractNum(moneyMatch[1]);
			if (val !== null) changes.rent = Math.round(val);
		} else if (qLower.includes('%')) {
			const pctMatch = question.match(/(\\d+(?:\\.\\d+)?)%/);
			if (pctMatch) {
				const pct = parseFloat(pctMatch[1]) / 100;
				if (qLower.match(/(lower|less|decrease|drop|reduce)/)) changes.rent = Math.round(calcs.rent * (1 - pct));
				else if (qLower.match(/(higher|more|increase|raise|up)/)) changes.rent = Math.round(calcs.rent * (1 + pct));
			}
		}
	}

	if (qLower.match(/(price|ticket|transaction|charge|cost)/)) {
		const moneyMatch = question.match(/\\$?\\s*([\\d,.]+)/);
		if (moneyMatch && moneyMatch[1].includes('.')) {
			const val = extractNum(moneyMatch[1]);
			if (val !== null) changes.avgTransaction = Math.round(val * 100) / 100;
		} else if (qLower.includes('%')) {
			const pctMatch = question.match(/(\\d+(?:\\.\\d+)?)%/);
			if (pctMatch) {
				const pct = parseFloat(pctMatch[1]) / 100;
				if (qLower.match(/(higher|increase|raise|up)/)) changes.avgTransaction = Math.round(calcs.avgTxn * (1 + pct) * 100) / 100;
				else changes.avgTransaction = Math.round(calcs.avgTxn * (1 - pct) * 100) / 100;
			}
		}
	}

	if (qLower.match(/(customer|people|traffic|guest|client)/)) {
		if (qLower.includes('%')) {
			const pctMatch = question.match(/(\\d+(?:\\.\\d+)?)%/);
			if (pctMatch) {
				const pct = parseFloat(pctMatch[1]) / 100;
				if (qLower.match(/(more|higher|increase|grow|up)/)) changes.dailyCustomers = Math.round(calcs.dailyCust * (1 + pct));
				else changes.dailyCustomers = Math.round(calcs.dailyCust * (1 - pct));
			}
		} else {
			const numMatch = question.match(/(\\d+)\\s*(more|fewer|less|extra)?.*(customer|people|traffic|guest)/i);
			if (numMatch) {
				const num = parseInt(numMatch[1], 10);
				if (numMatch[2] && numMatch[2].match(/(more|extra)/i)) changes.dailyCustomers = calcs.dailyCust + num;
				else if (numMatch[2] && numMatch[2].match(/(fewer|less)/i)) changes.dailyCustomers = Math.max(0, calcs.dailyCust - num);
				else changes.dailyCustomers = num;
			}
		}
	}

	if (qLower.match(/(staff|employee|hire|worker|team)/)) {
		let count = 0;
		if (qLower.match(/\\b(one|a)\\b/)) count = 1;
		else if (qLower.includes('two')) count = 2;
		else if (qLower.includes('three')) count = 3;
		else if (qLower.includes('four')) count = 4;
		else if (qLower.includes('five')) count = 5;
		else {
			const m = question.match(/(?:\\s|^)(\\d+)(?:\\s|$)/);
			if (m) count = parseInt(m[1], 10);
		}
		
		if (count > 0) {
			const currentStaff = financialData.staffCount || bench.staffPerShift;
			if (qLower.match(/(more|add|extra|another)/)) changes.staffCount = currentStaff + count;
			else if (qLower.match(/(fewer|less|remove|fire|drop)/)) changes.staffCount = Math.max(1, currentStaff - count);
			else changes.staffCount = count;
		}
	}

	"""

if start_idx != -1 and end_idx != -1:
    new_orig = orig[:start_idx] + hardened_code + orig[end_idx:]
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(new_orig)
    print("Hardened successfully")
else:
    print("Could not find boundaries", start_idx, end_idx)
