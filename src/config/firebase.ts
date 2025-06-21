import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
    apiKey: "AIzaSyDC_YL8wau3PKK1r2ZYYHc32TtnoXe5giQ",
    authDomain: "stanford-lastchances.firebaseapp.com",
    projectId: "stanford-lastchances",
    storageBucket: "stanford-lastchances.firebasestorage.app",
    messagingSenderId: "792276801448",
    appId: "1:792276801448:web:84a43cc96308673321ef9d",
    measurementId: "G-HLD1E4T34S"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);

// Configure Google provider to only allow stanford.edu emails
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
    hd: 'stanford.edu' // This restricts to stanford.edu domain
});

// Additional configuration for cross-domain compatibility
auth.useDeviceLanguage();