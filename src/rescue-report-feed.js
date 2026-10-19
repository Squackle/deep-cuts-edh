// Published-report RSS derives only from the editorial published archive.
const SITE = 'https://deep-cuts-edh.pages.dev';
const archivePattern = /<nav\b(?=[^>]*\baria-label=["']Published Commander rescue reports["'])[^>]*>([\s\S]*?)<\/nav>/i;
const attr = (attrs, name) => attrs.match(new RegExp('\\b' + name + '=["\']([^"\']*)["\']', 'i'))?.[1] || '';
const decode = input => String(input).replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos|nbsp|#39);/gi, (_, entity) => {
 const e = entity.toLowerCase();
 const named = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ', '#39':"'"};
 if (e in named) return named[e];
 const n = e.startsWith('#x') ? parseInt(e.slice(2),16) : parseInt(e.slice(1),10);
 return Number.isInteger(n) && n>=32 && n<=0x10ffff && !(n>=0xd800 && n<=0xdfff) ? String.fromCodePoint(n) : '';
});
const readable = s => decode(String(s).replace(/<[^>]*>/g,'')).replace(/\s+/g,' ').trim();
const escapeXml = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');

export function extractPublishedRescueReports(html) {
 if (typeof html !== 'string' || html.length > 400000) throw new Error('Invalid homepage');
 const archive = html.match(archivePattern)?.[1];
 if (!archive) throw new Error('Published-case archive not found');
 const reports=[], seen=new Set();
 for (const match of archive.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
  if (!attr(match[1],'class').split(/\s+/).includes('hub-case-link')) continue;
  const path = decode(attr(match[1],'href'));
  if (!/^\/reports\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path)) throw new Error('Invalid published case link');
  if (seen.has(path)) throw new Error('Duplicate published report');
  const title = readable(match[2].match(/<strong\b[^>]*>([\s\S]*?)<\/strong>/i)?.[1] || '');
  const excerpt = readable(match[2].match(/<small\b[^>]*>([\s\S]*?)<\/small>/i)?.[1] || '');
  if (!title || title.length > 200 || excerpt.length > 500) throw new Error('Invalid published metadata');
  reports.push({title,excerpt,path}); seen.add(path);
 }
 if (!reports.length || reports.length > 100) throw new Error('No valid published reports');
 return reports;
}
export function renderRescueReportFeed(html) {
 const items = extractPublishedRescueReports(html).map(({title,excerpt,path}) => {
  const url=SITE+path;
  // Canonical URLs are immutable GUIDs. Avoid fabricating unknown first-publication dates.
  return [
   '    <item>',
   '      <title>'+escapeXml(title)+' — Rescue Report | Deep Cuts EDH</title>',
   '      <link>'+escapeXml(url)+'</link>',
   '      <guid isPermaLink="true">'+escapeXml(url)+'</guid>',
   '      <description>'+escapeXml(excerpt ? excerpt+'. Read the published Deep Cuts EDH Commander Rescue Report.' : 'Read the published Deep Cuts EDH Commander Rescue Report.')+'</description>',
   '    </item>'
  ].join('\n');
 }).join('\n');
 return [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<rss version="2.0">',
  '  <channel>',
  '    <title>Deep Cuts EDH — Commander Rescue Reports</title>',
  '    <link>'+SITE+'/</link>',
  '    <description>Editorially published Commander Rescue Reports from Deep Cuts EDH.</description>',
  '    <language>en-us</language>',
  '    <ttl>360</ttl>',
  items,'  </channel>','</rss>',''
 ].join('\n');
}
