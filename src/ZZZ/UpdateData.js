import CONFIG from '../utils/config.js';
import mw from '../utils/mediawiki.js';
import { writeData } from '../utils/data.js';
import fs from 'fs';

const api = new mw.Api({
    url: CONFIG.ZH_API,
    botUsername: CONFIG.USERNAME, 
    botPassword: CONFIG.ZH_PASSWORD, 
    cookie: CONFIG.COOKIE
});

const dataTable = {
    chara_list: async () => {
        const response = await fetch('https://api.hakush.in/zzz/data/character.json');
        const json = await response.json();
        const today = new Date().getTime();

        return Object.fromEntries(
            Object.entries(json)
                .filter(([_, v]) => !['铃', '哲'].includes(v.CHS) && v.desc != '...')
                .map(([id, v]) => [v.CHS, id])
                .map(([name, id]) => [name == '雅' ? '星见雅' : name, id])
        );
    }, 

    chara_redirects: async () => {
        const response = await api.post({
            action: 'query',
            prop: 'revisions',
            titles: `绝区零`,
            rvprop: 'content'
        });
        const code = response.query.pages[0].revisions[0].content.match(/=== 代理人 ===\n(.+?)\n==+ *.+? *==*\n/s)[1];
        const redirects = {};

        const linkMatch = code.matchAll(/<center>'''(.+?)'''<\/center>.+?{{!}}style="width: 400px;"{{!}}\n:'''\[\[(.*?)(?:\|.*)?\]\]'''/gs);
        for(let match of linkMatch) {
            const [name, link] = [match[1], match[2]];
            if(name != link) {
                redirects[name] = link;
            }
        }

        return redirects;
    }
};

(async () => {
    await api.login();

    let mergedData = {};
    for(let dataName in dataTable) {
        mergedData[dataName] = await dataTable[dataName]();
    }

    writeData('ZZZ', undefined, JSON.stringify(mergedData));

    await api.logout();
})();
