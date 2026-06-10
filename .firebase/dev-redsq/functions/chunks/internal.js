import { r as root } from "./root.js";
import "./environment.js";
import "./private.js";
let read_implementation = null;
function set_read_implementation(fn) {
  read_implementation = fn;
}
function set_manifest(_) {
}
const options = {
  app_template_contains_nonce: false,
  async: false,
  csp: { "mode": "auto", "directives": { "upgrade-insecure-requests": false, "block-all-mixed-content": false }, "reportOnly": { "upgrade-insecure-requests": false, "block-all-mixed-content": false } },
  csrf_check_origin: true,
  csrf_trusted_origins: [],
  embedded: false,
  env_public_prefix: "PUBLIC_",
  env_private_prefix: "",
  hash_routing: false,
  hooks: null,
  // added lazily, via `get_hooks`
  preload_strategy: "modulepreload",
  root,
  service_worker: false,
  service_worker_options: void 0,
  server_error_boundaries: false,
  templates: {
    app: ({ head, body, assets, nonce, env }) => '<!doctype html>\r\n<html lang="en">\r\n	<!-- DOMAIN: Update og:url, og:image, twitter:image, canonical when domain changes. See SITE_CONFIG in src/lib/modules.ts -->\r\n	<head>\r\n		<meta charset="utf-8" />\r\n		<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />\r\n		<meta name="theme-color" content="#1e3a2a" />\r\n		<meta name="description" content="RE² — Location intelligence for small business founders. Get your RE² Score across 19 data sources, model finances, and find your perfect spot before you sign." />\r\n		<meta name="robots" content="noarchive, noimageindex" />\r\n		<meta name="author" content="RE² — Real Estate Einstein" />\r\n		<meta property="og:type" content="website" />\r\n		<meta property="og:site_name" content="RE² — Real Estate Einstein" />\r\n		<meta property="og:title" content="RE² — Know Before You Sign" />\r\n		<meta property="og:description" content="Location intelligence for small business founders. Get your RE² Score, model finances, and find your perfect spot." />\r\n		<meta property="og:url" content="https://resquared.io" />\r\n		<meta property="og:image" content="https://resquared.io/icon-512.png" />\r\n		<meta name="twitter:card" content="summary" />\r\n		<meta name="twitter:title" content="RE² — Know Before You Sign" />\r\n		<meta name="twitter:description" content="Location intelligence for small business founders. Get your RE² Score, model finances, and find your perfect spot." />\r\n		<meta name="twitter:image" content="https://resquared.io/icon-512.png" />\r\n		<link rel="canonical" href="https://resquared.io" />\r\n		<link rel="icon" href="' + assets + '/favicon.png" />\r\n		<link rel="apple-touch-icon" href="' + assets + '/icon-192.png" />\r\n		<meta name="apple-mobile-web-app-capable" content="yes" />\r\n		<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />\r\n		<meta name="apple-mobile-web-app-title" content="RE²" />\r\n		<meta name="mobile-web-app-capable" content="yes" />\r\n		' + head + "\r\n	<script>\r\n		// Global error handler: catch unhandled runtime errors and display a visible banner\r\n		function showErrorBanner(message) {\r\n			if (typeof window === 'undefined' || location.hostname === 'localhost') return;\r\n\r\n			let banner = document.getElementById('re2-error-banner');\r\n			if (!banner) {\r\n				banner = document.createElement('div');\r\n				banner.id = 're2-error-banner';\r\n				banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#dc2626;color:white;padding:12px 16px;font-size:14px;z-index:99999;box-shadow:0 2px 8px rgba(0,0,0,0.2);cursor:pointer;font-family:system-ui,sans-serif';\r\n				document.body.appendChild(banner);\r\n			}\r\n			banner.textContent = message;\r\n			banner.style.display = 'block';\r\n\r\n			const timeout = setTimeout(() => { banner.style.display = 'none'; }, 10000);\r\n			banner.onclick = () => { clearTimeout(timeout); banner.style.display = 'none'; };\r\n		}\r\n\r\n		window.onerror = (msg, url, line, col, error) => {\r\n			const errorName = error?.name || 'Error';\r\n			const errorMsg = error?.message || msg;\r\n			const fullMsg = `${errorName}: ${errorMsg}`;\r\n			console.error('Unhandled error:', error || msg, `at ${url}:${line}:${col}`);\r\n			showErrorBanner(fullMsg);\r\n			return false;\r\n		};\r\n\r\n		window.onunhandledrejection = (event) => {\r\n			const reason = event.reason;\r\n			const errorMsg = reason?.message || String(reason);\r\n			const fullMsg = `Unhandled Promise rejection: ${errorMsg}`;\r\n			console.error('Unhandled rejection:', reason);\r\n			showErrorBanner(fullMsg);\r\n			event.preventDefault();\r\n		};\r\n	<\/script>\r\n	</head>\r\n	<body data-sveltekit-preload-data=\"hover\">\r\n		<div style=\"display: contents\">" + body + "</div>\r\n	</body>\r\n</html>\r\n",
    error: ({ status, message }) => '<!doctype html>\n<html lang="en">\n	<head>\n		<meta charset="utf-8" />\n		<title>' + message + `</title>

		<style>
			body {
				--bg: white;
				--fg: #222;
				--divider: #ccc;
				background: var(--bg);
				color: var(--fg);
				font-family:
					system-ui,
					-apple-system,
					BlinkMacSystemFont,
					'Segoe UI',
					Roboto,
					Oxygen,
					Ubuntu,
					Cantarell,
					'Open Sans',
					'Helvetica Neue',
					sans-serif;
				display: flex;
				align-items: center;
				justify-content: center;
				height: 100vh;
				margin: 0;
			}

			.error {
				display: flex;
				align-items: center;
				max-width: 32rem;
				margin: 0 1rem;
			}

			.status {
				font-weight: 200;
				font-size: 3rem;
				line-height: 1;
				position: relative;
				top: -0.05rem;
			}

			.message {
				border-left: 1px solid var(--divider);
				padding: 0 0 0 1rem;
				margin: 0 0 0 1rem;
				min-height: 2.5rem;
				display: flex;
				align-items: center;
			}

			.message h1 {
				font-weight: 400;
				font-size: 1em;
				margin: 0;
			}

			@media (prefers-color-scheme: dark) {
				body {
					--bg: #222;
					--fg: #ddd;
					--divider: #666;
				}
			}
		</style>
	</head>
	<body>
		<div class="error">
			<span class="status">` + status + '</span>\n			<div class="message">\n				<h1>' + message + "</h1>\n			</div>\n		</div>\n	</body>\n</html>\n"
  },
  version_hash: "q73uqf"
};
async function get_hooks() {
  let handle;
  let handleFetch;
  let handleError;
  let handleValidationError;
  let init;
  ({ handle, handleFetch, handleError, handleValidationError, init } = await import("../entries/hooks.server.js"));
  let reroute;
  let transport;
  return {
    handle,
    handleFetch,
    handleError,
    handleValidationError,
    init,
    reroute,
    transport
  };
}
export {
  set_manifest as a,
  get_hooks as g,
  options as o,
  read_implementation as r,
  set_read_implementation as s
};
