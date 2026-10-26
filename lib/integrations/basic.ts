export function parseBasicCredentials(header: string | null): { name: string; secret: string } | null {
  const match = header?.match(/^Basic\s+(\S+)$/i);

  if (!match) {
    return null;
  }

  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  const separator = decoded.indexOf(":");

  if (separator < 1) {
    return null;
  }

  return { name: decoded.slice(0, separator), secret: decoded.slice(separator + 1) };
}
