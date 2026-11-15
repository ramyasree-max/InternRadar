import crypto from 'crypto';
import { getDbStore } from '../db.ts';
import { summarizeNewsArticleWithAI } from './gemini.ts';

interface DevToArticle {
  id: number;
  title: string;
  description: string;
  url: string;
  published_at: string;
  tag_list: string[];
  user?: { name?: string };
  organization?: { name?: string };
}

function mapTagsToCategory(tags: string[], title: string): string {
  const text = `${tags.join(' ')} ${title}`.toLowerCase();
  if (/\b(ai|ml|machinelearning|llm|genai|datascience)\b/.test(text)) return 'Artificial Intelligence and Machine Learning';
  if (/\b(security|cybersecurity|infosec|auth)\b/.test(text)) return 'Cybersecurity';
  if (/\b(cloud|aws|kubernetes|docker|devops|azure|gcp)\b/.test(text)) return 'Cloud Computing';
  if (/\b(startup|founder|entrepreneur|funding)\b/.test(text)) return 'Startups and Entrepreneurship';
  if (/\b(hiring|career|interview|internship|jobs|resume)\b/.test(text)) return 'Career Opportunities';
  if (/\b(tools|cli|vscode|git|vite|typescript|productivity)\b/.test(text)) return 'Developer Tools';
  return 'Software Engineering';
}

export async function refreshIndustryNews(): Promise<{ fetched: number; error?: string }> {
  const store = getDbStore();
  const endpoints = [
    'https://dev.to/api/articles?tag=career&per_page=2',
    'https://dev.to/api/articles?tag=ai&per_page=2',
    'https://dev.to/api/articles?tag=webdev&per_page=2',
    'https://dev.to/api/articles?tag=devops&per_page=2',
  ];

  let inserted = 0;
  const nowIso = new Date().toISOString();

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'InternRadarNews/1.0' },
      });
      clearTimeout(timer);

      if (!res.ok) continue;
      const articles = (await res.json()) as DevToArticle[];
      if (!Array.isArray(articles)) continue;

      for (const art of articles) {
        if (!art.title || !art.url || !art.published_at) continue;
        const extId = `devto_${art.id}`;
        const existing = await store.hasIndustryNewsByExternalId(extId);
        if (existing) continue;

        const publisher = art.organization?.name
          ? `${art.organization.name} (via DEV)`
          : art.user?.name
            ? `${art.user.name} (DEV Community)`
            : 'DEV Community';
        const excerpt = (art.description || art.title).trim();
        const tags = Array.isArray(art.tag_list) ? art.tag_list : [];
        const category = mapTagsToCategory(tags, art.title);

        const ai = await summarizeNewsArticleWithAI(art.title, publisher, excerpt);

        await store.insertIndustryNewsIfNew({
          id: `news_${crypto.randomUUID()}`,
          external_id: extId,
          title: art.title.trim(),
          publisher,
          category,
          published_at: new Date(art.published_at).toISOString(),
          original_url: art.url,
          raw_excerpt: excerpt,
          ai_summary: ai.aiSummary,
          why_it_matters: ai.whyItMatters,
          related_skills_json: JSON.stringify(ai.relatedSkills),
          fetched_at: nowIso,
          is_demo: 0,
        });
        inserted++;
      }
    } catch (err) {
      console.warn('News feed fetch skipped:', err instanceof Error ? err.message : err);
    }
  }

  return { fetched: inserted };
}
