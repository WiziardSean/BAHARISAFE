// src/components/LanguageSelector.tsx
import React from 'react';
import { REGIONAL_LANGUAGES } from '../config/languages';
import { Globe } from 'lucide-react';

interface LanguageSelectorProps {
  currentLang: string;
  onLanguageChange: (langCode: string) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLang,
  onLanguageChange,
}) => {
  return (
    <div className="flex items-center space-x-1 px-2 py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-2xl border border-white/30 shadow text-xs font-bold text-white transition">
      <Globe className="w-3.5 h-3.5 text-sky-200 shrink-0" />
      <select
        value={currentLang}
        onChange={(e) => onLanguageChange(e.target.value)}
        className="bg-transparent text-white text-xs font-extrabold focus:outline-none cursor-pointer [&>option]:bg-slate-900 [&>option]:text-white w-10"
      >
        {REGIONAL_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.code.toUpperCase()} - {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
};