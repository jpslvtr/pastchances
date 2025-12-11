export type UserClass = 'gsb' | 'undergrad';

export interface MatchInfo {
    name: string;
    email: string;
    matchedAt?: any; // Firebase Timestamp or Date
}

export interface UserData {
    uid: string;
    email: string;
    emailAlumni?: string;
    emailAlumniGSB?: string;
    name: string;
    photoURL: string;
    crushes: string[];
    lockedCrushes: string[];
    matches: MatchInfo[];
    crushCount: number;
    userClass: UserClass;
    createdAt: any;
    updatedAt: any;
    lastLogin: any;
}

export interface UserWithId extends UserData {
    id: string;
}

export interface InactiveUser extends UserData {
    isInactive: boolean;
}

export interface GhostUser extends UserData {
    isGhost: boolean;
}

export interface CrusherInfo {
    name: string;
    email: string;
}

export interface ClassAnalyticsData {
    totalUsers: number;
    totalClassSize: number;
    totalMatches: number;
    matchedPairs: string[];
    totalCrushes: number;
    peopleWithCrushes: number;
    matchRate: number;
    crushRate: number;
}