import { getCollection, type CollectionEntry } from 'astro:content';
import { gameById } from '../data/catalog';
export { readingMinutes, wordCount } from '../data/blog';

/**
 * Helpers for the strategy guides (/blog/). Shared by the hub, the article
 * pages, the homepage, sitemaps, llms.txt and the game pages' guide links.
 */
export type Post = CollectionEntry<'blog'>;
export type PostCategory = Post['data']['category'];

export const BLOG_PATH = '/blog/';
export const POST_CATEGORIES: readonly { id: PostCategory; slug: string; blurb: string }[] = [
  { id: 'Strategy', slug: 'strategy', blurb: 'Plans and tactics that win more games.' },
  { id: 'Rules', slug: 'rules', blurb: 'How the rules work, and how rule sets differ.' },
  { id: 'Tips', slug: 'tips', blurb: 'Quick habits that make every game a little easier.' },
];

export const postPath = (p: Post) => `${BLOG_PATH}${p.id}/`;
export const postUpdated = (p: Post) => p.data.updatedDate ?? p.data.pubDate;

/** Newest first; ties broken by title so the order is stable. */
export async function allPosts(): Promise<Post[]> {
  return (await getCollection('blog')).sort(
    (a, b) => postUpdated(b).getTime() - postUpdated(a).getTime() || a.data.title.localeCompare(b.data.title),
  );
}

/** The game an article sends readers to: the catalog game, or the page named in `play`. */
export function postGame(p: Post) {
  const g = gameById(p.data.relatedGameId);
  return { id: g.id, name: p.data.play?.name ?? g.name, href: p.data.play?.href ?? g.play, icon: g.icon };
}

export const formatDate = (d: Date) =>
  d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
