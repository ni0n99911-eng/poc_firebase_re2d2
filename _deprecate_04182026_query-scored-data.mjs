import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jtunulrrnhekljzirynu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY env var'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('[1] Checking block_group_scores table...\n');
  
  // Get count of total scores
  const { count: totalScores, error: countError } = await supabase
    .from('block_group_scores')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Total block_group_scores rows: ${totalScores || 0}`);
  if (countError) console.error('Count error:', countError.message);
  
  // Get distinct geoids
  const { data: geoidData, error: geoidError } = await supabase
    .from('block_group_scores')
    .select('geoid', { distinct: true });
  
  const uniqueGeoids = geoidData?.length || 0;
  console.log(`Unique GEOIDs: ${uniqueGeoids}`);
  if (geoidError) console.error('GEOID error:', geoidError.message);
  
  // Get distinct score types
  const { data: scoreTypeData, error: typeError } = await supabase
    .from('block_group_scores')
    .select('score_type', { distinct: true });
  
  const scoreTypes = scoreTypeData?.map(d => d.score_type) || [];
  console.log(`\nDistinct score types (${scoreTypes.length}):`);
  scoreTypes.sort().forEach(t => console.log(`  - ${t}`));
  
  if (typeError) console.error('Type error:', typeError.message);
  
  // Get a sample of actual scored locations
  console.log('\n[2] Sample scored block groups:\n');
  
  const { data: sampleGeoids } = await supabase
    .from('block_group_scores')
    .select('geoid', { distinct: true })
    .limit(5);
  
  if (sampleGeoids && sampleGeoids.length > 0) {
    for (const { geoid } of sampleGeoids) {
      console.log(`GEOID: ${geoid}`);
      
      const { data: scores } = await supabase
        .from('block_group_scores')
        .select('score_type, score, components')
        .eq('geoid', geoid);
      
      if (scores) {
        scores.forEach(row => {
          console.log(`  ${row.score_type}: ${row.score}`);
          if (row.components && Object.keys(row.components).length > 0) {
            console.log(`    Components: ${JSON.stringify(row.components).substring(0, 120)}...`);
          }
        });
      }
      console.log('');
    }
  }
  
  // Check table schema
  console.log('[3] Table structure info:\n');
  
  const { data: columns, error: schemaError } = await supabase
    .from('block_group_scores')
    .select('*')
    .limit(1);
  
  if (columns && columns.length > 0) {
    const keys = Object.keys(columns[0]);
    console.log('block_group_scores columns:');
    keys.forEach(k => console.log(`  - ${k}: ${typeof columns[0][k]}`));
  }
  if (schemaError) console.error('Schema error:', schemaError.message);
  
  // Check for vision data
  console.log('\n[4] Checking block_group_visions table...\n');
  
  const { count: visionCount, error: visionCountError } = await supabase
    .from('block_group_visions')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Total block_group_visions rows: ${visionCount || 0}`);
  if (visionCountError) console.error('Vision count error:', visionCountError.message);
  
  // Sample vision data
  if (visionCount && visionCount > 0) {
    const { data: visions } = await supabase
      .from('block_group_visions')
      .select('geoid, narrative, model')
      .limit(2);
    
    if (visions) {
      console.log('\nSample vision data:');
      visions.forEach(v => {
        console.log(`  GEOID: ${v.geoid}`);
        console.log(`  Model: ${v.model}`);
        console.log(`  Narrative: ${v.narrative?.substring(0, 150)}...`);
        console.log('');
      });
    }
  }
  
  console.log('\n[DONE]');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
