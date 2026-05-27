import re

with open("c:/sandbox_re_squared/jared_prod/repo/src/routes/api/copilot/business/+server.ts", "r") as f:
    orig = f.read()

handled_code = """
async function handleWhatIf(
	question: string,
	financialData: BusinessCopilotRequest['financialData'],
	launchpad: BusinessCopilotRequest['launchpad'],
	locationScores: Record<string, any>
): Promise<BusinessCopilotResponse> {
	const calcs = computeFinancials(financialData, launchpad);
	const bench = calcs.benchmark;

	const changes: Record<string, any> = {};
	const qLower = question.toLowerCase();

	if (qLower.includes('rent')) {
		const moneyMatch = question.match(/\\$?([\\d,]+)/);
		if (moneyMatch && !qLower.includes('%')) {
			changes.rent = parseInt(moneyMatch[1].replace(/,/g, ''));
		} else if (qLower.includes('%')) {
			const pctMatch = question.match(/(\\d+)%/);
			if (pctMatch) {
				const pct = parseInt(pctMatch[1]) / 100;
				if (qLower.match(/(lower|less|decrease|drop)/)) changes.rent = calcs.rent * (1 - pct);
				else if (qLower.match(/(higher|more|increase|raise)/)) changes.rent = calcs.rent * (1 + pct);
			}
		}
	}

	if (qLower.match(/(price|ticket|transaction)/)) {
		const moneyMatch = question.match(/\\$?([\\d,.]+)/);
		if (moneyMatch && moneyMatch[1].includes('.')) {
			changes.avgTransaction = parseFloat(moneyMatch[1].replace(/,/g, ''));
		} else if (qLower.includes('%')) {
			const pctMatch = question.match(/(\\d+)%/);
			if (pctMatch) {
				const pct = parseInt(pctMatch[1]) / 100;
				if (qLower.match(/(higher|increase|raise)/)) changes.avgTransaction = calcs.avgTxn * (1 + pct);
				else changes.avgTransaction = calcs.avgTxn * (1 - pct);
			}
		}
	}

	if (qLower.match(/(customer|people|traffic)/)) {
		if (qLower.includes('%')) {
			const pctMatch = question.match(/(\\d+)%/);
			if (pctMatch) {
				const pct = parseInt(pctMatch[1]) / 100;
				if (qLower.match(/(more|higher|increase)/)) changes.dailyCustomers = calcs.dailyCust * (1 + pct);
				else changes.dailyCustomers = calcs.dailyCust * (1 - pct);
			}
		} else {
			const numMatch = question.match(/(\\d+) (more|fewer|less|extra)?.*(customer|people|traffic)/i);
			if (numMatch) {
				const num = parseInt(numMatch[1]);
				if (numMatch[2] && numMatch[2].toLowerCase() === 'more') changes.dailyCustomers = calcs.dailyCust + num;
				else if (numMatch[2] && numMatch[2].match(/(fewer|less)/i)) changes.dailyCustomers = Math.max(0, calcs.dailyCust - num);
				else changes.dailyCustomers = num;
			}
		}
	}

	if (qLower.match(/(staff|employee|hire|worker)/)) {
		let count = 0;
		if (qLower.includes('one')) count = 1;
		else if (qLower.includes('two')) count = 2;
		else if (qLower.includes('three')) count = 3;
		else {
			const m = question.match(/(\\d+)/);
			if (m) count = parseInt(m[1]);
		}
		
		if (count > 0) {
			const currentStaff = financialData.staffCount || bench.staffPerShift;
			if (qLower.match(/(more|add|extra)/)) changes.staffCount = currentStaff + count;
			else if (qLower.match(/(fewer|less|remove|fire)/)) changes.staffCount = Math.max(1, currentStaff - count);
			else changes.staffCount = count;
		}
	}

	const baseInputs = {
		businessType: launchpad.businessType,
		rent: financialData.rent || parseRent(launchpad.rent || '') || undefined,
		avgTransaction: financialData.avgTransaction || undefined,
		dailyCustomers: financialData.dailyCustomers || undefined,
		staffCount: financialData.staffCount || undefined,
		operatingHours: launchpad.hours || undefined,
	};
	
	const whatIfResult = computeWhatIf(calcs.projection, changes, baseInputs);
	const { after, impact } = whatIfResult;

	const conceptKnowledge = buildConceptKnowledge(launchpad.businessType);
	const userMsg = `The user asks a what-if scenario: "${question}"
${conceptKnowledge}

CURRENT FINANCIALS (BEFORE):
- Monthly Revenue: $${calcs.monthlyRevenue.toLocaleString()}
- Monthly Expenses: $${calcs.monthlyExpenses.toLocaleString()} (rent $${calcs.rent.toLocaleString()}, staff $${calcs.staffCost.toLocaleString()})
- Net Income: $${calcs.monthlyNetIncome.toLocaleString()}/month
- Break-even: ${calcs.breakEvenDaily} transactions/day
- Avg transaction: $${calcs.avgTxn}, Daily customers: ${calcs.dailyCust}

SCENARIO RESULTS (AFTER DETERMINISTIC CALCULATION):
Do not change these numbers; explain them.
- Monthly Revenue: $${after.monthlyPL.revenue.toLocaleString()} (Change: $${impact.revenueChange.toLocaleString()})
- Monthly Expenses: $${after.monthlyPL.totalExpenses.toLocaleString()} (rent $${after.monthlyPL.rent.toLocaleString()}, staff $${after.monthlyPL.labor.toLocaleString()})
- Net Income: $${after.monthlyPL.netIncome.toLocaleString()}/month (Change: $${impact.netIncomeChange.toLocaleString()})
- Break-even: ${after.breakEven.dailyTransactionsNeeded} transactions/day (Change: ${impact.breakEvenChange})

Explain the impact of this scenario in plain English based on the DETERMINISTIC CALCULATIONS provided above. Show the math and why it matters.`;

	const result = await callLLM({
		model: 'sonnet',
		system: BUSINESS_SYSTEM_PROMPT,
		messages: [{ role: 'user', content: userMsg }],
		maxTokens: 800,
		temperature: 0.4,
	});

	let chartUpdate: BusinessCopilotResponse['chartUpdate'] = undefined;
	if (Object.keys(changes).length > 0) {
		chartUpdate = {
			type: 'scenario_comparison',
			data: {
				original: { 
					revenue: calcs.monthlyRevenue,
					rent: calcs.rent, 
					expenses: calcs.monthlyExpenses, 
					netIncome: calcs.monthlyNetIncome,
					breakEven: calcs.breakEvenDaily
				},
				scenario: { 
					revenue: after.monthlyPL.revenue,
					rent: after.monthlyPL.rent, 
					expenses: after.monthlyPL.totalExpenses, 
					netIncome: after.monthlyPL.netIncome,
					breakEven: after.breakEven.dailyTransactionsNeeded
				},
				label: `Scenario: ${Object.keys(changes).join(', ')} changed`,
			},
		};
	}

	return {
		message: result.content,
		suggestedPrompts: [
			'What if I hired one fewer staff member?',
			'What if I increased prices by 15%?',
			'Show me the 12-month projection',
		],
		chartUpdate,
	};
}
"""

start_idx = orig.find('async function handleWhatIf(')
end_idx = orig.find('async function handleAskQuestion(')
if start_idx != -1 and end_idx != -1:
    new_orig = orig[:start_idx] + handled_code + orig[end_idx:]
    with open("c:/sandbox_re_squared/jared_prod/repo/src/routes/api/copilot/business/+server.ts", "w") as f:
        f.write(new_orig)
    print("Replaced successfully")
else:
    print("Could not find boundaries")
