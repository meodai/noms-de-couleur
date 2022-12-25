import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import titleCaseFrench from 'titlecase-french';
import { formatHex, converter } from 'culori';
const userColors = JSON.parse( 
  fs.readFileSync(path.normalize('src/userCreations.json'), 'utf8') 
).colors;

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
      'https://www.duluxvalentine.com/fr/couleurs/filters/h_White#tabId=item0',
      'https://www.duluxvalentine.com/fr/couleurs/filters/h_Red#tabId=item0',
      'https://www.duluxvalentine.com/fr/couleurs/filters/h_Orange#tabId=item0',
      'https://www.duluxvalentine.com/fr/couleurs/filters/h_Gold#tabId=item0',
      'https://www.duluxvalentine.com/fr/couleurs/filters/h_Yellow#tabId=item0',
      'https://www.duluxvalentine.com/fr/couleurs/filters/h_Lime#tabId=item0',
      'https://www.duluxvalentine.com/fr/couleurs/filters/h_Green#tabId=item0',
      'https://www.duluxvalentine.com/fr/couleurs/filters/h_Teal#tabId=item0',
      'https://www.duluxvalentine.com/fr/couleurs/filters/h_Blue#tabId=item0',
      'https://www.duluxvalentine.com/fr/couleurs/filters/h_Violet#tabId=item0',
      'https://www.duluxvalentine.com/fr/couleurs/filters/h_Cool%20neutral#tabId=item0',
      'https://www.duluxvalentine.com/fr/couleurs/filters/h_Warm%20neutral#tabId=item0',
    ],
    fn: _ => {
      const colorList = [];
      const colorTable = document.querySelector('.related-colors');
      const colorRows = colorTable.querySelectorAll('.js-color-card');

      for (let y = 1; y < colorRows.length; y++) {
        const colorRow = colorRows[y];
        
        const link = 'https://www.duluxvalentine.com/fr/couleurs';
        const hex = colorRow.dataset.hex;
        let name = colorRow.querySelector('.color-card-label').innerHTML;
        name = name.replace(/RAL \d+/g, '').trim();

        colorList.push({
          name, hex, link,
        });
        
      }

      return colorList;
    }
  },
];

let colors = [];

userColors.forEach(color => {
  colors.push({
    name: color.name,
    hex: color.hex,
    link: color.hasOwnProperty('link') ? color.link :
    `https://github.com/meodai/noms-de-couleur/#authors-${color.author}`,
  })  
});


(async () => {
  const browser = await puppeteer.launch();
  
  for (let j = 0; j < pages.length; j++) {
    for (let i = 0; i < pages[j].sources.length; i++) {
      const page = await browser.newPage();
      console.log(`visiting ${pages[j].sources[i]}`);
      await page.goto(pages[j].sources[i]);

      const colorList = await page.evaluate(pages[j].fn);
      colors = colors.concat(colorList);
    }
  }

  await browser.close();

  // data sanitization
  
  // title case each color name
  colors.forEach(c => {
    c.name = titleCaseFrench.convert(c.name.replace(/’/g, "'").trim());
  });


  // sanitize hex values and names
  colors.forEach(c => {
    // remove parentheses and its contents from name
    c.name = c.name.replace(/\(.*\)/, '').trim();
    c.hex = formatHex(c.hex);
    if (!c.hex) {
      console.warn(`invalid hex: ${c.name} (${c.link})`);
    }
  });

  // remove duplicate names from colors list
  // while keeping the first occurence
  colors = colors.filter((c, i) => {
    const referenceName = c.name.toLowerCase().replace(/-/g, ' ').replace(/Œ/ig, 'oe');
    const index = colors.findIndex(
      c => c.name.toLowerCase()
                 .replace(/-/g, ' ')
                 .replace(/Œ/ig, 'oe')
                 .localeCompare(
                    referenceName
                  ) === 0
    );
    if (index === i) {
      return true;
    }
    return false;
  });

  // sort colors by name
  colors.sort((a, b) => {
    if (a.name < b.name) {
      return -1;
    }
    if (a.name > b.name) {
      return 1;
    }
    return 0;
  });

  // find duplicate hex values and warn about them
  const hexes = colors.map(c => c.hex);
  const duplicates = hexes.filter((h, i) => hexes.indexOf(h) !== i);
  if (duplicates.length > 0) {
    console.warn('found some duplicate hex values:');
    duplicates.forEach(d => {
      const dupes = colors.filter(c => c.hex === d);
      console.warn(`duplicate hex: ${d} (${dupes.map(c => c.name).join(', ')})`);
      // shift each subsequent duplicate color value by 1
      for (let i = 1; i < dupes.length; i++) {
        dupes[i].hex = shiftColor(dupes[i].hex, (1/255) * i);
      }
    });
  }
  // will probably need to do this recursively
  console.warn('Shifted all the color values a bit to make each color unique');

  function shiftColor(hex, shift) {
    const rgb = rgbconv(hex);
    rgb.r = rgb.r + shift;
    rgb.g = rgb.g + shift;
    rgb.b = rgb.b + shift;
    
    if (rgb.r > 1) {
      rgb.r = 2 - rgb.r;
    }
    if (rgb.g > 1) {
      rgb.g = 2 - rgb.g;
    }
    if (rgb.b > 1) {
      rgb.b = 2 - rgb.b;
    }

    return formatHex(rgb);
  }


  // update color count in readme.md
  // gets SVG template
  let mdTpl = fs.readFileSync(
    './readme.md',
    'utf8'
  ).toString();

  mdTpl = mdTpl.replace(/\(\*{2}(\d+)\*{2}\)/gm, `(**${colors.length}**)`);

  fs.writeFileSync(
    './readme.md',
    mdTpl
  );

  // create a csv file with the colors
  const csv = 'name,hex,link\n' + colors.map(c => `${c.name},${c.hex},${c.link}`).join('\n');
  
  fs.writeFileSync('./colors.csv', csv);
  fs.writeFileSync('./colors.min.json', JSON.stringify(colors));
  fs.writeFileSync('./colors.json', JSON.stringify(colors, null, 2));
})().catch(e => console.log(e));