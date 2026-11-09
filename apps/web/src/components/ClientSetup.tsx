import { useState } from 'react';
import { CopyCode } from '../App';

export default function ClientSetup(){
  const [client,setClient]=useState('claude-desktop');
  const [directory,setDirectory]=useState('C:/path/to/Wahlet');
  const folder=directory.trim().replaceAll('\\','/').replace(/\/$/,'');
  const validPath=/^(?:[A-Za-z]:\/|\/)/.test(folder)&&!/[\r\n\0]/.test(folder)&&!folder.includes('/path/to/');
  const entry=folder+'/dist/mcp/index.js';
  const server={command:'node',args:[entry]};
  const config=JSON.stringify({mcpServers:{wahlet:server}},null,2);
  const encoded=btoa(Array.from(new TextEncoder().encode(JSON.stringify(server)),byte=>String.fromCharCode(byte)).join(''));
  const installLink=`cursor://anysphere.cursor-deeplink/mcp/install?name=wahlet&config=${encodeURIComponent(encoded)}`;
  const quotedEntry="'"+entry.replaceAll("'","''")+"'";
  return <div className="install-surface">
    <label>Your AI assistant<select value={client} onChange={event=>setClient(event.target.value)}><option value="claude-desktop">Claude Desktop</option><option value="claude-code">Claude Code</option><option value="codex">Codex</option><option value="chatgpt">ChatGPT</option><option value="cursor">Cursor</option><option value="other">Another local MCP client</option></select></label>
    <p>Start the Wahlet wallet service on your computer before connecting. Keep it running while your assistant uses the wallet. Configure and unlock the dedicated signer locally. Never paste a private key or vault password into chat.</p>
    <label>Wahlet installation folder<input value={directory} onChange={event=>setDirectory(event.target.value)} spellCheck={false} aria-invalid={!validPath} aria-describedby="installation-path-help"/></label>
    <p id="installation-path-help" className="field-help">Enter the absolute folder containing your built Wahlet installation. Replace the example path before copying configuration.</p>
    {client==='cursor'&&(validPath?<a className="button primary" href={installLink}>Add Wahlet to Cursor</a>:<p role="status">Enter your installation folder to enable direct installation.</p>)}
    {validPath&&(client==='chatgpt'?<><h2>Connect through a private tunnel.</h2><p>ChatGPT needs a supported MCP connection. A local file path alone does not connect the web app. Secure MCP Tunnel can connect the local stdio server when your account and workspace permit custom MCP servers.</p><p>Follow the official setup guide with the command <code>node</code> and the server entry below. Associate the tunnel with your ChatGPT workspace, then add it through Plugins. Expose only the agent MCP server, never the wallet owner console.</p><CopyCode text={entry}/><a className="text-link" href="https://developers.openai.com/api/docs/guides/secure-mcp-tunnels" target="_blank" rel="noreferrer">Open the Secure MCP Tunnel guide</a><p className="small">This connection requires separate setup. Choosing ChatGPT here does not install or connect a tunnel.</p></>:<>
      {client==='claude-desktop'&&<p>In Claude Desktop, open Settings, Developer, Edit Config. Merge this entry into <code>claude_desktop_config.json</code>, preserve other servers, then fully quit and restart Claude.</p>}
      {client==='cursor'&&<p>Merge this entry into your project <code>.cursor/mcp.json</code>, then enable Wahlet in Cursor MCP settings.</p>}
      {client==='other'&&<p>Add a local stdio server named Wahlet. Use command <code>node</code> with the absolute entry path below as its only argument.</p>}
      {(client==='claude-code'||client==='codex')?<><p>Run this command in PowerShell, then reopen your assistant and review the Wahlet tools. For other shells, use the JSON configuration below.</p><CopyCode text={client==='codex'?`codex mcp add wahlet -- node ${quotedEntry}`:`claude mcp add --transport stdio wahlet -- node ${quotedEntry}`}/><CopyCode text={config}/></>:<CopyCode text={config}/>}</>)}
    <h2>Try it in your own chat.</h2><p>Confirm that Wahlet appears in the assistant tool list, then paste:</p><CopyCode text="Use Wahlet to check my wallet address, network, WBT and USDT balances, and spending report. Do not send a payment."/>
    <p>A connection is ready when your assistant returns real tool results. A copied configuration alone does not verify it.</p>
  </div>;
}
