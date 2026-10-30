export interface SectionPartDefinition {
  section: string;
  parts: string[];
}

export const SECTIONS_AND_PARTS: SectionPartDefinition[] = [
  {
    section: '木管',
    parts: ['フルート/ピッコロ', 'オーボエ', 'ファゴット', 'クラリネット', 'バスクラリネット', 'アルトサックス', 'テナーサックス', 'バリトンサックス'],
  },
  {
    section: '金管',
    parts: ['トランペット', 'ホルン', 'トロンボーン', 'ユーフォニアム', 'チューバ'],
  },
  {
    section: '打楽器',
    parts: ['打楽器/パーカッション'],
  },
  {
    section: 'その他',
    parts: ['指揮/指導', 'ピアノ', 'マネージャー', 'その他'],
  },
];

export const ALL_SECTIONS = SECTIONS_AND_PARTS.map((s) => s.section);

export function getPartsForSection(sectionName: string): string[] {
  const found = SECTIONS_AND_PARTS.find((s) => s.section === sectionName);
  return found ? found.parts : [];
}

export function getSectionForPart(partName: string): string {
  for (const s of SECTIONS_AND_PARTS) {
    if (s.parts.includes(partName)) return s.section;
  }
  return 'その他';
}
