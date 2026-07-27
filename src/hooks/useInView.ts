import { useEffect, useState, type RefObject } from 'react';

/**
 * Tracks whether an element is intersecting the viewport, so animated canvases
 * can stop rendering while scrolled out of view (see ARCHITECTURE.md §6).
 */
export function useInView(ref: RefObject<Element | null>, rootMargin = '64px'): boolean {
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      rootMargin,
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, rootMargin]);

  return inView;
}
