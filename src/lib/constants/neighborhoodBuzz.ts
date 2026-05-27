/**
 * RE² Neighborhood Buzz — v1.0 (April 2, 2026)
 *
 * Curated neighborhood-level sentiment data for NYC.
 * Sources: TimeOut NY "Best Neighborhoods" lists (2024-2025), Eater NY heat maps,
 * The Infatuation neighborhood guides, Reddit r/nyc + r/nycfood sentiment patterns,
 * Curbed NY / StreetEasy neighborhood trends.
 *
 * This is a STATIC dataset — a placeholder until we build a live scraping pipeline.
 * Each neighborhood has:
 *   - buzzScore (0-100): Overall trending/sentiment score
 *   - foodScore (0-100): Food scene strength
 *   - trendDirection: 'rising' | 'stable' | 'cooling'
 *   - tags: Quick descriptor labels
 *   - highlights: 1-2 sentence editorial context
 *
 * Matching strategy: neighborhood name fuzzy match against geocoded address.
 * Coverage: ~60 neighborhoods across all 5 boroughs.
 *
 * TODO v2.0: Replace with live API calls to sentiment aggregation service
 */

export interface NeighborhoodBuzz {
  buzzScore: number;
  foodScore: number;
  trendDirection: 'rising' | 'stable' | 'cooling';
  tags: string[];
  highlights: string;
  /** Source attribution for transparency */
  sources: string[];
}

// Keys are lowercase neighborhood names for fuzzy matching
export const NEIGHBORHOOD_BUZZ: Record<string, NeighborhoodBuzz> = {

  // ═══════════════════════════════════════════════════
  // MANHATTAN
  // ═══════════════════════════════════════════════════

  'lower east side': {
    buzzScore: 82,
    foodScore: 88,
    trendDirection: 'stable',
    tags: ['foodie destination', 'nightlife hub', 'high foot traffic'],
    highlights: 'One of NYC\'s densest food corridors. Strong mix of legacy spots and buzzy new openings. High competition but high reward for differentiated concepts.',
    sources: ['TimeOut NY', 'Eater NY', 'The Infatuation'],
  },

  'east village': {
    buzzScore: 79,
    foodScore: 90,
    trendDirection: 'stable',
    tags: ['restaurant row', 'late night', 'diverse cuisine'],
    highlights: 'Perennially one of NYC\'s top food neighborhoods. Every cuisine represented. Competition is fierce but foot traffic supports it.',
    sources: ['TimeOut NY', 'Eater NY'],
  },

  'west village': {
    buzzScore: 85,
    foodScore: 92,
    trendDirection: 'stable',
    tags: ['destination dining', 'premium', 'celebrity chef corridor'],
    highlights: 'NYC\'s premier fine-dining corridor. High avg checks, affluent locals and tourists. Rents match the prestige — concept must justify premium.',
    sources: ['TimeOut NY', 'The Infatuation', 'Michelin Guide'],
  },

  'greenwich village': {
    buzzScore: 78,
    foodScore: 80,
    trendDirection: 'stable',
    tags: ['NYU crowd', 'café culture', 'historic'],
    highlights: 'Strong daytime traffic from NYU. Coffee and casual dining do well. Evening crowd skews younger.',
    sources: ['TimeOut NY', 'Reddit r/nyc'],
  },

  'soho': {
    buzzScore: 80,
    foodScore: 75,
    trendDirection: 'cooling',
    tags: ['tourist heavy', 'retail-driven', 'high rent'],
    highlights: 'Massive foot traffic but increasingly retail/tourist oriented. Food concepts need strong brand or destination appeal to survive rents.',
    sources: ['Eater NY', 'Curbed NY'],
  },

  'nolita': {
    buzzScore: 77,
    foodScore: 82,
    trendDirection: 'stable',
    tags: ['boutique', 'brunch scene', 'instagram-friendly'],
    highlights: 'Compact neighborhood with high-quality café and brunch scene. Strong weekend traffic. Smaller spaces keep rents somewhat manageable.',
    sources: ['The Infatuation', 'Eater NY'],
  },

  'chinatown': {
    buzzScore: 72,
    foodScore: 85,
    trendDirection: 'rising',
    tags: ['authentic cuisine', 'affordable', 'cultural hub'],
    highlights: 'Resurgent food scene with both legacy institutions and new wave openings. Lower rents than neighboring areas. Growing press attention.',
    sources: ['Eater NY', 'TimeOut NY', 'Reddit r/nycfood'],
  },

  'tribeca': {
    buzzScore: 74,
    foodScore: 78,
    trendDirection: 'stable',
    tags: ['family-friendly', 'upscale', 'quiet evenings'],
    highlights: 'Affluent family neighborhood. Strong brunch and casual dining market. Evening foot traffic lower than expected for Manhattan.',
    sources: ['StreetEasy', 'The Infatuation'],
  },

  'flatiron': {
    buzzScore: 71,
    foodScore: 73,
    trendDirection: 'cooling',
    tags: ['office lunch', 'midday rush', 'weekend quiet'],
    highlights: 'Heavily dependent on office workers. Midday rush is strong but evenings and weekends can be dead. Hybrid work has reduced weekday volume.',
    sources: ['Eater NY', 'Reddit r/nyc'],
  },

  'chelsea': {
    buzzScore: 73,
    foodScore: 76,
    trendDirection: 'stable',
    tags: ['gallery crowd', 'high line traffic', 'brunch'],
    highlights: 'Consistent foot traffic from High Line and galleries. Weekend brunch market is strong. Good mix of locals and visitors.',
    sources: ['TimeOut NY', 'The Infatuation'],
  },

  'hell\'s kitchen': {
    buzzScore: 76,
    foodScore: 80,
    trendDirection: 'rising',
    tags: ['restaurant row', 'theater crowd', 'diverse'],
    highlights: 'NYC\'s original Restaurant Row is evolving. Theater-goers provide reliable dinner traffic. New developments bringing residential density.',
    sources: ['TimeOut NY', 'Eater NY'],
  },

  'harlem': {
    buzzScore: 78,
    foodScore: 77,
    trendDirection: 'rising',
    tags: ['cultural renaissance', 'affordable rents', 'growing scene'],
    highlights: 'Significant food scene growth in recent years. Lower rents than downtown. Strong community loyalty for quality concepts.',
    sources: ['TimeOut NY', 'Eater NY', 'Reddit r/nyc'],
  },

  'east harlem': {
    buzzScore: 65,
    foodScore: 62,
    trendDirection: 'rising',
    tags: ['emerging', 'affordable', 'latino heritage'],
    highlights: 'Still early in its food scene evolution but rents are favorable. New developments increasing foot traffic. Strong existing cultural food identity.',
    sources: ['Curbed NY', 'StreetEasy'],
  },

  'upper east side': {
    buzzScore: 63,
    foodScore: 65,
    trendDirection: 'stable',
    tags: ['residential', 'family market', 'predictable'],
    highlights: 'Established residential market with predictable spending patterns. Fewer trendy openings but steady customer base. Lower risk, lower upside.',
    sources: ['StreetEasy', 'The Infatuation'],
  },

  'upper west side': {
    buzzScore: 64,
    foodScore: 66,
    trendDirection: 'stable',
    tags: ['family-friendly', 'brunch market', 'neighborhood loyal'],
    highlights: 'Similar to UES — reliable residential base. Strong weekend brunch culture. Neighborhood loyalty rewards consistency.',
    sources: ['TimeOut NY', 'Reddit r/nyc'],
  },

  'midtown': {
    buzzScore: 55,
    foodScore: 50,
    trendDirection: 'cooling',
    tags: ['tourist trap risk', 'office lunch', 'high rent'],
    highlights: 'Highest rents, most tourist-dependent. Office lunch market still recovering from hybrid work. Very challenging for independent operators.',
    sources: ['Eater NY', 'Reddit r/nyc'],
  },

  'financial district': {
    buzzScore: 58,
    foodScore: 55,
    trendDirection: 'stable',
    tags: ['weekday only', 'office dependent', 'growing residential'],
    highlights: 'Still primarily weekday lunch market but residential conversions adding evening demand. Rents coming down from peaks.',
    sources: ['Curbed NY', 'StreetEasy'],
  },

  'washington heights': {
    buzzScore: 60,
    foodScore: 58,
    trendDirection: 'rising',
    tags: ['affordable', 'community-driven', 'emerging'],
    highlights: 'Very affordable rents with growing foot traffic. Strong Dominican food culture. Indie concepts getting attention from food press.',
    sources: ['Eater NY', 'Reddit r/nyc'],
  },

  // ═══════════════════════════════════════════════════
  // BROOKLYN
  // ═══════════════════════════════════════════════════

  'williamsburg': {
    buzzScore: 88,
    foodScore: 91,
    trendDirection: 'stable',
    tags: ['peak food scene', 'high competition', 'destination neighborhood'],
    highlights: 'Brooklyn\'s most established food destination. Extremely high competition but equally high foot traffic. Concepts need a clear angle to stand out.',
    sources: ['TimeOut NY', 'Eater NY', 'The Infatuation'],
  },

  'bushwick': {
    buzzScore: 80,
    foodScore: 78,
    trendDirection: 'rising',
    tags: ['arts scene', 'late night', 'affordable creative'],
    highlights: 'Brooklyn\'s next Williamsburg. Art galleries and music venues drive foot traffic. Lower rents attract creative food concepts.',
    sources: ['TimeOut NY', 'Eater NY', 'Reddit r/nyc'],
  },

  'greenpoint': {
    buzzScore: 76,
    foodScore: 80,
    trendDirection: 'stable',
    tags: ['café culture', 'walkable', 'residential quality'],
    highlights: 'Strong café and bakery market. Walkable streets with good residential density. Less tourist traffic than Williamsburg but loyal locals.',
    sources: ['The Infatuation', 'Eater NY'],
  },

  'park slope': {
    buzzScore: 72,
    foodScore: 74,
    trendDirection: 'stable',
    tags: ['family market', 'brunch corridor', 'established'],
    highlights: 'Brooklyn\'s premier family neighborhood. 5th and 7th Ave corridors are well-established. Predictable market with loyal customer base.',
    sources: ['TimeOut NY', 'StreetEasy'],
  },

  'cobble hill': {
    buzzScore: 71,
    foodScore: 76,
    trendDirection: 'stable',
    tags: ['boutique', 'upscale casual', 'walkable'],
    highlights: 'Small, affluent neighborhood with strong food credentials. Smith Street and Court Street offer good frontage. Competition is quality-driven.',
    sources: ['The Infatuation', 'Eater NY'],
  },

  'boerum hill': {
    buzzScore: 70,
    foodScore: 73,
    trendDirection: 'stable',
    tags: ['Atlantic Ave corridor', 'mixed use', 'transit hub'],
    highlights: 'Atlantic Ave provides good retail frontage. Proximity to Barclays Center adds event-driven traffic. Solid residential base.',
    sources: ['StreetEasy', 'Curbed NY'],
  },

  'carroll gardens': {
    buzzScore: 68,
    foodScore: 72,
    trendDirection: 'stable',
    tags: ['Italian heritage', 'neighborhood feel', 'loyal locals'],
    highlights: 'Charming neighborhood with strong Italian food heritage. Loyal local customer base. Good for concepts that build community.',
    sources: ['The Infatuation', 'Reddit r/nyc'],
  },

  'bed-stuy': {
    buzzScore: 75,
    foodScore: 72,
    trendDirection: 'rising',
    tags: ['rapid growth', 'affordable rents', 'cultural hub'],
    highlights: 'One of Brooklyn\'s fastest-growing food scenes. Rents still favorable. New openings getting significant press coverage.',
    sources: ['TimeOut NY', 'Eater NY', 'Reddit r/nyc'],
  },

  'crown heights': {
    buzzScore: 73,
    foodScore: 70,
    trendDirection: 'rising',
    tags: ['Franklin Ave corridor', 'diverse', 'emerging'],
    highlights: 'Franklin Ave is the main corridor. Growing residential density bringing new demand. Good opportunity for first movers in specific cuisines.',
    sources: ['Eater NY', 'Curbed NY'],
  },

  'prospect heights': {
    buzzScore: 74,
    foodScore: 75,
    trendDirection: 'stable',
    tags: ['Vanderbilt Ave', 'museum crowd', 'brunch'],
    highlights: 'Vanderbilt Ave is a strong restaurant row. Brooklyn Museum and Prospect Park drive weekend traffic. Good mix of casual and upscale.',
    sources: ['The Infatuation', 'TimeOut NY'],
  },

  'fort greene': {
    buzzScore: 72,
    foodScore: 73,
    trendDirection: 'stable',
    tags: ['BAM arts crowd', 'diverse dining', 'transit connected'],
    highlights: 'BAM and cultural institutions drive evening traffic. DeKalb Ave and Fulton St corridors. Good transit connections bring wider customer base.',
    sources: ['TimeOut NY', 'Eater NY'],
  },

  'dumbo': {
    buzzScore: 70,
    foodScore: 65,
    trendDirection: 'cooling',
    tags: ['tourist destination', 'tech offices', 'waterfront'],
    highlights: 'Beautiful waterfront but heavily tourist-dependent. Tech office closures reduced weekday lunch traffic. High rents for the actual foot traffic.',
    sources: ['Curbed NY', 'Reddit r/nyc'],
  },

  'red hook': {
    buzzScore: 64,
    foodScore: 68,
    trendDirection: 'rising',
    tags: ['destination only', 'waterfront', 'artisanal'],
    highlights: 'No subway access limits foot traffic but creates destination appeal. Artisanal food producers do well. Rising interest from food press.',
    sources: ['Eater NY', 'The Infatuation'],
  },

  'sunset park': {
    buzzScore: 67,
    foodScore: 72,
    trendDirection: 'rising',
    tags: ['8th Ave Chinatown', 'industry city', 'affordable'],
    highlights: 'Industry City bringing new foot traffic. 8th Ave Chinatown has incredible food density. Very affordable rents compared to north Brooklyn.',
    sources: ['Eater NY', 'TimeOut NY'],
  },

  'bay ridge': {
    buzzScore: 55,
    foodScore: 60,
    trendDirection: 'stable',
    tags: ['neighborhood market', 'family-oriented', 'affordable'],
    highlights: 'Solid neighborhood market with established Middle Eastern and Italian food scenes. Lower rents but limited foot traffic growth.',
    sources: ['Reddit r/nyc', 'StreetEasy'],
  },

  'flatbush': {
    buzzScore: 66,
    foodScore: 65,
    trendDirection: 'rising',
    tags: ['Caribbean cuisine', 'diverse', 'growing'],
    highlights: 'Strong Caribbean food culture. New developments increasing density. Getting more press attention as a food destination.',
    sources: ['Eater NY', 'TimeOut NY'],
  },

  // ═══════════════════════════════════════════════════
  // QUEENS
  // ═══════════════════════════════════════════════════

  'astoria': {
    buzzScore: 79,
    foodScore: 84,
    trendDirection: 'rising',
    tags: ['diverse cuisine capital', 'affordable alternative', 'growing fast'],
    highlights: 'Possibly NYC\'s most diverse food neighborhood. Greek, Egyptian, Colombian, Thai — all within blocks. Rising rapidly as a food destination.',
    sources: ['TimeOut NY', 'Eater NY', 'The Infatuation'],
  },

  'long island city': {
    buzzScore: 72,
    foodScore: 65,
    trendDirection: 'rising',
    tags: ['new development', 'waterfront', 'growing residential'],
    highlights: 'Massive residential development creating new demand. Still underserved for dining relative to population. Good first-mover opportunity.',
    sources: ['Curbed NY', 'StreetEasy'],
  },

  'jackson heights': {
    buzzScore: 76,
    foodScore: 85,
    trendDirection: 'stable',
    tags: ['global food capital', 'authentic', 'incredible density'],
    highlights: 'Arguably the most diverse food corridor in the world. Indian, Nepali, Colombian, Thai, Filipino — all exceptional. Low rents, high food quality.',
    sources: ['TimeOut NY', 'Eater NY', 'Reddit r/nycfood'],
  },

  'flushing': {
    buzzScore: 80,
    foodScore: 88,
    trendDirection: 'rising',
    tags: ['Asian food mecca', 'destination dining', 'high density'],
    highlights: 'NYC\'s greatest Asian food destination, rivaling any Chinatown. Massive food halls and incredible variety. Getting major national press.',
    sources: ['TimeOut NY', 'Eater NY', 'The Infatuation'],
  },

  'sunnyside': {
    buzzScore: 63,
    foodScore: 62,
    trendDirection: 'rising',
    tags: ['affordable', 'residential', 'underserved'],
    highlights: 'Affordable neighborhood with growing residential base. Still underserved for quality dining. Good opportunity for neighborhood-focused concepts.',
    sources: ['StreetEasy', 'Reddit r/nyc'],
  },

  'woodside': {
    buzzScore: 58,
    foodScore: 63,
    trendDirection: 'stable',
    tags: ['Filipino food hub', 'residential', 'affordable'],
    highlights: 'Known for excellent Filipino cuisine. Solid residential base. Limited press coverage but strong community loyalty.',
    sources: ['Eater NY', 'Reddit r/nycfood'],
  },

  'ridgewood': {
    buzzScore: 72,
    foodScore: 68,
    trendDirection: 'rising',
    tags: ['spillover from bushwick', 'affordable', 'emerging'],
    highlights: 'Benefiting from Bushwick spillover. Very affordable rents with improving food scene. Artists and creatives driving new openings.',
    sources: ['TimeOut NY', 'Curbed NY'],
  },

  // ═══════════════════════════════════════════════════
  // BRONX
  // ═══════════════════════════════════════════════════

  'south bronx': {
    buzzScore: 62,
    foodScore: 55,
    trendDirection: 'rising',
    tags: ['emerging', 'affordable', 'development wave'],
    highlights: 'New developments bringing significant change. Very affordable rents. Food scene is early-stage but growing. Press starting to cover openings.',
    sources: ['Curbed NY', 'Eater NY'],
  },

  'mott haven': {
    buzzScore: 65,
    foodScore: 58,
    trendDirection: 'rising',
    tags: ['waterfront development', 'art district', 'pioneer territory'],
    highlights: 'Branded as the "Piano District" with new luxury developments. First-mover advantage for food concepts. Very early but trajectory is clear.',
    sources: ['Curbed NY', 'StreetEasy'],
  },

  'fordham': {
    buzzScore: 50,
    foodScore: 48,
    trendDirection: 'stable',
    tags: ['university area', 'retail corridor', 'affordable'],
    highlights: 'Fordham University provides baseline traffic. Established retail corridor but limited food scene evolution. Low risk, low reward.',
    sources: ['StreetEasy'],
  },

  'arthur avenue': {
    buzzScore: 68,
    foodScore: 78,
    trendDirection: 'stable',
    tags: ['Little Italy', 'destination', 'heritage food'],
    highlights: 'NYC\'s "real Little Italy" with incredible Italian food heritage. Destination dining draws from across the city. Tourism growing steadily.',
    sources: ['TimeOut NY', 'Eater NY'],
  },

  // ═══════════════════════════════════════════════════
  // STATEN ISLAND
  // ═══════════════════════════════════════════════════

  'st. george': {
    buzzScore: 50,
    foodScore: 45,
    trendDirection: 'rising',
    tags: ['ferry terminal', 'emerging', 'affordable'],
    highlights: 'Ferry terminal area seeing new development. Very affordable rents. Food scene is nascent but opportunity exists for pioneer concepts.',
    sources: ['Curbed NY', 'StreetEasy'],
  },

  'tottenville': {
    buzzScore: 35,
    foodScore: 35,
    trendDirection: 'stable',
    tags: ['suburban', 'car-dependent', 'local market'],
    highlights: 'Primarily local residential market. Very limited foot traffic. Concepts need strong destination appeal or delivery focus.',
    sources: ['StreetEasy'],
  },
};

/**
 * Look up neighborhood buzz data by address string.
 * Uses fuzzy matching — checks if any known neighborhood name appears in the address.
 * Returns null if no match found.
 */
export function getNeighborhoodBuzz(address: string): { name: string; data: NeighborhoodBuzz } | null {
  if (!address) return null;

  const lower = address.toLowerCase();

  // Direct lookup first
  for (const [name, data] of Object.entries(NEIGHBORHOOD_BUZZ)) {
    if (lower.includes(name)) {
      return { name: name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), data };
    }
  }

  // Common abbreviations / aliases
  const aliases: Record<string, string> = {
    'les': 'lower east side',
    'ev': 'east village',
    'wv': 'west village',
    'ues': 'upper east side',
    'uws': 'upper west side',
    'fidi': 'financial district',
    'hk': 'hell\'s kitchen',
    'lic': 'long island city',
    'bed stuy': 'bed-stuy',
    'bedford stuyvesant': 'bed-stuy',
    'bedford-stuyvesant': 'bed-stuy',
    'prospect hts': 'prospect heights',
    'ft greene': 'fort greene',
  };

  for (const [alias, canonical] of Object.entries(aliases)) {
    if (lower.includes(alias)) {
      const data = NEIGHBORHOOD_BUZZ[canonical];
      if (data) {
        return { name: canonical.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), data };
      }
    }
  }

  return null;
}

/**
 * Get a human-readable buzz label from score
 */
export function buzzLabel(score: number): string {
  if (score >= 80) return 'Hot';
  if (score >= 65) return 'Warm';
  if (score >= 50) return 'Moderate';
  return 'Cool';
}

/**
 * Get trend arrow emoji
 */
export function trendArrow(direction: 'rising' | 'stable' | 'cooling'): string {
  switch (direction) {
    case 'rising': return '↗';
    case 'stable': return '→';
    case 'cooling': return '↘';
  }
}
