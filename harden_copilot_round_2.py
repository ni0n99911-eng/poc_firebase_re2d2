import os

filepath = 'src/routes/api/copilot/business/+server.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    orig = f.read()

start_idx = orig.find("if (qLower.match(/(price|ticket|transaction|charge|cost)/)) {")
end_idx = orig.find("if (qLower.match(/(customer|people|traffic|guest|client)/)) {")

hardened_code = """if (qLower.match(/(price|ticket|transaction|charge|cost)/)) {
		let moneyMatch = question.match(/\\$\\s*([\\d,.]+)/);
		if (!moneyMatch) {
			// Find numbers that are preceded by common verbs/prepositions, ignoring percentages
			const fallbackMatch = question.match(/(?:to|by|is|at|for)\\s*([\\d,.]+)/);
			if (fallbackMatch && fallbackMatch[1] && !question.substring(fallbackMatch.index! + fallbackMatch[0].length).trim().startsWith('%')) {
				moneyMatch = fallbackMatch;
			} else {
				// Last resort, capture any number if there's no % nearby
				const bareNum = question.match(/(?:^|\\s)([\\d,.]+)(?:\\s|$)/);
				if (bareNum && !question.includes('%')) {
					moneyMatch = [bareNum[0], bareNum[1]];
				}
			}
		}

		if (moneyMatch) {
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

	"""

if start_idx != -1 and end_idx != -1:
    new_orig = orig[:start_idx] + hardened_code + orig[end_idx:]
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(new_orig)
    print("Hardened price parser successfully")
else:
    print("Could not find boundaries")
