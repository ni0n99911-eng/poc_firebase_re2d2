import 'dotenv/config';
import snowflake from 'snowflake-sdk';

console.log("Reading environment variables...");
let token = process.env.SNOWFLAKE_PASSWORD || '';
if (token.startsWith('PAT-')) {
    token = token.substring(4);
}

const connection = snowflake.createConnection({
    account: process.env.SNOWFLAKE_ACCOUNT,
    username: process.env.SNOWFLAKE_USER,
    authenticator: 'PROGRAMMATIC_ACCESS_TOKEN',
    token: token,
    database: 'RE2_ANALYTICS',
    schema: 'STAGING_PROD',
    warehouse: 'RE2_COMPUTE_WH'
});

console.log(`Attempting connection to account: ${process.env.SNOWFLAKE_ACCOUNT}...`);
connection.connect((err, conn) => {
    if (err) {
        console.error("❌ Connection failed:", err.message);
        process.exit(1);
    } else {
        console.log("✅ Connection established successfully!");
        conn.destroy((err) => {
            if (err) console.error("Disconnect error:", err);
            else console.log("Disconnected cleanly.");
        });
    }
});
