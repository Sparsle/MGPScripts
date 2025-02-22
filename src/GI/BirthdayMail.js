import CONFIG from '../utils/config.js';
import mw from '../utils/mediawiki.js';
import { readData } from '../utils/data.js';

const api = new mw.Api({
    url: CONFIG.ZH_API,
    botUsername: CONFIG.USERNAME, 
    botPassword: CONFIG.PASSWORD, 
    cookie: CONFIG.COOKIE
});

const redirects = readData('GI', 'chara_redirects');
const birthdayList = [];
const today = new Date();

async function fetchPosts() {
    const response = await fetch('https://bbs-api.miyoushe.com/post/wapi/userPost?size=20&uid=281538057');
    const json = await response.json();

    let dateFormat = (date) => {
        return `${date.getMonth()+1}.${date.getDate()}`;
    };

    json.data.list.forEach((postItem) => {
        const title = postItem.post.subject;
        const postID = postItem.post.post_id;
        const date = dateFormat(new Date(parseInt(postItem.post.created_at) * 1000));
        if(dateFormat(today) != date) {
            return;
        }

        let titleMatch = title.match(/(.+)Ⅰ(.+)生日快乐/);
        if(!titleMatch) {
            return;
        }
        let [_, subject, name] = titleMatch.values();
        subject = subject.replaceAll('···', '…');

        let content = postItem.post.structured_content
            .match(/{\"insert\":\"(.+?)\\n\"}/)[1]
            .replaceAll('\\n', '\n');

        birthdayList.push([
            name, 
            postID,
            `
{{Hide|标题=${subject}
|内容=
<poem>
${content}
</poem>
}}`
        ]);
    });
}

async function addToCharaPage() {
    for(let [name, postID, snippet] of birthdayList) {
        let response = await api.post({
            action: 'query',
            prop: 'revisions',
            titles: redirects[name] ?? name,
            rvprop: 'content'
        });
        let code = response.query.pages[0].revisions[0].content;

        let start = code.search(/==== *生日 *==== *\n/);
        let sliceToStart = code.slice(start);
        let end = start + sliceToStart.search(`;${today.getFullYear()}年`) + 6;

        code = code.slice(0, end) + snippet + code.slice(end);

        response = await api.post({
            action: 'edit',
            title: redirects[name] ?? name,
            text: code,
            summary: CONFIG.SUMMARY('自动添加角色生日邮件') + `　/*【注意】*/不包含奖励物品；正文可能有错别字，建议复查　/*【录入】*/米游社@绘忆繁星（允许规范转载）　/*【出处】*/https://www.miyoushe.com/ys/article/${postID}`,
            bot: true,
            tags: 'Bot',
            token: await api.getToken('csrf', true)
        }).then(console.log);

        setTimeout(() => {}, 60000);
    }
}

await fetchPosts();

if(birthdayList.length > 0) {
    await api.login();

    await addToCharaPage();

    await api.logout();
}
