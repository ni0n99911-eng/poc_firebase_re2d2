import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCHODJnhEuuV-DHBH3wr7eoc8YsO3KXxdo",
  authDomain: "dev-redsq.firebaseapp.com",
  projectId: "dev-redsq",
  storageBucket: "dev-redsq.firebasestorage.app",
  messagingSenderId: "1082427457375",
  appId: "1:1082427457375:web:7d823d35ec41c0f3a100ea",
  measurementId: "G-TQKZ97T7PG"
};

// Initialize Firebase only if it hasn't been initialized yet
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
