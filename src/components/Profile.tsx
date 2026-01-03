import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from './shared/Navbar';
import UserPhoto from './shared/UserPhoto';
import PhotoModal from './shared/PhotoModal';
import { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { getUserDocumentId } from '../utils';
import { GSB_CLASS_NAMES } from '../data/names';
import { UNDERGRAD_CLASS_NAMES } from '../data/names-undergrad';
import type { UserData, PublicContact } from '../types';
import '../styles/profile.css';

const hashName = (name: string): string => {
    let hash = 0;
    const normalized = name.toLowerCase().trim();
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
};

interface CountryCode {
    code: string;
    country: string;
    format: (digits: string) => string;
    minDigits: number;
    maxDigits: number;
}

const COUNTRY_CODES: CountryCode[] = [
    {
        code: '+1',
        country: 'United States/Canada',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 3) return digits;
            if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
            return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
        },
        minDigits: 10,
        maxDigits: 10
    },
    {
        code: '+93',
        country: 'Afghanistan',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+355',
        country: 'Albania',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 3) return digits;
            if (digits.length <= 7) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
            return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+213',
        country: 'Algeria',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+376',
        country: 'Andorra',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 3) return digits;
            return `${digits.slice(0, 3)} ${digits.slice(3, 6)}`;
        },
        minDigits: 6,
        maxDigits: 9
    },
    {
        code: '+244',
        country: 'Angola',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 3) return digits;
            return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+54',
        country: 'Argentina',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 6) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6, 10)}`;
        },
        minDigits: 10,
        maxDigits: 11
    },
    {
        code: '+374',
        country: 'Armenia',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)}`;
        },
        minDigits: 8,
        maxDigits: 8
    },
    {
        code: '+61',
        country: 'Australia',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+43',
        country: 'Austria',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 10,
        maxDigits: 13
    },
    {
        code: '+994',
        country: 'Azerbaijan',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+973',
        country: 'Bahrain',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 4) return digits;
            return `${digits.slice(0, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 8,
        maxDigits: 8
    },
    {
        code: '+880',
        country: 'Bangladesh',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 10)}`;
        },
        minDigits: 10,
        maxDigits: 10
    },
    {
        code: '+375',
        country: 'Belarus',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+32',
        country: 'Belgium',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 7)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+501',
        country: 'Belize',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 3) return digits;
            return `${digits.slice(0, 3)} ${digits.slice(3, 7)}`;
        },
        minDigits: 7,
        maxDigits: 7
    },
    {
        code: '+591',
        country: 'Bolivia',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 8,
        maxDigits: 8
    },
    {
        code: '+387',
        country: 'Bosnia and Herzegovina',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)}`;
        },
        minDigits: 8,
        maxDigits: 8
    },
    {
        code: '+267',
        country: 'Botswana',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 3) return digits;
            return `${digits.slice(0, 3)} ${digits.slice(3, 7)}`;
        },
        minDigits: 7,
        maxDigits: 7
    },
    {
        code: '+55',
        country: 'Brazil',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 7) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 7)} ${digits.slice(7, 11)}`;
        },
        minDigits: 11,
        maxDigits: 11
    },
    {
        code: '+673',
        country: 'Brunei',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 3) return digits;
            return `${digits.slice(0, 3)} ${digits.slice(3, 7)}`;
        },
        minDigits: 7,
        maxDigits: 7
    },
    {
        code: '+359',
        country: 'Bulgaria',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 7)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+855',
        country: 'Cambodia',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+237',
        country: 'Cameroon',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+56',
        country: 'Chile',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+86',
        country: 'China',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 3) return digits;
            if (digits.length <= 7) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
            return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7, 11)}`;
        },
        minDigits: 11,
        maxDigits: 11
    },
    {
        code: '+57',
        country: 'Colombia',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 10,
        maxDigits: 10
    },
    {
        code: '+506',
        country: 'Costa Rica',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 4) return digits;
            return `${digits.slice(0, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 8,
        maxDigits: 8
    },
    {
        code: '+385',
        country: 'Croatia',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+53',
        country: 'Cuba',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 5)} ${digits.slice(5, 8)}`;
        },
        minDigits: 8,
        maxDigits: 8
    },
    {
        code: '+357',
        country: 'Cyprus',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            return `${digits.slice(0, 2)} ${digits.slice(2, 8)}`;
        },
        minDigits: 8,
        maxDigits: 8
    },
    {
        code: '+420',
        country: 'Czech Republic',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 3) return digits;
            if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
            return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+45',
        country: 'Denmark',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)}`;
        },
        minDigits: 8,
        maxDigits: 8
    },
    {
        code: '+1',
        country: 'Dominican Republic',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 3) return digits;
            if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
            return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
        },
        minDigits: 10,
        maxDigits: 10
    },
    {
        code: '+593',
        country: 'Ecuador',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+20',
        country: 'Egypt',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 10,
        maxDigits: 10
    },
    {
        code: '+503',
        country: 'El Salvador',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 4) return digits;
            return `${digits.slice(0, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 8,
        maxDigits: 8
    },
    {
        code: '+372',
        country: 'Estonia',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 3) return digits;
            return `${digits.slice(0, 3)} ${digits.slice(3, 7)}`;
        },
        minDigits: 7,
        maxDigits: 8
    },
    {
        code: '+251',
        country: 'Ethiopia',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+679',
        country: 'Fiji',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 3) return digits;
            return `${digits.slice(0, 3)} ${digits.slice(3, 7)}`;
        },
        minDigits: 7,
        maxDigits: 7
    },
    {
        code: '+358',
        country: 'Finland',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 10
    },
    {
        code: '+33',
        country: 'France',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 3) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            if (digits.length <= 5) return `${digits.slice(0, 1)} ${digits.slice(1, 3)} ${digits.slice(3)}`;
            if (digits.length <= 7) return `${digits.slice(0, 1)} ${digits.slice(1, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+995',
        country: 'Georgia',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 3) return digits;
            if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
            return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+49',
        country: 'Germany',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 3) return digits;
            if (digits.length <= 7) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
            return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7, 11)}`;
        },
        minDigits: 10,
        maxDigits: 11
    },
    {
        code: '+233',
        country: 'Ghana',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+30',
        country: 'Greece',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 10)}`;
        },
        minDigits: 10,
        maxDigits: 10
    },
    {
        code: '+502',
        country: 'Guatemala',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 4) return digits;
            return `${digits.slice(0, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 8,
        maxDigits: 8
    },
    {
        code: '+852',
        country: 'Hong Kong',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 4) return digits;
            return `${digits.slice(0, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 8,
        maxDigits: 8
    },
    {
        code: '+36',
        country: 'Hungary',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 7)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+354',
        country: 'Iceland',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 3) return digits;
            return `${digits.slice(0, 3)} ${digits.slice(3, 7)}`;
        },
        minDigits: 7,
        maxDigits: 7
    },
    {
        code: '+91',
        country: 'India',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 5) return digits;
            return `${digits.slice(0, 5)} ${digits.slice(5, 10)}`;
        },
        minDigits: 10,
        maxDigits: 10
    },
    {
        code: '+62',
        country: 'Indonesia',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 6) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6, 10)}`;
        },
        minDigits: 9,
        maxDigits: 11
    },
    {
        code: '+98',
        country: 'Iran',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 10,
        maxDigits: 10
    },
    {
        code: '+964',
        country: 'Iraq',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 10,
        maxDigits: 10
    },
    {
        code: '+353',
        country: 'Ireland',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+972',
        country: 'Israel',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+39',
        country: 'Italy',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 10
    },
    {
        code: '+81',
        country: 'Japan',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 6) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6, 10)}`;
        },
        minDigits: 10,
        maxDigits: 10
    },
    {
        code: '+962',
        country: 'Jordan',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+7',
        country: 'Kazakhstan',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 3) return digits;
            if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
            return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
        },
        minDigits: 10,
        maxDigits: 10
    },
    {
        code: '+254',
        country: 'Kenya',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+965',
        country: 'Kuwait',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 4) return digits;
            return `${digits.slice(0, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 8,
        maxDigits: 8
    },
    {
        code: '+371',
        country: 'Latvia',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)}`;
        },
        minDigits: 8,
        maxDigits: 8
    },
    {
        code: '+961',
        country: 'Lebanon',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 7)}`;
        },
        minDigits: 7,
        maxDigits: 8
    },
    {
        code: '+218',
        country: 'Libya',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+370',
        country: 'Lithuania',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 3) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
            return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)}`;
        },
        minDigits: 8,
        maxDigits: 8
    },
    {
        code: '+352',
        country: 'Luxembourg',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 3) return digits;
            if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
            return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+853',
        country: 'Macau',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 4) return digits;
            return `${digits.slice(0, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 8,
        maxDigits: 8
    },
    {
        code: '+60',
        country: 'Malaysia',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 9,
        maxDigits: 10
    },
    {
        code: '+960',
        country: 'Maldives',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 3) return digits;
            return `${digits.slice(0, 3)} ${digits.slice(3, 7)}`;
        },
        minDigits: 7,
        maxDigits: 7
    },
    {
        code: '+356',
        country: 'Malta',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 4) return digits;
            return `${digits.slice(0, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 8,
        maxDigits: 8
    },
    {
        code: '+52',
        country: 'Mexico',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 6) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6, 10)}`;
        },
        minDigits: 10,
        maxDigits: 10
    },
    {
        code: '+377',
        country: 'Monaco',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)}`;
        },
        minDigits: 8,
        maxDigits: 9
    },
    {
        code: '+976',
        country: 'Mongolia',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)}`;
        },
        minDigits: 8,
        maxDigits: 8
    },
    {
        code: '+382',
        country: 'Montenegro',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)}`;
        },
        minDigits: 8,
        maxDigits: 8
    },
    {
        code: '+212',
        country: 'Morocco',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+258',
        country: 'Mozambique',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+95',
        country: 'Myanmar',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 8,
        maxDigits: 10
    },
    {
        code: '+264',
        country: 'Namibia',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+977',
        country: 'Nepal',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 10,
        maxDigits: 10
    },
    {
        code: '+31',
        country: 'Netherlands',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+64',
        country: 'New Zealand',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 9,
        maxDigits: 10
    },
    {
        code: '+234',
        country: 'Nigeria',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 3) return digits;
            if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
            return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
        },
        minDigits: 10,
        maxDigits: 10
    },
    {
        code: '+47',
        country: 'Norway',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 3) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
            return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)}`;
        },
        minDigits: 8,
        maxDigits: 8
    },
    {
        code: '+968',
        country: 'Oman',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 4) return digits;
            return `${digits.slice(0, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 8,
        maxDigits: 8
    },
    {
        code: '+92',
        country: 'Pakistan',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 10,
        maxDigits: 10
    },
    {
        code: '+507',
        country: 'Panama',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 4) return digits;
            return `${digits.slice(0, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 8,
        maxDigits: 8
    },
    {
        code: '+595',
        country: 'Paraguay',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+51',
        country: 'Peru',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+63',
        country: 'Philippines',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 10,
        maxDigits: 10
    },
    {
        code: '+48',
        country: 'Poland',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+351',
        country: 'Portugal',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+974',
        country: 'Qatar',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 4) return digits;
            return `${digits.slice(0, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 8,
        maxDigits: 8
    },
    {
        code: '+40',
        country: 'Romania',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+7',
        country: 'Russia',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 3) return digits;
            if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
            return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
        },
        minDigits: 10,
        maxDigits: 10
    },
    {
        code: '+966',
        country: 'Saudi Arabia',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+381',
        country: 'Serbia',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+65',
        country: 'Singapore',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 4) return digits;
            return `${digits.slice(0, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 8,
        maxDigits: 8
    },
    {
        code: '+421',
        country: 'Slovakia',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 3) return digits;
            if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
            return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+386',
        country: 'Slovenia',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)}`;
        },
        minDigits: 8,
        maxDigits: 8
    },
    {
        code: '+27',
        country: 'South Africa',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+82',
        country: 'South Korea',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 6) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6, 10)}`;
        },
        minDigits: 10,
        maxDigits: 10
    },
    {
        code: '+34',
        country: 'Spain',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 3) return digits;
            if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
            return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+94',
        country: 'Sri Lanka',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+46',
        country: 'Sweden',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+41',
        country: 'Switzerland',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+963',
        country: 'Syria',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+886',
        country: 'Taiwan',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+66',
        country: 'Thailand',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+216',
        country: 'Tunisia',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)}`;
        },
        minDigits: 8,
        maxDigits: 8
    },
    {
        code: '+90',
        country: 'Turkey',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 3) return digits;
            if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
            return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
        },
        minDigits: 10,
        maxDigits: 10
    },
    {
        code: '+256',
        country: 'Uganda',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 3) return digits;
            if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
            return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+380',
        country: 'Ukraine',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+971',
        country: 'United Arab Emirates',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 8,
        maxDigits: 9
    },
    {
        code: '+44',
        country: 'United Kingdom',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 4) return digits;
            if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
            return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`;
        },
        minDigits: 10,
        maxDigits: 10
    },
    {
        code: '+598',
        country: 'Uruguay',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 8)}`;
        },
        minDigits: 8,
        maxDigits: 8
    },
    {
        code: '+998',
        country: 'Uzbekistan',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+58',
        country: 'Venezuela',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 3) return digits;
            if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
            return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
        },
        minDigits: 10,
        maxDigits: 10
    },
    {
        code: '+84',
        country: 'Vietnam',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 10
    },
    {
        code: '+967',
        country: 'Yemen',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 7)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+260',
        country: 'Zambia',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
        },
        minDigits: 9,
        maxDigits: 9
    },
    {
        code: '+263',
        country: 'Zimbabwe',
        format: (digits: string) => {
            if (digits.length === 0) return '';
            if (digits.length <= 1) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 7)}`;
        },
        minDigits: 9,
        maxDigits: 9
    }
];

const Profile = () => {
    const { userId: nameHash } = useParams<{ userId?: string }>();
    const { user, userData: currentUserData, refreshUserData } = useAuth();
    const navigate = useNavigate();
    const [profileData, setProfileData] = useState<UserData | null>(null);
    const [profileName, setProfileName] = useState<string>('');
    const [profileUserClass, setProfileUserClass] = useState<string>('gsb');
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [location, setLocation] = useState('');
    const [about, setAbout] = useState('');
    const [publicContact, setPublicContact] = useState<PublicContact>({
        cell: '',
        instagram: '',
        x: '',
        linkedin: '',
        other: '',
        preferred: ''
    });
    const [countryCode, setCountryCode] = useState('+1');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [contactErrors, setContactErrors] = useState<{
        cell?: string;
        instagram?: string;
        x?: string;
        linkedin?: string;
        other?: string;
        preferred?: string;
    }>({});
    const [saving, setSaving] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showCropModal, setShowCropModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [showPhotoModal, setShowPhotoModal] = useState(false);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);

    const isOwnProfile = !nameHash || (currentUserData && hashName(currentUserData.name) === nameHash);

    useEffect(() => {
        const loadProfile = async () => {
            setLoadingProfile(true);
            try {
                if (isOwnProfile) {
                    setProfileData(currentUserData);
                    setProfileName(currentUserData?.name || '');
                    setProfileUserClass(currentUserData?.userClass || 'gsb');
                    setLocation(currentUserData?.location || '');
                    setAbout(currentUserData?.about || '');

                    const contact: PublicContact = {
                        cell: currentUserData?.publicContact?.cell || '',
                        instagram: currentUserData?.publicContact?.instagram || '',
                        x: currentUserData?.publicContact?.x || '',
                        linkedin: currentUserData?.publicContact?.linkedin || '',
                        other: currentUserData?.publicContact?.other || '',
                        preferred: currentUserData?.publicContact?.preferred || ''
                    };

                    setPublicContact(contact);

                    // Parse existing cell phone into country code and number
                    if (contact.cell) {
                        const parsed = parsePhoneNumber(contact.cell);
                        setCountryCode(parsed.countryCode);
                        // Format the parsed number to include spaces
                        const formatted = formatPhoneNumber(parsed.number.replace(/\D/g, ''), parsed.countryCode);
                        setPhoneNumber(formatted);
                    } else {
                        setCountryCode('+1');
                        setPhoneNumber('');
                    }
                } else if (nameHash) {
                    const userClass = currentUserData?.userClass || 'gsb';
                    const classNames = userClass === 'gsb' ? GSB_CLASS_NAMES : UNDERGRAD_CLASS_NAMES;

                    const matchingName = classNames.find(name => hashName(name) === nameHash);

                    if (!matchingName) {
                        navigate('/');
                        return;
                    }

                    setProfileName(matchingName);
                    setProfileUserClass(userClass);

                    const usersRef = collection(db, 'users');
                    const q = query(
                        usersRef,
                        where('name', '==', matchingName),
                        where('userClass', '==', userClass)
                    );

                    const snapshot = await getDocs(q);

                    if (!snapshot.empty) {
                        setProfileData(snapshot.docs[0].data() as UserData);
                    } else {
                        setProfileData(null);
                    }
                }
            } catch (error) {
                console.error('Error loading profile:', error);
            } finally {
                setLoadingProfile(false);
            }
        };

        if (user && currentUserData) {
            loadProfile();
        }
    }, [nameHash, user, currentUserData, isOwnProfile, navigate]);

    const parsePhoneNumber = (fullNumber: string): { countryCode: string; number: string } => {
        const digits = fullNumber.replace(/\D/g, '');

        // Find matching country code (check longer codes first)
        const sortedCodes = [...COUNTRY_CODES].sort((a, b) =>
            b.code.replace('+', '').length - a.code.replace('+', '').length
        );

        for (const cc of sortedCodes) {
            const codeDigits = cc.code.replace('+', '');
            if (digits.startsWith(codeDigits)) {
                return {
                    countryCode: cc.code,
                    number: digits.slice(codeDigits.length)
                };
            }
        }

        // Default to +1 if no match
        return {
            countryCode: '+1',
            number: digits.length > 1 ? digits.slice(1) : digits
        };
    };

    const formatPhoneNumber = (digits: string, code: string): string => {
        const country = COUNTRY_CODES.find(c => c.code === code);
        if (!country) return digits;
        return country.format(digits);
    };

    const validateCell = (code: string, number: string): string | null => {
        if (!number) return null;

        const digits = number.replace(/\D/g, '');
        const country = COUNTRY_CODES.find(c => c.code === code);

        if (!country) {
            return 'Invalid country code';
        }

        if (digits.length < country.minDigits) {
            return `Phone number must have at least ${country.minDigits} digits`;
        }

        if (digits.length > country.maxDigits) {
            return `Phone number must have at most ${country.maxDigits} digits`;
        }

        return null;
    };

    const validateInstagram = (username: string): string | null => {
        if (!username) return null;

        const instagramRegex = /^[a-zA-Z0-9._]{1,30}$/;

        if (!instagramRegex.test(username)) {
            return 'Invalid Instagram username';
        }

        return null;
    };

    const validateLinkedIn = (username: string): string | null => {
        if (!username) return null;

        const linkedinRegex = /^[a-zA-Z0-9-]{3,100}$/;

        if (!linkedinRegex.test(username)) {
            return 'Invalid LinkedIn username';
        }

        return null;
    };

    const validateX = (username: string): string | null => {
        if (!username) return null;

        // Username validation (1-15 characters, alphanumeric and underscores)
        const xUsernameRegex = /^[a-zA-Z0-9_]{1,15}$/;

        if (!xUsernameRegex.test(username)) {
            return 'Invalid X username (1-15 characters, letters, numbers, underscores only)';
        }

        return null;
    };

    const handlePhoneNumberChange = (value: string) => {
        // Strip all non-digits first to enforce proper formatting
        const digits = value.replace(/\D/g, '');
        const formatted = formatPhoneNumber(digits, countryCode);
        setPhoneNumber(formatted);

        setContactErrors(prev => ({
            ...prev,
            cell: undefined
        }));
    };

    const handleCountryCodeChange = (code: string) => {
        setCountryCode(code);
        // Reformat the existing number with the new country code
        const digits = phoneNumber.replace(/\D/g, '');
        const formatted = formatPhoneNumber(digits, code);
        setPhoneNumber(formatted);

        setContactErrors(prev => ({
            ...prev,
            cell: undefined
        }));
    };

    const handleContactChange = (field: Exclude<keyof PublicContact, 'cell'>, value: string) => {
        setPublicContact(prev => ({
            ...prev,
            [field]: value
        }));

        setContactErrors(prev => ({
            ...prev,
            [field]: undefined
        }));
    };

    const handlePreferredToggle = (field: 'cell' | 'instagram' | 'x' | 'linkedin' | 'other') => {
        setPublicContact(prev => ({
            ...prev,
            preferred: prev.preferred === field ? '' : field
        }));
    };

    const validateAllContactFields = (): boolean => {
        const errors: {
            cell?: string;
            instagram?: string;
            x?: string;
            linkedin?: string;
            other?: string;
            preferred?: string;
        } = {};
        let isValid = true;

        if (phoneNumber) {
            const cellError = validateCell(countryCode, phoneNumber);
            if (cellError) {
                errors.cell = cellError;
                isValid = false;
            }
        }

        if (publicContact.instagram) {
            const instagramError = validateInstagram(publicContact.instagram);
            if (instagramError) {
                errors.instagram = instagramError;
                isValid = false;
            }
        }

        if (publicContact.x) {
            const xError = validateX(publicContact.x);
            if (xError) {
                errors.x = xError;
                isValid = false;
            }
        }

        if (publicContact.linkedin) {
            const linkedinError = validateLinkedIn(publicContact.linkedin);
            if (linkedinError) {
                errors.linkedin = linkedinError;
                isValid = false;
            }
        }

        // Other field is free-text, no validation needed

        if (publicContact.preferred) {
            const preferredField = publicContact.preferred as 'cell' | 'instagram' | 'x' | 'linkedin' | 'other';
            if (preferredField === 'cell' && !phoneNumber) {
                errors.preferred = 'Cannot set cell as preferred when it\'s empty';
                isValid = false;
            } else if (preferredField !== 'cell' && !publicContact[preferredField]) {
                errors.preferred = `Cannot set ${publicContact.preferred} as preferred when it's empty`;
                isValid = false;
            }
        }

        setContactErrors(errors);
        return isValid;
    };
    const handlePhotoClick = () => {
        if (isOwnProfile) {
            fileInputRef.current?.click();
        } else {
            setShowPhotoModal(true);
        }
    };

    const resizeImageIfNeeded = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (file.size < 5 * 1024 * 1024) {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('Could not get canvas context'));
                        return;
                    }

                    const maxDimension = 2048;
                    let width = img.width;
                    let height = img.height;

                    if (width > maxDimension || height > maxDimension) {
                        if (width > height) {
                            height = (height / width) * maxDimension;
                            width = maxDimension;
                        } else {
                            width = (width / height) * maxDimension;
                            height = maxDimension;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);

                    resolve(canvas.toDataURL('image/jpeg', 0.85));
                };
                img.onerror = reject;
                img.src = e.target?.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const resizedImage = await resizeImageIfNeeded(file);
            setSelectedImage(resizedImage);
            setImageFile(file);
            setShowCropModal(true);
            setZoom(1);
            setPosition({ x: 0, y: 0 });
        } catch (error) {
            console.error('Error loading image:', error);
            alert('Failed to load image. Please try again.');
        }

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        setIsDragging(true);
        setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        setPosition({
            x: touch.clientX - dragStart.x,
            y: touch.clientY - dragStart.y
        });
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
    };

    const handleCropConfirm = async () => {
        if (!imageRef.current || !canvasRef.current || !imageFile) return;

        setUploadingPhoto(true);

        try {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not get canvas context');

            const targetSize = 400;
            canvas.width = targetSize;
            canvas.height = targetSize;

            const img = imageRef.current;
            const previewCircle = previewRef.current;
            if (!previewCircle) throw new Error('Preview element not found');

            const circleWidth = previewCircle.offsetWidth;

            const scale = targetSize / circleWidth;

            const scaledZoom = zoom * scale;
            const scaledX = position.x * scale;
            const scaledY = position.y * scale;

            ctx.save();
            ctx.beginPath();
            ctx.arc(targetSize / 2, targetSize / 2, targetSize / 2, 0, Math.PI * 2);
            ctx.clip();

            const imgWidth = img.naturalWidth * scaledZoom;
            const imgHeight = img.naturalHeight * scaledZoom;

            const drawX = (targetSize - imgWidth) / 2 + scaledX;
            const drawY = (targetSize - imgHeight) / 2 + scaledY;

            ctx.drawImage(img, drawX, drawY, imgWidth, imgHeight);
            ctx.restore();

            canvas.toBlob(async (blob) => {
                if (!blob) {
                    throw new Error('Failed to create blob from canvas');
                }

                const actualUid = getUserDocumentId(user!, currentUserData!);
                const timestamp = Date.now();
                const storageRef = ref(storage, `profile-photos/${actualUid}_${timestamp}.jpg`);

                await uploadBytes(storageRef, blob);
                const downloadURL = await getDownloadURL(storageRef);

                const userDocRef = doc(db, 'users', actualUid);
                await updateDoc(userDocRef, {
                    customPhotoURL: downloadURL,
                    updatedAt: new Date()
                });

                if (currentUserData?.customPhotoURL) {
                    try {
                        const oldPhotoRef = ref(storage, currentUserData.customPhotoURL);
                        await deleteObject(oldPhotoRef);
                    } catch (error) {
                        console.log('Could not delete old photo:', error);
                    }
                }

                await refreshUserData();

                setShowCropModal(false);
                setSelectedImage(null);
                setImageFile(null);
                setZoom(1);
                setPosition({ x: 0, y: 0 });
            }, 'image/jpeg', 0.9);

        } catch (error) {
            console.error('Error uploading photo:', error);
            alert('Failed to upload photo. Please try again.');
        } finally {
            setUploadingPhoto(false);
        }
    };

    const handleCropCancel = () => {
        setShowCropModal(false);
        setSelectedImage(null);
        setImageFile(null);
        setZoom(1);
        setPosition({ x: 0, y: 0 });
    };

    const handleLocationChange = (value: string) => {
        setLocation(value);

        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        if (!value.trim() || value.length < 2) {
            setSuggestions([]);
            return;
        }

        debounceTimer.current = setTimeout(async () => {
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=5&addressdetails=1`
                );
                const data = await response.json();

                const formattedSuggestions = data.map((item: any) => {
                    const parts = [];
                    if (item.address.city) parts.push(item.address.city);
                    else if (item.address.town) parts.push(item.address.town);
                    else if (item.address.village) parts.push(item.address.village);

                    if (item.address.state) parts.push(item.address.state);
                    if (item.address.country) parts.push(item.address.country);

                    return parts.join(', ');
                }).filter((suggestion: string, index: number, self: string[]) =>
                    suggestion && self.indexOf(suggestion) === index
                );

                setSuggestions(formattedSuggestions.slice(0, 5));
            } catch (error) {
                console.error('Error fetching location suggestions:', error);
            }
        }, 300);
    };

    const handleSuggestionClick = (suggestion: string) => {
        setLocation(suggestion);
        setSuggestions([]);
        setShowSuggestions(false);
    };

    const handleSave = async () => {
        if (!user || !currentUserData) return;

        if (!validateAllContactFields()) {
            return;
        }

        setSaving(true);

        try {
            const actualUid = getUserDocumentId(user!, currentUserData);
            const userDocRef = doc(db, 'users', actualUid);

            // Combine country code and phone number for storage
            const fullPhoneNumber = phoneNumber ? `${countryCode} ${phoneNumber}` : '';

            await updateDoc(userDocRef, {
                location,
                about,
                publicContact: {
                    ...publicContact,
                    cell: fullPhoneNumber
                },
                updatedAt: new Date()
            });

            await refreshUserData();

            setIsEditing(false);
        } catch (error) {
            console.error('Error saving profile:', error);
            alert('Failed to save profile. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setLocation(currentUserData?.location || '');
        setAbout(currentUserData?.about || '');

        const contact: PublicContact = {
            cell: currentUserData?.publicContact?.cell || '',
            instagram: currentUserData?.publicContact?.instagram || '',
            x: currentUserData?.publicContact?.x || '',
            linkedin: currentUserData?.publicContact?.linkedin || '',
            other: currentUserData?.publicContact?.other || '',
            preferred: currentUserData?.publicContact?.preferred || ''
        };

        setPublicContact(contact);

        if (contact.cell) {
            const parsed = parsePhoneNumber(contact.cell);
            setCountryCode(parsed.countryCode);
            // Format the parsed number to include spaces
            const formatted = formatPhoneNumber(parsed.number.replace(/\D/g, ''), parsed.countryCode);
            setPhoneNumber(formatted);
        } else {
            setCountryCode('+1');
            setPhoneNumber('');
        }

        setContactErrors({});
    };

    const viewingContact: PublicContact = isOwnProfile ? publicContact : {
        cell: profileData?.publicContact?.cell || '',
        instagram: profileData?.publicContact?.instagram || '',
        x: profileData?.publicContact?.x || '',
        linkedin: profileData?.publicContact?.linkedin || '',
        other: profileData?.publicContact?.other || '',
        preferred: profileData?.publicContact?.preferred || ''
    };

    if (loadingProfile) {
        return <div className="loading">Loading...</div>;
    }

    return (
        <div className="dashboard-container">
            <div className="dashboard-card">
                <Navbar user={user} userData={currentUserData} />

                <div className="profile-container">
                    <div className="profile-header">
                        <div className="profile-photo-wrapper" onClick={handlePhotoClick}>
                            <UserPhoto
                                name={profileName}
                                userClass={profileUserClass}
                                size="large"
                                photoUrl={isOwnProfile ?
                                    (currentUserData?.customPhotoURL || null) :
                                    (profileData?.customPhotoURL || null)
                                }
                            />
                            {isOwnProfile && (
                                <div className="photo-edit-overlay">
                                    <span>✎</span>
                                </div>
                            )}
                        </div>
                        <h2>{profileName}</h2>

                        {isOwnProfile && (
                            <div className="profile-actions">
                                {!isEditing ? (
                                    <button onClick={() => setIsEditing(true)} className="edit-btn">
                                        Edit Profile
                                    </button>
                                ) : (
                                    <div className="edit-actions">
                                        <button onClick={handleSave} disabled={saving} className="save-btn">
                                            {saving ? 'Saving...' : 'Save'}
                                        </button>
                                        <button onClick={handleCancel} disabled={saving} className="cancel-btn">
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="profile-info-section">
                        <div className="info-row location-row">
                            <label>Location:</label>
                            {isOwnProfile && isEditing ? (
                                <div style={{ position: 'relative', flex: 1, width: '100%' }}>
                                    <input
                                        type="text"
                                        value={location}
                                        onChange={(e) => handleLocationChange(e.target.value)}
                                        onFocus={() => setShowSuggestions(true)}
                                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                        placeholder="Start typing city, country..."
                                        className="info-input-inline"
                                    />
                                    {showSuggestions && suggestions.length > 0 && (
                                        <div className="location-suggestions">
                                            {suggestions.map((suggestion, index) => (
                                                <div
                                                    key={index}
                                                    className="suggestion-item"
                                                    onMouseDown={() => handleSuggestionClick(suggestion)}
                                                >
                                                    {suggestion}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ flex: 1, width: '100%' }}>
                                    <div className="info-value-plain">{profileData?.location || ''}</div>
                                </div>
                            )}
                        </div>

                        <div className="info-row">
                            <label>Contact:</label>
                            {isOwnProfile && isEditing ? (
                                <div className="contact-fields-plain">
                                    <div className="contact-field-plain">
                                        <label>Cell:</label>
                                        <div className="contact-input-with-star">
                                            <div className="phone-input-group">
                                                <select
                                                    value={countryCode}
                                                    onChange={(e) => handleCountryCodeChange(e.target.value)}
                                                    className="country-code-select"
                                                >
                                                    {COUNTRY_CODES.map((country) => (
                                                        <option key={country.code} value={country.code}>
                                                            {country.code} {country.country}
                                                        </option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="text"
                                                    value={phoneNumber}
                                                    onChange={(e) => handlePhoneNumberChange(e.target.value)}
                                                    placeholder={COUNTRY_CODES.find(c => c.code === countryCode)?.code === '+1' ? '234 567 8900' : 'Phone number'}
                                                    className={`phone-number-input ${contactErrors.cell ? 'error' : ''}`}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                className={`preferred-star ${publicContact.preferred === 'cell' ? 'active' : ''}`}
                                                onClick={() => handlePreferredToggle('cell')}
                                                disabled={!phoneNumber}
                                                title="Set as preferred contact method"
                                            >
                                                {publicContact.preferred === 'cell' ? '★' : '☆'}
                                            </button>
                                        </div>
                                        {contactErrors.cell && <span className="contact-error">{contactErrors.cell}</span>}
                                    </div>

                                    <div className="contact-field-plain">
                                        <label>Instagram:</label>
                                        <div className="contact-input-with-star">
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <span style={{
                                                    position: 'absolute',
                                                    left: '14px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    color: '#6c757d',
                                                    pointerEvents: 'none',
                                                    fontSize: '14px',
                                                    zIndex: 1
                                                }}>
                                                    https://www.instagram.com/
                                                </span>
                                                <input
                                                    type="text"
                                                    value={publicContact.instagram}
                                                    onChange={(e) => handleContactChange('instagram', e.target.value)}
                                                    placeholder=""
                                                    className={`info-input-inline ${contactErrors.instagram ? 'error' : ''}`}
                                                    style={{ paddingLeft: '196px', width: '100%' }}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                className={`preferred-star ${publicContact.preferred === 'instagram' ? 'active' : ''}`}
                                                onClick={() => handlePreferredToggle('instagram')}
                                                disabled={!publicContact.instagram}
                                                title="Set as preferred contact method"
                                            >
                                                {publicContact.preferred === 'instagram' ? '★' : '☆'}
                                            </button>
                                        </div>
                                        {contactErrors.instagram && <span className="contact-error">{contactErrors.instagram}</span>}
                                    </div>

                                    <div className="contact-field-plain">
                                        <label>X:</label>
                                        <div className="contact-input-with-star">
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <span style={{
                                                    position: 'absolute',
                                                    left: '14px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    color: '#6c757d',
                                                    pointerEvents: 'none',
                                                    fontSize: '14px',
                                                    zIndex: 1
                                                }}>
                                                    https://x.com/
                                                </span>
                                                <input
                                                    type="text"
                                                    value={publicContact.x}
                                                    onChange={(e) => handleContactChange('x', e.target.value)}
                                                    placeholder=""
                                                    className={`info-input-inline ${contactErrors.x ? 'error' : ''}`}
                                                    style={{ paddingLeft: '103px', width: '100%' }}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                className={`preferred-star ${publicContact.preferred === 'x' ? 'active' : ''}`}
                                                onClick={() => handlePreferredToggle('x')}
                                                disabled={!publicContact.x}
                                                title="Set as preferred contact method"
                                            >
                                                {publicContact.preferred === 'x' ? '★' : '☆'}
                                            </button>
                                        </div>
                                        {contactErrors.x && <span className="contact-error">{contactErrors.x}</span>}
                                    </div>

                                    <div className="contact-field-plain">
                                        <label>LinkedIn:</label>
                                        <div className="contact-input-with-star">
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <span style={{
                                                    position: 'absolute',
                                                    left: '14px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    color: '#6c757d',
                                                    pointerEvents: 'none',
                                                    fontSize: '14px',
                                                    zIndex: 1
                                                }}>
                                                    https://www.linkedin.com/in/
                                                </span>
                                                <input
                                                    type="text"
                                                    value={publicContact.linkedin}
                                                    onChange={(e) => handleContactChange('linkedin', e.target.value)}
                                                    placeholder=""
                                                    className={`info-input-inline ${contactErrors.linkedin ? 'error' : ''}`}
                                                    style={{ paddingLeft: '196px', width: '100%' }}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                className={`preferred-star ${publicContact.preferred === 'linkedin' ? 'active' : ''}`}
                                                onClick={() => handlePreferredToggle('linkedin')}
                                                disabled={!publicContact.linkedin}
                                                title="Set as preferred contact method"
                                            >
                                                {publicContact.preferred === 'linkedin' ? '★' : '☆'}
                                            </button>
                                        </div>
                                        {contactErrors.linkedin && <span className="contact-error">{contactErrors.linkedin}</span>}
                                    </div>

                                    <div className="contact-field-plain">
                                        <label>Other:</label>
                                        <div className="contact-input-with-star">
                                            <input
                                                type="text"
                                                value={publicContact.other}
                                                onChange={(e) => handleContactChange('other', e.target.value)}
                                                placeholder="Any other contact method"
                                                className={`info-input-inline ${contactErrors.other ? 'error' : ''}`}
                                            />
                                            <button
                                                type="button"
                                                className={`preferred-star ${publicContact.preferred === 'other' ? 'active' : ''}`}
                                                onClick={() => handlePreferredToggle('other')}
                                                disabled={!publicContact.other}
                                                title="Set as preferred contact method"
                                            >
                                                {publicContact.preferred === 'other' ? '★' : '☆'}
                                            </button>
                                        </div>
                                        {contactErrors.other && <span className="contact-error">{contactErrors.other}</span>}
                                    </div>
                                    {contactErrors.preferred && <span className="contact-error general-error">{contactErrors.preferred}</span>}
                                </div>
                            ) : (
                                <div style={{ flex: 1 }}>
                                    <div className="contact-display-plain">
                                        {(isOwnProfile || viewingContact.cell) && (
                                            <div className={`info-value-plain ${viewingContact.preferred === 'cell' ? 'preferred' : ''}`}>
                                                {viewingContact.cell ? (
                                                    <>
                                                        <strong>Cell: </strong>
                                                        <a href={`sms:${viewingContact.cell.replace(/\s/g, '')}`} className="contact-link-plain">
                                                            {viewingContact.cell}
                                                        </a>
                                                    </>
                                                ) : (
                                                    ''
                                                )}
                                                {viewingContact.preferred === 'cell' && viewingContact.cell && <span className="preferred-badge">Preferred</span>}
                                            </div>
                                        )}
                                        {(isOwnProfile || viewingContact.instagram) && (
                                            <div className={`info-value-plain ${viewingContact.preferred === 'instagram' ? 'preferred' : ''}`}>
                                                {viewingContact.instagram ? (
                                                    <>
                                                        <strong>Instagram: </strong>
                                                        <a
                                                            href={`https://www.instagram.com/${viewingContact.instagram}/`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="contact-link-plain"
                                                        >
                                                            https://www.instagram.com/{viewingContact.instagram}{viewingContact.instagram.endsWith('/') ? '' : '/'}
                                                        </a>
                                                    </>
                                                ) : (
                                                    ''
                                                )}
                                                {viewingContact.preferred === 'instagram' && viewingContact.instagram && <span className="preferred-badge">Preferred</span>}
                                            </div>
                                        )}
                                        {(isOwnProfile || viewingContact.x) && (
                                            <div className={`info-value-plain ${viewingContact.preferred === 'x' ? 'preferred' : ''}`}>
                                                {viewingContact.x ? (
                                                    <>
                                                        <strong>X: </strong>
                                                        <a
                                                            href={`https://x.com/${viewingContact.x}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="contact-link-plain"
                                                        >
                                                                https://x.com/{viewingContact.x}{viewingContact.x.endsWith('/') ? '' : '/'}
                                                        </a>
                                                    </>
                                                ) : (
                                                    ''
                                                )}
                                                {viewingContact.preferred === 'x' && viewingContact.x && <span className="preferred-badge">Preferred</span>}
                                            </div>
                                        )}
                                        {(isOwnProfile || viewingContact.linkedin) && (
                                            <div className={`info-value-plain ${viewingContact.preferred === 'linkedin' ? 'preferred' : ''}`}>
                                                {viewingContact.linkedin ? (
                                                    <>
                                                        <strong>LinkedIn: </strong>
                                                        <a
                                                            href={`https://www.linkedin.com/in/${viewingContact.linkedin}/`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="contact-link-plain"
                                                        >
                                                            https://www.linkedin.com/in/{viewingContact.linkedin}{viewingContact.linkedin.endsWith('/') ? '' : '/'}
                                                        </a>
                                                    </>
                                                ) : (
                                                    ''
                                                )}
                                                {viewingContact.preferred === 'linkedin' && viewingContact.linkedin && <span className="preferred-badge">Preferred</span>}
                                            </div>
                                        )}
                                            {(isOwnProfile || viewingContact.other) && (
                                                <div className={`info-value-plain ${viewingContact.preferred === 'other' ? 'preferred' : ''}`}>
                                                    {viewingContact.other ? (
                                                        <>
                                                            <strong>Other: </strong>

                                                            <a href={viewingContact.other.startsWith('http') ? viewingContact.other : `https://${viewingContact.other}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="contact-link-plain"
                >
                                                            {viewingContact.other}
                                                        </a>
                                                </>
                                            ) : (
                                            ''
        )}
                                            {viewingContact.preferred === 'other' && viewingContact.other && <span className="preferred-badge">Preferred</span>}
                                        </div>
)}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {isOwnProfile && (
                        <>
                            <div className="profile-section-divider"></div>
                            <div className="account-information">
                                <p className="account-info-subtitle">Only visible to you</p>

                                <div className="profile-info">
                                    <div className="info-row">
                                        <label>Email:</label>
                                        <div className={`info-value-plain ${user?.email === currentUserData?.email ? 'current-email' : ''}`}>
                                            {currentUserData?.email}
                                        </div>
                                    </div>

                                    {currentUserData?.emailAlumni && (
                                        <div className="info-row">
                                            <label>Stanford Alumni:</label>
                                            <div className={`info-value-plain ${user?.email === currentUserData?.emailAlumni ? 'current-email' : ''}`}>
                                                {currentUserData.emailAlumni}
                                            </div>
                                        </div>
                                    )}

                                    {currentUserData?.emailAlumniGSB && (
                                        <div className="info-row">
                                            <label>GSB Alumni:</label>
                                            <div className={`info-value-plain ${user?.email === currentUserData?.emailAlumniGSB ? 'current-email' : ''}`}>
                                                {currentUserData.emailAlumniGSB}
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="info-row">
                                        <label>Account Created:</label>
                                        <div className="info-value-plain">
                                            {currentUserData?.createdAt?.toDate?.()?.toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            }) || 'Unknown'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    style={{ display: 'none' }}
                />

                {showCropModal && selectedImage && (
                    <div className="crop-modal-overlay">
                        <div className="crop-modal">
                            <h3>Adjust Your Photo</h3>
                            <p className="crop-instructions">
                                Zoom and drag to position your photo
                            </p>

                            <div
                                className="crop-preview-container"
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                                onTouchStart={handleTouchStart}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                            >
                                <div
                                    ref={previewRef}
                                    className="crop-preview-circle"
                                    style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                                >
                                    <img
                                        ref={imageRef}
                                        src={selectedImage}
                                        alt="Preview"
                                        style={{
                                            transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                                            maxWidth: 'none',
                                            maxHeight: 'none',
                                            userSelect: 'none',
                                            pointerEvents: 'none'
                                        }}
                                        draggable={false}
                                    />
                                </div>
                            </div>

                            <div className="zoom-control">
                                <label>Zoom</label>
                                <input
                                    type="range"
                                    min="1"
                                    max="3"
                                    step="0.1"
                                    value={zoom}
                                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                                    className="zoom-slider"
                                />
                            </div>

                            <div className="crop-modal-actions">
                                <button
                                    onClick={handleCropCancel}
                                    disabled={uploadingPhoto}
                                    className="cancel-btn"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCropConfirm}
                                    disabled={uploadingPhoto}
                                    className="save-btn"
                                >
                                    {uploadingPhoto ? 'Uploading...' : 'Save Photo'}
                                </button>
                            </div>

                            <canvas ref={canvasRef} style={{ display: 'none' }} />
                        </div>
                    </div>
                )}

                {showPhotoModal && (profileData?.customPhotoURL) && (
                    <PhotoModal
                        photoUrl={profileData.customPhotoURL}
                        userName={profileName}
                        onClose={() => setShowPhotoModal(false)}
                    />
                )}
            </div>
        </div>
    );
};

export default Profile;