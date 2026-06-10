import * as server from '../entries/pages/admin/_page.server.ts.js';

export const index = 6;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/admin/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/admin/+page.server.ts";
export const imports = ["_app/immutable/nodes/6.DZfw-F5-.js","_app/immutable/chunks/DsnmJJEf.js","_app/immutable/chunks/BufiP_45.js","_app/immutable/chunks/D25caDr-.js","_app/immutable/chunks/CvxDhPSO.js","_app/immutable/chunks/B8Xjc-9p.js","_app/immutable/chunks/CppFO539.js","_app/immutable/chunks/FBxVPPK2.js","_app/immutable/chunks/lZh8teW6.js","_app/immutable/chunks/WuSn550s.js","_app/immutable/chunks/C7YJlRmi.js","_app/immutable/chunks/BcXEXYgD.js","_app/immutable/chunks/YQzOw_K7.js","_app/immutable/chunks/7UM8O3XK.js","_app/immutable/chunks/DFfDs9aE.js","_app/immutable/chunks/DUOBdVG7.js","_app/immutable/chunks/BN7pGYGw.js"];
export const stylesheets = ["_app/immutable/assets/6.uTkPqk0G.css"];
export const fonts = [];
