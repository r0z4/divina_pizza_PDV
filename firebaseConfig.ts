// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBo5pT38Jx41FUESPlxWTZAsdTyS_BTEwM",
  authDomain: "pizza-divina-pdv.firebaseapp.com",
  projectId: "pizza-divina-pdv",
  storageBucket: "pizza-divina-pdv.firebasestorage.app",
  messagingSenderId: "831771462448",
  appId: "1:831771462448:web:196319320c3ee041e296f5",
  measurementId: "G-WVQCVSMVTD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics (Conditional check to prevent errors in some environments)
let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

// Export Firestore database instance to be used in services
export const db = getFirestore(app);