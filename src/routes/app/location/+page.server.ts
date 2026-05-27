import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Google Maps API key is accessed client-side via $env/dynamic/public
	return {};
};
