import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { UserData } from '../types';

export const isStanfordEmail = (email: string): boolean => {
    return email.toLowerCase().endsWith('@stanford.edu');
};

export const isAlumniEmail = (email: string): boolean => {
    const lowerEmail = email.toLowerCase();
    return lowerEmail.endsWith('@alumni.stanford.edu') ||
        lowerEmail.endsWith('@alumni.gsb.stanford.edu');
};

export const isValidStanfordRelatedEmail = (email: string): boolean => {
    return isStanfordEmail(email) || isAlumniEmail(email);
};

export const normalizeEmail = (email: string): string => {
    return email.toLowerCase().trim();
};

export const getEmailPrefix = (email: string): string => {
    return email.split('@')[0].toLowerCase();
};

export const generateAlumniEmails = (prefix: string): { emailAlumni: string; emailAlumniGSB: string } => {
    const normalizedPrefix = prefix.toLowerCase();
    return {
        emailAlumni: `${normalizedPrefix}@alumni.stanford.edu`,
        emailAlumniGSB: `${normalizedPrefix}@alumni.gsb.stanford.edu`
    };
};

interface EmailLookupResult {
    docId: string | null;
    userData: UserData | null;
}

export const findUserByEmail = async (email: string): Promise<EmailLookupResult> => {
    try {
        const normalizedEmail = normalizeEmail(email);
        const usersRef = collection(db, 'users');

        const [snap1, snap2, snap3] = await Promise.all([
            getDocs(query(usersRef, where('email', '==', normalizedEmail))),
            getDocs(query(usersRef, where('emailAlumni', '==', normalizedEmail))),
            getDocs(query(usersRef, where('emailAlumniGSB', '==', normalizedEmail)))
        ]);

        const found = [snap1, snap2, snap3].find(snap => !snap.empty);
        if (found) {
            return { docId: found.docs[0].id, userData: found.docs[0].data() as UserData };
        }

        return { docId: null, userData: null };
    } catch (error) {
        console.error('Error in findUserByEmail:', error);
        return { docId: null, userData: null };
    }
};

// NEW: Enhanced fuzzy name matching with case-insensitive and hyphen-insensitive matching
export const fuzzyNameMatch = (googleName: string, dbName: string): number => {
    // Normalize: lowercase, remove hyphens, remove non-alphabetic chars except spaces
    const normalize = (str: string) =>
        str.toLowerCase().trim().replace(/-/g, ' ').replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ');

    const normalizedGoogle = normalize(googleName);
    const normalizedDb = normalize(dbName);

    // Exact match after normalization
    if (normalizedGoogle === normalizedDb) return 100;

    // Parse name variations to handle "First Last" vs "Last, First"
    const parseNameVariations = (name: string): string[] => {
        const variations: string[] = [name];
        const parts = name.split(' ').filter(p => p.length > 0);

        if (parts.length >= 2) {
            // For "First Last" or "First Middle Last", create "Last First" variation
            const lastName = parts[parts.length - 1];
            const firstParts = parts.slice(0, -1).join(' ');
            variations.push(`${lastName} ${firstParts}`);
        }

        return variations;
    };

    const googleVariations = parseNameVariations(normalizedGoogle);
    const dbVariations = parseNameVariations(normalizedDb);

    let maxScore = 0;

    // Check all combinations of variations
    for (const gVar of googleVariations) {
        for (const dVar of dbVariations) {
            const score = calculateMatchScore(gVar, dVar);
            maxScore = Math.max(maxScore, score);
        }
    }

    return maxScore;
};

// Helper function to calculate match score between two normalized name strings
const calculateMatchScore = (name1: string, name2: string): number => {
    const parts1 = name1.split(' ').filter(p => p.length > 0);
    const parts2 = name2.split(' ').filter(p => p.length > 0);

    if (parts1.length === 0 || parts2.length === 0) return 0;

    let score = 0;

    // Check if all parts from the shorter name appear in the longer name
    const shorterParts = parts1.length <= parts2.length ? parts1 : parts2;
    const longerParts = parts1.length <= parts2.length ? parts2 : parts1;

    const allPartsMatch = shorterParts.every(sPart =>
        longerParts.some(lPart => lPart === sPart || lPart.startsWith(sPart) || sPart.startsWith(lPart))
    );

    if (allPartsMatch) score += 70;

    // First name match
    if (parts1[0] === parts2[0] ||
        (parts1[0].length >= 3 && parts2[0].startsWith(parts1[0])) ||
        (parts2[0].length >= 3 && parts1[0].startsWith(parts2[0]))) {
        score += 30;
    }

    // Last name match (if both have multiple parts)
    if (parts1.length > 1 && parts2.length > 1) {
        const last1 = parts1[parts1.length - 1];
        const last2 = parts2[parts2.length - 1];
        if (last1 === last2 ||
            (last1.length >= 3 && last2.startsWith(last1)) ||
            (last2.length >= 3 && last1.startsWith(last2))) {
            score += 30;
        }
    }

    // Substring matching as fallback
    if (score === 0) {
        if (name1.includes(name2) || name2.includes(name1)) {
            score = 40;
        }
    }

    return Math.min(score, 100);
};