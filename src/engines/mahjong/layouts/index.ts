import type { Layout } from '../types';
import { turtle } from './turtle';
import { pyramid } from './pyramid';
import { fortress } from './fortress';

export interface LayoutMeta {
  layout: Layout;
  difficulty: 'easy' | 'medium' | 'hard';
  /** One-line hook used in cards and meta descriptions. */
  blurb: string;
}

export const LAYOUTS: Record<string, LayoutMeta> = {
  turtle: {
    layout: turtle,
    difficulty: 'medium',
    blurb: 'The original 144-tile Shanghai layout: five layers, a crown tile and the famous side ears.',
  },
  pyramid: {
    layout: pyramid,
    difficulty: 'easy',
    blurb: 'A stepped 104-tile pyramid with wide open edges. Ideal for learning the rules or a quick game.',
  },
  fortress: {
    layout: fortress,
    difficulty: 'hard',
    blurb: 'A 140-tile walled fort with corner towers and a central keep. Long walls hide tiles deep inside.',
  },
};

export const layoutSlugs = () => Object.keys(LAYOUTS);
export const getLayout = (slug: string) => LAYOUTS[slug];
export const DEFAULT_LAYOUT = 'turtle';
