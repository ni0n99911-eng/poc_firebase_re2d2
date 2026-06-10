import snowflake from "snowflake-sdk";
import { p as private_env } from "./private.js";
const getConnection = () => {
  let token = private_env.SNOWFLAKE_PASSWORD;
  if (token && token.startsWith("PAT-")) {
    token = token.substring(4);
  }
  return snowflake.createConnection({
    account: private_env.SNOWFLAKE_ACCOUNT,
    username: private_env.SNOWFLAKE_USER,
    authenticator: "PROGRAMMATIC_ACCESS_TOKEN",
    token,
    database: "RE2_ANALYTICS",
    schema: "STAGING_PROD",
    warehouse: "RE2_COMPUTE_WH"
  });
};
async function getGoldenRecord(lat, lng, businessType) {
  let mappedCategory = "cafe";
  if (businessType.includes("gym") || businessType.includes("fitness")) {
    mappedCategory = "gym";
  }
  return new Promise((resolve, reject) => {
    const connection = getConnection();
    connection.connect((err, conn) => {
      if (err) {
        console.warn("[Snowflake] Unable to connect (likely IP restricted). Falling back to mock data.", err.message);
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
        complete: (err2, stmt, rows) => {
          if (err2) {
            console.warn("[Snowflake] Query failed. Falling back to mock data.", err2.message);
            resolve(getFallbackMock(mappedCategory));
          } else {
            resolve(rows[0] || getFallbackMock(mappedCategory));
          }
          conn.destroy((err3) => {
            if (err3) console.error("Failed to disconnect:", err3);
          });
        }
      });
    });
  });
}
function getFallbackMock(category) {
  if (category === "gym") {
    return {
      LOCATION_ID: "loc_times_square",
      LOCATION_NAME: "Times Square",
      BUSINESS_CATEGORY: "gym",
      TOTAL_COMPETITORS: 3,
      TOTAL_DAILY_RIDERSHIP: 12e4,
      ESTIMATED_MORNING_PASSERSBY: 15e3,
      MEDIAN_HOUSEHOLD_INCOME: 95e3,
      CRIME_COUNT: 400,
      COMPLAINT_COUNT: 85,
      BUSINESS_LICENSE_COUNT: 20,
      MORNING_FOOT_TRAFFIC_SCORE: 95,
      COMPETITION_CONTEXT_SCORE: 80,
      DEMOGRAPHICS_FIT_SCORE: 60,
      DAILY_RITUAL_DENSITY_SCORE: 2.1,
      STREET_SIDE_SCORE: 70,
      SAFETY_SCORE: 40,
      NEIGHBORHOOD_HEALTH_SCORE: 50,
      BUSINESS_SURVIVAL_SCORE: 65,
      FINAL_LOCATION_IQ: 70,
      CATEGORY_PERCENTILE: 0.1
    };
  }
  return {
    LOCATION_ID: "loc_345_7th_ave",
    LOCATION_NAME: "345 7th Ave",
    BUSINESS_CATEGORY: "cafe",
    TOTAL_COMPETITORS: 8,
    TOTAL_DAILY_RIDERSHIP: 66e3,
    ESTIMATED_MORNING_PASSERSBY: 8104,
    MEDIAN_HOUSEHOLD_INCOME: 12e4,
    CRIME_COUNT: 711,
    COMPLAINT_COUNT: 199,
    BUSINESS_LICENSE_COUNT: 14,
    MORNING_FOOT_TRAFFIC_SCORE: 88,
    COMPETITION_CONTEXT_SCORE: 60,
    DEMOGRAPHICS_FIT_SCORE: 75,
    DAILY_RITUAL_DENSITY_SCORE: 1.44,
    STREET_SIDE_SCORE: 50,
    SAFETY_SCORE: 0,
    NEIGHBORHOOD_HEALTH_SCORE: 40.2,
    BUSINESS_SURVIVAL_SCORE: 50,
    FINAL_LOCATION_IQ: 50,
    CATEGORY_PERCENTILE: 0
  };
}
export {
  getConnection,
  getGoldenRecord
};
