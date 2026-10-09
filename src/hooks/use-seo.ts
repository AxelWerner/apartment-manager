import { useEffect } from 'react';

interface SEOOptions {
  title?: string;
  description?: string;
}

/**
 * Custom hook to dynamically update document title and meta description per route.
 */
export function useSEO({ title, description }: SEOOptions) {
  useEffect(() => {
    const prevTitle = document.title;
    const baseTitle = 'AptOS';

    if (title) {
      document.title = title.includes(baseTitle) ? title : `${title} — ${baseTitle}`;
    }

    if (description) {
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', description);
      }
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) {
        ogDesc.setAttribute('content', description);
      }
    }

    return () => {
      document.title = prevTitle;
    };
  }, [title, description]);
}
