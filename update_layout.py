import re

with open(r'C:\sandbox_re_squared\jared_prod\bkp_main_05272026\src\routes\+layout.svelte', 'r', encoding='utf-8') as f:
    content = f.read()

# Add Firebase import
content = content.replace("import { authedFetch } from '$lib/authed-fetch';", "import { authedFetch } from '$lib/authed-fetch';\n\timport { auth } from '$lib/firebase/client';")

# Remove Clerk init session keepalive block
content = re.sub(r'// ── Clerk Session Keepalive ──.*?onDestroy\(\(\) => \{.*?\n\t\}\);', '', content, flags=re.DOTALL)

# Remove call to initClerkSession
content = content.replace('\t\t// Start Clerk session keepalive for authenticated pages\n\t\tinitClerkSession();\n', '')

# Replace doSignOut
old_signout = '''	async function doSignOut() {
		try {
			if (window.Clerk) {
				await window.Clerk.signOut();
				window.location.href = '/login';
			}
		} catch (err) {
			console.error('Sign out error:', err);
			window.location.href = '/login';
		}
	}'''

new_signout = '''	async function doSignOut() {
		try {
			await auth.signOut();
			await fetch('/api/session', { method: 'DELETE' });
			window.location.href = '/login';
		} catch (err) {
			console.error('Sign out error:', err);
			window.location.href = '/login';
		}
	}'''

content = content.replace(old_signout, new_signout)

with open(r'C:\sandbox_re_squared\jared_prod\bkp_main_05272026\src\routes\+layout.svelte', 'w', encoding='utf-8') as f:
    f.write(content)
