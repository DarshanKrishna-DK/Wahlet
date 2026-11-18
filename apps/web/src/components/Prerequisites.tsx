import { PreviewScope, PaymentCompatibility, RecoveryWalkthrough } from './ReleaseOnboarding';

export default function Prerequisites() {
  return <section className="prerequisites"><h2>Before you connect.</h2><PreviewScope/><dl>
    <dt>Node.js and npm</dt><dd>Install Node.js 24 or newer. Download the versioned Wahlet package and verify its checksum before installing. Windows is verified; macOS and Linux need independent acceptance.</dd>
    <dt>An MCP-compatible assistant</dt><dd>Use Claude Desktop, Claude Code, Codex, Cursor, or another stdio MCP host. ChatGPT requires workspace access to custom MCP connections and a separately configured Secure MCP Tunnel.</dd>
    <dt>A running wallet service</dt><dd>Run <code>wahlet doctor</code>, then <code>wahlet serve</code>. Keep the service running while your assistant uses the wallet. In a second terminal, open the private owner console with <code>wahlet console</code>.</dd>
    <dt>A dedicated agent wallet</dt><dd>Create an encrypted signer locally and keep its password and backup private. Set your spending policy and unlock the signer before payments. Read-only tools work without unlocking.</dd>
    <dt>Test WBT and test USDT</dt><dd>Use Whitechain Sepolia, chain 1874. Get test WBT from the <a href="https://faucet.testnet.whitechain.io" target="_blank" rel="noreferrer">official faucet</a>, then follow the console token guidance. Official test USDT is <code>0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7</code>, with 6 decimals. Test tokens have no monetary value.</dd>
    <dt>Paid API authorization</dt><dd>Approve the service origin and a bounded USDT allowance locally. The supported scheme is x402 v2 exact on official test USDT, authorized with Permit2 or EIP-3009. Only Permit2 needs the bounded allowance. For the included example, create and fund a separate merchant wallet in the console. Never paste wallet secrets or the private console link into AI chat.</dd>
  </dl><PaymentCompatibility/><RecoveryWalkthrough/></section>;
}
