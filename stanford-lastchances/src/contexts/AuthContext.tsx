import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '../config/firebase';

interface UserData {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string;
    verifiedName: string; // The actual GSB student name they selected
    crushes: string[]; // Made required, will always be initialized as empty array
    submitted: boolean; // Whether they've submitted their final list
    matches: string[]; // Array of matched names
    createdAt: any;
    updatedAt: any;
    lastLogin: any;
}

interface AuthContextType {
    user: User | null;
    userData: UserData | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

const DEFAULT_PROFILE_URL = '/files/default-profile.png';

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);

    // Function to refresh user data from Firestore
    const refreshUserData = async () => {
        if (!user?.uid) return;

        try {
            const userRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
                const data = userDoc.data();
                // Ensure crushes and matches are always arrays
                const userData: UserData = {
                    uid: data.uid,
                    email: data.email,
                    displayName: data.displayName,
                    photoURL: data.photoURL,
                    verifiedName: data.verifiedName || '', // Empty string if not verified yet
                    crushes: data.crushes || [], // Fallback to empty array
                    submitted: data.submitted || false, // Default to false if not set
                    matches: data.matches || [], // Fallback to empty array
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt,
                    lastLogin: data.lastLogin
                };
                setUserData(userData);
            }
        } catch (error) {
            console.error('Error refreshing user data:', error);
        }
    };

    // Function to create or update user document
    const createOrUpdateUserDocument = async (user: User) => {
        if (!user.uid) return null;

        const userRef = doc(db, 'users', user.uid);

        try {
            // Check if user document already exists
            const userDoc = await getDoc(userRef);

            if (!userDoc.exists()) {
                // Create new user document
                const newUserData: UserData = {
                    uid: user.uid,
                    email: user.email || '',
                    displayName: user.displayName || user.email?.split('@')[0] || '',
                    photoURL: user.photoURL || DEFAULT_PROFILE_URL,
                    verifiedName: '', // Empty until they verify their name
                    crushes: [], // Always initialize as empty array
                    submitted: false, // Default to false for new users
                    matches: [], // Initialize as empty array
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    lastLogin: serverTimestamp()
                };

                await setDoc(userRef, newUserData);
                console.log('New user document created:', user.email);
                setUserData(newUserData);
                return newUserData;
            } else {
                // Update existing user's last login
                const existingData = userDoc.data();
                const updatedData: UserData = {
                    uid: existingData.uid,
                    email: existingData.email,
                    displayName: user.displayName || existingData.displayName,
                    photoURL: user.photoURL || existingData.photoURL || DEFAULT_PROFILE_URL,
                    verifiedName: existingData.verifiedName || '', // Preserve existing verification
                    crushes: existingData.crushes || [], // Ensure crushes is always an array
                    submitted: existingData.submitted || false, // Preserve submission status
                    matches: existingData.matches || [], // Ensure matches is always an array
                    createdAt: existingData.createdAt,
                    updatedAt: serverTimestamp(),
                    lastLogin: serverTimestamp()
                };

                await setDoc(userRef, updatedData, { merge: true });
                console.log('User document updated:', user.email);
                setUserData(updatedData);
                return updatedData;
            }
        } catch (error) {
            console.error('Error creating/updating user document:', error);
            return null;
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            console.log('Auth state changed:', user?.email);

            if (user) {
                // Verify user has stanford.edu email
                if (!user.email?.endsWith('@stanford.edu')) {
                    console.log('Invalid email domain:', user.email);
                    await signOut(auth);
                    setUser(null);
                    setUserData(null);
                    alert('Only @stanford.edu email addresses are allowed. Please sign in with your Stanford account.');
                } else {
                    setUser(user);
                    // Create or update user document in Firestore
                    await createOrUpdateUserDocument(user);
                }
            } else {
                setUser(null);
                setUserData(null);
            }

            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const signInWithGoogle = async () => {
        try {
            console.log('Attempting Google sign-in...');
            const result = await signInWithPopup(auth, googleProvider);
            console.log('Sign-in successful:', result.user.email);

            if (!result.user.email?.endsWith('@stanford.edu')) {
                await signOut(auth);
                throw new Error('Only @stanford.edu email addresses are allowed');
            }

            // The user document will be created/updated in the onAuthStateChanged listener

        } catch (error: any) {
            console.error('Login error:', error);

            // Handle specific Firebase errors
            if (error.code === 'auth/configuration-not-found') {
                alert('Authentication is not properly configured. Please contact the administrator.');
            } else if (error.code === 'auth/popup-closed-by-user') {
                // User closed the popup, don't show error
                console.log('Sign-in popup was closed by user');
            } else if (error.code === 'auth/cancelled-popup-request') {
                // Another popup is already open
                console.log('Another sign-in popup is already open');
            } else {
                alert('Login failed. Please make sure you\'re using a @stanford.edu email address.');
            }
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
            setUserData(null);
            console.log('User signed out successfully');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const value = {
        user,
        userData,
        loading,
        signInWithGoogle,
        logout,
        refreshUserData
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};