import { formatMessage } from '../format';

describe('formatMessage', () => {
  it('should return formatted HTML for messages with HTML tags', () => {
    const content = 'This is a <code>test</code> message';
    const result = formatMessage(content);
    expect(result).toEqual({ __html: content });
  });

  it('should return null for plain text messages', () => {
    const content = 'This is a plain text message';
    const result = formatMessage(content);
    expect(result).toBeNull();
  });

  it('should return formatted HTML for messages with ul tags', () => {
    const content = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    const result = formatMessage(content);
    expect(result).toEqual({ __html: content });
  });

  it('should return formatted HTML for messages with li tags', () => {
    const content = 'Some text with <li>list item</li>';
    const result = formatMessage(content);
    expect(result).toEqual({ __html: content });
  });
});