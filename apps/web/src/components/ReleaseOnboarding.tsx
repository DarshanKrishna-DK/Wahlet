import { CopyCode } from '../App';
import AnatomyScene from './AnatomyScene';
import './release-onboarding.css';

const release = 'https://github.com/DarshanKrishna-DK/Wahlet/releases/tag/v0.2.0';

export function PreviewScope() {
  return <div className="preview-scope"><span className="preview-marker" aria-hidden="true"/><div><strong>Whitechain Sepolia developer preview</strong><p>Chain 1874. Test tokens only. Mainnet payments are disabled. The included paid API is verified; independent merchant interoperability is still being qualified.</p></div></div>;
}

export default function ReleaseOnboarding() {
  return <>
    <PreviewScope/>
    <div className="install-intro-art"><AnatomyScene kind="wallet"/><div><h2>One local wallet.<br/>Your choice of assistant.</h2><p>Signing keys stay on your computer. Your assistant gets payment tools with the limits you set.</p><a className="button primary" href={release} target="_blank" rel="noreferrer">Get Wahlet v0.2.0</a></div></div>
    <ol className="release-steps">
      <li><span className="release-step-number">01</span><div><h2>Install the runtime.</h2><p>Use <a href="https://nodejs.org/en/download" target="_blank" rel="noreferrer">Node.js 24 or newer</a>, with npm. Windows is verified. The same Node commands support macOS and Linux; those platforms still need independent acceptance.</p><CopyCode text="node --version"/></div></li>
      <li><span className="release-step-number">02</span><div><h2>Verify the release.</h2><p>Download <code>wahlet-0.2.0.tgz</code> and <code>SHA256SUMS</code> from the <a href={release} target="_blank" rel="noreferrer">versioned GitHub release</a>. Compare the package hash with the matching entry before installation.</p><details><summary>Windows PowerShell</summary><CopyCode text="Get-FileHash ./wahlet-0.2.0.tgz -Algorithm SHA256"/></details><details><summary>macOS or Linux</summary><CopyCode text="shasum -a 256 wahlet-0.2.0.tgz"/></details><CopyCode text="npm install --global ./wahlet-0.2.0.tgz"/><p className="small">Checksums detect changed downloads. Obtain both files from the trusted release. Keep your existing wallet state when upgrading.</p></div></li>
      <li><span className="release-step-number">03</span><div><h2>Start your wallet.</h2><CopyCode text={'wahlet doctor\nwahlet serve'}/><p>Keep that terminal open. In a second terminal, open the private owner console:</p><CopyCode text="wahlet console"/><p>Create an encrypted agent wallet, set your policy, and unlock it locally. The public website cannot open or administer a local wallet.</p></div></li>
      <li><span className="release-step-number">04</span><div><h2>Fund and authorize.</h2><p>Get test WBT from the <a href="https://faucet.testnet.whitechain.io" target="_blank" rel="noreferrer">Whitechain faucet</a>. Follow the console guidance for official test USDT. Confirm chain 1874 and the token contract before funding.</p><p className="token-address"><code>0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7</code><span>Official test USDT, 6 decimals</span></p><p>Approve the API origin and a bounded USDT allowance. For the included sample, create and fund a distinct merchant wallet in the console. It sponsors settlement gas when using embedded facilitation.</p><p>To enable the loopback sample only, restart the service with this setting. It is never needed for approved HTTPS merchants.</p><details><summary>Windows PowerShell</summary><CopyCode text={'$env:WAHLET_DEMO_LOCAL="true"\nwahlet serve'}/></details><details><summary>macOS or Linux</summary><CopyCode text="WAHLET_DEMO_LOCAL=true wahlet serve"/></details></div></li>
    </ol>
  </>;
}

export function PaymentCompatibility() {
  return <section className="payment-compatibility"><h2>Who does what?</h2><dl><dt>Your wallet</dt><dd>Checks owner policy and signs an exact payment for an approved resource.</dd><dt>The merchant</dt><dd>Offers the paid API, selects its facilitator, and returns the resource and receipt.</dd><dt>The facilitator</dt><dd>Verifies the authorization and submits settlement. It pays WBT gas and cannot change the signed recipient or amount.</dd></dl><p>You do not need to choose a facilitator to connect your wallet. The current preview accepts official test USDT with x402 v2 exact Permit2 on Whitechain Sepolia. Another token, scheme, or chain is not interchangeable.</p><p>The included sample merchant works with embedded facilitation or a configured Wahlet facilitator. A compatible independently operated merchant remains a release qualification gate.</p></section>;
}

export function RecoveryWalkthrough() {
  return <section className="recovery-walkthrough"><h2>Recover the original payment.</h2><ol><li>If a request times out, retain its operation ID. Do not create a replacement payment.</li><li>Restart <code>wahlet serve</code> if needed, then open <code>wahlet console</code> and inspect Activity. Unlock only when a new signature is needed.</li><li>Ask your assistant to inspect the original operation. If delivery remains incomplete, retry that same request with the same operation ID.</li></ol><CopyCode text="Use Wahlet spending_report to inspect operation [ORIGINAL_OPERATION_ID]. Report its state and receipt without sending a new payment. If it is confirmed but not delivered, explain how to resume the original request."/><p>A confirmed receipt proves successful chain inclusion. Delivered also means the resource returned successfully. Ethereum finality is a separate stage.</p></section>;
}
