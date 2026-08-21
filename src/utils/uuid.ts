const HEX = '0123456789abcdef';

/**
 * Self-contained UUID v4. The Hermes runtime's global crypto surface varies by engine
 * build, so sync identifiers never depend on it — the RPC gateway rejects non-UUID ids.
 */
export function randomUuid(): string {
  let out = '';
  for (let index = 0; index < 36; index += 1) {
    if (index === 8 || index === 13 || index === 18 || index === 23) {
      out += '-';
    } else if (index === 14) {
      out += '4';
    } else if (index === 19) {
      out += HEX[8 + Math.floor(Math.random() * 4)];
    } else {
      out += HEX[Math.floor(Math.random() * 16)];
    }
  }
  return out;
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
