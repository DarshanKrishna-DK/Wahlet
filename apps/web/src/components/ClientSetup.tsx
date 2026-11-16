import { useState } from 'react';
import { CopyCode } from '../App';

const clients = [
  ['claude-desktop', 'Claude Desktop'], ['claude-code', 'Claude Code'],
  ['codex', 'Codex'], ['chatgpt', 'ChatGPT'], ['cursor', 'Cursor'], ['other', 'Another local MCP client'],
] as const;

export default function ClientSetup() {
  const [client, setClient] = useState('claude-desktop');
  const configurationClient = client.startsWith('claude') ? 'claude' : client;
  return <div className="install-surface client-setup">
    <h2>Connect your assistant.</h2>
    <label>Your AI assistant<select value={client} onChange={event => setClient(event.target.value)}>{clients.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <p>Keep <code>wahlet serve</code> running. Generate configuration from the installed app so it uses your Node.js path and local wallet state.</p>
    <CopyCode text={`wahlet config ${configurationClient}`}/>
    {client === 'claude-desktop' && <p>Open Claude Desktop Settings, Developer, Edit Config. Merge the generated <code>mcpServers.wahlet</code> entry into <code>claude_desktop_config.json</code>, preserve other servers, then fully quit and restart Claude.</p>}
    {client === 'claude-code' && <p>Merge the generated JSON into your project <code>.mcp.json</code>, preserve other servers, then reopen Claude Code and approve the Wahlet project server.</p>}
    {client === 'codex' && <><p>Merge the generated TOML into <code>~/.codex/config.toml</code>. Replace an existing Wahlet section instead of adding it twice. Restart Codex, then check registration:</p><CopyCode text="codex mcp list"/></>}
    {client === 'cursor' && <p>Merge the generated JSON into your project <code>.cursor/mcp.json</code>, preserve other servers, then enable Wahlet in Cursor MCP settings. The generated configuration contains the installed executable paths.</p>}
    {client === 'other' && <p>Add the generated Wahlet entry as a local stdio MCP server. Preserve its command, arguments, and state directory. The generated configuration contains local paths, never signing keys.</p>}
    {client === 'chatgpt' && <><h3>Use a private MCP connection.</h3><p>ChatGPT requires access to custom MCP connections and a separately configured Secure MCP Tunnel. Use the command, arguments, and state directory printed above for the local stdio process. Associate the tunnel with your ChatGPT workspace. Expose only the agent MCP process, never the owner console.</p><a className="text-link" href="https://developers.openai.com/api/docs/guides/secure-mcp-tunnels" target="_blank" rel="noreferrer">Open the Secure MCP Tunnel guide</a><p className="small">Selecting ChatGPT does not install or connect a tunnel. Availability depends on your account and workspace.</p></>}
    <h3>Start with a read.</h3>
    <p>Confirm that Wahlet appears in your assistant tool list, then paste:</p>
    <CopyCode text="Use Wahlet to check my wallet address, network, WBT and USDT balances, and spending report. Do not send a payment."/>
    <p className="small">A connection is ready when the assistant returns real tool results. Never paste a private key, vault password, or owner console link into chat.</p>
  </div>;
}
