import CONFIG from '../utils/config.js';
import mw from '../utils/mediawiki.js';
import { readData, writeData } from '../utils/data.js';

const api = new mw.Api({
    url: CONFIG.ZH_API,
    botUsername: CONFIG.USERNAME, 
    botPassword: CONFIG.ZH_PASSWORD, 
    cookie: CONFIG.COOKIE
});

await api.login();

let response = await api.post({
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

let submitText = `<center><div style="display:inline-block;border:1px solid #a2a9b1;background:#f8f9fa;padding:1em 0 0 3em">
{{Echart|data=<nowiki>${JSON.stringify(json).replace(/"temp":.+?,/, "")}</nowiki>|width=650|height=400}}
</div></center>`;
response = await api.post({
    action: 'edit',
    title: `User:${CONFIG.USERNAME.slice(0, -4)}/statistics`,
    text: submitText,
    bot: true,
    tags: 'Bot',
    token: await api.getToken('csrf', true)
}).then(console.log);

await api.logout();
