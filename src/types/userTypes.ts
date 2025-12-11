export type UserClass = 'gsb' | 'undergrad';

export interface MatchInfo {
    name: string;
    email: string;
    matchedAt?: any;
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