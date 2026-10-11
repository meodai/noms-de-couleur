import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');
const colors = JSON.parse(await read('colors.json'));

test('every color has a name, a valid hex and a link', () => {
  for (const c of colors) {
    assert.ok(c.name, JSON.stringify(c));
    assert.match(c.hex, /^#[0-9a-f]{6}$/, c.name);
    assert.ok(c.link, c.name);
  }
});

test('names are not enumerations or codes', () => {
  for (const c of colors) {
    assert.doesNotMatch(c.name, /\s\d+$|(?<!\p{L})RAL \d/iu);
  }
});

test('names are unique', () => {
  const names = colors.map(c => c.name.toLowerCase());
  assert.equal(new Set(names).size, names.length);
});

test('hex values are unique', () => {
  const hexes = colors.map(c => c.hex);
  assert.equal(new Set(hexes).size, hexes.length);
});

test('user creations keep their hex values', async () => {
  const { colors: userColors } = JSON.parse(await read('src/userCreations.json'));
  const hexes = new Set(colors.map(c => c.hex));
  for (const c of userColors) assert.ok(hexes.has(c.hex.toLowerCase()), c.name);
});

test('minified json and csv match colors.json', async () => {
  assert.deepEqual(JSON.parse(await read('colors.min.json')), colors);
  assert.equal((await read('colors.csv')).trim().split('\n').length, colors.length + 1);
});

test('readme count matches', async () => {
  assert.match(await read('README.md'), new RegExp(`\\(\\*\\*${colors.length}\\*\\*\\)`));
});
