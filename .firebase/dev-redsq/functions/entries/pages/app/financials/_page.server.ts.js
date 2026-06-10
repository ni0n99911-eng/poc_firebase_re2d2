import { redirect } from "@sveltejs/kit";
const load = () => {
  redirect(302, "/app/business-plan");
};
export {
  load
};
