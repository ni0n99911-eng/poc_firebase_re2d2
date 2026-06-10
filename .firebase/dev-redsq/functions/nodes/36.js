import * as server from '../entries/pages/app/recommendations/_page.server.ts.js';

export const index = 36;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/app/recommendations/_page.svelte.js')).default;
export const universal = {
  "load": null,
  "prerender": false,
  "ssr": false
};
export const universal_id = "src/routes/app/recommendations/+page.ts";
export { server };
export const server_id = "src/routes/app/recommendations/+page.server.ts";
export const imports = ["_app/immutable/nodes/36.DUP-s2h6.js","_app/immutable/chunks/DsnmJJEf.js","_app/immutable/chunks/DFfDs9aE.js","_app/immutable/chunks/BufiP_45.js","_app/immutable/chunks/D25caDr-.js","_app/immutable/chunks/y76kGcK1.js","_app/immutable/chunks/DUOBdVG7.js","_app/immutable/chunks/CvxDhPSO.js","_app/immutable/chunks/B8Xjc-9p.js","_app/immutable/chunks/CppFO539.js","_app/immutable/chunks/FBxVPPK2.js","_app/immutable/chunks/lZh8teW6.js","_app/immutable/chunks/WuSn550s.js","_app/immutable/chunks/C7YJlRmi.js","_app/immutable/chunks/BcXEXYgD.js","_app/immutable/chunks/mf652fPw.js","_app/immutable/chunks/CFW7KP3u.js","_app/immutable/chunks/7UM8O3XK.js","_app/immutable/chunks/Pg2b-klD.js","_app/immutable/chunks/B3pMjJiC.js","_app/immutable/chunks/D084FNB9.js","_app/immutable/chunks/AV1LE4ug.js","_app/immutable/chunks/CRLlU6aD.js","_app/immutable/chunks/CeY3YN3h.js","_app/immutable/chunks/BmjnIYve.js","_app/immutable/chunks/CssW1sDD.js","_app/immutable/chunks/BN7pGYGw.js","_app/immutable/chunks/1dHPDrID.js","_app/immutable/chunks/BwphXhWQ.js","_app/immutable/chunks/BrHmjSbG.js"];
export const stylesheets = ["_app/immutable/assets/PageNav.j8pwKQpr.css","_app/immutable/assets/DisclaimerBanner.M7SIPslP.css","_app/immutable/assets/NavigationDrawer.CO_g1_C7.css","_app/immutable/assets/36.Crbg7l7N.css"];
export const fonts = [];
