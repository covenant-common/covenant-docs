#!/usr/bin/env python3
"""Check public assets, links and crawler metadata; optionally refresh their inventory."""
import argparse,hashlib,json,re,subprocess,sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote,urlsplit
from version_public_assets import outdated
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
BASE='https://covenant-common.github.io/covenant-docs'
class Page(HTMLParser):
    def __init__(self):super().__init__();self.links=[];self.meta={};self.canonical=[];self.scripts=[];self.current=None;self.main=0;self.title=False;self.titles=[];self.ids=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if a.get('id'):self.ids.append(a['id'])
        if tag=='main':self.main+=1
        if tag=='title':self.title=True
        if tag=='meta':self.meta[a.get('name',a.get('property',''))]=a.get('content','')
        if tag in ('a','link','img'):
            u=a.get('href',a.get('src'))
            if u:self.links.append(u)
        if tag=='link' and a.get('rel')=='canonical':self.canonical.append(a.get('href'))
        if tag=='script':self.current={'type':a.get('type'),'data':'','src':a.get('src'),'defer':'defer' in a};self.scripts.append(self.current)
    def handle_endtag(self,tag):
        if tag=='title':self.title=False
        if tag=='script':self.current=None
    def handle_data(self,data):
        if self.title:self.titles.append(data)
        if self.current is not None:self.current['data']+=data

def check():
    errors=[];pages={};links=0
    if outdated():errors.append('Style/script versions stale; run tools/version_public_assets.py')
    paths=subprocess.check_output(['git','ls-files','-z'],cwd=ROOT).decode().split('\0')
    files=[p for p in paths if p and p!='manifest.json']
    for name in files:
        p=ROOT/name
        if not p.is_file() or p.is_symlink():errors.append('Nonregular asset: '+name)
        if re.search(r'(^|/)(reports|private|custody|node_modules)(/|$)|(^|/)\.env|\.(sqlite3?|pem|key)$',name):errors.append('Private/runtime asset: '+name)
    expected={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in files if (ROOT/p).is_file()}
    manifest=json.loads((ROOT/'manifest.json').read_text())
    if manifest.get('assets')!=expected:errors.append('Asset inventory stale; run --write-manifest')
    for path in [ROOT/'index.html',*sorted((ROOT/'docs').rglob('*.html'))]:
        name=path.relative_to(ROOT).as_posix();raw=path.read_text();page=Page();page.feed(raw);pages[name]=page
        expected_url=BASE+'/' if name=='index.html' else BASE+'/'+name
        if page.canonical!=[expected_url]:errors.append('Canonical URL: '+name)
        if page.main!=1 or not ''.join(page.titles).strip() or not page.meta.get('description'):errors.append('Page structure/description: '+name)
        technical=name.startswith('docs/technical/')
        if page.meta.get('robots')!=('noindex,follow' if technical else 'index,follow'):errors.append('Crawler directive: '+name)
        for url in page.links:
            parsed=urlsplit(url);links+=1
            if not parsed.scheme and parsed.path:
                target=(path.parent/unquote(parsed.path)).resolve()
                if ROOT not in target.parents or not target.is_file():errors.append('Missing/outside link: '+name+' -> '+url)
        for script in page.scripts:
            script_path=urlsplit(script['src']).path if script['src'] else None
            local_script=script_path if not script['src'] or not urlsplit(script['src']).scheme and not urlsplit(script['src']).netloc else None
            allowed_live={'index.html':{'assets/story-scripts.js','assets/story-characters.js','assets/story-player.js','assets/public-feedback.js'},
                          'docs/TRIAL.html':{'../assets/trial-client.js'},
                          'docs/PAYMENTS.html':{'../assets/payment-options.js'},
                          'docs/MATRIX.html':{'../assets/matrix.js','../assets/deal-structures.js'},
                          'docs/TERMINAL.html':{'../assets/terminal.js','../assets/deal-structures.js'},
                          'docs/DEAL_STRUCTURES.html':{'../assets/deal-structures.js'}}
            if (name in allowed_live and script['type'] is None and script['defer'] and
                    local_script in allowed_live[name] and not script['data'].strip()):
                if not (path.parent/local_script).is_file():errors.append('Missing public-directory controls: '+name)
                continue
            allowed_controls={'docs/EXAMPLES.html':'../assets/example-controls.mjs',
                              'docs/PRICING.html':'../assets/pricing-controls.mjs'}
            if (script['type']=='module' and name in allowed_controls and
                    local_script==allowed_controls[name] and not script['data'].strip()):
                if not (path.parent/local_script).is_file():errors.append('Missing local-only controls: '+name)
                continue
            if script['type']!='application/ld+json' or script['src']:errors.append('Unexpected executable script: '+name)
            else:
                data=json.loads(script['data'])
                if data.get('@context')!='https://schema.org':errors.append('Structured data: '+name)
        if name in ('index.html','docs/OVERVIEW.html','docs/INVESTORS.html','docs/COLLABORATE.html','docs/WORK_WITH_US.html'):
            for key in ('og:title','og:description','og:url','og:image','twitter:card'):
                if not page.meta.get(key):errors.append('Missing '+key+': '+name)
            if page.meta.get('og:url')!=expected_url:errors.append('Share URL: '+name)
    # A surviving URL can still send visitors to the wrong or a missing step.
    for name,page in pages.items():
        if len(page.ids)!=len(set(page.ids)):errors.append('Duplicate page anchors: '+name)
        for href in page.links:
            u=urlsplit(href)
            if u.scheme or not u.fragment:continue
            target=((ROOT/name).parent/unquote(u.path)).resolve() if u.path else ROOT/name
            relative=target.relative_to(ROOT).as_posix() if ROOT in target.parents else None
            if relative in pages and unquote(u.fragment) not in pages[relative].ids:
                errors.append('Missing page anchor: '+name+' -> '+href)
    for route in json.loads((ROOT/'covenant.json').read_text()).get('routes',[]):
        guide=route.get('guide','');u=urlsplit(guide)
        if u.scheme:continue
        if u.path not in pages or (u.fragment and unquote(u.fragment) not in pages[u.path].ids):
            errors.append('Missing catalog guide: '+str(route.get('id'))+' -> '+guide)
    sitemap=ET.parse(ROOT/'sitemap.xml')
    urls=[node.text for node in sitemap.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
    wanted={BASE+'/' if p=='index.html' else BASE+'/'+p for p in pages if not p.startswith('docs/technical/')}
    if set(urls)!=wanted or len(urls)!=len(wanted):errors.append('Sitemap must contain every public HTML page once')
    robots=(ROOT/'robots.txt').read_text()
    if 'Allow: /' not in robots or 'Disallow:' in robots or 'Sitemap: '+BASE+'/sitemap.xml' not in robots:errors.append('robots.txt')
    for p in (ROOT/'README.md',ROOT/'CONTRIBUTING.md',ROOT/'SECURITY.md',ROOT/'llms.txt'):
        for href in re.findall(r'\[[^\]]+\]\(([^)]+)\)',p.read_text()):
            u=urlsplit(href)
            if not u.scheme and u.path and not (p.parent/unquote(u.path)).is_file():errors.append('Markdown link: '+str(p.relative_to(ROOT))+' -> '+href)
    for path in (ROOT/'llms.txt',ROOT/'docs/AGENT_START.html.md',ROOT/'skills/covenant-use/references/QUICKSTART.md'):
        if 'npx -y' in path.read_text() or 'uvx --from' in path.read_text():errors.append('Unavailable launcher: '+str(path.relative_to(ROOT)))
    technical_count=sum(p.startswith('docs/technical/') for p in pages)
    return {'status':'FAIL' if errors else 'PASS','public_html_pages':len(pages)-technical_count,'technical_reference_pages':technical_count,'local_and_external_links_examined':links,'assets':len(expected),'errors':errors,'browser_rendering':'SEPARATE','search_engine_indexing':'NOT_ESTABLISHED'}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--write-manifest',action='store_true');args=p.parse_args()
    if args.write_manifest:
        path=ROOT/'manifest.json';m=json.loads(path.read_text());names=subprocess.check_output(['git','ls-files','-z'],cwd=ROOT).decode().split('\0');m['assets']={n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest() for n in sorted(names) if n and n!='manifest.json' and (ROOT/n).is_file()};path.write_text(json.dumps(m,indent=2)+'\n')
    result=check();print(json.dumps(result,indent=2));return int(result['status']!='PASS')
if __name__=='__main__':raise SystemExit(main())
