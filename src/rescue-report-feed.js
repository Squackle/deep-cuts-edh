// Published-report RSS derives only from the editorial published archive.
const SITE = 'https://deep-cuts-edh.pages.dev';
const archivePattern = /<nav\b(?=[^>]*\baria-label=["']Published Commander rescue reports["'])[^>]*>([\s\S]*?)<\/nav>/i;
const attr = (attrs, name) => attrs.match(new RegExp('\\b' + name + '=["\']([^"\']*)["\']', 'i'))?.[1] || '';
// Validate before normalization: dropping an invalid entity can turn a
// malformed path into a different, apparently valid canonical report URL.
const validXmlCodePoint = cp => cp === 9 || cp === 10 || cp === 13 ||
 (cp >= 32 && cp <= 0xd7ff) || (cp >= 0xe000 && cp <= 0xfffd) ||
 (cp >= 0x10000 && cp <= 0x10ffff);
const decode = input => String(input).replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos|nbsp|#39);/gi, (_, entity) => {
 const e = entity.toLowerCase();
 const named = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ', '#39':"'"};
 if (e in named) return named[e];
 const n = e.startsWith('#x') ? parseInt(e.slice(2),16) : parseInt(e.slice(1),10);
 if (!Number.isInteger(n) || !validXmlCodePoint(n)) throw new Error('Invalid XML character in published entity');
 return String.fromCodePoint(n);
});
// Archive metadata is editorial plain text, not arbitrary HTML. Reject markup
// instead of deleting tag-shaped substrings (which can reconstruct new tags).
const readable = s => {
 if (s.includes('<') || s.includes('>')) throw new Error('Invalid published metadata markup');
 const text = decode(s);
 for (const ch of text) if (!validXmlCodePoint(ch.codePointAt(0))) throw new Error('Invalid XML character in published metadata');
 return text.replace(/\s+/g,' ').trim();
};
// XML 1.0 text nodes cannot contain forbidden controls or lone surrogates.
const escapeXml = s => {
 const text = String(s);
 for (const ch of text) {
  const cp = ch.codePointAt(0);
  if (!validXmlCodePoint(cp)) {
   throw new Error('Invalid XML character in published metadata');
  }
 }
 return text.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[ch]);
};
// RSS description text is commonly parsed as HTML after XML decoding.
// Encode HTML text first, then serialize the resulting string as XML.
const escapeDescription = s => escapeXml(escapeXml(s));

export function extractPublishedRescueReports(html) {
 if (typeof html !== 'string' || html.length > 400000) throw new Error('Invalid homepage');
 const archive = html.match(archivePattern)?.[1];
 if (!archive) throw new Error('Published-case archive not found');
 const reports=[], seen=new Set();
 for (const match of archive.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
  if (!attr(match[1],'class').split(/\s+/).includes('hub-case-link')) continue;
  const path = decode(attr(match[1],'href'));
  if (!/^\/reports\/[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/.test(path)) throw new Error('Invalid published case link');
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
   '      <description>'+escapeDescription(excerpt ? excerpt+'. Read the published Deep Cuts EDH Commander Rescue Report.' : 'Read the published Deep Cuts EDH Commander Rescue Report.')+'</description>',
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
