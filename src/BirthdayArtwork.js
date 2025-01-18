import CONFIG from './utils/config.js';
import mw from './utils/mediawiki.js';
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

let response = await api.post({
    action: 'query',
    prop: 'revisions',
    titles: `User:Chi_ZJ2/Data`,
    rvprop: 'content'
});

const redirects = JSON.parse(response.query.pages[0].revisions[0].content),
    birthdayList = [],
    today = new Date();

async function fetchPosts() {
    const response = await fetch('https://bbs-api.miyoushe.com/post/wapi/userPost?size=20&uid=75276539');
    const json = await response.json();

    let dateFormat = (date) => {
        return `${date.getMonth()+1}.${date.getDate()}`;
    };

    json.data.list.forEach((postItem) => {
        let title = postItem.post.subject;
        let postId = postItem.post.post_id;
        let date = dateFormat(new Date(parseInt(postItem.post.created_at) * 1000));
        if(dateFormat(today) != date) {
            return;
        }

        let titleMatch = title.match(/(.+)生日快乐｜(.+)/);
        if(!titleMatch) {
            return;
        }
        let [_, name, description] = titleMatch.values();

        let content = postItem.post.structured_content
            .match(/{\"insert\":\"(.+)\\n\"}/)[1]
            .replaceAll('\\n', '\n\n');

        birthdayList.push([
            name, 
            description,
            `File:YuanShen${today.getFullYear()}${name}生日贺图.jpg|[[${name}]]生日${date}<br>[https://www.miyoushe.com/ys/article/${postId} ${description}]`,
            `
{{Hide|标题=[https://www.miyoushe.com/ys/article/${postId} ${description}]
|内容=[[File:YuanShen${today.getFullYear()}${name}生日贺图.jpg|400px|缩略图|无]]

${content}
}}
`
        ]);
    });

    birthdayList.reverse();
}

async function addToListPage() {
    let response = await api.post({
        action: 'query',
        prop: 'revisions',
        titles: '原神/贺图',
        rvprop: 'content'
    });
    let code = response.query.pages[0].revisions[0].content;

    for(let [name, _, snippet, __] of birthdayList) {
        if(redirects[name] !== undefined) {
            snippet = snippet.replace(`[[${name}]]`, `[[${redirects[name]}|${name}]]`);
        }

        code = code.replace(snippet + '\n', '');
        code = code.replace(
            /(角色生日 *==.+?<gallery>)/s,
            `$1\n${snippet}`
        );
    }

    response = await api.post({
        action: 'edit',
        title: '原神/贺图',
        text: code,
        summary: '自动更新角色生日贺图',
        bot: true,
        tags: 'Bot',
        token: await api.getToken('csrf', true)
    }).then(console.log);

}

async function addToCharaPage() {
    for(let [name, description, _, snippet] of birthdayList) {
        let response = await api.post({
            action: 'query',
            prop: 'revisions',
            titles: redirects[name] ?? name,
            rvprop: 'content'
        });
        let code = response.query.pages[0].revisions[0].content;

        let start = code.search(/==== *生日 *====\s*\n/),
            sliceToStart = code.slice(start);
        let end = start + sliceToStart.search(/\n(?:===* *.+? *===*\s*\n|{{原神\|角色}})/);

        if(sliceToStart.search(description) != -1) {
            continue;
        } else if(sliceToStart.search(`;${today.getFullYear()}年`) == -1) {
            snippet = `\n;${today.getFullYear()}年` + snippet;
        }
        code = code.slice(0, end) + snippet + code.slice(end);

        response = await api.post({
            action: 'edit',
            title: redirects[name] ?? name,
            text: code,
            summary: '自动更新角色生日贺图',
            bot: true,
            tags: 'Bot',
            token: await api.getToken('csrf', true)
        }).then(console.log);

        setTimeout(() => {}, 2000);
    }
}

await fetchPosts();
await addToListPage();
await addToCharaPage();

await api.logout();
