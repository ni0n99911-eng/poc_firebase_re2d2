import * as universal from '../entries/pages/_layout.ts.js';
import * as server from '../entries/pages/_layout.server.ts.js';

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export { universal };
export const universal_id = "src/routes/+layout.ts";
export { server };
export const server_id = "src/routes/+layout.server.ts";
export const imports = ["_app/immutable/nodes/0.DN4_rDfi.js","_app/immutable/chunks/DsnmJJEf.js","_app/immutable/chunks/DFfDs9aE.js","_app/immutable/chunks/BufiP_45.js","_app/immutable/chunks/D25caDr-.js","_app/immutable/chunks/y76kGcK1.js","_app/immutable/chunks/DUOBdVG7.js","_app/immutable/chunks/CvxDhPSO.js","_app/immutable/chunks/B8Xjc-9p.js","_app/immutable/chunks/CppFO539.js","_app/immutable/chunks/CMFHHzHj.js","_app/immutable/chunks/FBxVPPK2.js","_app/immutable/chunks/lZh8teW6.js","_app/immutable/chunks/WuSn550s.js","_app/immutable/chunks/C7YJlRmi.js","_app/immutable/chunks/BcXEXYgD.js","_app/immutable/chunks/mf652fPw.js","_app/immutable/chunks/CFW7KP3u.js","_app/immutable/chunks/7UM8O3XK.js","_app/immutable/chunks/AV1LE4ug.js","_app/immutable/chunks/DrZ7JVGd.js","_app/immutable/chunks/B3pMjJiC.js","_app/immutable/chunks/BN7pGYGw.js","_app/immutable/chunks/nC4iq7Kr.js"];
export const stylesheets = ["_app/immutable/assets/app.B8awCFW-.css","_app/immutable/assets/0.BKCdSYue.css"];
export const fonts = [];
