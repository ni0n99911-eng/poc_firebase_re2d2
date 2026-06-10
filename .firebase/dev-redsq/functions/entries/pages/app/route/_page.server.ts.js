import { redirect } from "@sveltejs/kit";
const load = async ({ locals }) => {
  if (!locals.user?.id) {
    throw redirect(303, "/login");
  }
  throw redirect(303, "/app/dashboard");
};
export {
  load
};
