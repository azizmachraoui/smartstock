import { useState } from 'react';
import { Package } from 'lucide-react';
import { assetUrl } from '../../services/api';

export function ProductImage({
  src,
  alt,
  className = 'h-10 w-10',
  iconClassName = 'h-5 w-5',
}: {
  src?: string;
  alt: string;
  className?: string;
  iconClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = assetUrl(src);

  if (!url || failed) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 ${className}`}
        aria-hidden="true"
      >
        <Package className={iconClassName} />
      </span>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-xl bg-slate-100 object-cover ring-1 ring-slate-200/70 dark:bg-slate-800 dark:ring-slate-700 ${className}`}
    />
  );
}
