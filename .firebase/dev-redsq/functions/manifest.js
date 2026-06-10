export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["favicon.png","favicon.svg","icon-192.png","icon-512.png","mockServiceWorker.js","offline.html","RE2_Mockup_01_Landing.html","RE2_Mockup_02_Chat_Onboarding.html","RE2_Mockup_03_Dashboard.html","RE2_Mockup_04_Compare.html","robots.txt","sitemap.xml","soma-einstein-intro.html"]),
	mimeTypes: {".png":"image/png",".svg":"image/svg+xml",".js":"text/javascript",".html":"text/html",".txt":"text/plain",".xml":"text/xml"},
	_: {
		client: {start:"_app/immutable/entry/start.hxLDjuNL.js",app:"_app/immutable/entry/app.2TFMMVxR.js",imports:["_app/immutable/entry/start.hxLDjuNL.js","_app/immutable/chunks/CFW7KP3u.js","_app/immutable/chunks/DFfDs9aE.js","_app/immutable/chunks/BufiP_45.js","_app/immutable/chunks/D25caDr-.js","_app/immutable/chunks/7UM8O3XK.js","_app/immutable/chunks/DUOBdVG7.js","_app/immutable/entry/app.2TFMMVxR.js","_app/immutable/chunks/CVx2-2dr.js","_app/immutable/chunks/BufiP_45.js","_app/immutable/chunks/D25caDr-.js","_app/immutable/chunks/DsnmJJEf.js","_app/immutable/chunks/DFfDs9aE.js","_app/immutable/chunks/CvxDhPSO.js","_app/immutable/chunks/B8Xjc-9p.js","_app/immutable/chunks/DEKfaXEp.js","_app/immutable/chunks/B3pMjJiC.js","_app/immutable/chunks/y76kGcK1.js","_app/immutable/chunks/DUOBdVG7.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js')),
			__memo(() => import('./nodes/4.js')),
			__memo(() => import('./nodes/5.js')),
			__memo(() => import('./nodes/6.js')),
			__memo(() => import('./nodes/7.js')),
			__memo(() => import('./nodes/8.js')),
			__memo(() => import('./nodes/9.js')),
			__memo(() => import('./nodes/10.js')),
			__memo(() => import('./nodes/11.js')),
			__memo(() => import('./nodes/12.js')),
			__memo(() => import('./nodes/13.js')),
			__memo(() => import('./nodes/14.js')),
			__memo(() => import('./nodes/15.js')),
			__memo(() => import('./nodes/16.js')),
			__memo(() => import('./nodes/17.js')),
			__memo(() => import('./nodes/18.js')),
			__memo(() => import('./nodes/19.js')),
			__memo(() => import('./nodes/20.js')),
			__memo(() => import('./nodes/21.js')),
			__memo(() => import('./nodes/22.js')),
			__memo(() => import('./nodes/23.js')),
			__memo(() => import('./nodes/24.js')),
			__memo(() => import('./nodes/25.js')),
			__memo(() => import('./nodes/26.js')),
			__memo(() => import('./nodes/27.js')),
			__memo(() => import('./nodes/28.js')),
			__memo(() => import('./nodes/29.js')),
			__memo(() => import('./nodes/30.js')),
			__memo(() => import('./nodes/31.js')),
			__memo(() => import('./nodes/32.js')),
			__memo(() => import('./nodes/33.js')),
			__memo(() => import('./nodes/34.js')),
			__memo(() => import('./nodes/35.js')),
			__memo(() => import('./nodes/36.js')),
			__memo(() => import('./nodes/37.js')),
			__memo(() => import('./nodes/38.js')),
			__memo(() => import('./nodes/39.js')),
			__memo(() => import('./nodes/40.js')),
			__memo(() => import('./nodes/41.js')),
			__memo(() => import('./nodes/42.js')),
			__memo(() => import('./nodes/43.js')),
			__memo(() => import('./nodes/44.js')),
			__memo(() => import('./nodes/45.js')),
			__memo(() => import('./nodes/46.js')),
			__memo(() => import('./nodes/47.js')),
			__memo(() => import('./nodes/48.js')),
			__memo(() => import('./nodes/49.js')),
			__memo(() => import('./nodes/50.js')),
			__memo(() => import('./nodes/51.js')),
			__memo(() => import('./nodes/52.js')),
			__memo(() => import('./nodes/53.js')),
			__memo(() => import('./nodes/54.js')),
			__memo(() => import('./nodes/55.js')),
			__memo(() => import('./nodes/56.js')),
			__memo(() => import('./nodes/57.js')),
			__memo(() => import('./nodes/58.js')),
			__memo(() => import('./nodes/59.js')),
			__memo(() => import('./nodes/60.js')),
			__memo(() => import('./nodes/61.js')),
			__memo(() => import('./nodes/62.js')),
			__memo(() => import('./nodes/63.js')),
			__memo(() => import('./nodes/64.js')),
			__memo(() => import('./nodes/65.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			},
			{
				id: "/about",
				pattern: /^\/about\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/admin",
				pattern: /^\/admin\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 6 },
				endpoint: null
			},
			{
				id: "/api/admin",
				pattern: /^\/api\/admin\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/admin/_server.ts.js'))
			},
			{
				id: "/api/admin/score-stats",
				pattern: /^\/api\/admin\/score-stats\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/admin/score-stats/_server.ts.js'))
			},
			{
				id: "/api/admin/waitlist",
				pattern: /^\/api\/admin\/waitlist\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/admin/waitlist/_server.ts.js'))
			},
			{
				id: "/api/ai",
				pattern: /^\/api\/ai\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/ai/_server.ts.js'))
			},
			{
				id: "/api/analyze-concept",
				pattern: /^\/api\/analyze-concept\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/analyze-concept/_server.ts.js'))
			},
			{
				id: "/api/block-group-intel",
				pattern: /^\/api\/block-group-intel\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/block-group-intel/_server.ts.js'))
			},
			{
				id: "/api/brokers",
				pattern: /^\/api\/brokers\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/brokers/_server.ts.js'))
			},
			{
				id: "/api/business-case-model",
				pattern: /^\/api\/business-case-model\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/business-case-model/_server.ts.js'))
			},
			{
				id: "/api/business-case-summary",
				pattern: /^\/api\/business-case-summary\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/business-case-summary/_server.ts.js'))
			},
			{
				id: "/api/cache-health",
				pattern: /^\/api\/cache-health\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/cache-health/_server.ts.js'))
			},
			{
				id: "/api/checklist-sync",
				pattern: /^\/api\/checklist-sync\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/checklist-sync/_server.ts.js'))
			},
			{
				id: "/api/checklist",
				pattern: /^\/api\/checklist\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/checklist/_server.ts.js'))
			},
			{
				id: "/api/checklist/cost-summary",
				pattern: /^\/api\/checklist\/cost-summary\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/checklist/cost-summary/_server.ts.js'))
			},
			{
				id: "/api/circuit-health",
				pattern: /^\/api\/circuit-health\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/circuit-health/_server.ts.js'))
			},
			{
				id: "/api/compare",
				pattern: /^\/api\/compare\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/compare/_server.ts.js'))
			},
			{
				id: "/api/concept-config",
				pattern: /^\/api\/concept-config\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/concept-config/_server.ts.js'))
			},
			{
				id: "/api/concepts",
				pattern: /^\/api\/concepts\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/concepts/_server.ts.js'))
			},
			{
				id: "/api/copilot/business",
				pattern: /^\/api\/copilot\/business\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/copilot/business/_server.ts.js'))
			},
			{
				id: "/api/copilot/checklist",
				pattern: /^\/api\/copilot\/checklist\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/copilot/checklist/_server.ts.js'))
			},
			{
				id: "/api/copilot/location",
				pattern: /^\/api\/copilot\/location\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/copilot/location/_server.ts.js'))
			},
			{
				id: "/api/deals",
				pattern: /^\/api\/deals\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/deals/_server.ts.js'))
			},
			{
				id: "/api/deals/remove-location",
				pattern: /^\/api\/deals\/remove-location\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/deals/remove-location/_server.ts.js'))
			},
			{
				id: "/api/deals/save-location",
				pattern: /^\/api\/deals\/save-location\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/deals/save-location/_server.ts.js'))
			},
			{
				id: "/api/deals/update-location",
				pattern: /^\/api\/deals\/update-location\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/deals/update-location/_server.ts.js'))
			},
			{
				id: "/api/deals/[id]",
				pattern: /^\/api\/deals\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/deals/_id_/_server.ts.js'))
			},
			{
				id: "/api/deals/[id]/events",
				pattern: /^\/api\/deals\/([^/]+?)\/events\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/deals/_id_/events/_server.ts.js'))
			},
			{
				id: "/api/export-operations",
				pattern: /^\/api\/export-operations\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/export-operations/_server.ts.js'))
			},
			{
				id: "/api/export-plan",
				pattern: /^\/api\/export-plan\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/export-plan/_server.ts.js'))
			},
			{
				id: "/api/feedback",
				pattern: /^\/api\/feedback\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/feedback/_server.ts.js'))
			},
			{
				id: "/api/fit-iq/compute",
				pattern: /^\/api\/fit-iq\/compute\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/fit-iq/compute/_server.ts.js'))
			},
			{
				id: "/api/generate-brief",
				pattern: /^\/api\/generate-brief\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/generate-brief/_server.ts.js'))
			},
			{
				id: "/api/generate-operations",
				pattern: /^\/api\/generate-operations\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/generate-operations/_server.ts.js'))
			},
			{
				id: "/api/generate-playbook",
				pattern: /^\/api\/generate-playbook\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/generate-playbook/_server.ts.js'))
			},
			{
				id: "/api/generate-questions",
				pattern: /^\/api\/generate-questions\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/generate-questions/_server.ts.js'))
			},
			{
				id: "/api/geocode",
				pattern: /^\/api\/geocode\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/geocode/_server.ts.js'))
			},
			{
				id: "/api/geo",
				pattern: /^\/api\/geo\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/geo/_server.ts.js'))
			},
			{
				id: "/api/health",
				pattern: /^\/api\/health\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/health/_server.ts.js'))
			},
			{
				id: "/api/location-history",
				pattern: /^\/api\/location-history\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/location-history/_server.ts.js'))
			},
			{
				id: "/api/location-intel",
				pattern: /^\/api\/location-intel\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/location-intel/_server.ts.js'))
			},
			{
				id: "/api/location-iq",
				pattern: /^\/api\/location-iq\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/location-iq/_server.ts.js'))
			},
			{
				id: "/api/nearby-businesses",
				pattern: /^\/api\/nearby-businesses\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/nearby-businesses/_server.ts.js'))
			},
			{
				id: "/api/neighborhood-intelligence",
				pattern: /^\/api\/neighborhood-intelligence\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/neighborhood-intelligence/_server.ts.js'))
			},
			{
				id: "/api/notify",
				pattern: /^\/api\/notify\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/notify/_server.ts.js'))
			},
			{
				id: "/api/onboarding-chat",
				pattern: /^\/api\/onboarding-chat\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/onboarding-chat/_server.ts.js'))
			},
			{
				id: "/api/outcomes",
				pattern: /^\/api\/outcomes\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/outcomes/_server.ts.js'))
			},
			{
				id: "/api/outcomes/process-checkins",
				pattern: /^\/api\/outcomes\/process-checkins\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/outcomes/process-checkins/_server.ts.js'))
			},
			{
				id: "/api/probability/compute",
				pattern: /^\/api\/probability\/compute\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/probability/compute/_server.ts.js'))
			},
			{
				id: "/api/profile-sync",
				pattern: /^\/api\/profile-sync\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/profile-sync/_server.ts.js'))
			},
			{
				id: "/api/re-score",
				pattern: /^\/api\/re-score\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/re-score/_server.ts.js'))
			},
			{
				id: "/api/re2d2/check-harm",
				pattern: /^\/api\/re2d2\/check-harm\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/re2d2/check-harm/_server.ts.js'))
			},
			{
				id: "/api/re2d2/respond",
				pattern: /^\/api\/re2d2\/respond\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/re2d2/respond/_server.ts.js'))
			},
			{
				id: "/api/request-failures",
				pattern: /^\/api\/request-failures\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/request-failures/_server.ts.js'))
			},
			{
				id: "/api/score/preview",
				pattern: /^\/api\/score\/preview\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/score/preview/_server.ts.js'))
			},
			{
				id: "/api/session-intelligence",
				pattern: /^\/api\/session-intelligence\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/session-intelligence/_server.ts.js'))
			},
			{
				id: "/api/session-sync",
				pattern: /^\/api\/session-sync\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/session-sync/_server.ts.js'))
			},
			{
				id: "/api/session",
				pattern: /^\/api\/session\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/session/_server.ts.js'))
			},
			{
				id: "/api/shortlist/compare",
				pattern: /^\/api\/shortlist\/compare\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/shortlist/compare/_server.ts.js'))
			},
			{
				id: "/api/street-side-test",
				pattern: /^\/api\/street-side-test\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/street-side-test/_server.ts.js'))
			},
			{
				id: "/api/street-view-history",
				pattern: /^\/api\/street-view-history\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/street-view-history/_server.ts.js'))
			},
			{
				id: "/api/vacancies",
				pattern: /^\/api\/vacancies\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/vacancies/_server.ts.js'))
			},
			{
				id: "/api/validate-sources",
				pattern: /^\/api\/validate-sources\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/validate-sources/_server.ts.js'))
			},
			{
				id: "/api/vault",
				pattern: /^\/api\/vault\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/vault/_server.ts.js'))
			},
			{
				id: "/api/vault/upload",
				pattern: /^\/api\/vault\/upload\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/vault/upload/_server.ts.js'))
			},
			{
				id: "/app",
				pattern: /^\/app\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 7 },
				endpoint: null
			},
			{
				id: "/app/about",
				pattern: /^\/app\/about\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 8 },
				endpoint: null
			},
			{
				id: "/app/app",
				pattern: /^\/app\/app\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 9 },
				endpoint: null
			},
			{
				id: "/app/brain",
				pattern: /^\/app\/brain\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 10 },
				endpoint: null
			},
			{
				id: "/app/brain/compare",
				pattern: /^\/app\/brain\/compare\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 11 },
				endpoint: null
			},
			{
				id: "/app/brain/daypart",
				pattern: /^\/app\/brain\/daypart\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 12 },
				endpoint: null
			},
			{
				id: "/app/brain/segments",
				pattern: /^\/app\/brain\/segments\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 13 },
				endpoint: null
			},
			{
				id: "/app/brain/street",
				pattern: /^\/app\/brain\/street\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 14 },
				endpoint: null
			},
			{
				id: "/app/brain/success-map",
				pattern: /^\/app\/brain\/success-map\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 15 },
				endpoint: null
			},
			{
				id: "/app/brain/transparency",
				pattern: /^\/app\/brain\/transparency\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 16 },
				endpoint: null
			},
			{
				id: "/app/business-plan",
				pattern: /^\/app\/business-plan\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 17 },
				endpoint: null
			},
			{
				id: "/app/checklist",
				pattern: /^\/app\/checklist\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 18 },
				endpoint: null
			},
			{
				id: "/app/dashboard",
				pattern: /^\/app\/dashboard\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 19 },
				endpoint: null
			},
			{
				id: "/app/financials",
				pattern: /^\/app\/financials\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 20 },
				endpoint: null
			},
			{
				id: "/app/financials/docs",
				pattern: /^\/app\/financials\/docs\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 21 },
				endpoint: null
			},
			{
				id: "/app/financials/grants",
				pattern: /^\/app\/financials\/grants\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 22 },
				endpoint: null
			},
			{
				id: "/app/financials/sba",
				pattern: /^\/app\/financials\/sba\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 23 },
				endpoint: null
			},
			{
				id: "/app/kanban",
				pattern: /^\/app\/kanban\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 24 },
				endpoint: null
			},
			{
				id: "/app/launch-pack",
				pattern: /^\/app\/launch-pack\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 25 },
				endpoint: null
			},
			{
				id: "/app/loans",
				pattern: /^\/app\/loans\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 26 },
				endpoint: null
			},
			{
				id: "/app/locations",
				pattern: /^\/app\/locations\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 29 },
				endpoint: null
			},
			{
				id: "/app/location",
				pattern: /^\/app\/location\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 27 },
				endpoint: null
			},
			{
				id: "/app/location/report",
				pattern: /^\/app\/location\/report\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 28 },
				endpoint: null
			},
			{
				id: "/app/model",
				pattern: /^\/app\/model\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 30 },
				endpoint: null
			},
			{
				id: "/app/onboarding",
				pattern: /^\/app\/onboarding\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 31 },
				endpoint: null
			},
			{
				id: "/app/operations",
				pattern: /^\/app\/operations\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 32 },
				endpoint: null
			},
			{
				id: "/app/outcomes",
				pattern: /^\/app\/outcomes\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 33 },
				endpoint: null
			},
			{
				id: "/app/overview",
				pattern: /^\/app\/overview\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 34 },
				endpoint: null
			},
			{
				id: "/app/pipeline",
				pattern: /^\/app\/pipeline\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 35 },
				endpoint: null
			},
			{
				id: "/app/recommendations",
				pattern: /^\/app\/recommendations\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 36 },
				endpoint: null
			},
			{
				id: "/app/route",
				pattern: /^\/app\/route\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 37 },
				endpoint: null
			},
			{
				id: "/app/rwa",
				pattern: /^\/app\/rwa\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 38 },
				endpoint: null
			},
			{
				id: "/app/space",
				pattern: /^\/app\/space\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 39 },
				endpoint: null
			},
			{
				id: "/app/space/compare",
				pattern: /^\/app\/space\/compare\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 40 },
				endpoint: null
			},
			{
				id: "/app/vault",
				pattern: /^\/app\/vault\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 41 },
				endpoint: null
			},
			{
				id: "/app/vision",
				pattern: /^\/app\/vision\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 42 },
				endpoint: null
			},
			{
				id: "/app/vision/calibration",
				pattern: /^\/app\/vision\/calibration\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 43 },
				endpoint: null
			},
			{
				id: "/app/vision/concept",
				pattern: /^\/app\/vision\/concept\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 44 },
				endpoint: null
			},
			{
				id: "/app/vision/financial",
				pattern: /^\/app\/vision\/financial\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 45 },
				endpoint: null
			},
			{
				id: "/app/vision/founder",
				pattern: /^\/app\/vision\/founder\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 46 },
				endpoint: null
			},
			{
				id: "/app/vision/review",
				pattern: /^\/app\/vision\/review\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 47 },
				endpoint: null
			},
			{
				id: "/app/website",
				pattern: /^\/app\/website\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 48 },
				endpoint: null
			},
			{
				id: "/app/welcome-back",
				pattern: /^\/app\/welcome-back\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 49 },
				endpoint: null
			},
			{
				id: "/contact",
				pattern: /^\/contact\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 50 },
				endpoint: null
			},
			{
				id: "/demo",
				pattern: /^\/demo\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 51 },
				endpoint: null
			},
			{
				id: "/login",
				pattern: /^\/login\/?$/,
				params: [],
				page: { layouts: [0,3,], errors: [1,,], leaf: 52 },
				endpoint: null
			},
			{
				id: "/methodology",
				pattern: /^\/methodology\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 53 },
				endpoint: null
			},
			{
				id: "/pending",
				pattern: /^\/pending\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 54 },
				endpoint: null
			},
			{
				id: "/personal/health",
				pattern: /^\/personal\/health\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 55 },
				endpoint: null
			},
			{
				id: "/personal/social",
				pattern: /^\/personal\/social\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 56 },
				endpoint: null
			},
			{
				id: "/personal/suggestions",
				pattern: /^\/personal\/suggestions\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 57 },
				endpoint: null
			},
			{
				id: "/personal/upcoming",
				pattern: /^\/personal\/upcoming\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 58 },
				endpoint: null
			},
			{
				id: "/pricing",
				pattern: /^\/pricing\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 59 },
				endpoint: null
			},
			{
				id: "/privacy",
				pattern: /^\/privacy\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 60 },
				endpoint: null
			},
			{
				id: "/sign-in",
				pattern: /^\/sign-in\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 61 },
				endpoint: null
			},
			{
				id: "/terms",
				pattern: /^\/terms\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 62 },
				endpoint: null
			},
			{
				id: "/work/commentary",
				pattern: /^\/work\/commentary\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 63 },
				endpoint: null
			},
			{
				id: "/work/daily",
				pattern: /^\/work\/daily\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 64 },
				endpoint: null
			},
			{
				id: "/work/weekly",
				pattern: /^\/work\/weekly\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 65 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
