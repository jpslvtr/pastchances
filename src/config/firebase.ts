import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Dynamically determine authDomain based on current hostname
const getAuthDomain = () => {
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === 'www.secondchances.app' || hostname === 'secondchances.app') {
            return hostname;
        }
        if (hostname === 'localhost' || hostname.includes('192.168.') || hostname.includes('10.0.0.')) {
            return 'secondchances.app';
        }
    }
    return 'secondchances.app';
};

const firebaseConfig = {
    apiKey: "AIzaSyDC_YL8wau3PKK1r2ZYYHc32TtnoXe5giQ",
    authDomain: getAuthDomain(),
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

// Set persistence to LOCAL to ensure auth state survives redirects
setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error('Error setting auth persistence:', error);
});

// Configure Google provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

auth.useDeviceLanguage();