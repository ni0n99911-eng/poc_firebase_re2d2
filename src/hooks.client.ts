// Sentry disabled — was causing client-side hydration failure.
// The @sentry/sveltekit import has side effects that interfere with
// Svelte 5's hydration process. Re-enable once Sentry SDK is updated.
//
// import * as Sentry from '@sentry/sveltekit';
// const dsn = import.meta.env.VITE_SENTRY_DSN;
// if (dsn) { Sentry.init({ dsn, ... }); }
// export const handleError = Sentry.handleErrorWithSentry();
