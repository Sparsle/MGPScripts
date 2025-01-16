import CONFIG from './utils/config.js';
import mw from './utils/Mediawiki.js';

const birthdayList = [];
const today = new Date();

async function fetchPosts() {
    const response = await fetch('https://bbs-api.miyoushe.com/post/wapi/userPost?size=20&uid=75276539');
    const json = await response.json();

    let dateFormat = (date) => {
        return `${date.getMonth()+1}.${date.getDate()}`;
    };

    json.data.list.forEach((postItem) => {
        let title = postItem.post.subject;
        let postId = postItem.post.post_id;
        let date = dateFormat(
            new Date(parseInt(postItem.post.created_at) * 1000)
        );

        if(dateFormat(today) != date) {
            //return;
        }


        let titleMatch = title.match(/(.+)生日快乐｜(.+)/);
        if(!titleMatch) {
            return;
        }
        let [_, name, description] = titleMatch.values();
        birthdayList.push([
            name, 
            `File:YuanShen${today.getFullYear()}${name}生日贺图.jpg|[[${name}]]生日${date}<br>[https://www.miyoushe.com/ys/article/${postId} ${description}]`
        ]);
    });

    birthdayList.reverse();
};

async function addToWiki() {
    const api = new mw.Api({
        url: 'https://mzh.moegirl.org.cn/api.php',
        botUsername: 'Chi ZJ2@Bot', 
        botPassword: CONFIG.PASSWORD, 
        cookie: {
            moegirlSSOUserID: CONFIG.SSO_USER_ID,
            moegirlSSOToken: CONFIG.SSO_TOKEN
        }
    });

    await api.login();

    try {
        let response = await api.post({
            action: 'query',
            prop: 'revisions',
            titles: `原神/贺图`,
            rvprop: 'content'
        });
        let code = response.query.pages[0].revisions[0].content;

        response = await api.post({
            action: 'query',
            prop: 'revisions',
            titles: `User:Chi_ZJ2/Data`,
            rvprop: 'content'
        });
        let redirects = JSON.parse(response.query.pages[0].revisions[0].content);

        birthdayList.forEach(([name, snippet]) => {
            if(redirects[name] !== undefined) {
                snippet = snippet.replace(`[[${name}]]`, `[[${redirects[name]}]]`);
            }

            code = code.replace(snippet + '\n', '');
            code = code.replace(
                /(角色生日 *==.+?<gallery>)/s,
                `$1\n${snippet}`
            );
        });

        let res = await api.post({
            action: 'edit',
            title: '原神/贺图',
            text: code,
            summary: '自动更新角色生日贺图',
            bot: true,
            tags: 'Bot',
            token: await api.getToken('csrf', true)
        });
    } catch (err) {
        console.error(err);
    }

    await api.logout();
};

(async () => {
    await fetchPosts();
    await addToWiki();
})();
