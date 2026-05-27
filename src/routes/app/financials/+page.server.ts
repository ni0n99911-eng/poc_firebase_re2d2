import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// /app/financials is deprecated — redirect to /app/business-plan.
// Using 302 (not 301) so browsers don't cache the redirect permanently.
// This fires server-side BEFORE any page template renders, so the old
// financials page content is never sent to the browser.
export const load: PageServerLoad = () => {
  redirect(302, '/app/business-plan');
};
