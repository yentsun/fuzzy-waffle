import { createConnection } from 'mysql2/promise';
import puppeteer from 'puppeteer';


// MySQL connection
const mySQLConfig = {
    user: 'avnadmin',
    host: 'mysql-tower-mkorinets-0bda.aivencloud.com',
    port: 26492 ,
    database: 'defaultdb'
};

const username = 'developertest@affluent.io';

// get password from cmd arguments
const [ , , dbPassword, userPassword ] = process.argv;

async function main() {
    // const [ rows, fields ] = await connection.execute('SELECT * FROM `table` WHERE `name` = ? AND `age` > ?', ['Morty', 14]);

    console.log('> launching puppeteer');
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    const loginURL = 'https://develop.pub.afflu.net';
    console.log(`> going to ${loginURL}`);
    await page.goto(loginURL);

    await page.waitForSelector('input[name="username"]');
    await page.type('input[name="username"]', username);
    await page.type('input[name="password"]', userPassword);
    await page.click('button[type="submit"]');
    console.log(`> logging in`);
    await page.waitForNavigation();

    const datesURL = 'https://develop.pub.afflu.net/list?type=dates';
    console.log(`> going to ${datesURL}`);
    // we could probably go directly to https://develop.pub.afflu.net/list?type=dates&startDate=2020-10-01&endDate=2020-10-30
    // but since task says `2. Navigate to https://develop.pub.afflu.net/list?type=dates`
    await page.goto(datesURL, { waitUntil: 'networkidle0' });
    console.log('> setting date range');
    const rangeButton = '#dashboard-report-range';
    await page.waitForSelector(rangeButton);
    await page.click(rangeButton);
    const rangeStartInput = 'input[name="daterangepicker_start"]';
    const rangeEndInput = 'input[name="daterangepicker_end"]';
    await page.click(rangeStartInput, { clickCount: 3 }); // clear the input, meh
    await page.click(rangeEndInput, { clickCount: 3 });
    await page.type(rangeStartInput, '10/01/2020');
    await page.type(rangeEndInput, '10/30/2020');
    await page.click(rangeStartInput);
    await page.waitForSelector('button.applyBtn');
    await page.click('button.applyBtn');

    // and here we desperately lack a method on `page` class - the waitForNetworkIdle
    // (https://github.com/puppeteer/puppeteer/issues/5328)
    // or something like `await page.waitForNavigation({ waitUntil: 'networkidle0' });`
    // would work. But instead:
    console.log('> waiting for data...');
    await page.waitForTimeout(1000);

    // select al rows
    await page.click('#DataTables_Table_0_length button');
    await page.click('#DataTables_Table_0_length li:nth-child(7)');
    await page.waitForTimeout(1000);


    // what? no convenient way of retrieving data? not a scraping tool after all, huh?
    const data = (await page.evaluate(() => {
        const rows = document.querySelectorAll('#DataTables_Table_0 tbody tr');
        return Array.from(rows, row => {
            const [ date, total, sales, leads, clicks, epc, impressions, cr ] = row.querySelectorAll('td');
            return [
                (new Date(`${date.innerText} UTC`)).toISOString().slice(0, 10),
                Number(total.innerText.replace(/\$|,/g, '')),
                Number(sales.innerText),
                Number(leads.innerText),
                Number(clicks.innerText.replace(',', '')),
                Number(epc.innerText.replace('$', '')),
                Number(impressions.innerText),
                Number(cr.innerText.replace('%', ''))
            ];
        });
    }));

    console.log('> got data:')
    console.table(data);
    await browser.close();

    console.log('> connecting to database');
    const connection = await createConnection({...mySQLConfig, password: dbPassword });
    await connection.execute('DROP TABLE dates');
    console.log('> creating table');
    await connection.execute(`CREATE TABLE dates (
        date DATE PRIMARY KEY,
        total DECIMAL(9,2),
        sales INT,
        leads INT,
        clicks INT,
        epc DECIMAL(6,2),
        impressions INT,
        cr DECIMAL(6,2)
    )  ENGINE=INNODB;`);

    console.log('> storing data');
    await connection.query('INSERT INTO `dates` (date, total, sales, leads, clicks, epc, impressions, cr) VALUES ?', [ data ]);

    console.log('> retrieving data');
    const [ rows ] = await connection.query(`SELECT *, DATE_FORMAT(date,'%m/%d/%Y') AS date FROM dates`);
    console.table(rows);

    console.log('> done');
    connection.end();
    process.exit();
}

main().catch(error => {
    console.error(error);
    process.exit();
});
