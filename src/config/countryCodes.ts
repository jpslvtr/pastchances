export interface CountryCode {
    code: string;
    country: string;
    format: (digits: string) => string;
    minDigits: number;
    maxDigits: number;
}

export const COUNTRY_CODES: CountryCode[] = [
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
