// src/lib/vamboService.ts

const VAMBO_API_KEY = process.env.VAMBO_API_KEY || '';
const VAMBO_API_URL = 'https://api.vambo.ai/v1';

export const translateAdvisory = async (
  text: string, 
  targetLang: string
): Promise<string> => {
  // Return early if language is default English
  if (targetLang === 'en') return text;

  try {
    const response = await fetch(`${VAMBO_API_URL}/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VAMBO_API_KEY}`,
      },
      body: JSON.stringify({
        text: text,
        target_language: targetLang,
      }),
    });

    if (!response.ok) {
      throw new Error('Vambo AI Translation failed');
    }

    const data = await response.json();
    return data.translatedText || text;
  } catch (error) {
    console.error('Vambo translation error:', error);
    return text; // Safe fallback to original text
  }
};