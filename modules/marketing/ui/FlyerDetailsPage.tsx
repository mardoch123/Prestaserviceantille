import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import { getFlyerById } from '../client';
import type { MktFlyer } from '../types';

const formatPrice = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return `${n.toFixed(2)} €`;
};

const FlyerDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [flyer, setFlyer] = useState<MktFlyer | null>(null);

  const normal = useMemo(() => formatPrice(flyer?.normal_price), [flyer?.normal_price]);
  const promo = useMemo(() => formatPrice(flyer?.promo_price), [flyer?.promo_price]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        setLoading(true);
        const row = await getFlyerById(String(id || ''));
        if (!mounted) return;
        setFlyer(row);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, [id]);

  return (
    <div className="min-h-screen bg-cream-50 font-sans">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>

          <div className="text-right">
            <div className="text-xs text-slate-500">Détails</div>
          </div>
        </div>

        {loading ? (
          <div className="mt-10 flex items-center justify-center gap-2 text-slate-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            Chargement...
          </div>
        ) : null}

        {!loading && !flyer ? (
          <div className="mt-8 bg-white border border-slate-100 rounded-xl p-6 text-center text-slate-700">
            Flyer introuvable.
          </div>
        ) : null}

        {!loading && flyer ? (
          <div className="mt-6 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {flyer.image_url ? (
              <div className="w-full h-64 bg-slate-100 overflow-hidden">
                <img src={flyer.image_url} alt={flyer.title} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-full h-64 bg-gradient-to-br from-brand-blue/10 to-brand-orange/10" />
            )}

            <div className="p-6">
              <h1 className="text-2xl font-extrabold text-slate-800 leading-snug">{flyer.title}</h1>

              {flyer.description ? (
                <p className="mt-3 text-sm text-slate-700 whitespace-pre-wrap">{flyer.description}</p>
              ) : null}

              {(normal || promo) ? (
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  {normal ? (
                    <div className={`text-base font-extrabold ${promo ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                      {normal}
                    </div>
                  ) : null}
                  {promo ? (
                    <div className="text-base font-extrabold text-brand-orange">{promo}</div>
                  ) : null}
                </div>
              ) : null}

              {flyer.observations ? (
                <div className="mt-5 text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-xl p-4">
                  {flyer.observations}
                </div>
              ) : null}

              {flyer.target_url ? (
                <div className="mt-6">
                  <a
                    href={flyer.target_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 bg-brand-blue text-white px-4 py-3 rounded-xl font-extrabold hover:bg-teal-700"
                  >
                    Voir l'offre
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ) : null}

              <div className="mt-4">
                <button
                  onClick={() => navigate(`/flyers/${flyer.id}/request`)}
                  className="w-full bg-brand-orange text-white px-4 py-3 rounded-xl font-extrabold hover:bg-orange-600"
                >
                  Faire une demande
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default FlyerDetailsPage;
