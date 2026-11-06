import TurndownService from 'turndown';
import {marked} from 'marked';
import DOMPurify from 'dompurify';
const converter = new TurndownService({headingStyle: 'atx', codeBlockStyle: 'fenced'});
// Rich article blocks and tables remain valid inline HTML inside Markdown.
converter.keep(['table','aside','section','figure','details','div','u']);
export function serializeArticle({title, labels, html}) {
  return '<!-- duy-editor:' + JSON.stringify({title, labels}).replace(/</g, '\\u003c').replace(/>/g, '\\u003e') + ' -->\n\n# ' + title.replace(/\r?\n/g, ' ') + '\n\n' + converter.turndown(html) + '\n';
}
export function parseArticle(content, name = 'Bài viết') {
  let title = name.replace(/\.md$/i, ''), labels = '';
  const match = content.match(/^<!-- duy-editor:(.*?) -->\r?\n/);
  if (match) {
    const data = JSON.parse(match[1]);
    title = typeof data.title === 'string' ? data.title : title;
    labels = typeof data.labels === 'string' ? data.labels : '';
    content = content.slice(match[0].length).replace(/^\s*# [^\r\n]*(?:\r?\n|$)/, '');
  } else {
    const heading = content.match(/^# (.+)(?:\r?\n|$)/);
    if (heading) { title = heading[1]; content = content.slice(heading[0].length); }
  }
  return {title, labels, html: DOMPurify.sanitize(marked.parse(content), {ADD_ATTR: ['class', 'data-kind'], FORBID_TAGS: ['style','iframe','object','embed']})};
}
