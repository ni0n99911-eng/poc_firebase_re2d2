import { redirect } from '@sveltejs/kit';

export function load() {
	// Street-level intelligence requires hyperlocal data not yet available at scale.
	// Redirect to dashboard until data layer is ready.
	throw redirect(307, '/app/dashboard');
}
