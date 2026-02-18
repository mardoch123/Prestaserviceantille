import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listActiveFlyers, listActivePromotions } from '../client';
import type { MktFlyer, MktPromotion } from '../types';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useData } from '../../../context/DataContext';

const formatPrice = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return `${n.toFixed(2)} €`;
};

const stripHtml = (value: string) => {
  const v = String(value || '');
  try {
    if (typeof window === 'undefined') return v.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const div = document.createElement('div');
    div.innerHTML = v;
    return String(div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
  } catch {
    return v.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
};

const FlyerCard: React.FC<{ flyer: MktFlyer; onClick: () => void; onRequest: () => void }> = ({ flyer, onClick, onRequest }) => {
  const normal = formatPrice(flyer.normal_price);
  const promo = formatPrice(flyer.promo_price);

  return (
    <div className="w-full text-left bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow">
      {flyer.image_url ? (
        <div className="relative w-full aspect-[3/2] bg-slate-100 overflow-hidden">
          <button onClick={onClick} className="w-full h-full">
            <img
              src={flyer.image_url}
              alt={flyer.title}
              className="absolute inset-0 w-full h-full object-cover blur-xl scale-110 opacity-40"
              aria-hidden="true"
            />
            <img src={flyer.image_url} alt={flyer.title} className="relative w-full h-full object-contain" />
          </button>
        </div>
      ) : (
        <button onClick={onClick} className="w-full aspect-[3/2] bg-gradient-to-br from-brand-blue/10 to-brand-orange/10" />
      )}

      <div className="p-3">
        <div className="flex items-start justify-between gap-3">
          <button onClick={onClick} className="text-left">
            <h3 className="text-lg font-bold text-slate-800 leading-snug">{flyer.title}</h3>
          </button>
          <button
            onClick={onClick}
            className="text-xs font-bold px-2 py-1 rounded-full bg-brand-blue/10 text-brand-blue whitespace-nowrap"
          >
            Voir
          </button>
        </div>

        {flyer.description ? (
          <p className="mt-2 text-sm text-slate-600 line-clamp-2">{stripHtml(flyer.description)}</p>
        ) : null}

        {(normal || promo) ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {normal ? (
              <div className={`text-sm font-bold ${promo ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                {normal}
              </div>
            ) : null}
            {promo ? (
              <div className="text-sm font-extrabold text-brand-orange">{promo}</div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4">
          <button
            onClick={onRequest}
            className="w-full bg-brand-orange text-white px-4 py-2 rounded-xl font-extrabold hover:bg-orange-600"
          >
            Faire une demande
          </button>
        </div>
      </div>
    </div>
  );
};

const PromotionRow: React.FC<{ promo: MktPromotion }> = ({ promo }) => {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-800">{promo.title}</div>
          {promo.description ? <div className="text-xs text-slate-600 mt-1">{promo.description}</div> : null}
        </div>
        {promo.code ? (
          <div className="text-xs font-extrabold px-2 py-1 rounded-lg bg-brand-orange/10 text-brand-orange">
            {promo.code}
          </div>
        ) : null}
      </div>

      {(promo.service_type || promo.pack_code) ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {promo.service_type ? (
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-700">Service: {promo.service_type}</span>
          ) : null}
          {promo.pack_code ? (
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-700">Pack: {promo.pack_code}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const FlyersPromotionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useData();
  const [loading, setLoading] = useState(true);
  const [flyers, setFlyers] = useState<MktFlyer[]>([]);
  const [promotions, setPromotions] = useState<MktPromotion[]>([]);

  const isClientReferrer = useMemo(() => {
    if (currentUser?.role !== 'client') return false;
    try {
      const v = String(localStorage.getItem('mkt_client_is_referrer') || '').trim();
      return v === '1' || v.toLowerCase() === 'true';
    } catch {
      return false;
    }
  }, [currentUser?.role, currentUser?.id]);

  const hasAny = useMemo(() => flyers.length > 0 || promotions.length > 0, [flyers.length, promotions.length]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        setLoading(true);
        const [f, p] = await Promise.all([listActiveFlyers(), listActivePromotions()]);
        if (!mounted) return;
        setFlyers(f);
        setPromotions(p);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-cream-50 font-sans">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>

          <div className="flex items-center gap-2">
            {!isClientReferrer ? (
              <button
                onClick={() => navigate('/parrainage/devenir-parrain')}
                className="hidden sm:inline-flex bg-brand-blue text-white px-3 py-2 rounded-xl font-extrabold hover:bg-teal-700 text-xs"
              >
                Devenir parrain
              </button>
            ) : null}
            <button
              onClick={() => navigate('/parrainage/inscrire-filleul')}
              className="hidden sm:inline-flex bg-brand-orange text-white px-3 py-2 rounded-xl font-extrabold hover:bg-orange-600 text-xs"
            >
              Inscrire un filleul
            </button>
            <button
              onClick={() => navigate('/parrainage/mes-points')}
              className="hidden sm:inline-flex bg-slate-900 text-white px-3 py-2 rounded-xl font-extrabold hover:bg-slate-800 text-xs"
            >
              Mes points
            </button>

            <div className="text-right">
              <h1 className="text-xl font-extrabold text-slate-800">Flyers & Promotions</h1>
              <div className="text-xs text-slate-500">Accès libre</div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="mt-10 flex items-center justify-center gap-2 text-slate-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            Chargement...
          </div>
        ) : null}

        {!loading && !hasAny ? (
          <div className="mt-8 bg-white border border-slate-100 rounded-xl p-6 text-center text-slate-700">
            Aucun flyer ou promotion disponible pour le moment.
          </div>
        ) : null}

        {!loading && flyers.length > 0 ? (
          <section className="mt-6">
            <h2 className="text-sm font-extrabold text-slate-700 mb-3">Flyers</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {flyers.map((flyer) => (
                <FlyerCard
                  key={flyer.id}
                  flyer={flyer}
                  onClick={() => navigate(`/flyers/${flyer.id}`)}
                  onRequest={() => navigate(`/flyers/${flyer.id}/request`)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {!loading && promotions.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-sm font-extrabold text-slate-700 mb-3">Promotions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {promotions.map((promo) => (
                <PromotionRow key={promo.id} promo={promo} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
};

export default FlyersPromotionsPage;
