import admin from 'firebase-admin';

let customApp: admin.app.App | null = null;

export function getAdminAuth() {
  if (!customApp) {
    try {
      customApp = admin.app('redsq-backend');
    } catch (e) {
      customApp = admin.initializeApp({ projectId: "dev-redsq" }, 'redsq-backend');
    }
  }
  return admin.auth(customApp);
}

export function getAdminApp() {
  if (!customApp) {
    try {
      customApp = admin.app('redsq-backend');
    } catch (e) {
      customApp = admin.initializeApp({ projectId: "dev-redsq" }, 'redsq-backend');
    }
  }
  return customApp;
}
