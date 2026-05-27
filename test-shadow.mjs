import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load from .env.local
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Key in .env.local!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("🧪 Simulating Fit IQ computation...");
  
  const mockLegacyScore = 75;
  const mockShadowScore = 82;
  const discrepancy = Math.abs(mockLegacyScore - mockShadowScore);
  
  const logEntry = {
    user_id: "test_agent_user",
    geoid: "360610076001",
    concept: "specialty_coffee",
    legacy_score: mockLegacyScore,
    shadow_score: mockShadowScore,
    discrepancy: discrepancy,
    input_snapshot: { source: "manual_verification_script_via_node" }
  };
  
  console.log("📤 Pushing to fit_iq_shadow_log in Supabase...");
  console.log(JSON.stringify(logEntry, null, 2));
  
  const { data, error } = await supabase
    .from('fit_iq_shadow_log')
    .insert(logEntry)
    .select();
    
  if (error) {
    console.error("❌ FAILED: ", error.message);
    if (error.message.includes('RLS')) {
       console.error("Row Level Security is blocking the insert because we are using the Anon key.");
    }
  } else {
    console.log("✅ SUCCESS! The database accepted the insert. Here is the returned row:");
    console.log(data);
    console.log("👉 You can now check DBeaver to confirm it is there!");
  }
}

main();
