import { splitText } from './text-splitter.js';

describe('splitText', () => {
  it('returns no chunks for blank input and one chunk for short text', () => {
    expect(splitText('  \n\n ', { chunkSize: 100, chunkOverlap: 10 })).toEqual(
      [],
    );
    expect(
      splitText(' hello world ', { chunkSize: 100, chunkOverlap: 10 }),
    ).toEqual(['hello world']);
  });

  it('prefers paragraph boundaries and keeps every chunk within the size', () => {
    const paragraphs = Array.from(
      { length: 6 },
      (_, i) => `Paragraph ${i} ${'word '.repeat(10).trim()}.`,
    );
    const chunks = splitText(paragraphs.join('\n\n'), {
      chunkSize: 120,
      chunkOverlap: 0,
    });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(120);
    }
    expect(chunks[0]!.startsWith('Paragraph 0')).toBe(true);
    expect(chunks.join(' ')).toContain('Paragraph 5');
  });

  it('splits CJK text on sentence punctuation', () => {
    const text = '第一句话讲猫。第二句话讲狗。第三句话讲鸟。第四句话讲鱼。';
    const chunks = splitText(text, { chunkSize: 14, chunkOverlap: 0 });
    expect(chunks).toEqual([
      '第一句话讲猫。第二句话讲狗。',
      '第三句话讲鸟。第四句话讲鱼。',
    ]);
  });

  it('overlaps consecutive chunks', () => {
    const text = Array.from({ length: 30 }, (_, i) => `w${i}`).join(' ');
    const chunks = splitText(text, { chunkSize: 30, chunkOverlap: 10 });
    expect(chunks.length).toBeGreaterThan(2);
    for (let i = 1; i < chunks.length; i++) {
      const previousWords = chunks[i - 1]!.split(' ');
      expect(chunks[i]!.split(' ')[0]).toBe(
        previousWords.find((word) => chunks[i]!.startsWith(word)),
      );
    }
  });

  it('hard-cuts text without separators', () => {
    const chunks = splitText('x'.repeat(250), {
      chunkSize: 100,
      chunkOverlap: 0,
    });
    expect(chunks.map((chunk) => chunk.length)).toEqual([100, 100, 50]);
  });

  it('validates options', () => {
    expect(() =>
      splitText('text', { chunkSize: 10, chunkOverlap: 10 }),
    ).toThrow();
  });
});
