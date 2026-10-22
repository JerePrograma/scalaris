#!/usr/bin/env python3
"""Add only healthy, explicitly selected demo routes to the existing Caddy site."""
from pathlib import Path
from datetime import datetime, timezone
import os
import shutil
import subprocess
import sys
import urllib.request

APPS = {
    'pharmahome': (18093, '/health', 'pharmahome-demo-web', ['/pharmahome']),
    'calendario-servicios': (18094, '/health', 'calendario-demo-web', ['/calendario-servicios']),
    'gestudio': (18091, '/healthz', 'gestudio-demo-web', ['/gestudio', '/gestudio-api']),
    'fourbubbles': (18092, '/health', 'fourbubbles-demo-web', ['/fourbubbles', '/fourbubbles-api']),
}
selected = sys.argv[1:]
if not selected or any(name not in APPS for name in selected):
    raise SystemExit('Select only known demo names')
for name in selected:
    port, health, _, _ = APPS[name]
    with urllib.request.urlopen(f'http://127.0.0.1:{port}{health}', timeout=10) as response:
        if response.status != 200:
            raise SystemExit(f'Health check failed: {name}')

site = Path('/srv/infrastructure/caddy/sites/apps.caddy')
routes = site.parent / 'demos'
marker = 'srv2083548.hstgr.cloud {'
include = '    import /etc/caddy/sites/demos/*.routes'
original = site.read_text()
if original.count(marker) != 1:
    raise SystemExit('Existing site does not match expected hostname; no changes made')
stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup = Path('/var/backups/scalaris') / f'before-demo-routes-{stamp}'
backup.mkdir(mode=0o700)
shutil.copy2(site, backup / 'apps.caddy')
if routes.exists():
    shutil.copytree(routes, backup / 'demos')
routes.mkdir(mode=0o755, exist_ok=True)
previous = {name: (routes / f'{name}.routes').read_bytes() if (routes / f'{name}.routes').exists() else None for name in selected}
try:
    for name in selected:
        _, _, upstream, prefixes = APPS[name]
        paths = ' '.join(path for prefix in prefixes for path in [prefix, f'{prefix}/*'])
        matcher = name.replace('-', '_')
        text = f'''@demo_{matcher} path {paths}
handle @demo_{matcher} {{
    reverse_proxy {upstream}:8080 {{
        header_up Host scalaris.com.ar
        header_up X-Forwarded-Host scalaris.com.ar
        header_up X-Forwarded-Proto https
    }}
}}
'''
        (routes / f'{name}.routes').write_text(text)
    updated = original if include in original else original.replace(marker, f'{marker}\n{include}', 1)
    site.write_text(updated)
    base = ['docker', 'exec', 'scalaris-proxy-caddy-1', 'caddy']
    for action in ['validate', 'reload']:
        result = subprocess.run(base + [action, '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile'], capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError(f'Caddy {action} failed: {result.stderr[-1200:]}')
except Exception:
    site.write_text(original)
    for name, content in previous.items():
        path = routes / f'{name}.routes'
        if content is None:
            path.unlink(missing_ok=True)
        else:
            path.write_bytes(content)
    subprocess.run(['docker', 'exec', 'scalaris-proxy-caddy-1', 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile'], capture_output=True)
    raise
print('ROUTES_ENABLED: ' + ', '.join(selected))
print('Configuration backup: ' + str(backup))
