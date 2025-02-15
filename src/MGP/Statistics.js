import CONFIG from '../utils/config.js';
import mw from '../utils/mediawiki.js';
import { readData, writeData } from '../utils/data.js';

const api = new mw.Api({
    url: CONFIG.ZH_API,
    botUsername: CONFIG.USERNAME, 
    botPassword: CONFIG.PASSWORD, 
    cookie: CONFIG.COOKIE
});

await api.login();

const response = await api.post({
    action: 'query',
    meta: 'siteinfo',
    siprop: 'statistics',
    format: 'json'
});
const stat = response.query.statistics;
console.log(stat);

let json = readData('MGP', 'stat');
json.dataset.source.push([
    new Date().toISOString().split('T')[0], 
    stat.activeusers,
    stat.edits - json.temp
]);
json.temp = stat.edits;
writeData('MGP', 'stat', json);

await api.logout();
