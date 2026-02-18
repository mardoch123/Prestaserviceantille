import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ExternalLink, Loader2 } from 'lucide-react';
import DOMPurify from 'dompurify';
import { getFlyerById } from '../client';
import type { MktFlyer } from '../types';
import { useData } from '../../../context/DataContext';
import MarketingPublicShell from './MarketingPublicShell';

const formatPrice = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return `${n.toFixed(2)} €`;
};

const FlyerDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companySettings } = useData();

  const [loading, setLoading] = useState(true);
  const [flyer, setFlyer] = useState<MktFlyer | null>(null);

  const normal = useMemo(() => formatPrice(flyer?.normal_price), [flyer?.normal_price]);
  const promo = useMemo(() => formatPrice(flyer?.promo_price), [flyer?.promo_price]);

  const safeDescriptionHtml = useMemo(() => {
    const raw = String(flyer?.description || '');
    if (!raw.trim()) return '';
    try {
      return DOMPurify.sanitize(raw, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
      });
    } catch {
      return raw;
    }
  }, [flyer?.description]);

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
    <MarketingPublicShell
      title={flyer ? flyer.title : 'Flyer'}
      subtitle="Détails"
      onBack={() => navigate(-1)}
      logoUrl={companySettings?.logoUrl}
      brandName={companySettings?.name}
      maxWidthClassName="max-w-3xl"
    >
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
            <div className="relative w-full bg-slate-100 overflow-hidden h-[28vh] max-h-[260px]">
              <img
                src={flyer.image_url}
                alt={flyer.title}
                className="absolute inset-0 w-full h-full object-cover blur-xl scale-110 opacity-40"
                aria-hidden="true"
              />
              <img src={flyer.image_url} alt={flyer.title} className="relative w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-full bg-gradient-to-br from-brand-blue/10 to-brand-orange/10 h-[28vh] max-h-[260px]" />
          )}

          <div className="p-6">
            {safeDescriptionHtml ? (
              <div
                className="text-sm text-slate-700 prose prose-slate max-w-none"
                dangerouslySetInnerHTML={{ __html: safeDescriptionHtml }}
              />
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
    </MarketingPublicShell>
  );
};

export default FlyerDetailsPage;
