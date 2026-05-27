/**
 * V4 Patch 003: Raw Data Transparency Payload
 *
 * Defines which raw inputs from block_group_intel map to each V4 dimension,
 * so the API can expose the actual numbers behind every score.
 *
 * When the UI shows "Competition: 25", the user should be able to expand
 * and see the raw data: "294 food establishments, 17/50 chains (34%), avg Yelp 3.8"
 *
 * This module defines:
 * 1. TRANSPARENCY_MAP: which raw fields feed each dimension
 * 2. extractTransparencyPayload(): pulls raw values from block_group_intel
 * 3. formatForUI(): converts raw values into human-readable explanations
 */

// ─── Transparency Map ───
// Maps each V4 dimension to the raw data fields that inform it
// Fields use dot notation: "source.field" where source is the block_group_intel source key

const TRANSPARENCY_MAP = {
  marketProof: {
    label: 'Market Proof',
    description: 'Do independent businesses already thrive here?',
    fields: [
      { key: 'foursquare.total_venues', label: 'Total Foursquare venues', unit: '' },
      { key: 'foursquare.independent_count', label: 'Independent businesses', unit: '' },
      { key: 'foursquare.chain_count', label: 'Chain businesses', unit: '' },
      { key: 'dca_licenses.record_count', label: 'DCA business licenses', unit: '' },
      { key: 'dohmh_inspections.record_count', label: 'DOHMH inspections', unit: '' },
      { key: 'hybrid_outcomes.all_food.successRate', label: 'Business success rate', unit: '%' },
      { key: 'hybrid_outcomes.all_food.n', label: 'Businesses sampled', unit: '' },
    ],
  },
  accessibility: {
    label: 'Accessibility',
    description: 'How easily can customers get here?',
    fields: [
      { key: 'walkscore.walkscore', label: 'Walk Score', unit: '/100' },
      { key: 'walkscore.transit_score', label: 'Transit Score', unit: '/100' },
      { key: 'walkscore.bike_score', label: 'Bike Score', unit: '/100' },
      { key: 'mta_ridership.estimated_daily_ridership', label: 'Daily subway riders', unit: '' },
      { key: 'mta_ridership.station_count_within_400m', label: 'Subway stations ≤400m', unit: '' },
      { key: 'pedestrian_counts.avg_pedestrian_count', label: 'Avg daily pedestrians', unit: '' },
    ],
  },
  competition: {
    label: 'Competition',
    description: 'Is there room for this type of business?',
    fields: [
      { key: 'google_places.total_results', label: 'Google Places nearby', unit: '' },
      { key: 'osm_pois.total_pois', label: 'OpenStreetMap POIs', unit: '' },
      { key: 'dohmh_inspections.record_count', label: 'Food establishments', unit: '' },
      { key: 'google_places.avg_rating', label: 'Avg Google rating', unit: '★' },
      { key: 'yelp.total_businesses', label: 'Yelp businesses', unit: '' },
      { key: 'yelp.avg_rating', label: 'Avg Yelp rating', unit: '★' },
      { key: 'foursquare.category_distribution', label: 'Category breakdown', unit: 'object' },
    ],
  },
  priceIncomeFit: {
    label: 'Price-Income Fit',
    description: 'Can this neighborhood afford this concept?',
    fields: [
      { key: 'census_demographics.median_household_income', label: 'Median household income', unit: '$' },
      { key: 'google_places.price_level_distribution', label: 'Google price levels', unit: 'object' },
      { key: 'yelp.price_level_distribution', label: 'Yelp price levels', unit: 'object' },
      { key: 'census_housing.median_gross_rent', label: 'Median gross rent', unit: '$/mo' },
      { key: 'census_housing.median_rent_burden_pct', label: 'Rent burden', unit: '%' },
    ],
  },
  vibrancy: {
    label: 'Vibrancy',
    description: 'Is this area commercially alive?',
    fields: [
      { key: 'sidewalk_cafes.record_count', label: 'Sidewalk café permits', unit: '' },
      { key: 'liquor_licenses.total_licenses', label: 'Liquor licenses', unit: '' },
      { key: 'dca_licenses.record_count', label: 'DCA licenses', unit: '' },
      { key: 'foursquare.total_venues', label: 'Foursquare venues', unit: '' },
      { key: 'yelp.total_businesses', label: 'Yelp businesses', unit: '' },
    ],
  },
  demographics: {
    label: 'Demographics',
    description: 'Who lives and works here?',
    fields: [
      { key: 'census_demographics.median_household_income', label: 'Median income', unit: '$' },
      { key: 'census_demographics.total_population', label: 'Population', unit: '' },
      { key: 'census_demographics.median_age', label: 'Median age', unit: 'yrs' },
      { key: 'census_demographics.in_labor_force', label: 'In labor force', unit: '' },
      { key: 'census_demographics.bachelors_degree', label: 'Bachelor\'s degree+', unit: '' },
      { key: 'census_housing.owner_occupied', label: 'Owner-occupied units', unit: '' },
      { key: 'census_housing.median_rent_burden_pct', label: 'Rent burden', unit: '%' },
      { key: 'census_housing.total_housing_units', label: 'Total housing units', unit: '' },
    ],
  },
  safety: {
    label: 'Safety',
    description: 'How safe is this area?',
    fields: [
      { key: 'nypd_crime.record_count', label: 'Crime incidents', unit: '' },
      { key: 'nypd_crime.by_category', label: 'Crime breakdown', unit: 'object' },
      { key: '311_complaints.record_count', label: '311 complaints', unit: '' },
      { key: 'dob_permits.record_count', label: 'DOB permits/violations', unit: '' },
    ],
  },
  momentum: {
    label: 'Momentum',
    description: 'Is this area growing?',
    fields: [
      { key: 'dob_permits.by_type', label: 'Permit types', unit: 'object' },
      { key: 'pluto_zoning.avg_built_far', label: 'Avg built FAR', unit: '' },
      { key: 'pluto_zoning.avg_max_far', label: 'Avg max FAR', unit: '' },
      { key: 'lpc_landmarks.record_count', label: 'Landmarks nearby', unit: '' },
    ],
  },
  boroughBonus: {
    label: 'Borough Bonus',
    description: 'Borough-specific signals from 311 complaint subtypes and local data',
    fields: [
      { key: '311_complaints.by_type', label: '311 complaint types', unit: 'object' },
      { key: 'dob_permits.by_type', label: 'DOB permit types', unit: 'object' },
      { key: 'census_demographics.in_labor_force', label: 'Labor force', unit: '' },
      { key: 'census_demographics.total_population', label: 'Population', unit: '' },
      { key: 'google_places.price_level_distribution', label: 'Price levels', unit: 'object' },
      { key: 'yelp.price_level_distribution', label: 'Yelp prices', unit: 'object' },
    ],
  },
};

/**
 * Extract raw data values from block_group_intel for a given dimension
 * @param rawIntel - Map of source → data from block_group_intel
 * @param dimension - V4 dimension name
 * @returns Object with field labels as keys and raw values
 */
function extractTransparencyPayload(rawIntel, dimension) {
  const config = TRANSPARENCY_MAP[dimension];
  if (!config) return null;

  const payload = {
    label: config.label,
    description: config.description,
    fields: [],
  };

  for (const field of config.fields) {
    const parts = field.key.split('.');
    let val = rawIntel;
    for (const p of parts) {
      val = val?.[p];
      if (val === undefined || val === null) break;
    }

    if (val !== undefined && val !== null) {
      payload.fields.push({
        label: field.label,
        value: val,
        unit: field.unit,
        formatted: formatValue(val, field.unit),
      });
    }
  }

  return payload;
}

function formatValue(val, unit) {
  if (unit === 'object' && typeof val === 'object') {
    // Compact object display
    return Object.entries(val)
      .slice(0, 8)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
  }
  if (unit === '$' && typeof val === 'number') {
    return '$' + val.toLocaleString();
  }
  if (unit === '$/mo' && typeof val === 'number') {
    return '$' + val.toLocaleString() + '/mo';
  }
  if (unit === '%' && typeof val === 'number') {
    return val + '%';
  }
  if (typeof val === 'number') {
    return val.toLocaleString() + (unit ? ' ' + unit : '');
  }
  return String(val);
}

export { TRANSPARENCY_MAP, extractTransparencyPayload };
