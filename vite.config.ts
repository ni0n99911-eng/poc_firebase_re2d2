import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			manifest: {
				name: 'RE² — Location Intelligence',
				short_name: 'RE²',
				description: 'Location intelligence for small business founders. Score any NYC address before you sign.',
				theme_color: '#1e3a2a',
				background_color: '#f5f0e8',
				display: 'standalone',
				orientation: 'portrait',
				start_url: '/app/welcome-back',
				scope: '/',
				categories: ['business', 'productivity'],
				icons: [
					{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
					{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
					{ src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
				]
			},
			workbox: {
				globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'],
				// Keep navigateFallback null — auth pages need server-side Clerk checks,
				// auto-fallback would intercept redirects. offline.html is precached below
				// and accessible at /offline.html when the user is offline.
				navigateFallback: null,
				// Precache the offline page so it's available without a network request
				additionalManifestEntries: [
					{ url: '/offline.html', revision: null }
				],
				offlineGoogleAnalytics: false,
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'supabase-api',
							expiration: { maxEntries: 50, maxAgeSeconds: 300 }
						}
					},
					// Never cache Anthropic/AI responses
					{
						urlPattern: /^https:\/\/api\.anthropic\.com\/.*/i,
						handler: 'NetworkOnly'
					},
					// Cache static app page shells for faster subsequent loads
					{
						urlPattern: /\/app\/.*/,
						handler: 'NetworkFirst',
						options: {
							cacheName: 're2-pages',
							expiration: { maxEntries: 20, maxAgeSeconds: 3600 },
							networkTimeoutSeconds: 5
						}
					}
				]
			}
		})
	]
});
