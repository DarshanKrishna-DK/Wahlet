# Install a verified Wahlet release

Wahlet is a Whitechain Sepolia developer preview. It requires Node.js 24 or newer and npm. Mainnet is disabled. The included paid API demonstrates USDT Permit2 payments; compatibility with an external merchant must be established for its exact network, token, and scheme.

## Install

Download the versioned `.tgz` archive and `SHA256SUMS` from the same Wahlet GitHub release. Compare the archive checksum with the published checksum before installation.

Windows PowerShell:

```powershell
Get-FileHash ./wahlet-0.2.0.tgz -Algorithm SHA256
npm.cmd install --global ./wahlet-0.2.0.tgz
wahlet doctor
wahlet serve
```

macOS or Linux:

```sh
shasum -a 256 wahlet-0.2.0.tgz
npm install --global ./wahlet-0.2.0.tgz
wahlet doctor
wahlet serve
```

Use a user-owned Node installation or npm prefix. Avoid running the wallet with administrator or root privileges. Open a second terminal and run `wahlet console` to open the private owner session. Configure the wallet and its limits there. The console link grants owner access and must remain private.

Windows installation and clean-package checks are performed in this workspace. The package uses portable Node APIs for macOS and Linux; native browser launch and full payment journeys on those systems still need platform verification.

## Try the included paid API

Enable the exact local demo origin when starting the service. In PowerShell, set `$env:WAHLET_DEMO_LOCAL="true"` before `wahlet serve`. On macOS or Linux, run `WAHLET_DEMO_LOCAL=true wahlet serve`. Other merchant origins still require HTTPS and explicit owner approval.

In the console, create and unlock the separate agent and demo merchant wallets, fund both with test WBT, and fund the agent with the supported test USDT. Review the spending policy and approve a bounded USDT allowance. Ask your assistant to fetch `http://127.0.0.1:4021/premium/insight`, which charges 0.001 test USDT. Keep its operation ID and retry that same ID after an interruption. A faucet WBT claim does not supply USDT. Use only token `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` on chain 1874.

## Connect an assistant

Run `wahlet config claude`, `wahlet config cursor`, or `wahlet config codex` and merge the output into the corresponding client configuration, preserving existing servers. The configuration pins the Node executable, installed entry point, and state directory. Regenerate it after moving Node or changing the installation path. No wallet signing credential is included.

`wahlet config chatgpt` describes the private MCP tunnel route. ChatGPT requires a compatible account and separate tunnel setup. Only expose the stdio MCP process. Keep the owner console on loopback.

Start the daemon with `wahlet serve` before using the assistant. The default `wahlet` command runs the stdio MCP client and remains compatible with clients that omit `mcp`.

## State, backup, and upgrades

Installed releases store state in the operating-system user data directory. `wahlet doctor --offline` displays the exact path. Source checkouts retain their existing `.local` directory. `WAHLET_STATE_DIR` explicitly selects another directory; use the same value for the daemon, console, and MCP client.

Stop the wallet before making a consistent backup of its entire state directory. Keep the encrypted vault password separately. A forgotten password cannot be recovered by Wahlet. Store backups securely because the directory includes authorization capabilities and signed payment records. Never upload it to GitHub or share it in chat.

Before an upgrade, stop the daemon, back up state, verify the new archive, and install it using the same command. State remains outside the installed package. Run `wahlet doctor` and regenerate client configuration if the executable path changed. A new owner-console session is issued on restart.

## Build a release from source

```sh
npm ci
npm run typecheck
npm run check:invariants
npm run release:pack
npm run check:release
```

The release script builds from the lockfile installation and writes the archive, SHA-256 checksum, npm integrity value, and file manifest under `.local/releases/`. The release check installs that archive into a fresh isolated directory, validates its checksum and public file manifest, and exercises the installed CLI and client configuration. An explicit package allowlist excludes credentials, runtime state, private planning documents, agent tooling, source maps, and test evidence. Review the manifest before uploading the release. SHA-256 verifies bytes against the published value; it is not an independent publisher signature. Registry publication is disabled by `private: true`.
