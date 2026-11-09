export default function PaymentSkyline(){
  return <svg className="payment-skyline" viewBox="0 0 1200 230" aria-hidden="true" focusable="false">
    <defs>
      <pattern id="payment-dots" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="3.5" cy="3.5" r="1.15" fill="currentColor"/></pattern>
      <linearGradient id="payment-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="white" stopOpacity=".95"/><stop offset="1" stopColor="white" stopOpacity=".18"/></linearGradient>
      <mask id="payment-art"><g fill="none" stroke="white" strokeWidth="15" strokeLinejoin="round" strokeLinecap="round">
        <rect x="102" y="69" width="135" height="99" rx="32"/><path d="M169 69V44m-27 79v7m54-7v7m-42 17q16 14 31 0M126 177v42m87-42v42M112 203H72m149 0h45"/><circle cx="169" cy="36" r="10"/>
        <rect x="391" y="106" width="180" height="103" rx="19"/><path d="M403 106V89q0-14 15-14h122v31m-31 40h70v39h-70z"/><circle cx="529" cy="165" r="4"/><path d="M438 74V44h75v30m-57-9h22"/>
        <path d="M712 202V52l15 9 15-9 15 9 15-9 15 9 15-9v150l-15-9-15 9-15-9-15 9-15-9zM735 92h44m-44 27h44m-44 27h29"/>
        <rect x="944" y="43" width="143" height="169" rx="18"/><path d="M966 75h99v47h-99zM973 151h58m-58 27h58"/><circle cx="1058" cy="151" r="4"/><circle cx="1058" cy="178" r="4"/>
      </g><path d="M269 159h104m217 0h102m134 0h100M0 223h1200" fill="none" stroke="white" strokeWidth="4" strokeDasharray="4 9"/></mask>
      <mask id="payment-fade-mask"><rect width="1200" height="230" fill="url(#payment-fade)"/></mask>
    </defs>
    <g mask="url(#payment-fade-mask)"><rect width="1200" height="230" fill="url(#payment-dots)" mask="url(#payment-art)"/></g>
    <g className="skyline-packets" fill="currentColor"><circle cx="286" cy="159" r="2.5"/><circle cx="607" cy="159" r="2.5"/><circle cx="842" cy="159" r="2.5"/></g>
  </svg>;
}
