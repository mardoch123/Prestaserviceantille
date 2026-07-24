import React, { useEffect, useState, useMemo } from 'react';
import { Award, CheckCircle2, AlertTriangle, Clock, Edit3, Trash2, Eye, ExternalLink, RefreshCw, Send, Check, X, Sparkles, AlertCircle, FileText, Search } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';
import { Article } from './Blog';

const AdminArticlesManager: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'published'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Selected article for detailed AI rubric view or editing
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editExcerpt, setEditExcerpt] = useState<string>('');
  const [editContent, setEditContent] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchAdminArticles = async () => {
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
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;

      setArticles(data || []);
    } catch (err: any) {
      console.error('[AdminArticlesManager] Error loading articles:', err);
      setError(err?.message || 'Erreur lors du chargement des articles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminArticles();
  }, []);

  // Filter articles based on tab & search
  const filteredArticles = useMemo(() => {
    return articles.filter((art) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        art.excerpt.toLowerCase().includes(searchQuery.toLowerCase());

      if (activeTab === 'pending') {
        return matchesSearch && art.status === 'draft';
      }
      if (activeTab === 'published') {
        return matchesSearch && art.status === 'published';
      }
      return matchesSearch;
    });
  }, [articles, activeTab, searchQuery]);

  // Count pending articles requiring manual review (score <= 50% or status = draft)
  const pendingCount = useMemo(() => {
    return articles.filter((art) => art.status === 'draft').length;
  }, [articles]);

  const handleOpenEdit = (article: Article) => {
    setSelectedArticle(article);
    setEditTitle(article.title);
    setEditExcerpt(article.excerpt);
    setEditContent(article.content_markdown);
    setEditCategory(article.category || 'Conseils Quotidien');
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedArticle) return;
    setSaving(true);
    setError(null);
    try {
      const { error: updateErr } = await supabase
        .from('articles')
        .update({
          title: editTitle,
          excerpt: editExcerpt,
          content_markdown: editContent,
          category: editCategory,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedArticle.id);

      if (updateErr) throw updateErr;

      setSuccessMessage('Article mis à jour avec succès.');
      setTimeout(() => setSuccessMessage(null), 3000);
      setIsEditing(false);
      fetchAdminArticles();
    } catch (err: any) {
      setError(err?.message || "Erreur lors de la mise à jour de l'article.");
    } finally {
      setSaving(false);
    }
  };

  const handlePublishNow = async (articleId: string) => {
    setSaving(true);
    setError(null);
    try {
      const { error: pubErr } = await supabase
        .from('articles')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', articleId);

      if (pubErr) throw pubErr;

      setSuccessMessage('Article publié sur le blog public avec succès !');
      setTimeout(() => setSuccessMessage(null), 3500);
      if (selectedArticle?.id === articleId) {
        setSelectedArticle((prev) => prev ? { ...prev, status: 'published' } : null);
      }
      fetchAdminArticles();
    } catch (err: any) {
      setError(err?.message || "Erreur lors de la publication de l'article.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (articleId: string) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cet article ?')) return;
    setSaving(true);
    try {
      const { error: delErr } = await supabase
        .from('articles')
        .delete()
        .eq('id', articleId);

      if (delErr) throw delErr;

      setSuccessMessage('Article supprimé.');
      setTimeout(() => setSuccessMessage(null), 3000);
      setSelectedArticle(null);
      fetchAdminArticles();
    } catch (err: any) {
      setError(err?.message || "Erreur lors de la suppression de l'article.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden min-w-0 p-4 md:p-8 space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-beige-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-blue/10 text-brand-blue text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-brand-orange" />
            Administration du Contenu IA & SEO
          </div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-slate-900">
            Gestionnaire des Articles & Barèmes IA
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Supervisez les évaluations SEO de l'IA, validez les articles retenus en révision (Score ≤ 50%) et gérez la publication.
          </p>
        </div>

        <button
          onClick={fetchAdminArticles}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-700 bg-cream-100 hover:bg-cream-200 rounded-xl border border-beige-200 transition-colors shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Rafraîchir
        </button>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs & Search Filter */}
      <div className="bg-white rounded-2xl p-4 border border-beige-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-brand-blue text-white shadow-sm'
                : 'bg-cream-100 text-slate-600 hover:bg-cream-200'
            }`}
          >
            Tous ({articles.length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all relative ${
              activeTab === 'pending'
                ? 'bg-brand-blue text-white shadow-sm'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            À Réviser (≤ 50%)
            {pendingCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('published')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'published'
                ? 'bg-brand-blue text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            Publiés ({articles.filter((a) => a.status === 'published').length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrer par titre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-cream-50 rounded-xl border border-beige-200 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 text-slate-800"
          />
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-16 text-center space-y-3">
          <div className="w-10 h-10 border-3 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-500">Chargement de la liste des articles...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredArticles.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center border border-beige-200 shadow-sm space-y-3">
          <FileText className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">Aucun article trouvé</h3>
          <p className="text-xs text-slate-500">Aucun article ne correspond à vos critères de recherche.</p>
        </div>
      )}

      {/* Articles Table Grid */}
      {!loading && filteredArticles.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {filteredArticles.map((article) => {
            const score = typeof article.seo_score === 'number' ? article.seo_score : 75;
            const isAutoPublished = score > 50 && article.status === 'published';
            const qr = article.quality_report || {};

            return (
              <div
                key={article.id}
                className={`bg-white rounded-2xl p-5 border shadow-sm transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  article.status === 'draft'
                    ? 'border-amber-300 bg-amber-50/20'
                    : 'border-beige-200'
                }`}
              >
                {/* Article Info */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {/* Status Badge */}
                    {article.status === 'published' ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Publié Automatiquement
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 font-bold px-2.5 py-0.5 rounded-full">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        En Révision (Score ≤ 50%)
                      </span>
                    )}

                    <span className="text-slate-400">•</span>
                    <span className="font-semibold text-slate-600">{article.category || 'Conseils Quotidien'}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-400">Généré le {article.generated_date}</span>
                  </div>

                  <h3 className="text-lg font-serif font-bold text-slate-900 leading-snug">
                    {article.title}
                  </h3>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {article.excerpt}
                  </p>
                </div>

                {/* Score Rubric Badge & Actions */}
                <div className="flex items-center gap-4 shrink-0 w-full md:w-auto justify-between md:justify-end pt-3 md:pt-0 border-t md:border-t-0 border-beige-100">
                  {/* AI Score Badge */}
                  <div
                    onClick={() => setSelectedArticle(article)}
                    className="cursor-pointer text-center px-4 py-2 rounded-xl bg-cream-100 hover:bg-cream-200 border border-beige-200 transition-colors"
                    title="Cliquer pour voir le détail du barème IA"
                  >
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Score SEO</div>
                    <div className={`text-lg font-serif font-bold ${score > 50 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {score}%
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedArticle(article)}
                      className="p-2 text-slate-600 hover:text-brand-blue bg-cream-50 hover:bg-cream-100 rounded-xl border border-beige-200 transition-colors"
                      title="Voir le barème et l'aperçu"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleOpenEdit(article)}
                      className="p-2 text-slate-600 hover:text-brand-blue bg-cream-50 hover:bg-cream-100 rounded-xl border border-beige-200 transition-colors"
                      title="Éditer le texte"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {article.status === 'draft' && (
                      <button
                        onClick={() => handlePublishNow(article.id)}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-colors"
                        title="Valider et Publier immédiatement"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Publier
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(article.id)}
                      disabled={saving}
                      className="p-2 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-xl border border-red-100 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Score Rubric Modal */}
      {selectedArticle && !isEditing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6 shadow-2xl border border-beige-200 relative">
            <button
              onClick={() => setSelectedArticle(null)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1 pr-8">
              <span className="text-xs font-bold text-brand-blue bg-brand-blue/10 px-3 py-1 rounded-full">
                Rapport de Barème IA & Qualité
              </span>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900">
                {selectedArticle.title}
              </h2>
            </div>

            {/* Score Overview Jauge */}
            <div className="p-5 rounded-2xl bg-cream-50 border border-beige-200 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-slate-500">Statut de Publication</div>
                <div className="text-base font-serif font-bold text-slate-800 mt-0.5">
                  {selectedArticle.status === 'published'
                    ? 'Publié automatiquement (Score > 50%)'
                    : 'Retenu en Révision (Score ≤ 50%)'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-slate-500">Score Global IA</div>
                <div className={`text-3xl font-serif font-bold ${(selectedArticle.seo_score || 0) > 50 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {selectedArticle.seo_score || 75}%
                </div>
              </div>
            </div>

            {/* Rubric Criteria Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Détail des 4 Critères d'Évaluation (Barème IA)
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-white border border-beige-200">
                  <div className="text-xs text-slate-500">1. Densité Mots-Clés</div>
                  <div className="text-base font-bold text-slate-800 mt-1">
                    {selectedArticle.quality_report?.keyword_density_score ?? 25} / 30 pts
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-beige-200">
                  <div className="text-xs text-slate-500">2. Structure & Titres</div>
                  <div className="text-base font-bold text-slate-800 mt-1">
                    {selectedArticle.quality_report?.structure_score ?? 22} / 25 pts
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-beige-200">
                  <div className="text-xs text-slate-500">3. Pertinence Méta SEO</div>
                  <div className="text-base font-bold text-slate-800 mt-1">
                    {selectedArticle.quality_report?.seo_meta_score ?? 22} / 25 pts
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-beige-200">
                  <div className="text-xs text-slate-500">4. Lisibilité & Conseils</div>
                  <div className="text-base font-bold text-slate-800 mt-1">
                    {selectedArticle.quality_report?.readability_score ?? 16} / 20 pts
                  </div>
                </div>
              </div>
            </div>

            {/* AI Feedback */}
            {selectedArticle.quality_report?.feedback && (
              <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-1">
                <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  Commentaires & Conseils d'amélioration de l'IA :
                </div>
                <p className="text-xs text-amber-800 leading-relaxed italic">
                  "{selectedArticle.quality_report.feedback}"
                </p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-4 border-t border-beige-200 flex items-center justify-end gap-3">
              {selectedArticle.status === 'draft' && (
                <button
                  onClick={() => handlePublishNow(selectedArticle.id)}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Valider & Publier sur le Blog
                </button>
              )}
              <button
                onClick={() => setSelectedArticle(null)}
                className="px-5 py-2.5 text-xs font-bold text-slate-600 bg-cream-100 hover:bg-cream-200 rounded-xl transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditing && selectedArticle && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6 shadow-2xl border border-beige-200 relative">
            <button
              onClick={() => setIsEditing(false)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-serif font-bold text-slate-900">Édition de l'Article</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Titre de l'article</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-cream-50 rounded-xl border border-beige-200 focus:outline-none focus:ring-2 focus:ring-brand-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Catégorie</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-cream-50 rounded-xl border border-beige-200 focus:outline-none focus:ring-2 focus:ring-brand-blue"
                >
                  <option value="Ménage & Repassage">Ménage & Repassage</option>
                  <option value="Bricolage & Jardin">Bricolage & Jardin</option>
                  <option value="Conseils Quotidien">Conseils Quotidien</option>
                  <option value="Martinique & Climat">Martinique & Climat</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Résumé / Extrait</label>
                <textarea
                  rows={3}
                  value={editExcerpt}
                  onChange={(e) => setEditExcerpt(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-cream-50 rounded-xl border border-beige-200 focus:outline-none focus:ring-2 focus:ring-brand-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Contenu (Markdown)</label>
                <textarea
                  rows={10}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-cream-50 rounded-xl border border-beige-200 focus:outline-none focus:ring-2 focus:ring-brand-blue"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-beige-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsEditing(false)}
                className="px-5 py-2.5 text-xs font-bold text-slate-600 bg-cream-100 hover:bg-cream-200 rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-5 py-2.5 text-xs font-bold text-white bg-brand-blue hover:bg-brand-blue/90 rounded-xl shadow-md transition-colors"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminArticlesManager;
