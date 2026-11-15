import { useEffect, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { AppShell } from '../components/AppShell.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch, formatDateShort } from '../lib/api.ts';

const NEWS_CATEGORIES = [
  'All',
  'Artificial Intelligence and Machine Learning',
  'Software Engineering',
  'Cybersecurity',
  'Cloud Computing',
  'Startups and Entrepreneurship',
  'Technology Hiring Trends',
  'Developer Tools',
  'Career Opportunities',
];

interface NewsArticle {
  id: string;
  title: string;
  publisher: string;
  category: string;
  publishedAt: string;
  originalUrl: string;
  rawExcerpt: string;
  aiSummary: string;
  whyItMatters: string;
  relatedSkills: string[];
  fetchedAt: string;
}

export function NewsPage() {
  const { user } = useAuth();
  const [category, setCategory] = useState('All');
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNews = async (cat: string) => {
    setLoading(true);
    try {
      const data = await apiFetch<{ articles: NewsArticle[] }>(
        `/api/news?category=${encodeURIComponent(cat)}&limit=30`
      );
      setArticles(data.articles || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNews(category);
  }, [category]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await apiFetch('/api/news/refresh', { method: 'POST' });
      await loadNews(category);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <AppShell
      title="Industry News Centre"
      subtitle="Verified developer and technology articles paired with clearly labelled AI summaries for students"
      actions={
        user ? (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#4F46E5] rounded-lg hover:bg-[#4338CA] disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Feed'}</span>
          </button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {/* Category Filters (wraps cleanly with zero horizontal browser scrollbar) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-2">
          {NEWS_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                category === cat ? 'bg-[#4F46E5] text-white' : 'bg-[#F4F6FA] text-[#64748B] hover:text-[#14243A]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 bg-white border border-slate-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
            <h3 className="text-base font-semibold text-[#14243A]">No articles in this category yet</h3>
            <p className="text-sm text-[#64748B]">
              Articles are fetched from verified public developer feeds without inventing headlines. Try selecting All categories or refreshing the feed.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {articles.map((art) => (
              <article
                key={art.id}
                className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[#14243A]">{art.publisher}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-[#4F46E5]">{art.category}</span>
                    </div>
                    <time dateTime={art.publishedAt} className="tabular-nums font-mono">
                      {formatDateShort(art.publishedAt)}
                    </time>
                  </div>

                  <h2 className="text-lg font-bold text-[#14243A] leading-snug">{art.title}</h2>

                  {/* Original Source Content */}
                  {art.rawExcerpt && (
                    <div className="bg-[#F4F6FA] border border-slate-200/80 rounded-lg p-3.5 space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                        Original Article Excerpt ({art.publisher})
                      </p>
                      <p className="text-xs text-[#14243A] leading-relaxed">{art.rawExcerpt}</p>
                    </div>
                  )}

                  {/* Distinct AI Summary & Student Relevance */}
                  <div className="pt-3 border-t border-slate-100 space-y-2.5 text-xs leading-relaxed">
                    <div>
                      <p className="font-semibold text-[#4F46E5] mb-0.5">AI-Generated Summary</p>
                      <p className="text-[#14243A]">{art.aiSummary}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-[#0F9D78] mb-0.5">Why It Matters to Students</p>
                      <p className="text-[#64748B]">{art.whyItMatters}</p>
                    </div>
                  </div>

                  {art.relatedSkills.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 text-xs text-[#64748B]">
                      <span className="font-semibold text-[#14243A]">Related Technologies: </span>
                      <span>{art.relatedSkills.join(' · ')}</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
                  <span className="text-[#64748B] truncate">Publisher: {art.publisher}</span>
                  <a
                    href={art.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-semibold text-[#4F46E5] hover:underline whitespace-nowrap shrink-0"
                  >
                    <span>Read Original Article</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
