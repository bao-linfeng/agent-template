import {
  parseDocument,
  resolveFormat,
  UnsupportedDocumentError,
} from './document-parsers.js';

describe('document parsers', () => {
  it('resolves supported formats by extension', () => {
    expect(resolveFormat('Notes.MD')).toEqual({
      extension: '.md',
      mimeType: 'text/markdown',
    });
    expect(resolveFormat('data.json').mimeType).toBe('application/json');
    expect(() => resolveFormat('report.pdf')).toThrow(UnsupportedDocumentError);
    expect(() => resolveFormat('README')).toThrow(UnsupportedDocumentError);
  });

  it('decodes UTF-8 text and strips the BOM', () => {
    const withBom = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from('你好 world', 'utf8'),
    ]);
    expect(parseDocument(withBom, 'text/plain')).toBe('你好 world');
  });

  it('rejects binary and invalid UTF-8 content', () => {
    expect(() =>
      parseDocument(Buffer.from([0x61, 0x00, 0x62]), 'text/plain'),
    ).toThrow(/binary/);
    expect(() =>
      parseDocument(Buffer.from([0xff, 0xfe, 0xfd]), 'text/plain'),
    ).toThrow(/UTF-8/);
  });

  it('extracts readable text from HTML', () => {
    const html =
      '<html><head><style>p{}</style><script>alert(1)</script></head><body><h1>Title</h1><p>A &amp; B</p></body></html>';
    const text = parseDocument(Buffer.from(html), 'text/html');
    expect(text).toContain('Title');
    expect(text).toContain('A & B');
    expect(text).not.toContain('alert');
    expect(text).not.toContain('<');
  });
});
