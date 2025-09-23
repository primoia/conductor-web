export const formatMessage = (content: string) => {
  if (content.includes('<ul>') || content.includes('<li>') || content.includes('<code>')) {
    return { __html: content };
  }
  return null;
};