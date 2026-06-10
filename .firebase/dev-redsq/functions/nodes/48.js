import * as server from '../entries/pages/app/website/_page.server.ts.js';

export const index = 48;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/app/website/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/app/website/+page.server.ts";
export const imports = ["_app/immutable/nodes/48.CMK-_XHo.js","_app/immutable/chunks/DsnmJJEf.js","_app/immutable/chunks/DFfDs9aE.js","_app/immutable/chunks/BufiP_45.js","_app/immutable/chunks/D25caDr-.js","_app/immutable/chunks/CvxDhPSO.js","_app/immutable/chunks/B8Xjc-9p.js","_app/immutable/chunks/CppFO539.js","_app/immutable/chunks/FBxVPPK2.js","_app/immutable/chunks/WuSn550s.js","_app/immutable/chunks/C7YJlRmi.js","_app/immutable/chunks/BcXEXYgD.js","_app/immutable/chunks/AV1LE4ug.js"];
export const stylesheets = ["_app/immutable/assets/48.BcoWpTlC.css"];
export const fonts = [];
