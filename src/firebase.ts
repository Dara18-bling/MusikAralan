import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA7zgdC3TRBz4n-ugIal_oxonGV2nAZ6jo",
  authDomain: "capstone-54a53.firebaseapp.com",
  projectId: "capstone-54a53",
  storageBucket: "capstone-54a53.firebasestorage.app",
  messagingSenderId: "635181104049",
  appId: "1:635181104049:web:0ace4ad8f717b86686db90",
  measurementId: "G-DV00XZ605F"
};

export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
