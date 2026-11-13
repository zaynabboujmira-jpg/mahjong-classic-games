import type { APIRoute } from 'astro';
import { llmsTxt } from '../lib/llms';

/** Structured site summary for AI answer engines (llmstxt.org convention). */
export const GET: APIRoute = async ({ site }) =>
  new Response(await llmsTxt(site!), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
