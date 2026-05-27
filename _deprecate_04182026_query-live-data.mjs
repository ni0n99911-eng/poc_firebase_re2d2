import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  try {
    // Query a sample of scored block groups
    const { data, error } = await supabase
      .from('block_group_scores')
      .select('geoid, location_name, fit_score, location_iq_v2, concept_type')
      .eq('borough', 'Manhattan')
      .limit(10);

    if (error) throw error;
    console.log('Sample Manhattan scores:', data);

    // Check what columns exist
    const { data: colData, error: colErr } = await supabase
      .from('block_group_scores')
      .select()
      .limit(1);

    if (!colErr && colData && colData.length > 0) {
      console.log('\nAvailable columns:', Object.keys(colData[0]));
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
