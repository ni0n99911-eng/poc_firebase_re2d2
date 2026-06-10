import snowflake from 'snowflake-sdk';
import { env } from '$env/dynamic/private';

// Initialize the connection pool or a single connection instance
export const getConnection = () => {
    let token = env.SNOWFLAKE_PASSWORD as string;
    if (token && token.startsWith('PAT-')) {
        token = token.substring(4);
    }
    return snowflake.createConnection({
        account: env.SNOWFLAKE_ACCOUNT as string,
        username: env.SNOWFLAKE_USER as string,
        authenticator: 'PROGRAMMATIC_ACCESS_TOKEN',
        token: token,
        database: 'RE2_ANALYTICS',
        schema: 'STAGING_PROD',
        warehouse: 'RE2_COMPUTE_WH'
    });
};

export async function getGoldenRecord(lat: number, lng: number, businessType: string): Promise<any> {
    // Map frontend businessType to the mock data's BUSINESS_CATEGORY ('cafe' or 'gym')
    let mappedCategory = 'cafe';
    if (businessType.includes('gym') || businessType.includes('fitness')) {
        mappedCategory = 'gym';
    }

    return new Promise((resolve, reject) => {
        const connection = getConnection();
        
        connection.connect((err: any, conn: any) => {
            if (err) {
                console.warn('[Snowflake] Unable to connect (likely IP restricted). Falling back to mock data.', err.message);
                return resolve(getFallbackMock(mappedCategory));
            }

            const query = `
                SELECT * 
                FROM RE2_ANALYTICS.STAGING_PROD.fct_location_scores 
                WHERE BUSINESS_CATEGORY = ? 
                LIMIT 1
            `;

            conn.execute({
                sqlText: query,
                binds: [mappedCategory],
                complete: (err: any, stmt: any, rows: any[]) => {
                    if (err) {
                        console.warn('[Snowflake] Query failed. Falling back to mock data.', err.message);
                        resolve(getFallbackMock(mappedCategory));
                    } else {
                        resolve(rows[0] || getFallbackMock(mappedCategory));
                    }
                    
                    // Always disconnect
                    conn.destroy((err: any) => {
                        if (err) console.error('Failed to disconnect:', err);
                    });
                }
            });
        });
    });
}

function getFallbackMock(category: string) {
    if (category === 'gym') {
        return {
            LOCATION_ID: 'loc_times_square', LOCATION_NAME: 'Times Square', BUSINESS_CATEGORY: 'gym',
            TOTAL_COMPETITORS: 3, TOTAL_DAILY_RIDERSHIP: 120000, ESTIMATED_MORNING_PASSERSBY: 15000,
            MEDIAN_HOUSEHOLD_INCOME: 95000, CRIME_COUNT: 400, COMPLAINT_COUNT: 85, BUSINESS_LICENSE_COUNT: 20,
            MORNING_FOOT_TRAFFIC_SCORE: 95, COMPETITION_CONTEXT_SCORE: 80, DEMOGRAPHICS_FIT_SCORE: 60,
            DAILY_RITUAL_DENSITY_SCORE: 2.1, STREET_SIDE_SCORE: 70, SAFETY_SCORE: 40,
            NEIGHBORHOOD_HEALTH_SCORE: 50.0, BUSINESS_SURVIVAL_SCORE: 65, FINAL_LOCATION_IQ: 70, CATEGORY_PERCENTILE: 0.1
        };
    }
    return {
        LOCATION_ID: 'loc_345_7th_ave', LOCATION_NAME: '345 7th Ave', BUSINESS_CATEGORY: 'cafe',
        TOTAL_COMPETITORS: 8, TOTAL_DAILY_RIDERSHIP: 66000, ESTIMATED_MORNING_PASSERSBY: 8104,
        MEDIAN_HOUSEHOLD_INCOME: 120000, CRIME_COUNT: 711, COMPLAINT_COUNT: 199, BUSINESS_LICENSE_COUNT: 14,
        MORNING_FOOT_TRAFFIC_SCORE: 88, COMPETITION_CONTEXT_SCORE: 60, DEMOGRAPHICS_FIT_SCORE: 75,
        DAILY_RITUAL_DENSITY_SCORE: 1.44, STREET_SIDE_SCORE: 50, SAFETY_SCORE: 0,
        NEIGHBORHOOD_HEALTH_SCORE: 40.2, BUSINESS_SURVIVAL_SCORE: 50, FINAL_LOCATION_IQ: 50, CATEGORY_PERCENTILE: 0
    };
}
