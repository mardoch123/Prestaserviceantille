import React, { useEffect, useState, useMemo } from 'react';
import { Search, Calendar, Clock, ArrowLeft, Share2, Check, BookOpen, Tag, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';

export interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content_markdown: string;
  status: 'draft' | 'published' | 'failed';
  generated_date: string;
  published_at: string;
  keywords: string[];
  seo_title?: string;
  seo_description?: string;
  created_at: string;
}

const Blog: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Fetch published articles
  const fetchArticles = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!isSupabaseConfigured) {
        setArticles([]);
        setLoading(false);
        return;
      }

      const { data, error: fetchErr } = await supabase
        .from('articles')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false });

      if (fetchErr) {
        throw fetchErr;
      }

      setArticles(data || []);
    } catch (err: any) {
      console.error('[Blog] Error fetching articles:', err);
      setError(err?.message || 'Impossible de charger les articles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  // Extract all unique keywords for filter badges
  const allKeywords = useMemo(() => {
    const tags = new Set<string>();
    articles.forEach((art) => {
      if (Array.isArray(art.keywords)) {
        art.keywords.forEach((kw) => tags.add(kw));
      }
    });
    return Array.from(tags);
  }, [articles]);

  // Filter articles based on search query and tag selection
  const filteredArticles = useMemo(() => {
    return articles.filter((art) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        art.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        art.keywords.some((kw) => kw.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesTag =
        !selectedTag || (Array.isArray(art.keywords) && art.keywords.includes(selectedTag));

      return matchesSearch && matchesTag;
    });
  }, [articles, searchQuery, selectedTag]);

  // Estimate reading time in minutes
  const getReadingTime = (text: string): number => {
    const words = text ? text.split(/\s+/).length : 0;
    return Math.max(1, Math.ceil(words / 200));
  };

  // Format date cleanly in French
  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Convert basic Markdown elements to clean JSX
  const renderMarkdown = (markdownText: string) => {
    if (!markdownText) return null;

    const lines = markdownText.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();

      if (trimmed.startsWith('# ')) {
        return (
          <h1 key={idx} className="text-2xl md:text-3xl font-serif font-bold text-slate-900 mt-6 mb-4 pb-2 border-b border-beige-200">
            {trimmed.replace('# ', '')}
          </h1>
        );
      }
      if (trimmed.startsWith('## ')) {
        return (
          <h2 key={idx} className="text-xl md:text-2xl font-serif font-bold text-brand-blue mt-6 mb-3">
            {trimmed.replace('## ', '')}
          </h2>
        );
      }
      if (trimmed.startsWith('### ')) {
        return (
          <h3 key={idx} className="text-lg font-serif font-bold text-slate-800 mt-5 mb-2">
            {trimmed.replace('### ', '')}
          </h3>
        );
      }
      if (trimmed.startsWith('---')) {
        return <hr key={idx} className="my-6 border-t border-beige-200" />;
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const content = trimmed.substring(2);
        return (
          <li key={idx} className="ml-6 list-disc text-slate-700 my-1 leading-relaxed">
            {renderInlineMarkdown(content)}
          </li>
        );
      }
      if (trimmed === '') {
        return <div key={idx} className="h-3" />;
      }

      return (
        <p key={idx} className="text-slate-700 text-base leading-relaxed my-3">
          {renderInlineMarkdown(line)}
        </p>
      );
    });
  };

  const renderInlineMarkdown = (text: string) => {
    // Basic bold replacement **bold**
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  // Article Reader View
  if (selectedArticle) {
    return (
      <div className="h-full overflow-y-auto bg-cream-50/50 p-4 md:p-8">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-beige-200 p-6 md:p-10">
          {/* Navigation Bar */}
          <div className="flex items-center justify-between pb-6 mb-6 border-b border-beige-200">
            <button
              onClick={() => setSelectedArticle(null)}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-brand-blue transition-colors px-3 py-1.5 rounded-lg hover:bg-cream-100"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour aux articles
            </button>
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 bg-cream-50 hover:bg-cream-100 border border-beige-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
              {copied ? 'Lien copié' : 'Partager'}
            </button>
          </div>

          {/* Article Header */}
          <div className="mb-8">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mb-3">
              <span className="inline-flex items-center gap-1 bg-cream-100 text-brand-blue px-2.5 py-1 rounded-full font-medium">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(selectedArticle.published_at || selectedArticle.created_at)}
              </span>
              <span className="inline-flex items-center gap-1 text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                {getReadingTime(selectedArticle.content_markdown)} min de lecture
              </span>
            </div>

            <h1 className="text-2xl md:text-4xl font-serif font-bold text-slate-900 leading-tight mb-4">
              {selectedArticle.title}
            </h1>

            <p className="text-lg text-slate-600 leading-relaxed font-sans italic border-l-4 border-brand-orange/40 pl-4 py-1 bg-amber-50/30 rounded-r-lg">
              {selectedArticle.excerpt}
            </p>
          </div>

          {/* Article Content */}
          <article className="prose prose-slate max-w-none font-sans">
            {renderMarkdown(selectedArticle.content_markdown)}
          </article>

          {/* Keywords Footer */}
          {Array.isArray(selectedArticle.keywords) && selectedArticle.keywords.length > 0 && (
            <div className="mt-10 pt-6 border-t border-beige-200">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 mr-2 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" /> Mots-clés :
                </span>
                {selectedArticle.keywords.map((kw, i) => (
                  <span
                    key={i}
                    className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 font-medium"
                  >
                    #{kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Author Badge */}
          <div className="mt-8 p-4 rounded-xl bg-cream-100/60 border border-beige-200 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-brand-blue/10 flex items-center justify-center text-brand-blue font-bold text-sm shrink-0">
              PSA
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Presta Services Antilles</p>
              <p className="text-xs text-slate-500">Conseils d'experts & services à domicile en Martinique.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Articles Grid List View
  return (
    <div className="h-full overflow-y-auto bg-cream-50/50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Banner / Header */}
        <div className="bg-white rounded-2xl p-6 md:p-8 border border-beige-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-brand-blue/5 rounded-full blur-3xl -z-0 pointer-events-none transform translate-x-1/3 -translate-y-1/3" />
          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-blue/10 text-brand-blue text-xs font-semibold">
              <BookOpen className="w-3.5 h-3.5" />
              Actualités & Conseils Pratiques
            </div>
            <h1 className="text-2xl md:text-4xl font-serif font-bold text-slate-900">
              Votre Guide du Quotidien en Martinique
            </h1>
            <p className="text-sm md:text-base text-slate-600 leading-relaxed">
              Découvrez nos articles et recommandations rédigés pour vous accompagner dans l’entretien de votre domicile, l'organisation et votre sérénité.
            </p>
          </div>
        </div>

        {/* Search & Filter Section */}
        <div className="bg-white rounded-xl p-4 border border-beige-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher un article, un sujet, un conseil..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-cream-50/50 rounded-lg border border-beige-200 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue text-slate-800 placeholder-slate-400"
              />
            </div>
            <button
              onClick={fetchArticles}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-slate-700 bg-cream-100 hover:bg-cream-200 rounded-lg border border-beige-200 transition-colors shrink-0"
              title="Rafraîchir"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          </div>

          {/* Keyword Badges */}
          {allKeywords.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-beige-100">
              <span className="text-xs font-semibold text-slate-400 mr-1">Thématiques :</span>
              <button
                onClick={() => setSelectedTag(null)}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                  selectedTag === null
                    ? 'bg-brand-blue text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tous
              </button>
              {allKeywords.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                    selectedTag === tag
                      ? 'bg-brand-blue text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-16 text-center space-y-3">
            <div className="w-10 h-10 border-3 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-medium text-slate-500">Chargement des articles...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center text-sm text-red-700 flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredArticles.length === 0 && (
          <div className="bg-white rounded-2xl p-12 text-center border border-beige-200 shadow-sm space-y-4">
            <div className="w-16 h-16 bg-cream-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <BookOpen className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-serif font-bold text-slate-800">Aucun article disponible</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {searchQuery || selectedTag
                ? "Aucun article ne correspond à votre recherche. Essayez avec d'autres mots-clés."
                : "Les prochains articles rédigés par notre équipe et l'IA seront disponibles sous peu."}
            </p>
          </div>
        )}

        {/* Articles Grid */}
        {!loading && !error && filteredArticles.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArticles.map((article) => (
              <article
                key={article.id}
                onClick={() => setSelectedArticle(article)}
                className="bg-white rounded-2xl border border-beige-200 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col overflow-hidden group cursor-pointer hover:-translate-y-0.5"
              >
                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatDate(article.published_at || article.created_at)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {getReadingTime(article.content_markdown)} min
                      </span>
                    </div>

                    <h2 className="text-xl font-serif font-bold text-slate-900 group-hover:text-brand-blue transition-colors line-clamp-2">
                      {article.title}
                    </h2>

                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
                      {article.excerpt}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-beige-100 flex items-center justify-between mt-auto">
                    {Array.isArray(article.keywords) && article.keywords.length > 0 ? (
                      <span className="text-xs px-2.5 py-1 bg-cream-100 text-brand-blue rounded-md font-medium">
                        {article.keywords[0]}
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="text-xs font-bold text-brand-blue group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                      Lire l'article &rarr;
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Blog;
