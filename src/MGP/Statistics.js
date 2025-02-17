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
await new Promise(resolve => setTimeout(resolve, 30000));

let json = readData('MGP', 'stat');
json.dataset.source.push([
    new Date().toISOString().split('T')[0], 
    stat.activeusers,
    stat.edits - json.temp
]);
json.temp = stat.edits;
writeData('MGP', 'stat', json);

response = await api.post({
    action: 'edit',
    title: `User:${CONFIG.USERNAME.slice(0, -4)}/statistics.json`,
    text: JSON.stringify(json).replace(/"temp":.+?,/, ""),
    bot: true,
    tags: 'Bot',
    token: await api.getToken('csrf', true)
}).then(console.log);

await api.logout();
