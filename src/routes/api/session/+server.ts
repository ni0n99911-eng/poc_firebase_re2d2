import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAdminAuth } from '$lib/firebase/server';

const SESSION_COOKIE_NAME = '__session';

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const { idToken } = await request.json();
    
    // Verify the ID token first
    await getAdminAuth().verifyIdToken(idToken);

    // Create a session cookie valid for 5 days
    const expiresIn = 60 * 60 * 24 * 5 * 1000; 
    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, { expiresIn });
    
    // Set cookie
    cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax'
    });

    return json({ status: 'success' });
  } catch (error: any) {
    console.error('Session creation failed:', error);
    return json({ error: 'Unauthorized request: ' + (error.message || 'Unknown error') }, { status: 401 });
  }
};

export const DELETE: RequestHandler = async ({ cookies }) => {
  cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
  return json({ status: 'success' });
};
