import { useEffect } from 'react';

export function useSectionNavigation(closeMenu:()=>void){
  useEffect(()=>{
    let frame=0;
    function scrollToSection(id:string){
      const target=document.getElementById(id);if(!target)return;
      cancelAnimationFrame(frame);
      const start=window.scrollY,end=Math.max(0,target.getBoundingClientRect().top+start-100);
      if(matchMedia('(prefers-reduced-motion: reduce)').matches){window.scrollTo(0,end);return;}
      const started=performance.now();
      function tick(now:number){const progress=Math.min((now-started)/900,1),ease=progress<.5?4*progress**3:1-(-2*progress+2)**3/2;window.scrollTo(0,start+(end-start)*ease);if(progress<1)frame=requestAnimationFrame(tick);}
      frame=requestAnimationFrame(tick);
    }
    function clicked(event:MouseEvent){
      if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      const link=(event.target as Element).closest<HTMLAnchorElement>('a[href]');if(!link)return;
      const url=new URL(link.href);if(url.origin!==location.origin||url.pathname!=='/'||!['#product','#how-it-works','#developers'].includes(url.hash))return;
      event.preventDefault();closeMenu();
      if(location.pathname!=='/'){sessionStorage.setItem('wahlet-section',url.hash.slice(1));location.assign('/');return;}
      history.pushState(null,'',url.hash);scrollToSection(url.hash.slice(1));
    }
    const saved=sessionStorage.getItem('wahlet-section');
    if(location.pathname==='/'&&saved){sessionStorage.removeItem('wahlet-section');frame=requestAnimationFrame(()=>scrollToSection(saved));}
    const cancel=()=>cancelAnimationFrame(frame);
    document.addEventListener('click',clicked);window.addEventListener('wheel',cancel,{passive:true});window.addEventListener('touchstart',cancel,{passive:true});
    return()=>{cancel();document.removeEventListener('click',clicked);window.removeEventListener('wheel',cancel);window.removeEventListener('touchstart',cancel);};
  },[closeMenu]);
}
