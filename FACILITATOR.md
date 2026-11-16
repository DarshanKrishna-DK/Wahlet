# Whitechain merchant integration

Wahlet 0.2.0 is a Whitechain Sepolia developer preview. It supports x402 v2, `exact`, official test USDT `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` (6 decimals), and Permit2. Mainnet is disabled. No merchant facilitation fee is collected in this release.

## Choose the settlement service as a merchant

Wallet users approve a resource origin and spending policy. They do not choose a facilitator or give a facilitator their key. The merchant sends the signed payment to its configured facilitator. Payments remain bound to the merchant recipient and exact amount.

The included sample API uses the same settlement service in process by default. Set `WAHLET_FACILITATOR_URL` and `WAHLET_FACILITATOR_API_KEY` in the merchant service environment to use a separately operated service. The local development URL is `http://127.0.0.1:4022`; remote deployments require HTTPS. The adapter uses the standard x402 facilitator wire format with bounded responses and redirects disabled.

## Run a standalone facilitator

Use a dedicated process, a separate private state directory, and a dedicated WBT gas signer. Never use the agent signer as the facilitator key. Supply secrets through a local secret manager or protected process environment, never source code, shell history, chat, or the public website.

Required environment:

| Variable | Purpose |
| --- | --- |
| `WAHLET_STATE_DIR` | Dedicated facilitator state directory, separate from agent/merchant state |
| `WAHLET_FACILITATOR_PRIVATE_KEY` | Dedicated testnet gas signer; consumed at process startup |
| `WAHLET_FACILITATOR_API_KEY` | At least 32 random characters; distribute privately to approved merchants |
| `WAHLET_FACILITATOR_MERCHANTS` | Comma-separated exact merchant recipient addresses |

Alternatively, retain a locally encrypted `facilitator.vault.json` and supply `WAHLET_FACILITATOR_PASSWORD` at startup. Back up the whole facilitator state directory privately, including its journal files, using a consistent SQLite backup procedure. Do not copy a live database file alone.

Run `wahlet facilitator`. The service listens on loopback port 4022. Put an authenticated TLS reverse proxy in front of it for remote merchants. API credentials belong on merchant servers. They must never be embedded in browser JavaScript.

The gas signer owns WBT only; payer token authority comes from exact signed Permit2 payloads. Default operator protections are 2 test USDT per settlement, 0.005 WBT estimated fee ceiling and 0.05 WBT daily reserved gas budget. Operators can configure `WAHLET_FACILITATOR_MAX_USDT`, `WAHLET_MAX_GAS_WBT`, and `WAHLET_FACILITATOR_GAS_DAY_WBT`. These protect sponsored infrastructure and are separate from wallet owner spending limits. One process per state directory is supported. A shared API key represents one operator-managed merchant group; self-service multi-tenant billing is a later release.

## HTTP interface

- `GET /health`: preview/network status without signing material.
- `GET /supported`: x402 capability and gas signer address.
- `POST /verify`: authenticated payment verification.
- `POST /settle`: authenticated, serialized durable settlement.

POST bodies use `{ "x402Version": 2, "paymentPayload": ..., "paymentRequirements": ... }`. Authenticate with `Authorization: Bearer <merchant credential>`. Bodies are bounded to 32 KB, browser origins are rejected, and requests are limited to 120 per minute per process. A durable authorization key binds payer and Permit2 nonce to the original complete payment. Retries return the original settlement. Uncertain submissions retain the signed raw transaction and reconcile the same hash before a new payment is attempted.

Official merchant SDK configuration:

```js
import { HTTPFacilitatorClient } from '@x402/core/server';

const facilitator = new HTTPFacilitatorClient({
  url: process.env.WAHLET_FACILITATOR_URL,
  createAuthHeaders: async () => ({
    verify: { Authorization: `Bearer ${process.env.WAHLET_FACILITATOR_API_KEY}` },
    settle: { Authorization: `Bearer ${process.env.WAHLET_FACILITATOR_API_KEY}` },
  }),
});
```

Configure your x402 resource server with explicit atomic pricing, `network: 'eip155:1874'`, `scheme: 'exact'`, the test USDT address, your registered `payTo`, and `extra: { assetTransferMethod: 'permit2' }`. Return the SDK settlement response in `PAYMENT-RESPONSE`. Keep delivery retryable after settlement and reuse the same signed authorization. A successful settlement is distinct from successful delivery.

## Compatibility and release boundary

An external ITC/EIP-3009 payment service is not interchangeable with test USDT/Permit2. Only the included sample merchant has been qualified for the complete Wahlet journey. Independent compatible merchants and external developer acceptance remain public interoperability gates. This release is a developer preview, not a production public gas sponsorship service.

The service has one pinned testnet network. Mainnet cannot be enabled by changing an RPC URL. A future mainnet release requires reviewed network/token contracts, deployed compatible settlement contracts, gas funding and key rotation, independent security review, incident procedures and explicit launch approval.
