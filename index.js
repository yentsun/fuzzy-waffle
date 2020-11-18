import { createConnection } from 'mysql2/promise';

// MySQL connection
const mySQLConfig = {
    user: 'avnadmin',
    host: 'mysql-tower-mkorinets-0bda.aivencloud.com',
    port: 26492 ,
    database: 'defaultdb'
};

// get password from cmd arguments
const [ , , password ] = process.argv;

async function main() {
    console.log('> connecting to database...');
    await createConnection({...mySQLConfig, password });
    console.log('> done');
}


main().catch(error => console.error(error));
