import { redirect } from "@sveltejs/kit";
function load() {
  throw redirect(307, "/app/dashboard");
}
export {
  load
};
