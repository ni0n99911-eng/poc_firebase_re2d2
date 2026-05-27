import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  try {
    const { data, error } = await supabase
      .from('block_group_scores')
      .select()
      .limit(1);

    if (error) {
      console.error('Error:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('Columns in block_group_scores:');
      Object.keys(data[0]).forEach(k => console.log(`  - ${k}`));
      
      console.log('\nSample record:');
      console.log(JSON.stringify(data[0], null, 2));
    } else {
      console.log('No records found');
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
