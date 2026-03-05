import React from 'react';

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

const Pagination: React.FC<Props> = ({ page, pageSize, total, onPageChange }) => {
  const totalPages = Math.max(1, Math.ceil((Number(total) || 0) / Math.max(1, Number(pageSize) || 1)));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-white">
      <div className="text-xs text-slate-500 font-semibold">
        {total === 0 ? '0 résultat' : `${start}-${end} sur ${total}`}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white"
        >
          Précédent
        </button>
        <div className="text-xs font-bold text-slate-700">
          Page {safePage} / {totalPages}
        </div>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white"
        >
          Suivant
        </button>
      </div>
    </div>
  );
};

export default Pagination;

