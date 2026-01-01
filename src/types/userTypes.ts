export type UserClass = 'gsb' | 'undergrad';

export interface MatchInfo {
    name: string;
    email: string;
    matchedAt?: any;
}

export interface PublicContact {
    cell: string;
    instagram: string;
    linkedin: string;
    preferred: 'cell' | 'instagram' | 'linkedin' | '';
}

export interface UserData {
    uid: string;
    email: string;
    emailAlumni?: string;
    emailAlumniGSB?: string;
    name: string;
    photoURL: string;
    customPhotoURL?: string;
    crushes: string[];
    lockedCrushes: string[];
    matches: MatchInfo[];
    crushCount: number;
    userClass: UserClass;
    createdAt: any;
    updatedAt: any;
    lastLogin: any;
    location?: string;
    about?: string;
    publicContact?: PublicContact;
}

export interface UserWithId extends UserData {
    id: string;
}