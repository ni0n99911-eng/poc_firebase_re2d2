import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jtunulrrnhekljzirynu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY env var'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('[1] Checking block_group_scores table...\n');
  
  // Get count of total scores
  const { count: totalScores } = await supabase
    .from('block_group_scores')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Total block_group_scores rows: ${totalScores || 0}`);
  
  // Get distinct geoids
  const { data: geoidData } = await supabase
    .from('block_group_scores')
    .select('geoid', { distinct: true });
  
  const uniqueGeoids = geoidData?.length || 0;
  console.log(`Unique GEOIDs: ${uniqueGeoids}`);
  
  // Get ALL data to extract unique score_types properly
  const { data: allData } = await supabase
    .from('block_group_scores')
    .select('score_type')
    .limit(1000);
  
  const scoreTypeSet = new Set(allData?.map(d => d.score_type) || []);
  const scoreTypes = Array.from(scoreTypeSet).sort();
  console.log(`\nUnique score types (${scoreTypes.length}):`);
  scoreTypes.forEach(t => console.log(`  - ${t}`));
  
  // Get a sample of actual scored locations
  console.log('\n[2] Sample scored block groups:\n');
  
  const { data: sampleGeoids } = await supabase
    .from('block_group_scores')
    .select('geoid', { distinct: true })
    .limit(3);
  
  if (sampleGeoids && sampleGeoids.length > 0) {
    for (const { geoid } of sampleGeoids) {
      console.log(`GEOID: ${geoid}`);
      
      const { data: scores } = await supabase
        .from('block_group_scores')
        .select('score_type, score, components')
        .eq('geoid', geoid)
        .order('score_type');
      
      if (scores) {
        scores.forEach(row => {
          const comp = row.components && Object.keys(row.components).length > 0 
            ? ` (${Object.keys(row.components).join(', ')})` 
            : '';
          console.log(`  ${row.score_type}: ${row.score}${comp}`);
        });
      }
      console.log('');
    }
  }
  
  // Get vision data stats
  console.log('[3] Vision data:\n');
  
  const { count: visionCount } = await supabase
    .from('block_group_visions')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Total block_group_visions rows: ${visionCount || 0}`);
  
  if (visionCount && visionCount > 0) {
    const { data: visions } = await supabase
      .from('block_group_visions')
      .select('geoid, vision_type, model, generated_at')
      .limit(3);
    
    if (visions) {
      console.log('\nSample vision data:');
      visions.forEach(v => {
        console.log(`  GEOID: ${v.geoid}`);
        console.log(`  Type: ${v.vision_type}`);
        console.log(`  Model: ${v.model}`);
        console.log(`  Generated: ${v.generated_at}`);
      });
    }
  }
  
  console.log('\n[DONE]');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
