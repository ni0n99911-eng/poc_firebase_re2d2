import { a as public_env } from "../../chunks/private.js";
const load = async ({ locals, url }) => {
  return {
    user: locals.user,
    clerkPublishableKey: public_env.PUBLIC_CLERK_PUBLISHABLE_KEY || "",
    pathname: url.pathname
  };
};
export {
  load
};
