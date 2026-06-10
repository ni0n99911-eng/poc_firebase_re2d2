import { redirect } from "@sveltejs/kit";
const load = async ({ locals }) => {
  if (locals.user) {
    throw redirect(303, "/app/location");
  }
  throw redirect(301, "/login");
};
export {
  load
};
