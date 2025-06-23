import { useCallback } from 'react';
import type { User } from 'firebase/auth';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { GSB_CLASS_NAMES } from '../data/names';
import { UNDERGRAD_CLASS_NAMES } from '../data/names-undergrad';
import { useAuthHelpers } from './useAuthHelpers';
import type { UserData, UserClass } from '../types/userTypes';

// Helper function to normalize names for comparison
function normalizeName(name: string): string {
    if (!name || typeof name !== 'string') return '';

    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
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

        return nameFirst === inputFirst && nameLast === inputLast;
    });

    return { potentialMatches };
}

export const useUserDocumentManager = (
    setNameOptions: (options: string[] | null) => void,
    setPendingUserClass: (userClass: UserClass | null) => void,
    setLastUsedClass: (userClass: UserClass) => void
) => {
    const { getUserDocumentId, normalizeMatches, DEFAULT_PROFILE_URL } = useAuthHelpers();

    const createOrUpdateUserDocument = useCallback(async (user: User, userClass: UserClass) => {
        if (!user.uid) return null;

        // Remember which class was selected for login
        setLastUsedClass(userClass);

        try {
            // Special handling for test user (you) - always use class-specific UIDs
            if (user.email === 'jpark22@stanford.edu') {
                const actualUid = getUserDocumentId(user, userClass);
                const userRef = doc(db, 'users', actualUid);
                const userDoc = await getDoc(userRef);

                if (!userDoc.exists()) {
                    // Create completely new user document for this class
                    const classNames = userClass === 'gsb' ? GSB_CLASS_NAMES : UNDERGRAD_CLASS_NAMES;
                    const displayName = user.displayName || user.email?.split('@')[0] || '';

                    const { exactMatch, potentialMatches } = findNameMatches(displayName, classNames);

                    if (exactMatch) {
                        console.log(`Creating fresh ${userClass} account with name: ${exactMatch}`);
                        const newUserData: UserData = {
                            uid: actualUid,
                            email: user.email || '',
                            name: exactMatch,
                            photoURL: user.photoURL || DEFAULT_PROFILE_URL,
                            crushes: [], // Start fresh - no crushes
                            lockedCrushes: [], // Start fresh - no locked crushes
                            matches: [], // Start fresh - no matches
                            crushCount: 0, // Start fresh - no crush count
                            userClass: userClass,
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                            lastLogin: serverTimestamp()
                        };

                        await setDoc(userRef, newUserData);
                        // Real-time listener will handle the update
                        console.log(`Successfully created fresh ${userClass} account`);
                        return newUserData;
                    } else if (potentialMatches.length > 0) {
                        console.log(`Multiple matches found for ${userClass}, showing selection`);
                        setNameOptions(potentialMatches);
                        setPendingUserClass(userClass);

                        const incompleteUserData: UserData = {
                            uid: actualUid,
                            email: user.email || '',
                            name: '', // Will be set when user selects
                            photoURL: user.photoURL || DEFAULT_PROFILE_URL,
                            crushes: [], // Start fresh
                            lockedCrushes: [], // Start fresh
                            matches: [], // Start fresh
                            crushCount: 0, // Start fresh
                            userClass: userClass,
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                            lastLogin: serverTimestamp()
                        };

                        await setDoc(userRef, incompleteUserData);
                        // Real-time listener will handle the update
                        return incompleteUserData;
                    } else {
                        await signOut(auth);
                        const className = userClass === 'gsb' ? 'GSB Class of 2025' : 'Undergraduate Class of 2025';
                        alert(`Your name was not found in the ${className} roster. If this is a mistake, please contact jpark22@stanford.edu.`);
                        return null;
                    }
                } else {
                    // Document exists, just update login time (don't modify crushes/matches)
                    const existingData = userDoc.data();
                    console.log(`Using existing ${userClass} account for ${existingData.name}`);

                    const updatedData: UserData = {
                        uid: existingData.uid,
                        email: existingData.email,
                        name: existingData.name || existingData.verifiedName || existingData.displayName || '',
                        photoURL: user.photoURL || existingData.photoURL || DEFAULT_PROFILE_URL,
                        crushes: existingData.crushes || [],
                        lockedCrushes: existingData.lockedCrushes || [],
                        matches: normalizeMatches(existingData.matches || []),
                        crushCount: existingData.crushCount || 0,
                        userClass: existingData.userClass || userClass,
                        createdAt: existingData.createdAt,
                        updatedAt: serverTimestamp(),
                        lastLogin: serverTimestamp()
                    };

                    await setDoc(userRef, updatedData, { merge: true });
                    // Real-time listener will handle the update
                    return updatedData;
                }
            } else {
                // Regular user flow for everyone else
                const userRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userRef);

                if (!userDoc.exists()) {
                    // New user
                    const classNames = userClass === 'gsb' ? GSB_CLASS_NAMES : UNDERGRAD_CLASS_NAMES;
                    const displayName = user.displayName || user.email?.split('@')[0] || '';
                    const { exactMatch, potentialMatches } = findNameMatches(displayName, classNames);

                    if (exactMatch) {
                        const newUserData: UserData = {
                            uid: user.uid,
                            email: user.email || '',
                            name: exactMatch,
                            photoURL: user.photoURL || DEFAULT_PROFILE_URL,
                            crushes: [],
                            lockedCrushes: [],
                            matches: [],
                            crushCount: 0,
                            userClass: userClass,
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                            lastLogin: serverTimestamp()
                        };

                        await setDoc(userRef, newUserData);
                        // Real-time listener will handle the update
                        return newUserData;
                    } else if (potentialMatches.length > 0) {
                        setNameOptions(potentialMatches);
                        setPendingUserClass(userClass);

                        const incompleteUserData: UserData = {
                            uid: user.uid,
                            email: user.email || '',
                            name: '',
                            photoURL: user.photoURL || DEFAULT_PROFILE_URL,
                            crushes: [],
                            lockedCrushes: [],
                            matches: [],
                            crushCount: 0,
                            userClass: userClass,
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                            lastLogin: serverTimestamp()
                        };

                        await setDoc(userRef, incompleteUserData);
                        // Real-time listener will handle the update
                        return incompleteUserData;
                    } else {
                        await signOut(auth);
                        const className = userClass === 'gsb' ? 'GSB Class of 2025' : 'Undergraduate Class of 2025';
                        alert(`Your name was not found in the ${className} roster. If this is a mistake, please contact jpark22@stanford.edu.`);
                        return null;
                    }
                } else {
                    // Existing user - check if they're trying wrong class
                    const existingData = userDoc.data();
                    if (existingData.userClass && existingData.userClass !== userClass) {
                        await signOut(auth);
                        const existingClassName = existingData.userClass === 'gsb' ? 'GSB' : 'Undergraduate';
                        alert(`You are already registered as a ${existingClassName} student. Please sign in with the ${existingClassName} option.`);
                        return null;
                    }

                    const updatedData: UserData = {
                        uid: existingData.uid,
                        email: existingData.email,
                        name: existingData.name || existingData.verifiedName || existingData.displayName || '',
                        photoURL: user.photoURL || existingData.photoURL || DEFAULT_PROFILE_URL,
                        crushes: existingData.crushes || [],
                        lockedCrushes: existingData.lockedCrushes || [],
                        matches: normalizeMatches(existingData.matches),
                        crushCount: existingData.crushCount || 0,
                        userClass: existingData.userClass || userClass,
                        createdAt: existingData.createdAt,
                        updatedAt: serverTimestamp(),
                        lastLogin: serverTimestamp()
                    };

                    await setDoc(userRef, updatedData, { merge: true });
                    // Real-time listener will handle the update
                    return updatedData;
                }
            }
        } catch (error) {
            console.error('Error creating/updating user document:', error);
            return null;
        }
    }, [getUserDocumentId, normalizeMatches, DEFAULT_PROFILE_URL, setNameOptions, setPendingUserClass, setLastUsedClass]);

    return { createOrUpdateUserDocument };
};