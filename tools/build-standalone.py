"""Builds dist/DCF-Workbench.html: one self-contained file (styles, scripts, example data and Excel templates
embedded) that runs by double-clicking it, with no web server."""
import base64, json, pathlib
R = pathlib.Path(__file__).resolve().parent.parent
css = (R / 'css/app.css').read_text()
js = ''.join((R / f).read_text() + '\n' for f in ['js/vendor/jszip.min.js', 'js/fields.js', 'js/engine.js', 'js/model.js', 'js/sec.js', 'js/nwc.js', 'js/data.js', 'js/analysis.js', 'js/help.js', 'js/nwc-help.js', 'js/charts.js', 'js/excel.js', 'js/comps-engine.js', 'js/comps-data.js', 'js/comps-model.js', 'js/comps-help.js', 'js/comps-export.js', 'js/comps-app.js', 'js/sec-cache.js', 'js/fsm-engine.js', 'js/fsm-data.js', 'js/fsm-model.js', 'js/fsm-help.js', 'js/fsm-export.js', 'js/fsm-app.js', 'js/sim-engine.js', 'js/sim-model.js', 'js/sim-help.js', 'js/sim-app.js', 'js/app.js'])
sample = json.loads((R / 'data/amzn-sample.json').read_text())
tpl = {k: base64.b64encode((R / f'templates/dcf-template-{k}.xlsx').read_bytes()).decode() for k in ('corrected', 'original')}
html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>DCF Pro</title>
<script>try{{var t=localStorage.getItem("dcfcalc.theme");if(t)document.documentElement.setAttribute("data-theme",t);}}catch(e){{}}</script>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">
<style>{css}</style></head><body>
<div class="app"><header class="topbar" id="topbar"></header><nav class="rail" id="rail" aria-label="Model sections"></nav><main class="main" id="main"></main></div>
<div id="drawer-root"></div><div id="modal-root"></div>
<script>window.DCF_SAMPLE = {json.dumps(sample)}; window.DCF_TEMPLATES = {json.dumps(tpl)};</script>
<script>{js}</script>
</body></html>
'''
(R / 'dist').mkdir(exist_ok=True)
(R / 'dist/DCF-Workbench.html').write_text(html)
print('wrote dist/DCF-Workbench.html', len(html))
