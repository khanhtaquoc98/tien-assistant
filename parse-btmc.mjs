import * as cheerio from 'cheerio';

async function main() {
    const res = await fetch('https://webgia.com/gia-vang/bao-tin-minh-chau/');
    const text = await res.text();
    const $ = cheerio.load(text);
    const results = [];
    
    $('table.table').each((i, table) => {
        const thead = $(table).find('thead').text();
        if (thead.includes('Mua') && thead.includes('Bán')) {
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
