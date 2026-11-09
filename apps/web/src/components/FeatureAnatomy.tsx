import { useId } from 'react';

/** Small static objects, built from their physical parts. */
export default function FeatureAnatomy({kind}:{kind:'wallet'|'policy'|'receipt'}){
  const id=useId().replaceAll(':','');
  return <svg className="feature-anatomy" viewBox="0 0 96 82" aria-hidden="true" focusable="false">
    <defs><linearGradient id={id+'shell'} x2=".7" y2="1"><stop stopColor="#fff5ff"/><stop offset=".5" stopColor="#d8c8e9"/><stop offset="1" stopColor="#9682b0"/></linearGradient><linearGradient id={id+'edge'} x2="0" y2="1"><stop stopColor="#8d76a8"/><stop offset="1" stopColor="#493854"/></linearGradient></defs>
    <ellipse cx="49" cy="74" rx="33" ry="5" fill="#000" opacity=".32"/>
    {kind==='wallet'?<>
      <path d="M20 25 65 15l13 8-47 12Z" fill="#b69acb"/>
      <rect x="27" y="8" width="35" height="43" rx="4" transform="rotate(-8 44 29)" fill={'url(#'+id+'shell)'}/><path d="m33 18 18-3m-17 9 9-1" stroke="#a98abd" strokeWidth="2"/>
      <path d="M15 31q0-6 7-7h48q10 0 10 9v30q0 8-9 8H25q-10 0-10-9Z" fill={'url(#'+id+'edge)'}/><rect x="15" y="31" width="61" height="36" rx="8" fill={'url(#'+id+'shell)'}/><path d="M21 38h46M22 60h38" stroke="#fff" strokeOpacity=".45" strokeDasharray="2 3"/>
      <path d="M62 43h21v14H62q-7-7 0-14" fill="#a891c1" stroke="#e9d8f8"/><circle cx="69" cy="50" r="3" fill="#f7e7c1"/>
    </>:kind==='policy'?<>
      <rect x="21" y="53" width="57" height="17" rx="6" fill={'url(#'+id+'edge)'}/><path d="M28 53h44l6 6H21Z" fill="#c5afd9"/>
      <path d="M35 31V21c0-18 26-18 26 0v10" fill="none" stroke="#efe3f5" strokeWidth="8"/>
      <rect x="24" y="28" width="48" height="33" rx="10" fill={'url(#'+id+'shell)'}/><circle cx="48" cy="42" r="4" fill="#695474"/><path d="M48 44v7" stroke="#695474" strokeWidth="4" strokeLinecap="round"/>
      <circle cx="72" cy="55" r="12" fill="#c9e0cd" stroke="#f4fff5"/><path d="m66 55 4 4 8-8" fill="none" stroke="#4b725a" strokeWidth="3"/>
    </>:<>
      <rect x="16" y="40" width="65" height="30" rx="9" fill={'url(#'+id+'edge)'}/><path d="m16 45 10-10h46l9 10Z" fill="#dac9e4"/><rect x="23" y="43" width="50" height="6" rx="3" fill="#332738"/>
      <path d="M31 48V9l4 3 5-3 5 3 5-3 5 3 5-3 5 3v36Z" fill={'url(#'+id+'shell)'}/><path d="M38 20h19m-19 6h19m-19 6h12" stroke="#9e83ae" strokeWidth="2"/><path d="m41 39 4 4 9-9" fill="none" stroke="#71947d" strokeWidth="2.5"/>
      <circle cx="70" cy="57" r="2" fill="#c3e8c9"/><path d="M25 63h30" stroke="#ac92bd" strokeWidth="2"/>
    </>}
  </svg>;
}
