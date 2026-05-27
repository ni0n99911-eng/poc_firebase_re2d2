/**
 * RE² Post-Login Router
 *
 * Simple: authenticated → dashboard, unauthenticated → login.
 * Dashboard handles both new and returning user empty states.
 * Onboarding is entered via "+ New Analysis" on the dashboard.
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user?.id) {
		throw redirect(303, '/login');
	}
	throw redirect(303, '/app/dashboard');
};
