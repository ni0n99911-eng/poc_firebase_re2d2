// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Locals {
			user?: {
				id: string;
				name: string;
				initials: string;
				role: 'owner' | 'member' | 'pending';
				modules: string[];
				plan?: 'free' | 'pro';
			};
		}
		interface Error {
			message: string;
		}
		interface PageData {
			user?: {
				id: string;
				name: string;
				initials: string;
				role: 'owner' | 'member' | 'pending';
				modules: string[];
				plan?: 'free' | 'pro';
			};
			clerkPublishableKey?: string;
		}
	}

	interface Window {
		Clerk?: {
			load: (config: { publishableKey: string }) => Promise<void>;
			signOut: () => Promise<void>;
			SignIn: {
				mount: (element: HTMLElement, config?: { routing?: string; signUpUrl?: string; afterSignInUrl?: string }) => void;
			};
			mountSignIn: (element: HTMLElement, config?: any) => void;
			addListener: (callback: (resources: any) => void) => void;
			user?: {
				id: string;
				[key: string]: any;
			};
			session?: {
				getToken: (options?: { skipCache?: boolean }) => Promise<string>;
			};
		};
	}
}

export {};
