import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const client = postgres(process.env.DATABASE_URL!, { prepare: false });

const rows = await client`
  SELECT geoid, score, created_at 
  FROM block_group_scores 
  ORDER BY created_at DESC 
  LIMIT 20
`;

console.log('Block groups with scores:');
rows.forEach((r: any) => console.log(`  GEOID: ${r.geoid} | Score: ${r.score} | Date: ${r.created_at}`));

const count = await client`SELECT COUNT(*) FROM block_group_scores`;
console.log(`\nTotal rows: ${count[0].count}`);

await client.end();
