import re

# File paths
bundle_file = "src/lib/intel/scoring/bundle-builder.ts"
space_file = "src/lib/intel/scoring/space-score.ts"
page_file = "src/routes/app/space/compare/+page.svelte"

# 1. Read bundle-builder.ts
with open(bundle_file, "r", encoding="utf-8") as f:
    bundle_content = f.read()

# 2. Split at Space Scoring
split_marker = "// --- Space Scoring ---"
if split_marker in bundle_content:
    parts = bundle_content.split(split_marker)
    bundle_new_content = parts[0].strip() + "\n\n// Re-export space scoring for backward compatibility if needed\nexport * from './space-score';\n"
    space_content = "import { scoreToGrade } from '$lib/intel/scoring/grade-scale';\n\n" + parts[1].strip() + "\n"

    # Write new bundle-builder.ts
    with open(bundle_file, "w", encoding="utf-8") as f:
        f.write(bundle_new_content)

    # Write new space-score.ts
    with open(space_file, "w", encoding="utf-8") as f:
        f.write(space_content)
    print("Extracted space-score.ts")
else:
    print("WARNING: split_marker not found")

# 3. Fix compare/+page.svelte
with open(page_file, "r", encoding="utf-8") as f:
    page_content = f.read()

# Fix import
page_content = page_content.replace(
    "import { computeSpaceScore, getWeights, type SpaceCard, type SpaceScoreResult } from '$lib/intel/scoring/bundle-builder';",
    "import { computeSpaceScore, getWeights, type SpaceCard, type SpaceScoreResult } from '$lib/intel/scoring/space-score';"
)

# Replace the wrong call signature
# The page was doing:
# const weights = getWeights(launchPadData?.businessType || 'cafe');
# for (const card of compareCards) {
#   const result = computeSpaceScore(card, weights);
# ...
call_block_old = """
		const weights = getWeights(launchPadData?.businessType || 'cafe');
		scoreResults.clear();
		for (const card of compareCards) {
			const result = computeSpaceScore(card, weights);
"""
call_block_new = """
		const bizType = launchPadData?.businessType || 'cafe';
		scoreResults.clear();
		for (const card of compareCards) {
			const result = computeSpaceScore(card, bizType);
"""
if "computeSpaceScore(card, weights)" in page_content:
    page_content = page_content.replace(call_block_old, call_block_new)

# Fix shapes: scoreResults.get(card.id)?.totalScore || 0 -> scoreResults.get(card.id)?.total || 0
page_content = page_content.replace("?.totalScore", "?.total")

# Fix dimensions: scoreResults.get(card.id)?.dimensionScores.physical -> scoreResults.get(card.id)?.dimensions.physicalReadiness.score
page_content = page_content.replace("?.dimensionScores.physical", "?.dimensions.physicalReadiness.score")
page_content = page_content.replace("?.dimensionScores.visibility", "?.dimensions.visibilityAccess.score")
page_content = page_content.replace("?.dimensionScores.economics", "?.dimensions.leaseEconomics.score")
page_content = page_content.replace("?.dimensionScores.structure", "?.dimensions.structuralFlexibility.score")

with open(page_file, "w", encoding="utf-8") as f:
    f.write(page_content)

print("Fixed compare/+page.svelte")
