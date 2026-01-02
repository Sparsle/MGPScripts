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

const today = new Date();
const todayStr = today.toISOString().split('T')[0];
let json = readData('MGP', 'stat');

const daysDiff = (dateStr1, dateStr2 = todayStr) => {
    const [year1, month1, day1] = dateStr1.split('-').map(Number);
    const [year2, month2, day2] = dateStr2.split('-').map(Number);
    const date1UTC = Date.UTC(year1, month1-1, day1);
    const date2UTC = Date.UTC(year2, month2-1, day2);
    return Math.floor((date2UTC - date1UTC) / (1000 * 60 * 60 * 24));
}
json.dataset.source.push([
    todayStr, 
    stat.activeusers,
    Math.floor(
        (stat.edits - json.temp) / daysDiff(json.dataset.source.at(-1)[0])
    )
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
