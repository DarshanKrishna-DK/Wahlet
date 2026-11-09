import { useEffect, useRef, useState } from 'react';
import './ceramic-scenes.css';

export type SceneKind = 'hero' | 'wallet' | 'policy' | 'receipt';
const descriptions: Record<SceneKind, string> = {
  hero: 'A cream and pink robot takes a lilac card from its wallet, presents it to an API terminal, and collects a printed receipt. Illustrative animation.',
  wallet: 'A cream and pink robot lifts a payment card from a large stitched lilac wallet beside it. Illustrative animation.',
  policy: 'A cream and pink robot presents a payment card to an authorization station. Its lock opens after the card is checked. Illustrative animation.',
  receipt: 'A cream and pink robot collects a paper receipt as it feeds from a small rounded printer. Illustrative animation.',
};
export default function AnatomyScene({ kind = 'hero' }: { kind?: SceneKind }) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    if (!('IntersectionObserver' in window) || !('ResizeObserver' in window)) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    setReady(false);
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void import('./ceramic-world').then(({ mountCeramicScene }) => {
        if (disposed) return;
        cleanup = mountCeramicScene(element, kind, () => setReady(true), () => setReady(false));
      }).catch(() => { /* The rendered still remains available if WebGL cannot start. */ });
    }, { rootMargin: '200px' });
    observer.observe(element);
    return () => { disposed = true; observer.disconnect(); cleanup?.(); };
  }, [kind]);
  return <figure className={`agent-scene ceramic-scene agent-scene-${kind}`} role="img" aria-label={descriptions[kind]}>
    <img className={`ceramic-still${ready ? ' ceramic-still-hidden' : ''}`} src={`/illustrations/ceramic-${kind}.png`} alt="" aria-hidden="true" width="900" height="750" loading={kind === 'hero' ? 'eager' : 'lazy'} decoding="async" />
    <div className="ceramic-canvas" ref={host} aria-hidden="true" />
  </figure>;
}
