import admin from "firebase-admin";
let customApp = null;
function getAdminAuth() {
  if (!customApp) {
    try {
      customApp = admin.app("redsq-backend");
    } catch (e) {
      customApp = admin.initializeApp({ projectId: "dev-redsq" }, "redsq-backend");
    }
  }
  return admin.auth(customApp);
}
function getAdminApp() {
  if (!customApp) {
    try {
      customApp = admin.app("redsq-backend");
    } catch (e) {
      customApp = admin.initializeApp({ projectId: "dev-redsq" }, "redsq-backend");
    }
  }
  return customApp;
}
export {
  getAdminApp as a,
  getAdminAuth as g
};
