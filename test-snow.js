import 'dotenv/config';
import snowflake from 'snowflake-sdk';

const conn = snowflake.createConnection({
    account: process.env.SNOWFLAKE_ACCOUNT,
    username: process.env.SNOWFLAKE_USER,
    password: process.env.SNOWFLAKE_PASSWORD,
    database: 'RE2_PROD_DB',
    schema: 'ANALYTICS',
    warehouse: 'COMPUTE_WH',
    role: 'ACCOUNTADMIN'
});

conn.connect((err, conn) => {
    if (err) {
        console.error('Connection failed:', err.message);
    } else {
        console.log('Successfully connected to Snowflake.');
        conn.destroy((err) => {
            if (err) console.error('Failed to disconnect:', err);
        });
    }
});
