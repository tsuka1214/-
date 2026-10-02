export type SectionCategory = '木管' | '金管' | '打楽器';

export const SECTION_CATEGORIES: SectionCategory[] = ['木管', '金管', '打楽器'];

export const SECTION_PARTS_MAP: Record<SectionCategory, string[]> = {
  木管: ['フルート', 'クラリネット', 'バスクラリネット', 'サックス'],
  金管: ['トランペット', 'ホルン', 'トロンボーン', 'ユーフォニアム', 'チューバ'],
  打楽器: ['パーカッション'],
};

export function isValidSectionCategory(val: string): val is SectionCategory {
  return SECTION_CATEGORIES.includes(val as SectionCategory);
}

export function getPartsForSection(section: string): string[] {
  if (isValidSectionCategory(section)) {
    return SECTION_PARTS_MAP[section];
  }
  return [];
}
