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
        const response = await fetch('https://gi.yatta.moe/api/v2/chs/avatar');
        const json = await response.json();
        const today = new Date().getTime();

        return Object.fromEntries(
            Object.entries(json.data.items)
                .filter(([_, v]) => v.name != '旅行者' && parseInt(v.release) * 1000 <= today)
                .map(([_, v]) => [v.name, v.id])
        );
    }, 

    chara_redirects: async () => {
        const response = await api.post({
            action: 'query',
            prop: 'revisions',
            titles: `原神`,
            rvsection: 12,
            rvprop: 'content'
        });
        const code = response.query.pages[0].revisions[0].content;
        const redirects = {};

        const linkMatch = code.match(/bt[^{]+?{{原神\/角色.+?原名=\[\[.+?\]\]/gs);
        for(let snippet of linkMatch) {
            const name = snippet.match(/bt\d+\s*=\s*(.+?)\n/)[1];
            const link = snippet.match(/原名\s*=\s*\[\[(.*?)(?:\|.*)?\]\]/)[1];
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

    writeData('GI', undefined, JSON.stringify(mergedData));

    await api.logout();
})();
