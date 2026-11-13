import type { APIRoute } from 'astro';
import { llmsFullTxt } from '../lib/llms';

/** Every page's facts, how-to steps and FAQ in one plain-text file for AI answer engines. */
export const GET: APIRoute = async ({ site }) =>
  new Response(await llmsFullTxt(site!), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
