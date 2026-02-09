import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { listActiveFlyers } from '../client';
import type { MktFlyer } from '../types';

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
};

const formatPrice = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return `${n.toFixed(2)} €`;
};

const OfferOfMomentModal: React.FC<Props> = ({ open, onClose, title }) => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [flyers, setFlyers] = useState<MktFlyer[]>([]);
  const [index, setIndex] = useState(0);

  const current = useMemo(() => flyers[index] || null, [flyers, index]);

  useEffect(() => {
    if (!open) return;

    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const rows = await listActiveFlyers();
        if (!mounted) return;
        const featured = (rows || []).filter((r: any) => r?.is_featured === true);
        const sortedFeatured = featured.sort((a: any, b: any) => {
          const ar = a?.featured_rank;
          const br = b?.featured_rank;
          if (ar === null || ar === undefined) return 1;
          if (br === null || br === undefined) return -1;
          return Number(ar) - Number(br);
        });

        setFlyers(sortedFeatured.length ? sortedFeatured : rows);
        setIndex(0);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(flyers.length - 1, i + 1));
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, flyers.length]);

  if (!open) return null;

  const hasAny = flyers.length > 0;
  const canPrev = index > 0;
  const canNext = index < flyers.length - 1;

  const normal = formatPrice(current?.normal_price);
  const promo = formatPrice(current?.promo_price);

  return (
    <div className="fixed inset-0 z-[9999]">
      <button
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
        aria-label="Fermer"
      />

      <div className="absolute inset-x-0 top-10 px-4">
        <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div>
              <div className="text-xs text-slate-500">Pop-up</div>
              <div className="text-base font-extrabold text-slate-800">{title || 'Offre du moment'}</div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100"
              aria-label="Fermer"
            >
              <X className="w-5 h-5 text-slate-700" />
            </button>
          </div>

          {loading ? (
            <div className="p-10 flex items-center justify-center gap-2 text-slate-600">
              <Loader2 className="w-5 h-5 animate-spin" />
              Chargement...
            </div>
          ) : !hasAny ? (
            <div className="p-6 text-center text-slate-700">
              Aucune offre disponible.
            </div>
          ) : current ? (
            <div>
              <button
                onClick={() => {
                  onClose();
                  navigate(`/flyers/${current.id}`);
                }}
                className="w-full text-left"
              >
                {current.image_url ? (
                  <div className="w-full h-52 bg-slate-100 overflow-hidden">
                    <img src={current.image_url} alt={current.title} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-full h-52 bg-gradient-to-br from-brand-blue/10 to-brand-orange/10" />
                )}

                <div className="p-5">
                  <div className="text-lg font-extrabold text-slate-800 leading-snug">{current.title}</div>
                  {current.description ? (
                    <div className="mt-2 text-sm text-slate-600 line-clamp-3">{current.description}</div>
                  ) : null}

                  {(normal || promo) ? (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
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

                  {current.observations ? (
                    <div className="mt-4 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl p-3">
                      {current.observations}
                    </div>
                  ) : null}
                </div>
              </button>

              <div className="px-5 pb-5">
                <button
                  onClick={() => {
                    onClose();
                    navigate(`/flyers/${current.id}/request`);
                  }}
                  className="w-full bg-brand-orange text-white px-4 py-3 rounded-xl font-extrabold hover:bg-orange-600"
                >
                  Faire une demande
                </button>

                <div className="mt-4 flex items-center justify-between">
                  <button
                    onClick={() => setIndex((i) => Math.max(0, i - 1))}
                    disabled={!canPrev}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Précédent
                  </button>

                  <div className="text-xs font-bold text-slate-500">
                    {index + 1} / {flyers.length}
                  </div>

                  <button
                    onClick={() => setIndex((i) => Math.min(flyers.length - 1, i + 1))}
                    disabled={!canNext}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    Suivant
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default OfferOfMomentModal;
