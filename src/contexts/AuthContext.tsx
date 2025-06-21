import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '../config/firebase';
import { GSB_CLASS_NAMES } from '../data/names';

interface MatchInfo {
    name: string;
    email: string;
}

interface UserData {
    uid: string;
    email: string;
    name: string;  // Single name field instead of displayName/verifiedName
    photoURL: string;
    crushes: string[];
    lockedCrushes: string[];
    matches: MatchInfo[];
    crushCount: number;
    createdAt: any;
    updatedAt: any;
    lastLogin: any;
}

interface AuthContextType {
    user: User | null;
    userData: UserData | null;
    loading: boolean;
    nameOptions: string[] | null; // For cases where multiple matches are found
    signInWithGoogle: () => Promise<void>;
    selectName: (selectedName: string) => Promise<void>;
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

// Helper function to normalize names for comparison
function normalizeName(name: string): string {
    if (!name || typeof name !== 'string') return '';

    return name
        .normalize('NFD')  // Decompose accented characters
        .replace(/[\u0300-\u036f]/g, '')  // Remove accent marks
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, ' ')  // Replace non-alphanumeric with spaces
        .replace(/\s+/g, ' ')  // Normalize spaces
        .trim();
}

// Helper function to find potential name matches
function findNameMatches(displayName: string, availableNames: string[]): { exactMatch?: string; potentialMatches: string[] } {
    const normalizedInput = normalizeName(displayName);

    // Try exact match first
    const exactMatch = availableNames.find(name =>
        normalizeName(name) === normalizedInput
    );

    if (exactMatch) {
        return { exactMatch, potentialMatches: [] };
    }

    // If no exact match, look for potential matches
    const inputParts = normalizedInput.split(' ').filter(Boolean);
    if (inputParts.length < 2) {
        return { potentialMatches: [] };
    }

    const inputFirst = inputParts[0];
    const inputLast = inputParts[inputParts.length - 1];

    const potentialMatches = availableNames.filter(name => {
        const normalizedName = normalizeName(name);
        const nameParts = normalizedName.split(' ').filter(Boolean);

        if (nameParts.length < 2) return false;

        const nameFirst = nameParts[0];
        const nameLast = nameParts[nameParts.length - 1];

        // Match if first and last names match
        return nameFirst === inputFirst && nameLast === inputLast;
    });

    return { potentialMatches };
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [nameOptions, setNameOptions] = useState<string[] | null>(null);

    const normalizeMatches = (matches: any[]): MatchInfo[] => {
        if (!matches || !Array.isArray(matches)) return [];

        return matches.map(match => {
            if (typeof match === 'string') {
                return {
                    name: match,
                    email: match.toLowerCase().replace(/\s+/g, '.') + '@stanford.edu'
                };
            } else if (match && typeof match === 'object' && match.name && match.email) {
                return {
                    name: match.name,
                    email: match.email
                };
            } else {
                return {
                    name: 'Unknown',
                    email: 'unknown@stanford.edu'
                };
            }
        });
    };

    const refreshUserData = async () => {
        if (!user?.uid) {
            console.warn('refreshUserData called without user');
            return;
        }

        try {
            const userRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
                const data = userDoc.data();
                const userData: UserData = {
                    uid: data.uid,
                    email: data.email,
                    name: data.name || data.verifiedName || data.displayName || '', // Migration support
                    photoURL: data.photoURL,
                    crushes: data.crushes || [],
                    lockedCrushes: data.lockedCrushes || [],
                    matches: normalizeMatches(data.matches),
                    crushCount: data.crushCount || 0,
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt,
                    lastLogin: data.lastLogin
                };
                setUserData(userData);
            } else {
                console.error('User document does not exist after creation');
                setUserData(null);
            }
        } catch (error) {
            console.error('Error refreshing user data:', error);
            setUserData(null);
        }
    };

    const selectName = async (selectedName: string) => {
        if (!user?.uid || !nameOptions) return;

        try {
            const userRef = doc(db, 'users', user.uid);
            await setDoc(userRef, {
                name: selectedName,
                updatedAt: serverTimestamp()
            }, { merge: true });

            setNameOptions(null);
            await refreshUserData();
        } catch (error) {
            console.error('Error selecting name:', error);
            throw error;
        }
    };

    const createOrUpdateUserDocument = async (user: User) => {
        if (!user.uid) return null;

        const userRef = doc(db, 'users', user.uid);

        try {
            const userDoc = await getDoc(userRef);

            if (!userDoc.exists()) {
                // New user - try to match their displayName to class roster
                const displayName = user.displayName || user.email?.split('@')[0] || '';
                const { exactMatch, potentialMatches } = findNameMatches(displayName, GSB_CLASS_NAMES);

                if (exactMatch) {
                    // Perfect match - create user with this name
                    const newUserData: UserData = {
                        uid: user.uid,
                        email: user.email || '',
                        name: exactMatch,
                        photoURL: user.photoURL || DEFAULT_PROFILE_URL,
                        crushes: [],
                        lockedCrushes: [],
                        matches: [],
                        crushCount: 0,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                        lastLogin: serverTimestamp()
                    };

                    await setDoc(userRef, newUserData);
                    setUserData(newUserData);
                    return newUserData;
                } else if (potentialMatches.length > 0) {
                    // Multiple potential matches - user needs to choose
                    setNameOptions(potentialMatches);

                    // Create incomplete user document
                    const incompleteUserData: UserData = {
                        uid: user.uid,
                        email: user.email || '',
                        name: '', // Will be set when user selects
                        photoURL: user.photoURL || DEFAULT_PROFILE_URL,
                        crushes: [],
                        lockedCrushes: [],
                        matches: [],
                        crushCount: 0,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                        lastLogin: serverTimestamp()
                    };

                    await setDoc(userRef, incompleteUserData);
                    setUserData(incompleteUserData);
                    return incompleteUserData;
                } else {
                    // No matches found
                    await signOut(auth);
                    alert(`Your name "${displayName}" was not found in the GSB Class of 2025 roster. Please contact the administrator if you believe this is an error.`);
                    return null;
                }
            } else {
                // Existing user - update login time and migrate if needed
                const existingData = userDoc.data();
                const updatedData: UserData = {
                    uid: existingData.uid,
                    email: existingData.email,
                    name: existingData.name || existingData.verifiedName || existingData.displayName || '', // Migration
                    photoURL: user.photoURL || existingData.photoURL || DEFAULT_PROFILE_URL,
                    crushes: existingData.crushes || [],
                    lockedCrushes: existingData.lockedCrushes || [],
                    matches: normalizeMatches(existingData.matches),
                    crushCount: existingData.crushCount || 0,
                    createdAt: existingData.createdAt,
                    updatedAt: serverTimestamp(),
                    lastLogin: serverTimestamp()
                };

                await setDoc(userRef, updatedData, { merge: true });
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
            if (user) {
                if (!user.email?.endsWith('@stanford.edu')) {
                    await signOut(auth);
                    setUser(null);
                    setUserData(null);
                    setLoading(false);
                    alert('Only @stanford.edu email addresses are allowed. Please sign in with your Stanford account.');
                } else {
                    setUser(user);
                    await createOrUpdateUserDocument(user);
                    setLoading(false);
                }
            } else {
                setUser(null);
                setUserData(null);
                setNameOptions(null);
                setLoading(false);
            }
        });

        return unsubscribe;
    }, []);

    const signInWithGoogle = async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);

            if (!result.user.email?.endsWith('@stanford.edu')) {
                await signOut(auth);
                throw new Error('Only @stanford.edu email addresses are allowed');
            }
        } catch (error: any) {
            console.error('Login error:', error);

            if (error.code === 'auth/popup-closed-by-user') {
                console.log('Sign-in popup was closed by user');
            } else if (error.code === 'auth/cancelled-popup-request') {
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
            setNameOptions(null);
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const value = {
        user,
        userData,
        loading,
        nameOptions,
        signInWithGoogle,
        selectName,
        logout,
        refreshUserData
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};