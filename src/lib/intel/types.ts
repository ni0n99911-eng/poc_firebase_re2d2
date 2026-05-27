/**
 * Core location intelligence type definitions.
 *
 * Extracted into its own module to break the circular dependency that occurs
 * when sub-modules (confidence, reconciliation, extrapolation, narrative) need
 * LocationIntelReport but index.ts also re-exports from those same modules.
 *
 * Import from here — never from './index' — inside any lib/intel sub-module.
 */

import type { CensusData } from './census';
import type { CensusHousingData } from './census-housing';
import type { WalkScoreData } from './walkscore';
import type { InspectionData } from './nyc-inspections';
import type { CrimeData } from './nyc-crime';
import type { PlacesData, MarketDensityData } from './google-places';
import type { OverpassData } from './overpass';
import type { LPCData } from './nyc-lpc';
import type { MTARidershipData } from './mta-ridership';
import type { DCALicenseData } from './dca-licenses';
import type { DOBData } from './dob-permits';
import type { NYC311Data } from './nyc-311';
import type { PedestrianData } from './nyc-pedestrian';
import type { PLUTOData } from './pluto';
import type { SidewalkCafeData } from './sidewalk-cafes';
import type { LiquorLicenseData } from './liquor-licenses';
import type { FoursquareData } from './foursquare';
import type { YelpData } from './yelp';
import type { MomentumData } from './momentum';
import type { StreetSideData } from './street-side-types';
import type { PropertyTaxProfile } from './dof-property-tax';
import type { SchoolProximityData } from './nyc-schools';

/**
 * Full location intelligence report — all sources combined.
 * Produced by fetchLocationIntel() in index.ts.
 */
export interface LocationIntelReport {
	lat: number;
	lng: number;
	address?: string;
	businessType: string;
	census: CensusData | null;
	censusHousing: CensusHousingData | null;
	walkScore: WalkScoreData | null;
	inspections: InspectionData | null;
	crime: CrimeData | null;
	places: PlacesData | null;
	marketDensity: MarketDensityData | null;
	competitors: OverpassData | null;
	lpc: LPCData | null;
	mtaRidership: MTARidershipData | null;
	dcaLicenses: DCALicenseData | null;
	dob: DOBData | null;
	complaints311: NYC311Data | null;
	pedestrian: PedestrianData | null;
	pluto: PLUTOData | null;
	sidewalkCafes: SidewalkCafeData | null;
	liquorLicenses: LiquorLicenseData | null;
	foursquare: FoursquareData | null;
	yelp: YelpData | null;
	momentum: MomentumData | null;
	/** Source #21 — NYC school locations for SLA 200-ft rule */
	schools?: SchoolProximityData | null;
	streetSide?: StreetSideData | null;
	/** Source #22 — DOF property tax + ACRIS mortgage/deed data */
	propertyTax?: PropertyTaxProfile | null;
	fetchedAt: string;
	errors: string[];
	/** How many of the 22 data sources returned non-null data */
	sourceCoverage?: { available: number; total: number; pct: number };
}
