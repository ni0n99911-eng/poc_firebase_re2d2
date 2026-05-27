import type { LayoutServerLoad } from './$types';
import { env } from '$env/dynamic/public';
export const load: LayoutServerLoad = async ({ locals, url }) => {
	return {
		user: locals.user,
		clerkPublishableKey: env.PUBLIC_CLERK_PUBLISHABLE_KEY || '',
		pathname: url.pathname
	};
};
