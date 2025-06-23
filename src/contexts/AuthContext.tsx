import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { auth, googleProvider, db } from '../config/firebase';
import { useAuthHelpers } from '../hooks/useAuthHelpers';
import { useUserDocumentManager } from '../hooks/useUserDocumentManager';
import type { UserData, UserClass } from '../types/userTypes';

interface AuthContextType {
    user: User | null;
    userData: UserData | null;
    loading: boolean;
    nameOptions: string[] | null;
    signInWithGoogle: (userClass: UserClass) => Promise<void>;
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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [nameOptions, setNameOptions] = useState<string[] | null>(null);
    const [pendingUserClass, setPendingUserClass] = useState<UserClass | null>(null);

    const {
        normalizeMatches,
        getUserDocumentId,
        getLastUsedClass,
        setLastUsedClass
    } = useAuthHelpers();

    const { createOrUpdateUserDocument } = useUserDocumentManager(
        setNameOptions,
        setPendingUserClass,
        setLastUsedClass
    );

    const selectName = async (selectedName: string) => {
        if (!user?.uid || !nameOptions || !pendingUserClass) return;

        try {
            const actualUid = getUserDocumentId(user, pendingUserClass);
            const userRef = doc(db, 'users', actualUid);

            await setDoc(userRef, {
                name: selectedName,
                userClass: pendingUserClass,
                updatedAt: serverTimestamp()
            }, { merge: true });

            // Remember which class was selected
            setLastUsedClass(pendingUserClass);

            setNameOptions(null);
            setPendingUserClass(null);
            // Real-time listener will handle the update
        } catch (error) {
            console.error('Error selecting name:', error);
            throw error;
        }
    };

    // Set up real-time listener for user data
    useEffect(() => {
        if (!user?.uid) return;

        let unsubscribe: (() => void) | null = null;

        const setupListener = async () => {
            try {
                // For test user, check both documents and prefer based on last used class
                if (user.email === 'jpark22@stanford.edu') {
                    const gsbDocId = `${user.uid}_gsb`;
                    const undergradDocId = `${user.uid}_undergrad`;

                    const gsbRef = doc(db, 'users', gsbDocId);
                    const undergradRef = doc(db, 'users', undergradDocId);

                    const [gsbDoc, undergradDoc] = await Promise.all([
                        getDoc(gsbRef),
                        getDoc(undergradRef)
                    ]);

                    let targetDocId = gsbDocId;
                    let detectedClass: UserClass = 'gsb';

                    // Get the last used class from localStorage
                    const lastUsedClass = getLastUsedClass();

                    // Prefer the last used class if both documents exist and have names
                    if (lastUsedClass === 'undergrad' && undergradDoc.exists() && undergradDoc.data().name) {
                        targetDocId = undergradDocId;
                        detectedClass = 'undergrad';
                    } else if (lastUsedClass === 'gsb' && gsbDoc.exists() && gsbDoc.data().name) {
                        targetDocId = gsbDocId;
                        detectedClass = 'gsb';
                    } else if (gsbDoc.exists() && gsbDoc.data().name) {
                        // Fallback to GSB if no preference or preference doesn't exist
                        targetDocId = gsbDocId;
                        detectedClass = 'gsb';
                    } else if (undergradDoc.exists() && undergradDoc.data().name) {
                        targetDocId = undergradDocId;
                        detectedClass = 'undergrad';
                    } else if (gsbDoc.exists()) {
                        // Fall back to GSB if neither has a name
                        targetDocId = gsbDocId;
                        detectedClass = 'gsb';
                    } else if (undergradDoc.exists()) {
                        targetDocId = undergradDocId;
                        detectedClass = 'undergrad';
                    }

                    // Set up real-time listener for the target document
                    const targetRef = doc(db, 'users', targetDocId);
                    unsubscribe = onSnapshot(targetRef, (doc) => {
                        if (doc.exists()) {
                            const data = doc.data();
                            const userData: UserData = {
                                uid: data.uid,
                                email: data.email,
                                name: data.name || data.verifiedName || data.displayName || '',
                                photoURL: data.photoURL,
                                crushes: data.crushes || [],
                                lockedCrushes: data.lockedCrushes || [],
                                matches: normalizeMatches(data.matches),
                                crushCount: data.crushCount || 0,
                                userClass: data.userClass || detectedClass,
                                createdAt: data.createdAt,
                                updatedAt: data.updatedAt,
                                lastLogin: data.lastLogin
                            };
                            setUserData(userData);

                            // Update localStorage with the class we're actually using
                            setLastUsedClass(detectedClass);
                        } else {
                            setUserData(null);
                        }
                    }, (error) => {
                        console.error('Error in real-time user data listener:', error);
                        setUserData(null);
                    });

                } else {
                    // Regular user logic - set up real-time listener
                    const userRef = doc(db, 'users', user.uid);
                    unsubscribe = onSnapshot(userRef, (doc) => {
                        if (doc.exists()) {
                            const data = doc.data();
                            const userData: UserData = {
                                uid: data.uid,
                                email: data.email,
                                name: data.name || data.verifiedName || data.displayName || '',
                                photoURL: data.photoURL,
                                crushes: data.crushes || [],
                                lockedCrushes: data.lockedCrushes || [],
                                matches: normalizeMatches(data.matches),
                                crushCount: data.crushCount || 0,
                                userClass: data.userClass || 'gsb',
                                createdAt: data.createdAt,
                                updatedAt: data.updatedAt,
                                lastLogin: data.lastLogin
                            };
                            setUserData(userData);
                        } else {
                            setUserData(null);
                        }
                    }, (error) => {
                        console.error('Error in real-time user data listener:', error);
                        setUserData(null);
                    });
                }
            } catch (error) {
                console.error('Error setting up real-time listener:', error);
                setUserData(null);
            }
        };

        setupListener();

        // Cleanup function
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [user?.uid, user?.email, normalizeMatches, getLastUsedClass, setLastUsedClass]);

    const refreshUserData = async () => {
        // With real-time listeners, manual refresh is not needed
        // The listener will automatically update when data changes
        console.log('Real-time listener active - manual refresh not needed');
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
                    setLoading(false);
                    // Real-time listener will be set up in the useEffect above
                }
            } else {
                setUser(null);
                setUserData(null);
                setNameOptions(null);
                setPendingUserClass(null);
                setLoading(false);
            }
        });

        return unsubscribe;
    }, []);

    const signInWithGoogle = async (userClass: UserClass) => {
        try {
            const result = await signInWithPopup(auth, googleProvider);

            if (!result.user.email?.endsWith('@stanford.edu')) {
                await signOut(auth);
                throw new Error('Only @stanford.edu email addresses are allowed');
            }

            // Create or update user document with the selected class
            await createOrUpdateUserDocument(result.user, userClass);
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
            setPendingUserClass(null);
            // Clear the last used class on logout
            try {
                localStorage.removeItem('lastUsedClass');
            } catch {
                // Ignore localStorage errors
            }
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