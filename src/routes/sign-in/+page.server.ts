import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// If authenticated, send to dashboard; otherwise send to login
	if (locals.user) {
		throw redirect(303, '/app/location');
	}
	throw redirect(301, '/login');
};
