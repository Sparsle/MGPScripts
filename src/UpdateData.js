import CONFIG from './utils/config.js';
import mw from './utils/mediawiki.js';
import fs from 'fs';

const api = new mw.Api({
    url: CONFIG.ZH_API,
    botUsername: CONFIG.USERNAME, 
    botPassword: CONFIG.PASSWORD, 
    cookie: CONFIG.COOKIE
});

const dataTable = {
    chara_list: async () => {
        let response = await fetch('https://gi.yatta.moe/api/v2/chs/avatar');
        let json = await response.json();
        let today = new Date().getTime();

        return Object.fromEntries(
            Object.entries(json.data.items)
                .filter(([_, v]) => v.name != '旅行者' && parseInt(v.release) * 1000 < today)
                .map(([_, v]) => [v.name, v.id])
        );
    }, 

    chara_redirects: async () => {
        let response = await api.post({
            action: 'query',
            prop: 'revisions',
            titles: `原神`,
            rvsection: 13,
            rvprop: 'content'
        });
        let code = response.query.pages[0].revisions[0].content;
        let redirects = {};

        let linkMatch = code.match(/bt[^{]+?{{原神\/角色.+?原名=\[\[.+?\]\]/gs);
        for(let snippet of linkMatch) {
            let name = snippet.match(/bt\d+\s*=\s*(.+?)\n/)[1],
                link = snippet.match(/原名\s*=\s*\[\[(.*?)(?:\|.*)?\]\]/)[1];
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
        mergedData[dataName] = await dataTable[dataName].call(null);
    }

    fs.writeFileSync('./data.json', JSON.stringify(mergedData));

    await api.logout();
})();
