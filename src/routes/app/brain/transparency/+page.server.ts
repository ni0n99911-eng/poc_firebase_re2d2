import { redirect } from '@sveltejs/kit';

export function load() {
	// Score breakdown page removed — methodology surfaced inline per metric.
	throw redirect(307, '/app/dashboard');
}
