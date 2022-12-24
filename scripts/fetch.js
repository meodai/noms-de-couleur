const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const pages = [{
  name: 'Wiktionary',
  sources: [
    'https://fr.wiktionary.org/wiki/Th%C3%A9saurus:couleur/fran%C3%A7ais'
  ],
}];

let colors = [];

(async () => {
  const browser = await puppeteer.launch();
  
  for (let j = 0; j < pages.length; j++) {
    for (let i = 0; i < pages[j].sources.length; i++) {
      const page = await browser.newPage();
      console.log(`visiting ${pages[j].sources[i]}`);
      await page.goto(pages[j].sources[i]);
      
      const colorList = await page.evaluate(_ => {     
        const colorList = [];
        const colorTable = document.querySelector('table.wikitable.sortable');
        const colorRows = colorTable.querySelectorAll('tr:not(:first-child)');

        for (let y = 1; y < colorRows.length; y++) {
          const colorRow = colorRows[y];
          const $wrap = colorRow.querySelector('td:nth-child(1) a');

          //sometimes people mess up the links
          //$wrap = $wrap ? $wrap : colorRow.querySelector('td');  
          if ($wrap) {
            const name = $wrap.innerText;
            const link = $wrap.href;
            const hex = '#' + colorRow.querySelector('td:nth-child(2)').getAttribute('bgcolor');
            colorList.push({
              name, hex, link,
            });
          } else {
            return {name:'noname', hex:'#000000', link:'nolink', debug:colorRow.innerHTML};
          }
        }

        return colorList;

      });
      colors = colors.concat(colorList);
    }
  }

  await browser.close();

  // data sanitization
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
    c.hex = c.hex.toLowerCase();
  });

  // remove duplicate names from colors list
  colors = colors.filter((c, i) => {
    const name = c.name;
    const index = colors.findIndex(c => c.name === name);
    if (index === i) {
      return true;
    }
    return false;
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