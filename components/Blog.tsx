import React, { useEffect, useState, useMemo } from 'react';
import { Search, Calendar, Clock, ArrowLeft, Share2, Check, BookOpen, Tag, AlertCircle, RefreshCw, ChevronRight, Phone, Mail, Sparkles } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';
import { useData } from '../context/DataContext';

export interface QualityReport {
  keyword_density_score?: number;
  structure_score?: number;
  seo_meta_score?: number;
  readability_score?: number;
  feedback?: string;
}

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
  category?: string;
  image_url?: string;
  seo_score?: number;
  quality_report?: QualityReport;
  seo_title?: string;
  seo_description?: string;
  created_at: string;
}

// High Quality Royalty-Free Pexels Images
const CATEGORY_DEFAULT_IMAGES: Record<string, string> = {
  'Ménage & Repassage': 'https://images.pexels.com/photos/4099467/pexels-photo-4099467.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'Bricolage & Jardin': 'https://images.pexels.com/photos/4503273/pexels-photo-4503273.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'Conseils Quotidien': 'https://images.pexels.com/photos/4239146/pexels-photo-4239146.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'Martinique & Climat': 'https://images.pexels.com/photos/1005417/pexels-photo-1005417.jpeg?auto=compress&cs=tinysrgb&w=1200',
};

const CATEGORIES = [
  'Toutes',
  'Ménage & Repassage',
  'Bricolage & Jardin',
  'Conseils Quotidien',
  'Martinique & Climat',
];

const Blog: React.FC = () => {
  const { currentUser } = useData();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Toutes');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const isPublicPage = !currentUser;

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

      if (fetchErr) throw fetchErr;
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

  // Filter articles based on search query and category
  const filteredArticles = useMemo(() => {
    return articles.filter((art) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        art.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (Array.isArray(art.keywords) && art.keywords.some((kw) => kw.toLowerCase().includes(searchQuery.toLowerCase())));

      const matchesCategory =
        selectedCategory === 'Toutes' || art.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [articles, searchQuery, selectedCategory]);

  const featuredArticle = useMemo(() => {
    return filteredArticles.length > 0 ? filteredArticles[0] : null;
  }, [filteredArticles]);

  const regularArticles = useMemo(() => {
    return filteredArticles.length > 1 ? filteredArticles.slice(1) : filteredArticles;
  }, [filteredArticles]);

  const getReadingTime = (text: string): number => {
    const words = text ? text.split(/\s+/).length : 0;
    return Math.max(1, Math.ceil(words / 200));
  };

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

  const getArticleImage = (art: Article): string => {
    if (art.image_url && art.image_url.startsWith('http')) {
      return art.image_url;
    }
    const cat = art.category || 'Conseils Quotidien';
    return CATEGORY_DEFAULT_IMAGES[cat] || CATEGORY_DEFAULT_IMAGES['Conseils Quotidien'];
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const renderMarkdown = (markdownText: string) => {
    if (!markdownText) return null;

    const lines = markdownText.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();

      if (trimmed.startsWith('# ')) {
        return (
          <h1 key={idx} className="text-2xl md:text-3xl font-serif font-bold text-slate-900 mt-8 mb-4 pb-2 border-b border-beige-200">
            {trimmed.replace('# ', '')}
          </h1>
        );
      }
      if (trimmed.startsWith('## ')) {
        return (
          <h2 key={idx} className="text-xl md:text-2xl font-serif font-bold text-brand-blue mt-8 mb-3">
            {trimmed.replace('## ', '')}
          </h2>
        );
      }
      if (trimmed.startsWith('### ')) {
        return (
          <h3 key={idx} className="text-lg font-serif font-bold text-slate-800 mt-6 mb-2">
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
          <li key={idx} className="ml-6 list-disc text-slate-700 my-1.5 leading-relaxed">
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

  const renderPublicHeader = () => (
    <header className="bg-white border-b border-beige-200 shadow-sm sticky top-0 z-30 shrink-0">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="https://anciens.prestaservicesantilles.com/images/logo.png"
            alt="Presta Services Antilles"
            className="h-10 sm:h-12 w-auto object-contain"
          />
          <div>
            <span className="text-sm sm:text-lg font-serif font-bold text-slate-900 block leading-tight">
              Presta Services Antilles
            </span>
            <span className="text-[11px] sm:text-xs text-slate-500 font-sans block">
              Actualités & Blog d'Expertise en Martinique
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href="tel:+596696000000"
            className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-blue text-white text-xs font-bold hover:bg-brand-blue/90 transition-colors shadow-sm"
          >
            <Phone className="w-3.5 h-3.5" />
            Nous contacter
          </a>
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cream-100 text-slate-700 text-xs font-bold hover:bg-cream-200 transition-colors border border-beige-200 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Lien copié !' : 'Partager'}</span>
          </button>
        </div>
      </div>
    </header>
  );

  const renderPublicFooter = () => (
    <footer className="mt-12 bg-white border-t border-beige-200 py-8 shrink-0">
      <div className="max-w-6xl mx-auto px-4 text-center space-y-3">
        <div className="flex items-center justify-center gap-2.5">
          <img
            src="https://anciens.prestaservicesantilles.com/images/logo.png"
            alt="Presta Services Antilles"
            className="h-8 w-auto object-contain opacity-90"
          />
          <span className="font-serif font-bold text-slate-800 text-base">Presta Services Antilles</span>
        </div>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          Services professionnels à domicile en Martinique : Ménage, Repassage, Bricolage et Jardinage.
        </p>
        <div className="flex items-center justify-center gap-4 text-xs font-semibold text-brand-blue pt-1">
          <a href="tel:+596696000000" className="hover:underline flex items-center gap-1">
            <Phone className="w-3.5 h-3.5" /> Appeler
          </a>
          <span>•</span>
          <a href="mailto:contact@prestaservicesantilles.com" className="hover:underline flex items-center gap-1">
            <Mail className="w-3.5 h-3.5" /> Écrire
          </a>
        </div>
        <p className="text-[11px] text-slate-400 pt-2">
          © {new Date().getFullYear()} Presta Services Antilles — Tous droits réservés.
        </p>
      </div>
    </footer>
  );

  return (
    <div className={`w-full max-w-full overflow-x-hidden flex flex-col font-sans ${isPublicPage ? 'min-h-screen' : 'min-h-full'}`}>
      {isPublicPage && renderPublicHeader()}

      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full space-y-6 md:space-y-8 min-w-0">
        
        {/* Header Hero Banner */}
        <div className="bg-white rounded-3xl p-6 md:p-10 border border-beige-200 shadow-sm relative overflow-hidden w-full max-w-full">
          <div className="absolute top-0 right-0 w-80 h-80 bg-brand-orange/5 rounded-full blur-3xl -z-0 pointer-events-none transform translate-x-1/3 -translate-y-1/3" />
          <div className="relative z-10 max-w-3xl space-y-3 sm:space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-brand-blue/10 text-brand-blue text-xs font-bold">
              <BookOpen className="w-4 h-4 text-brand-blue shrink-0" />
              <span>Blog Officiel & Recommandations d'Experts</span>
            </div>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-serif font-bold text-slate-900 leading-tight">
              Conseils & Astuces pour Votre Maison en Martinique
            </h1>
            <p className="text-xs sm:text-base text-slate-600 leading-relaxed">
              Découvrez nos guides pratiques rédigés pour vous aider à préserver votre logement, entretenir votre intérieur et simplifier votre quotidien.
            </p>
          </div>
        </div>

        {/* Search Bar & Category Filter Bar */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-beige-200 shadow-sm space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher une astuce, un mot-clé ou un sujet..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-cream-50/50 rounded-xl border border-beige-200 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue text-slate-800 placeholder-slate-400"
              />
            </div>
            <button
              onClick={fetchArticles}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-cream-100 hover:bg-cream-200 rounded-xl border border-beige-200 transition-colors shrink-0 w-full sm:w-auto cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          </div>

          {/* Horizontally Scrollable Category Pills Bar */}
          <div className="w-full max-w-full overflow-hidden pt-2 border-t border-beige-100">
            <div className="w-full overflow-x-auto scrollbar-none flex items-center gap-2 py-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-xs px-3.5 py-1.5 rounded-full font-bold transition-all shrink-0 cursor-pointer whitespace-nowrap ${
                    selectedCategory === cat
                      ? 'bg-brand-blue text-white shadow-sm'
                      : 'bg-cream-100 text-slate-600 hover:bg-cream-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="py-20 text-center space-y-3">
            <div className="w-10 h-10 border-3 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-medium text-slate-500">Chargement des articles du blog...</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center text-sm text-red-700 flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredArticles.length === 0 && (
          <div className="bg-white rounded-3xl p-10 sm:p-14 text-center border border-beige-200 shadow-sm space-y-4">
            <div className="w-16 h-16 bg-cream-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <BookOpen className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-serif font-bold text-slate-800">Aucun article trouvé</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Aucun article ne correspond à votre recherche ou catégorie sélectionnée.
            </p>
          </div>
        )}

        {/* Articles Grid Section */}
        {!loading && !error && filteredArticles.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArticles.map((article) => (
              <article
                key={article.id}
                onClick={() => setSelectedArticle(article)}
                className="bg-white rounded-3xl border border-beige-200 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col overflow-hidden group cursor-pointer hover:-translate-y-0.5"
              >
                <div className="h-48 w-full overflow-hidden bg-slate-900 relative">
                  <img
                    src={getArticleImage(article)}
                    alt={article.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3">
                    <span className="bg-white/90 backdrop-blur-md text-brand-blue text-[11px] px-2.5 py-1 rounded-full font-bold shadow-sm">
                      {article.category || 'Conseils Quotidien'}
                    </span>
                  </div>
                </div>

                <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-4">
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

                    <h3 className="text-base sm:text-lg font-serif font-bold text-slate-900 group-hover:text-brand-blue transition-colors line-clamp-2">
                      {article.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-3">
                      {article.excerpt}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-beige-100 flex items-center justify-between mt-auto">
                    <span className="text-xs font-bold text-brand-blue group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                      Lire l'article &rarr;
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {isPublicPage && renderPublicFooter()}

      {/* Reader Modal View with Smooth Vertical Scrolling */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md overflow-y-auto flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-beige-200 space-y-0 relative">
            
            {/* Modal Header Cover */}
            <div className="relative h-64 md:h-96 w-full overflow-hidden bg-slate-900 shrink-0">
              <img
                src={getArticleImage(selectedArticle)}
                alt={selectedArticle.title}
                className="w-full h-full object-cover opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/30 to-transparent" />
              
              {/* Back & Share buttons */}
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 bg-white/90 hover:bg-white backdrop-blur-md px-4 py-2 rounded-full shadow-md transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour au Blog
                </button>
                <button
                  onClick={handleShare}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 bg-white/90 hover:bg-white backdrop-blur-md px-4 py-2 rounded-full shadow-md transition-all cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
                  {copied ? 'Lien copié' : 'Partager'}
                </button>
              </div>

              {/* Title & Metadata Overlaid */}
              <div className="absolute bottom-6 left-6 right-6 z-10 text-white">
                <div className="flex flex-wrap items-center gap-2.5 mb-2 text-xs">
                  <span className="bg-brand-orange text-white px-3 py-1 rounded-full font-bold shadow-sm">
                    {selectedArticle.category || 'Conseils Quotidien'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-slate-200">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(selectedArticle.published_at || selectedArticle.created_at)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-slate-200">
                    <Clock className="w-3.5 h-3.5" />
                    {getReadingTime(selectedArticle.content_markdown)} min de lecture
                  </span>
                </div>
                <h1 className="text-xl sm:text-3xl md:text-4xl font-serif font-bold text-white leading-tight">
                  {selectedArticle.title}
                </h1>
              </div>
            </div>

            {/* Scrollable Article Text */}
            <div className="p-6 md:p-10 space-y-6 sm:space-y-8">
              <p className="text-base sm:text-lg text-slate-700 leading-relaxed font-sans italic border-l-4 border-brand-orange pl-4 py-2 bg-amber-50/30 rounded-r-xl">
                {selectedArticle.excerpt}
              </p>

              <article className="prose prose-slate max-w-none font-sans text-sm sm:text-base">
                {renderMarkdown(selectedArticle.content_markdown)}
              </article>

              {/* Keywords */}
              {Array.isArray(selectedArticle.keywords) && selectedArticle.keywords.length > 0 && (
                <div className="pt-6 border-t border-beige-200">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400 mr-2 flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5" /> Mots-clés :
                    </span>
                    {selectedArticle.keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="text-xs px-3 py-1 rounded-full bg-cream-100 text-brand-blue font-medium"
                      >
                        #{kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Author Footer */}
              <div className="p-5 rounded-2xl bg-cream-100/70 border border-beige-200 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-brand-blue text-white font-bold flex items-center justify-center text-sm shrink-0 shadow-sm">
                  PSA
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Presta Services Antilles</p>
                  <p className="text-xs text-slate-600">Vos spécialistes des services à domicile en Martinique (Ménage, Repassage, Bricolage, Jardinage).</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Blog;
