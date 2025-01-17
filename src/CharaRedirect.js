import CONFIG from './utils/config.js';
import mw from './utils/mediawiki.js';

(async () => {
    const api = new mw.Api({
        url: 'https://zh.moegirl.org.cn/api.php',
        botUsername: CONFIG.USERNAME, 
        botPassword: CONFIG.PASSWORD, 
        cookie: {
            moegirlSSOUserID: CONFIG.SSO_USER_ID,
            moegirlSSOToken: CONFIG.SSO_TOKEN
        }
    });

    await api.login();

    const json = {};

    try {
        let response = await api.post({
            action: 'query',
            prop: 'revisions',
            titles: `原神`,
            rvsection: 13,
            rvprop: 'content'
        });
        let code = response.query.pages[0].revisions[0].content;

        let linkMatch = code.match(/bt[^{]+?{{原神\/角色.+?原名=\[\[.+?\]\]/gs);
        linkMatch.forEach((snippet) => {
            let name = snippet.match(/bt\d+\s*=\s*(.+?)\n/)[1],
                link = snippet.match(/原名\s*=\s*\[\[(.*?)(?:\|.*)?\]\]/)[1];

            if(name != link) {
                json[name] = link;
            }
        });

        let res = await api.post({
            action: 'edit',
            title: 'User:Chi ZJ2/Data',
            text: JSON.stringify(json),
            bot: true,
            tags: 'Bot',
            token: await api.getToken('csrf', true)
        });
        
    } catch (err) {
        console.error(err);
    }

    await api.logout();
})();
