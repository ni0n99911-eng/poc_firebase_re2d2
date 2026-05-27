import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  // Business Case page — no redirect, serve the full page
  return {};
};
