import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { formatHex } from 'culori';

// to add
// - http://pourpre.com/fr/dictionnaire/alpha/c
// - https://influenz.design/mag/couleurs-et-leurs-noms
// - https://encycolorpedia.fr/named
// - https://podarilove.ru/fr/unusual-names-of-color-shades/ <- probably manually

const pages = [
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
];

let colors = [];

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
  
  // lowercase the first letter of each name
  colors.forEach(c => {
    c.name = c.name.charAt(0).toLowerCase() + c.name.slice(1);
  });

  // remove duplicate names from colors list
  // while keeping the first occurence
  colors = colors.filter((c, i) => {
    const name = c.name.toLowerCase();
    const index = colors.findIndex(c => c.name.toLowerCase() === name);
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
  }).forEach(c => {
    // remove parentheses and its contents from name
    c.name = c.name.replace(/\(.*\)/, '').trim();
    c.hex = formatHex(c.hex);
  });

  
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