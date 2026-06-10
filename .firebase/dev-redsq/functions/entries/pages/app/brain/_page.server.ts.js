import { redirect } from "@sveltejs/kit";
function load() {
  throw redirect(302, "/app/brain/segments");
}
export {
  load
};
