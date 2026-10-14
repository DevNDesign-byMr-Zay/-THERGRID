import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const directory = new URL('../apps/aethergrid-console/web/local-dist/', import.meta.url);
const javascript = await readFile(new URL('workspace.js', directory), 'utf8');
const css = await readFile(new URL('workspace.css', directory), 'utf8');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="ÆTHERGRID spatial intelligence workspace. Direct-open local interface with 4D controls.">
<meta name="theme-color" content="#07090f"><title>ÆTHERGRID · Local workspace</title>
<style>${css.replaceAll('</style', '<\\/style')}
#local-boot{position:fixed;inset:0;display:grid;place-content:center;background:#07090f;color:#b9e7ee;font:16px system-ui;letter-spacing:.25em;z-index:9999;text-align:center}
#local-boot span{margin:18px auto;width:36px;height:36px;border:2px solid #253841;border-top-color:#a3efff;border-radius:50%;animation:boot-spin 1.2s linear infinite}
@keyframes boot-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){#local-boot span{animation:none}}
.local-file-status{position:fixed;bottom:4px;left:50%;transform:translateX(-50%);z-index:60;max-width:95vw;padding:4px 10px;border:1px solid #55747d;background:#0c141bea;color:#c4dbe0;font:11px system-ui;border-radius:6px;text-align:center}
.local-file-status a{color:#9feaff;margin-left:8px}
</style></head><body><div id="local-boot">ÆTHERGRID<span></span><small>Opening your workspace</small></div><div id="root"></div>
<script>${javascript.replaceAll('</script', '<\\/script')}</script>
<script>new MutationObserver(function(_,observer){if(document.querySelector('.spatial-shell')){document.getElementById('local-boot').remove();observer.disconnect();}}).observe(document.getElementById('root'),{childList:true,subtree:true});setTimeout(function(){var boot=document.getElementById('local-boot');if(boot)boot.innerHTML='Workspace could not start. Please extract the ZIP and open index.html in your browser.';},15000);</script>
</body></html>`;
await writeFile(new URL('index.html', directory), html);
process.stdout.write(
  `Built direct-open ÆTHERGRID HTML: ${fileURLToPath(new URL('index.html', directory))}\n`,
);
