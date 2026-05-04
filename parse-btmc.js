const cheerio = require('cheerio');
const axios = require('axios');

async function main() {
    const { data } = await axios.get('https://webgia.com/gia-vang/bao-tin-minh-chau/');
    const $ = cheerio.load(data);
    const results = [];
    // the main table might be inside an article or specific class. Let's just find the table that has 'Mua' and 'Bán'
    $('table.table').each((i, table) => {
        const text = $(table).text();
        if (text.includes('Mua') && text.includes('Bán')) {
            $(table).find('tbody tr').each((j, tr) => {
                const tds = $(tr).find('td');
                if (tds.length >= 3) {
                    const type = $(tds[0]).text().trim();
                    const buy = $(tds[1]).text().trim();
                    const sell = $(tds[2]).text().trim();
                    results.push({ type, buy, sell });
                }
            });
        }
    });
    console.log(JSON.stringify(results, null, 2));
}
main();
