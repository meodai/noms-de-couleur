import { readFile, writeFile } from 'node:fs/promises';
import puppeteer from 'puppeteer';
import titleCaseFrench from 'titlecase-french';
import { formatHex, converter } from 'culori';

const rgbconv = converter('rgb');

// to add
// - http://pourpre.com/fr/dictionnaire/alpha/c
// - https://encycolorpedia.fr/named
// - https://podarilove.ru/fr/unusual-names-of-color-shades/ <- probably manually

const pages = [
  {
    name: 'influenz.design',
    sources: [
      'https://influenz.design/mag/couleurs-et-leurs-noms',
    ],
    fn: _ => {
      const colorList = [];
      const colorTable = document.querySelector('div.col.sqs-col-12.span-12');
      const colorRows = colorTable.querySelectorAll('div.summary-item-has-thumbnail');

      for (let y = 1; y < colorRows.length; y++) {
        const colorRow = colorRows[y];
        const $wrap = colorRow.querySelector('.summary-excerpt-gallery-caption-description');
        
        if ($wrap) {
          const $link = colorRow.querySelector('a');
          const titleParts = $link.dataset.title.split(' / ');
          let link = $link.getAttribute('href');
          // if link does not start with http, it's a relative link
          // so we need to add the domain
          if (link && !link.startsWith('http')) {
            link = 'https://influenz.design' + link;
          }
          
          const hex = titleParts[1].trim();
          const name = titleParts[0].trim();
          colorList.push({
            name, hex, link,
          });
        }
      }

      return colorList;
    }
  },
  {
    name: 'Wiktionary',
    sources: [
      'https://fr.wiktionary.org/wiki/Th%C3%A9saurus:couleur/fran%C3%A7ais'
    ],
    fn: _ => {
      const colorList = [];
      const colorTable = document.querySelector('table.wikitable.sortable');
      const colorRows = colorTable.querySelectorAll('tr:not(:first-child)');

      for (let y = 1; y < colorRows.length; y++) {
        const colorRow = colorRows[y];
        let $wrap = colorRow.querySelector('td:nth-child(1) a');

        //sometimes people mess up the links
        $wrap = $wrap ? $wrap : colorRow.querySelector('td');  
        
        const name = $wrap.innerText;
        const link = $wrap.href;
        // because sometimes the bgcolor attribute is not a valid color
        // but somehow the browser gets it right anyway
        const hex = window.getComputedStyle(
          colorRow.querySelector('td:nth-child(2)')
        )['background-color'];
        colorList.push({
          name, hex, link,
        });
        
      }

      return colorList;
    }
  },
  {
    name: 'deleze.name/marcel/',
    sources: [
      'https://www.deleze.name/marcel/photo/noms-couleurs/454-couleurs.php',
    ],
    fn: _ => {
      const colorList = [];
      const colorTable = document.querySelector('table.struct tr:nth-child(2)');
      const colorRows = colorTable.querySelectorAll('div.struct:not(:first-child)');

      for (let y = 1; y < colorRows.length; y++) {
        const colorRow = colorRows[y];
        
        const link = 'https://www.deleze.name/marcel/photo/noms-couleurs/454-couleurs.php';
        const hex = colorRow.querySelector('.couleur').style['background-color'];
        colorRow.querySelector('.couleur').remove(); // it contains p's :D
        const name = colorRow.querySelector('p').innerHTML.replace(/&nbsp;/g, '').split('<br>')[0];
        colorList.push({
          name, hex, link,
        });
        
      }

      return colorList;
    }
  },
  {
    name: 'Dulux',
    sources: [
      // the hue filters are ignored now, the color wall always contains every color
      'https://www.duluxvalentine.com/fr/couleurs/filters/h_White',
    ],
    fn: _ => {
      const colorList = [];
      const colorBoxes = document.querySelectorAll('.js-color-box[data-hex]');

      for (const colorBox of colorBoxes) {
        const link = new URL(colorBox.dataset.href, location.origin).href;
        const hex = colorBox.dataset.hex;
        const name = colorBox.dataset.name;

        colorList.push({
          name, hex, link,
        });
      }

      return colorList;
    }
  },
  {
    name: 'Papeteries Montsegur',
    sources: [
      'https://www.papeteries-montsegur.com/content/23-nuancier-interactif?content_only=1',
    ],
    fn: _ => {
      const colorList = [];
      const colorRows = document.querySelectorAll('#sb-container > div:not(:last-child)');

      for (let y = 1; y < colorRows.length; y++) {
        const colorRow = colorRows[y];
        
        const link = 'https://www.papeteries-montsegur.com/';
        const hex = window.getComputedStyle(
          colorRow
        )['background-color'];
        const name = colorRow.querySelector('h4 > span').innerHTML.split('<br>')[0].trim();

        colorList.push({
          name, hex, link,
        });
        
      }

      return colorList;
    }
  },
  {
    name: 'Peintures MF',
    sources: [
      'https://www.peinturesmf.com/couleurs/',
    ],
    fn: _ => {
      const colorList = [];
      const colorRows = document.querySelectorAll('.row.no-gutters.align-items-center.my-auto a');

      for (let y = 1; y < colorRows.length; y++) {
        const colorRow = colorRows[y];
        const $el = colorRow.querySelector('.pastille-couleur');
        const link = colorRow.href;
        const hex = $el.style['background-color'];
        const name = $el.innerHTML.split(' - ')[1].trim();

        colorList.push({
          name, hex, link,
        });
        
      }

      return colorList;
    }
  },
];


const userColors = JSON.parse(
  await readFile(new URL('../src/userCreations.json', import.meta.url), 'utf8'),
).colors;

let colors = userColors.map(color => ({
  name: color.name,
  hex: color.hex,
  link: color.link ?? `https://github.com/meodai/noms-de-couleur/#authors-${color.author}`,
}));

const browser = await puppeteer.launch();

try {
  for (const { sources, fn } of pages) {
    for (const source of sources) {
      const page = await browser.newPage();
      console.log(`visiting ${source}`);
      await page.goto(source);
      colors.push(...await page.evaluate(fn));
      await page.close();
    }
  }
} finally {
  await browser.close();
}

// the Dulux color wall only shows part of the catalog, the rest is listed in the sitemap
const duluxLinks = new Set(colors.map(c => c.link).filter(link => link.includes('duluxvalentine.com')));
colors.push(...await fetchDuluxCatalog(duluxLinks));

async function fetchDuluxCatalog(knownLinks, concurrency = 6) {
  const sitemap = await (await fetch('https://www.duluxvalentine.com/fr/sitemap.xml')).text();
  const links = [...new Set(
    [...sitemap.matchAll(/<loc>(https:\/\/www\.duluxvalentine\.com\/fr\/couleurs\/[a-z0-9-]+-\d{5,})<\/loc>/g)]
      .map(m => m[1]),
  )].filter(link => !knownLinks.has(link));

  console.log(`visiting ${links.length} Dulux color pages`);

  const decode = str => str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const results = new Array(links.length);
  let next = 0;
  let skipped = 0;

  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < links.length) {
      const i = next++;
      const link = links[i];
      const id = link.match(/-(\d+)$/)[1];
      try {
        const res = await fetch(link);
        const html = res.ok ? await res.text() : '';
        const m = html.match(new RegExp(`data-ccid="${id}" data-label="([^"]+)" data-hex="(#[0-9a-f]{6})"`, 'i'));
        // some sitemap entries are product pages without a color card
        if (m) results[i] = { name: decode(m[1]), hex: m[2], link };
        else skipped++;
      } catch (e) {
        console.warn(`could not fetch ${link}: ${e.cause?.message ?? e.message}`);
      }
    }
  }));

  console.log(`skipped ${skipped} Dulux pages without a color`);
  return results.filter(Boolean);
}

// data sanitization
// titlecase-french drops the accents of the letters it capitalizes ("écru" -> "Ecru"),
// the accent-less version is kept as sort and deduplication key, the name gets its accents back
const sortKeys = new Map();
for (const c of colors) {
  const raw = c.name.replace(/’/g, "'").replace(/(?<!\p{L})RAL \d+/giu, '').trim().normalize();
  const titled = titleCaseFrench.convert(raw);
  // remove parentheses and their contents from the name
  sortKeys.set(c, titled.replace(/\(.*\)/, '').trim());
  c.name = restoreAccents(raw, titled).replace(/\(.*\)/, '').trim();
  c.hex = formatHex(c.hex);
  if (!c.hex) {
    console.warn(`invalid hex: ${c.name} (${c.link})`);
  }
}

function restoreAccents(original, titled) {
  if (original.length !== titled.length) return titled;
  const base = char => char.normalize('NFD')[0].toLowerCase();
  return [...titled].map((char, i) => {
    const source = original[i];
    if (char === source || base(char) !== base(source)) return char;
    return char === char.toUpperCase() ? source.toUpperCase() : source.toLowerCase();
  }).join('');
}

// drop numbered shades like "Terre Cuite 1", "Terre Cuite 2"…
colors = colors.filter(c => !/\s\d+$/.test(c.name));

// remove duplicate names while keeping the first occurrence
const normalizeName = name => name.normalize().toLowerCase().replace(/-/g, ' ').replace(/œ/g, 'oe');
const seenNames = new Set();
colors = colors.filter(c => {
  const key = normalizeName(sortKeys.get(c));
  if (seenNames.has(key)) return false;
  seenNames.add(key);
  return true;
});

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
colors.sort((a, b) => compare(sortKeys.get(a), sortKeys.get(b)) || compare(a.name, b.name));

// find duplicate hex values and shift each subsequent one a bit to make each color unique
const byHex = Map.groupBy(colors, c => c.hex);
const usedHexes = new Set(byHex.keys());
for (const [hex, dupes] of byHex) {
  if (dupes.length < 2) continue;
  console.warn(`duplicate hex: ${hex} (${dupes.map(c => c.name).join(', ')})`);
  for (const c of dupes.slice(1)) {
    let step = 1;
    let shifted;
    do {
      shifted = shiftColor(hex, step++ / 255);
    } while (usedHexes.has(shifted));
    c.hex = shifted;
    usedHexes.add(shifted);
  }
}

function shiftColor(hex, shift) {
  const rgb = rgbconv(hex);
  for (const channel of ['r', 'g', 'b']) {
    rgb[channel] += shift;
    if (rgb[channel] > 1) rgb[channel] = 2 - rgb[channel];
  }
  return formatHex(rgb);
}

// update color count in README.md
const readmePath = new URL('../README.md', import.meta.url);
const readme = await readFile(readmePath, 'utf8');
await writeFile(readmePath, readme.replace(/\(\*{2}(\d+)\*{2}\)/gm, `(**${colors.length}**)`));

const csvField = value => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const csv = 'name,hex,link\n' + colors.map(c => [c.name, c.hex, c.link].map(csvField).join(',')).join('\n');

const out = file => new URL(`../${file}`, import.meta.url);
await writeFile(out('colors.csv'), csv);
await writeFile(out('colors.min.json'), JSON.stringify(colors));
await writeFile(out('colors.json'), JSON.stringify(colors, null, 2));
