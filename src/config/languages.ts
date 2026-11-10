// src/config/languages.ts

export interface LanguageOption {
  code: string;
  name: string;
  region: string;
}

export const REGIONAL_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', region: 'General' },
  { code: 'sw', name: 'Kiswahili', region: 'East Africa / Coast & Lakes' },
  { code: 'luo', name: 'Dholuo', region: 'Lake Victoria' },
  { code: 'tur', name: 'Turkana', region: 'Lake Turkana' },
  { code: 'gir', name: 'Giriama / Mijikenda', region: 'Indian Ocean Coast' },
];