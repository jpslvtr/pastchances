export interface UserData {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string;
    verifiedName: string;
    crushes: string[];
    lockedCrushes?: string[];
    matches?: MatchInfo[];
    crushCount?: number;
    createdAt: any;
    updatedAt: any;
    lastLogin: any;
}

export interface UserWithId extends UserData {
    id: string;
}

export interface MatchInfo {
    name: string;
    email: string;
}