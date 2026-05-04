const cheerio = require('cheerio');
const fs = require('fs');
const axios = require('axios');

async function check() {
  const bmh = await axios.get('https://baotinmanhhai.vn/vi/bang-gia-vang').then(res => res.data);
  console.log('--- baotinmanhhai ---');
  let $ = cheerio.load(bmh);
  console.log('Title:', $('title').text());
  console.log('Tables:', $('table').length);
  $('table').first().find('tr').slice(0,5).each((i, el) => {
    console.log($(el).text().replace(/\s+/g, ' '));
  });

  const btmc = await axios.get('https://btmc.vn/?srsltid=AfmBOoqz5tQnEuF-MlW8-Ky822lbiYawgsuKen1NYzaxnGopVu1zMV91').then(res => res.data);
  console.log('--- btmc ---');
  $ = cheerio.load(btmc);
  console.log('Title:', $('title').text());
  console.log('Tables:', $('table').length);
  $('table').first().find('tr').slice(0,5).each((i, el) => {
    console.log($(el).text().replace(/\s+/g, ' '));
  });
  
  fs.writeFileSync('btmc.html', btmc);
}
check();
