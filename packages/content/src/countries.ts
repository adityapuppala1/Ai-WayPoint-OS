import type { CountryProfile } from './types';

/**
 * Countries with curated support data. Order: roughly by population within region.
 *
 * `languages` lists the languages people most often use with public services (BCP-47,
 * most common first). `region` follows World Bank-style groupings, split further for Asia
 * and Oceania; it is used only to pick sensible defaults and is not a political statement.
 */
export const COUNTRIES: CountryProfile[] = [
  // South Asia
  {
    code: 'IN',
    name: 'India',
    languages: ['hi', 'en', 'bn', 'mr', 'te', 'ta', 'gu', 'ur', 'kn', 'or', 'ml', 'pa'],
    currency: 'INR',
    region: 'south-asia',
  },
  {
    code: 'PK',
    name: 'Pakistan',
    languages: ['ur', 'en', 'pa', 'ps', 'sd'],
    currency: 'PKR',
    region: 'south-asia',
  },
  {
    code: 'BD',
    name: 'Bangladesh',
    languages: ['bn', 'en'],
    currency: 'BDT',
    region: 'south-asia',
  },
  { code: 'NP', name: 'Nepal', languages: ['ne', 'en'], currency: 'NPR', region: 'south-asia' },
  {
    code: 'LK',
    name: 'Sri Lanka',
    languages: ['si', 'ta', 'en'],
    currency: 'LKR',
    region: 'south-asia',
  },

  // Southeast Asia
  { code: 'ID', name: 'Indonesia', languages: ['id'], currency: 'IDR', region: 'southeast-asia' },
  {
    code: 'PH',
    name: 'Philippines',
    languages: ['fil', 'en'],
    currency: 'PHP',
    region: 'southeast-asia',
  },
  { code: 'VN', name: 'Vietnam', languages: ['vi'], currency: 'VND', region: 'southeast-asia' },
  { code: 'TH', name: 'Thailand', languages: ['th'], currency: 'THB', region: 'southeast-asia' },
  {
    code: 'MY',
    name: 'Malaysia',
    languages: ['ms', 'en', 'zh', 'ta'],
    currency: 'MYR',
    region: 'southeast-asia',
  },
  {
    code: 'SG',
    name: 'Singapore',
    languages: ['en', 'zh', 'ms', 'ta'],
    currency: 'SGD',
    region: 'southeast-asia',
  },

  // East Asia
  { code: 'CN', name: 'China', languages: ['zh'], currency: 'CNY', region: 'east-asia' },
  { code: 'JP', name: 'Japan', languages: ['ja'], currency: 'JPY', region: 'east-asia' },
  { code: 'KR', name: 'South Korea', languages: ['ko'], currency: 'KRW', region: 'east-asia' },

  // Middle East & North Africa
  {
    code: 'EG',
    name: 'Egypt',
    languages: ['ar'],
    currency: 'EGP',
    region: 'middle-east-north-africa',
  },
  {
    code: 'MA',
    name: 'Morocco',
    languages: ['ar', 'fr', 'zgh'],
    currency: 'MAD',
    region: 'middle-east-north-africa',
  },
  {
    code: 'SA',
    name: 'Saudi Arabia',
    languages: ['ar', 'en'],
    currency: 'SAR',
    region: 'middle-east-north-africa',
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    languages: ['ar', 'en'],
    currency: 'AED',
    region: 'middle-east-north-africa',
  },

  // Sub-Saharan Africa
  {
    code: 'NG',
    name: 'Nigeria',
    languages: ['en', 'ha', 'yo', 'ig', 'pcm'],
    currency: 'NGN',
    region: 'sub-saharan-africa',
  },
  {
    code: 'ET',
    name: 'Ethiopia',
    languages: ['am', 'om', 'ti', 'so'],
    currency: 'ETB',
    region: 'sub-saharan-africa',
  },
  {
    code: 'TZ',
    name: 'Tanzania',
    languages: ['sw', 'en'],
    currency: 'TZS',
    region: 'sub-saharan-africa',
  },
  {
    code: 'ZA',
    name: 'South Africa',
    languages: ['en', 'zu', 'xh', 'af', 'nso', 'tn', 'st'],
    currency: 'ZAR',
    region: 'sub-saharan-africa',
  },
  {
    code: 'KE',
    name: 'Kenya',
    languages: ['en', 'sw'],
    currency: 'KES',
    region: 'sub-saharan-africa',
  },
  {
    code: 'UG',
    name: 'Uganda',
    languages: ['en', 'sw', 'lg'],
    currency: 'UGX',
    region: 'sub-saharan-africa',
  },
  {
    code: 'GH',
    name: 'Ghana',
    languages: ['en', 'ak'],
    currency: 'GHS',
    region: 'sub-saharan-africa',
  },
  {
    code: 'RW',
    name: 'Rwanda',
    languages: ['rw', 'en', 'fr', 'sw'],
    currency: 'RWF',
    region: 'sub-saharan-africa',
  },

  // Europe (Türkiye grouped with Europe, as in the World Bank's Europe & Central Asia region)
  { code: 'TR', name: 'Türkiye', languages: ['tr'], currency: 'TRY', region: 'europe' },
  { code: 'DE', name: 'Germany', languages: ['de'], currency: 'EUR', region: 'europe' },
  {
    code: 'GB',
    name: 'United Kingdom',
    languages: ['en', 'cy'],
    currency: 'GBP',
    region: 'europe',
  },
  { code: 'FR', name: 'France', languages: ['fr'], currency: 'EUR', region: 'europe' },
  { code: 'IT', name: 'Italy', languages: ['it'], currency: 'EUR', region: 'europe' },
  {
    code: 'ES',
    name: 'Spain',
    languages: ['es', 'ca', 'gl', 'eu'],
    currency: 'EUR',
    region: 'europe',
  },
  { code: 'PL', name: 'Poland', languages: ['pl'], currency: 'PLN', region: 'europe' },
  { code: 'NL', name: 'Netherlands', languages: ['nl'], currency: 'EUR', region: 'europe' },
  { code: 'SE', name: 'Sweden', languages: ['sv'], currency: 'SEK', region: 'europe' },
  { code: 'IE', name: 'Ireland', languages: ['en', 'ga'], currency: 'EUR', region: 'europe' },
  { code: 'PT', name: 'Portugal', languages: ['pt'], currency: 'EUR', region: 'europe' },
  { code: 'UA', name: 'Ukraine', languages: ['uk'], currency: 'UAH', region: 'europe' },

  // North America
  {
    code: 'US',
    name: 'United States',
    languages: ['en', 'es'],
    currency: 'USD',
    region: 'north-america',
  },
  { code: 'CA', name: 'Canada', languages: ['en', 'fr'], currency: 'CAD', region: 'north-america' },

  // Latin America & Caribbean
  {
    code: 'BR',
    name: 'Brazil',
    languages: ['pt-BR'],
    currency: 'BRL',
    region: 'latin-america-caribbean',
  },
  {
    code: 'MX',
    name: 'Mexico',
    languages: ['es'],
    currency: 'MXN',
    region: 'latin-america-caribbean',
  },
  {
    code: 'CO',
    name: 'Colombia',
    languages: ['es'],
    currency: 'COP',
    region: 'latin-america-caribbean',
  },
  {
    code: 'AR',
    name: 'Argentina',
    languages: ['es'],
    currency: 'ARS',
    region: 'latin-america-caribbean',
  },
  {
    code: 'PE',
    name: 'Peru',
    languages: ['es', 'qu'],
    currency: 'PEN',
    region: 'latin-america-caribbean',
  },
  {
    code: 'CL',
    name: 'Chile',
    languages: ['es'],
    currency: 'CLP',
    region: 'latin-america-caribbean',
  },

  // Oceania
  { code: 'AU', name: 'Australia', languages: ['en'], currency: 'AUD', region: 'oceania' },
  { code: 'NZ', name: 'New Zealand', languages: ['en', 'mi'], currency: 'NZD', region: 'oceania' },
];
