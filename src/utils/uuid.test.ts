import { randomUuid, UUID_PATTERN } from './uuid';

test('generates RFC 4122 v4 uuids with negligible collisions', () => {
  const seen = new Set<string>();
  for (let index = 0; index < 500; index += 1) {
    const value = randomUuid();
    expect(value).toMatch(UUID_PATTERN);
    seen.add(value);
  }
  expect(seen.size).toBeGreaterThanOrEqual(490);
});
