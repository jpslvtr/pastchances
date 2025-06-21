export interface UserData {
    uid: string;
    email: string;
    name: string;  // Single name field instead of displayName/verifiedName
    photoURL: string;
    crushes: string[];
    lockedCrushes?: string[];
    matches?: MatchInfo[];
    crushCount?: number;
    createdAt: any;
    updatedAt: any;
    lastLogin: any;

    // Legacy fields for migration support
    displayName?: string;
    verifiedName?: string;
}

export interface UserWithId extends UserData {
    id: string;
}

export interface MatchInfo {
    name: string;
    email: string;
}