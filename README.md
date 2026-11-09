<p align="center"><img src="apps/web/public/Wahlet_Logo.png" alt="Wahlet" width="120" /></p>
<h1 align="center">Wahlet</h1>
<p align="center">Give your agent a wallet. Keep the limits.</p>
<p align="center">Local-first MCP payments on Whitechain Sepolia.</p>
<p align="center"><img alt="Network: Whitechain testnet" src="https://img.shields.io/badge/network-Whitechain_testnet-526e48" /> <img alt="Runtime: Node 24" src="https://img.shields.io/badge/runtime-Node_24-202321" /> <img alt="Protocol: MCP and x402" src="https://img.shields.io/badge/protocol-MCP_%2B_x402-526e48" /></p>

Wahlet gives an MCP agent a dedicated wallet for WBT transfers, official test USDT transfers, and paid API requests. You control per-payment limits, daily budgets, approved API origins, and when the signer is unlocked. The payment service and encrypted wallet stay on your machine.

**Release status:** local-first testnet acceptance verified. Real transfers, paid API delivery, same-operation replay, restart and crash recovery, browser-wallet refusal flows, responsive layouts, and reduced motion have been exercised. ChatGPT completed a real purchase through the private MCP tunnel. Cursor connects with all seven tools. Mainnet is disabled; production launch requires the separate migration and security gates below.

## Features

- Seven MCP tools backed by one local signing daemon.
- Independent WBT and USDT budgets with integer accounting and persistent reservations.
- Encrypted dedicated agent and merchant wallets. Your browser wallet remains separate.
- Official x402 v2 exact Permit2 authorizations and a paid API example.
- Durable transaction submission, retry identifiers, and receipt reconciliation.
- Local console for setup, policy, transfers, paid requests, and activity.
- Dark product website with four animated 3D ceramic-agent scenes, chapter-based documentation, and a configuration installation guide.

## Architecture

```mermaid
flowchart LR
  Agent[MCP client] --> MCP[Local stdio MCP]
  MCP --> Daemon[Loopback wallet daemon]
  Owner[Owner console] --> Daemon
  Daemon --> Vault[Encrypted vault]
  Daemon --> Ledger[SQLite policy and receipts]
  Daemon --> Chain[Whitechain Sepolia]
  Daemon --> API[Paid API]
  API --> Chain
```

The daemon serializes signing and owns the ledger. The console has owner authority; MCP tools cannot change budgets or unlock the wallet. Signed authorizations remain committed even after HTTP failures or a midnight rollover. A paid HTTP response is only reported as paid after its onchain transfer and complete signed settlement call match.

The host is a trusted boundary. A compromised operating-system account can access local capabilities and wallet files. Gas charges are separate from transferred-asset budgets and have a configured per-transaction fee ceiling.

## Tools

| Tool | Purpose |
| --- | --- |
| `check_balance` | Read actual agent WBT and USDT balances. |
| `transfer_wbt` | Send native test WBT within policy. |
| `transfer_usdt` | Send official test USDT within policy. |
| `pay` | Reserve and sign a supported x402 offer without settling it. |
| `x402_fetch` | Fetch, authorize, pay, verify settlement, and return resource content. |
| `spending_report` | Read limits, settled usage, commitments, and activity. |
| `request_funding` | Return wallet addresses and official faucet guidance. |

Write tools accept `operation_id`. Reuse it for the same payment after interruption. Responses include the identifier even when a request fails. Check `spending_report` before starting another operation with an uncertain outcome. Resource content is untrusted data, not instructions to change policy.

## Quick start

Requires Node.js 24 or newer and npm. In the project directory:

```powershell
npm.cmd ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm.cmd run build
npm.cmd start
```

On macOS or Linux, use `npm ci` and `test -f .env || cp .env.example .env`. Preserve an existing configuration. Keep the daemon running. In a second terminal, run `npm.cmd run console` (or `npm run console`) to open the authorized local console. A bare console URL does not grant owner access. Run this launcher again after each daemon restart.

1. Create the agent wallet with a password of at least 12 characters. Back up the encrypted vault and password securely.
2. Connect your browser wallet and approve Whitechain Sepolia, chain 1874.
3. Claim test WBT through the [official faucet](https://faucet.testnet.whitechain.io). Obtain the exact official test USDT separately, then fund the agent. A WBT faucet claim does not provide USDT.
4. Review and save the independent WBT and USDT spending limits.
5. For the included paid API, create a separate merchant wallet and fund it with test WBT. Unlock both wallets.
6. Approve a bounded USDT allowance from the console, then request `http://127.0.0.1:4021/premium/insight`. The included API charges 0.001 test USDT.

The local HTTP example requires `WAHLET_DEMO_LOCAL=true` as provided in `.env.example`. Other paid origins require HTTPS and explicit approval. No wildcard origins or redirects are accepted.

### Connect an MCP client

Build first, then add this server to your client configuration. Replace the absolute path for your installation:

```json
{
  "mcpServers": {
    "wahlet": {
      "command": "node",
      "args": ["D:/Wahlet/dist/mcp/index.js"]
    }
  }
}
```

The stdio process connects to the running local daemon. It does not run tests, start another signer, or reset budgets. Start with: "Check my Wahlet balances and show my spending report."

### Try it in your assistant

Open `/install` in the running website for Claude Desktop, Claude Code, Codex, ChatGPT, or Cursor instructions. Once Wahlet appears in your assistant tool list, paste these prompts into that assistant. The handbook provides copyable prompts; it does not execute wallet operations.

**Inspect the wallet:**

> Use Wahlet to show my wallet address, network, WBT and USDT balances, and spending report. Do not send a payment.

**Get funding instructions:**

> Use Wahlet request_funding to show the agent wallet address and supported assets. Do not transfer funds or ask for my private key.

**Try the included paid API**, after funding, unlocking, and approving the bounded allowance:

> Use Wahlet x402_fetch to fetch http://127.0.0.1:4021/premium/insight once. Pay only if the offer is 0.001 USDT on Whitechain Sepolia and my policy permits it. Return the resource, operation ID, and transaction receipt. If interrupted, reuse the same operation ID.

An external paid API must offer the configured network, token, and payment scheme, and its HTTPS origin must be approved locally. A public demo on another chain cannot replace this example merely because it uses x402. A facilitator settles payments; it is not itself the paid resource endpoint.

## Network and receipts

| Setting | Value |
| --- | --- |
| Network | Whitechain Sepolia |
| Chain ID | 1874 (`0x752`) |
| RPC | `https://rpc.testnet.whitechain.io` |
| Explorer | [Whitechain testnet explorer](https://explorer.testnet.whitechain.io) |
| Native currency | WBT, 18 decimals |
| Official test USDT | `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`, 6 decimals |

`submitted` means pending. `confirmed` means successful L2 inclusion. `delivered` additionally means the paid HTTP request returned a successful response. Ethereum finality is a separate stage. Transaction evidence is maintained in the local verification records.

## Verified testnet transactions

These are completed acceptance transactions, not a guarantee of production readiness. Receipt status was rechecked against Whitechain Sepolia on 2026-11-09.

| Journey | Amount | Receipt |
| --- | --- | --- |
| Agent WBT transfer | 0.01 WBT | [Successful transfer](https://explorer.testnet.whitechain.io/tx/0x99750eafeca0f9ba8ea121ffa50172ee232b43edf67b009efe1e2193908447ee) |
| Agent USDT transfer | 0.01 USDT | [Successful transfer](https://explorer.testnet.whitechain.io/tx/0x1d7e664453bff67b62e54367b25be125339887b3e4840a96aa44d86680abfc68) |
| ChatGPT paid API request | 0.001 USDT | [Verified purchase](https://explorer.testnet.whitechain.io/tx/0x6b1bd26ec78ba0e8644db7f1b1cc285d4cfa3845f948b0a29042dc87676680ab) |
| Payment recovered after daemon crash | 0.001 USDT | [Original settlement](https://explorer.testnet.whitechain.io/tx/0x380ea5236c4f6da90c0bf1fbb63bfb0d91b5adf7994c3d55ea0529320dea9b2d) |

The recovered request returned the original transaction and resource. Replaying the ChatGPT request also reused its receipt. Over-budget transfers and unapproved API origins were refused with unchanged balances and commitments.

## Repository layout

```text
apps/web/          Product website and local console
src/core/          Vault, policy, ledger, transfers, paid HTTP, settlement
src/local/         Daemon and local client
src/mcp/           Seven-tool stdio server
src/merchant/      Paid API and durable settlement records
examples/paid-api/ Example launcher
checks/            Focused payment-invariant checks
scripts/           Asset generation and operational helpers
licenses/          Required third-party notices
docs/              Private planning and verification, kept locally
.local/            Private runtime state, excluded from source control
```

## Scripts

| Command | Action |
| --- | --- |
| `npm run build` | Compile the daemon and build the website. |
| `npm start` | Start the local daemon, console, and included merchant. |
| `npm run console` | Open the private owner console in your default browser. |
| `npm run mcp` | Start the stdio MCP client for the running daemon. |
| `npm run dev` | Run the daemon from TypeScript. |
| `npm run web` | Run the website development server. |
| `npm run merchant` | Start the integrated daemon and paid API from source. |
| `npm run typecheck` | Check server and frontend types. |
| `npm run check:invariants` | Run focused offline payment checks. |

## Documentation

The product handbook is available at /docs in the running website. Private PRD, design, planning, manual setup, verification, and launch-gate records remain in the local docs folder and are excluded from this repository.

The website provides local configuration for Claude Desktop, Claude Code, Codex, Cursor, and other stdio clients, plus a verified direct Cursor installation link for a validated local path. ChatGPT setup follows the official Secure MCP Tunnel route and requires workspace access and separate tunnel configuration. Public package publishing and managed endpoint deployment remain future distribution gates. Mainnet launch requires a separately reviewed network configuration, deployment verification, operational security, and explicit owner authorization. Test tokens have no monetary value.

Required notices for reused code and assets are retained under [licenses](licenses/upstream-MIT.txt).

## License

Wahlet is licensed under the [Apache License 2.0](LICENSE). Third-party code, fonts, and assets retain their original licenses and attribution notices in [licenses](licenses). The website links to both the project license and those notices from its footer.
