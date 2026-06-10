let private_env = {};
let public_env = {};
function set_private_env(environment) {
  private_env = environment;
}
function set_public_env(environment) {
  public_env = environment;
}
const _private = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  get env() {
    return private_env;
  }
}, Symbol.toStringTag, { value: "Module" }));
export {
  _private as _,
  public_env as a,
  set_public_env as b,
  private_env as p,
  set_private_env as s
};
