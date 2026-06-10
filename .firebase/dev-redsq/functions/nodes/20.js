import * as server from '../entries/pages/app/financials/_page.server.ts.js';

export const index = 20;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/app/financials/_page.svelte.js')).default;
export const universal = {
  "load": null,
  "prerender": false,
  "ssr": false
};
export const universal_id = "src/routes/app/financials/+page.ts";
export { server };
export const server_id = "src/routes/app/financials/+page.server.ts";
export const imports = ["_app/immutable/nodes/20.dKARkS3X.js","_app/immutable/chunks/DsnmJJEf.js","_app/immutable/chunks/DFfDs9aE.js","_app/immutable/chunks/BufiP_45.js","_app/immutable/chunks/D25caDr-.js","_app/immutable/chunks/FBxVPPK2.js","_app/immutable/chunks/CFW7KP3u.js","_app/immutable/chunks/7UM8O3XK.js","_app/immutable/chunks/DUOBdVG7.js"];
export const stylesheets = [];
export const fonts = [];
