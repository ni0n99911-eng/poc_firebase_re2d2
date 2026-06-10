import * as server from '../entries/pages/app/route/_page.server.ts.js';

export const index = 37;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/app/route/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/app/route/+page.server.ts";
export const imports = ["_app/immutable/nodes/37.McdIsBhW.js","_app/immutable/chunks/DsnmJJEf.js","_app/immutable/chunks/BufiP_45.js","_app/immutable/chunks/FBxVPPK2.js"];
export const stylesheets = ["_app/immutable/assets/37.V31g1pyz.css"];
export const fonts = [];
