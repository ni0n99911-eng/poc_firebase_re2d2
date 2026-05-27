import os

bundle_file = 'src/lib/intel/scoring/bundle-builder.ts'
space_file = 'src/lib/space-scores.ts'

with open(space_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Filter out deprecated header and duplicate imports
out_lines = []
skip = True
for line in lines:
    if "export interface SpaceCard" in line:
        skip = False
    
    if not skip:
        # replace BusinessType with string
        line = line.replace("businessType: BusinessType", "businessType: string")
        line = line.replace("businessType: ValidBusinessType | string", "businessType: string")
        out_lines.append(line)

append_content = "".join(out_lines)

append_content += """
export function buildSpaceScoreBundle(
  card: SpaceCard,
  businessType: string,
  rentBudget?: number
): { spaceScore: SpaceScoreResult; buildoutGap: BuildoutGapEstimate } {
  return {
    spaceScore: computeSpaceScore(card, businessType, rentBudget),
    buildoutGap: estimateBuildoutGap(card, businessType),
  };
}
"""

with open(bundle_file, 'r', encoding='utf-8') as f:
    bundle_content = f.read()

# Add imports for scoreToGrade if not present
if "scoreToGrade" not in bundle_content:
    bundle_content = bundle_content.replace(
        "import { runIQScore } from '$lib/intel/scoring/iq-score';",
        "import { runIQScore } from '$lib/intel/scoring/iq-score';\nimport { scoreToGrade } from '$lib/intel/scoring/grade-scale';"
    )

bundle_content += "\n\n// --- Space Scoring ---\n\n" + append_content

with open(bundle_file, 'w', encoding='utf-8') as f:
    f.write(bundle_content)

print("Ported successfully.")
