#!/usr/bin/env python3
"""Check public assets, links and crawler metadata; optionally refresh their inventory."""
import argparse,hashlib,json,re,subprocess,sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote,urlsplit
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
BASE='https://covenant-common.github.io/covenant-docs'
class Page(HTMLParser):
    def __init__(self):super().__init__();self.links=[];self.meta={};self.canonical=[];self.scripts=[];self.current=None;self.main=0;self.title=False;self.titles=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='main':self.main+=1
        if tag=='title':self.title=True
        if tag=='meta':self.meta[a.get('name',a.get('property',''))]=a.get('content','')
        if tag in ('a','link','img'):
            u=a.get('href',a.get('src'))
            if u:self.links.append(u)
        if tag=='link' and a.get('rel')=='canonical':self.canonical.append(a.get('href'))
        if tag=='script':self.current={'type':a.get('type'),'data':'','src':a.get('src')};self.scripts.append(self.current)
    def handle_endtag(self,tag):
        if tag=='title':self.title=False
        if tag=='script':self.current=None
    def handle_data(self,data):
        if self.title:self.titles.append(data)
        if self.current is not None:self.current['data']+=data

def check():
    errors=[];pages={};links=0
    paths=subprocess.check_output(['git','ls-files','-z'],cwd=ROOT).decode().split('\0')
    files=[p for p in paths if p and p!='manifest.json']
    for name in files:
        p=ROOT/name
        if not p.is_file() or p.is_symlink():errors.append('Nonregular asset: '+name)
        if re.search(r'(^|/)(reports|private|custody|node_modules)(/|$)|(^|/)\.env|\.(sqlite3?|pem|key)$',name):errors.append('Private/runtime asset: '+name)
    expected={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in files if (ROOT/p).is_file()}
    manifest=json.loads((ROOT/'manifest.json').read_text())
    if manifest.get('assets')!=expected:errors.append('Asset inventory stale; run --write-manifest')
    for path in [ROOT/'index.html',*sorted((ROOT/'docs').glob('*.html'))]:
        name=path.relative_to(ROOT).as_posix();raw=path.read_text();page=Page();page.feed(raw);pages[name]=page
        expected_url=BASE+'/' if name=='index.html' else BASE+'/'+name
        if page.canonical!=[expected_url]:errors.append('Canonical URL: '+name)
        if page.main!=1 or not ''.join(page.titles).strip() or not page.meta.get('description'):errors.append('Page structure/description: '+name)
        if page.meta.get('robots')!='index,follow':errors.append('Crawler directive: '+name)
        for url in page.links:
            parsed=urlsplit(url);links+=1
            if not parsed.scheme and parsed.path:
                target=(path.parent/unquote(parsed.path)).resolve()
                if ROOT not in target.parents or not target.is_file():errors.append('Missing/outside link: '+name+' -> '+url)
        for script in page.scripts:
            allowed_controls={'docs/EXAMPLES.html':'../assets/example-controls.mjs',
                              'docs/PRICING.html':'../assets/pricing-controls.mjs'}
            if (script['type']=='module' and name in allowed_controls and
                    script['src']==allowed_controls[name] and not script['data'].strip()):
                if not (path.parent/script['src']).is_file():errors.append('Missing local-only controls: '+name)
                continue
            if script['type']!='application/ld+json' or script['src']:errors.append('Unexpected executable script: '+name)
            else:
                data=json.loads(script['data'])
                if data.get('@context')!='https://schema.org':errors.append('Structured data: '+name)
        if name in ('index.html','docs/OVERVIEW.html','docs/INVESTORS.html','docs/COLLABORATE.html','docs/WORK_WITH_US.html'):
            for key in ('og:title','og:description','og:url','og:image','twitter:card'):
                if not page.meta.get(key):errors.append('Missing '+key+': '+name)
            if page.meta.get('og:url')!=expected_url:errors.append('Share URL: '+name)
    sitemap=ET.parse(ROOT/'sitemap.xml')
    urls=[node.text for node in sitemap.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
    wanted={BASE+'/' if p=='index.html' else BASE+'/'+p for p in pages}
    if set(urls)!=wanted or len(urls)!=len(wanted):errors.append('Sitemap must contain every public HTML page once')
    robots=(ROOT/'robots.txt').read_text()
    if 'Allow: /' not in robots or 'Disallow:' in robots or 'Sitemap: '+BASE+'/sitemap.xml' not in robots:errors.append('robots.txt')
    for p in (ROOT/'README.md',ROOT/'CONTRIBUTING.md',ROOT/'SECURITY.md',ROOT/'llms.txt'):
        for href in re.findall(r'\[[^\]]+\]\(([^)]+)\)',p.read_text()):
            u=urlsplit(href)
            if not u.scheme and u.path and not (p.parent/unquote(u.path)).is_file():errors.append('Markdown link: '+str(p.relative_to(ROOT))+' -> '+href)
    for path in (ROOT/'llms.txt',ROOT/'docs/AGENT_START.html.md',ROOT/'skills/covenant-use/references/QUICKSTART.md'):
        if 'npx -y' in path.read_text() or 'uvx --from' in path.read_text():errors.append('Unavailable launcher: '+str(path.relative_to(ROOT)))
    return {'status':'FAIL' if errors else 'PASS','public_html_pages':len(pages),'local_and_external_links_examined':links,'assets':len(expected),'errors':errors,'browser_rendering':'SEPARATE','search_engine_indexing':'NOT_ESTABLISHED'}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--write-manifest',action='store_true');args=p.parse_args()
    if args.write_manifest:
        path=ROOT/'manifest.json';m=json.loads(path.read_text());names=subprocess.check_output(['git','ls-files','-z'],cwd=ROOT).decode().split('\0');m['assets']={n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest() for n in sorted(names) if n and n!='manifest.json' and (ROOT/n).is_file()};path.write_text(json.dumps(m,indent=2)+'\n')
    result=check();print(json.dumps(result,indent=2));return int(result['status']!='PASS')
if __name__=='__main__':raise SystemExit(main())
