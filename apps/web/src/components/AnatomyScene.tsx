import { useEffect, useRef, useState } from 'react';
import './ceramic-scenes.css';

export type SceneKind = 'hero' | 'wallet' | 'policy' | 'receipt';
const descriptions: Record<SceneKind, string> = {
  hero: 'Three small white and light-purple agents queue at an API terminal. The happy first agent taps a card, then the terminal prints a receipt. The waiting agents glance toward the viewer. Illustrative animation.',
  wallet: 'A white and light-purple agent pulls a payment card from inside its wallet, holds it clear, and returns it through the opening. Illustrative animation.',
  policy: 'A white and light-purple agent taps its card against an authorization reader. The lock opens after contact. Illustrative animation.',
  receipt: 'A printer feeds a receipt outward. A white and light-purple agent grasps the paper, turns, and places it inside a small bag. Illustrative animation.',
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
