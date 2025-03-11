import CONFIG from '../utils/config.js';
import mw from '../utils/mediawiki.js';
import { readData } from '../utils/data.js';

const api = new mw.Api({
    url: CONFIG.ZH_API,
    botUsername: CONFIG.USERNAME, 
    botPassword: CONFIG.ZH_PASSWORD, 
    cookie: CONFIG.COOKIE
});
const api_cm = new mw.Api({
    url: CONFIG.CM_API,
    botUsername: CONFIG.USERNAME, 
    botPassword: CONFIG.CM_PASSWORD, 
    cookie: CONFIG.COOKIE
});

const charaList = readData('ZZZ', 'chara_list');
const redirects = readData('ZZZ', 'chara_redirects');
const birthdayList = [];
const today = new Date();

async function fetchPosts(offset) {
    const response = await fetch(`https://bbs-api.miyoushe.com/post/wapi/userPost?${!!offset ? `offset=${offset}&` : ''}size=20&uid=152039148`);
    const json = await response.json();

    let dateFormat = (date) => {
        return `${date.getMonth()+1}.${date.getDate()}`;
    };

    json.data.list.forEach((postItem) => {
        const subject = postItem.post.subject;
        const postID = postItem.post.post_id;
        const date = new Date(parseInt(postItem.post.created_at) * 1000);
        if(dateFormat(today) != dateFormat(date)) {
            return;
        }

        const subjectMatch = subject.match(/生日快乐(.+)丨(.+)/);
        if(!subjectMatch) {
            return;
        }
        let [_, name, title] = subjectMatch.values();

        const structuredContent = JSON.parse(postItem.post.structured_content);
        const content = structuredContent[2].insert;
        const artworkURL = structuredContent[3].insert.image;
        const artworkFileName = `绝区零${date.getFullYear()}${name}生日贺图${artworkURL.match(/\.[^\.]+?$/)[0]}`;
        const charasInArtwork = postItem.topics
            .map((topic) => topic.name)
            .filter((charaName) => !!charaList[charaName]);

        if(!charaList[name]) {
            for(let charaName of charasInArtwork) {
                if(charaName.search(name) != -1) {
                    name = charaName;
                    break;
                }
            }
        }

        birthdayList.push({
            name: name, 
            title: title,
            year: date.getFullYear(),
            artworkURL: artworkURL,
            artworkFileName: artworkFileName,
            charasInArtwork: charasInArtwork,
            listPageSnippet: `File:${artworkFileName}|[[${name}]]生日${dateFormat(date)}<br>[https://www.miyoushe.com/ys/article/${postID} ${title}]`,
            charaPageSnippet: `
{{Hide|标题=[https://www.miyoushe.com/ys/article/${postID} ${title}]
|内容=[[File:${artworkFileName}|400px|缩略图|无]]
<poem>
${content.trim()}
</poem>
}}
`
        });
    });

    birthdayList.reverse();
    /*
    if(json.data.is_last) {
        birthdayList.reverse();
    } else {
        await fetchPosts(json.data.next_offset);
    }
    */
}

async function addToListPage() {
    let response = await api.post({
        action: 'query',
        prop: 'revisions',
        titles: '绝区零/贺图',
        rvprop: 'content'
    });
    const rawCode = response.query.pages[0].revisions[0].content;
    let code = rawCode;

    for(let item of birthdayList) {
        if(redirects[item.name] !== undefined) {
            item.listPageSnippet = item.listPageSnippet.replace(`[[${item.name}]]`, `[[${redirects[item.name]}|${item.name}]]`);
        }

        code = code.replace(item.listPageSnippet + '\n', '');
        code = code.replace(
            /(角色生日 *==.+?<gallery>)/s,
            `$1\n${item.listPageSnippet}`
        );
    }

    if(code == rawCode) {
        return;
    }
    response = await api.post({
        action: 'edit',
        title: '绝区零/贺图',
        text: code,
        summary: CONFIG.SUMMARY('自动添加角色生日贺图'),
        bot: true,
        tags: 'Bot',
        token: await api.getToken('csrf', true)
    }).then(console.log);
}

async function addToCharaPage() {
    for(let item of birthdayList) {
        let response = await api.post({
            action: 'query',
            prop: 'revisions',
            titles: redirects[item.name] ?? item.name,
            rvprop: 'content'
        });
        const rawCode = response.query.pages[0].revisions[0].content;
        let code = rawCode;

        let start = code.search(new RegExp(`== *.+?（.+?·.+?） *== *\n`));
        if(start == -1) {
            continue;
        }
        if(code.slice(start).search(/==== *生日 *==== *\n/) == -1) {
            start = start + code.slice(start).indexOf('\n');
            start = start + code.slice(start).search(/\n(?:== *[^=]+? *== *\n|{{绝区零\|登场角色}})/);
            item.charaPageSnippet = `\n==== 生日 ====\n;${item.year}年` + item.charaPageSnippet;
            code = code.slice(0, start) + item.charaPageSnippet + code.slice(start);
        } else {
            start = code.search(/==== *生日 *==== *\n/);
            const sliceFromStart = code.slice(start);
            const end = start + sliceFromStart.search(/\n(?:==+ *.+? *==+ *\n|{{绝区零\|登场角色}})/);

            if(sliceFromStart.indexOf(item.title) != -1) {
                continue;
            } else if(sliceFromStart.indexOf(`;${item.year}年`) == -1) {
                item.charaPageSnippet = `\n;${item.year}年` + item.charaPageSnippet;
            }
            code = code.slice(0, end) + item.charaPageSnippet + code.slice(end);
        }

        if(code == rawCode) {
            continue;
        }
        response = await api.post({
            action: 'edit',
            title: redirects[item.name] ?? item.name,
            text: code,
            summary: CONFIG.SUMMARY('自动添加角色生日贺图'),
            bot: true,
            tags: 'Bot',
            token: await api.getToken('csrf', true)
        }).then(console.log);

        await new Promise(resolve => setTimeout(resolve, 10000));
    }
}

async function uploadArtworks() {
    for(let item of birthdayList) {
        const cateStr = item.charasInArtwork.reduce(
            (cateStr, charaName) => cateStr + `[[分类:${redirects[charaName] ?? charaName}]] `, 
            '[[分类:绝区零贺图]] '
        );
        await api_cm.post({
            action: 'upload',
            filename: item.artworkFileName,
            comment: `${cateStr} /* （通过自动化工具上传） */`,
            text: `== 文件说明 ==\n`
                + `${cateStr}\n`
                + `== 授权协议 ==\n`
                + `{{Copyright}}`,
            url: item.artworkURL,
            ignorewarnings: '1',
            token: await api_cm.getToken('csrf', true)
        }).then(console.log);

        await new Promise(resolve => setTimeout(resolve, 10000));
    }
}

await fetchPosts();
console.log(birthdayList);
if(birthdayList.length > 0) {
    await api.login();
    await addToCharaPage();
    await addToListPage();
    await api.logout();
    
    await api_cm.login();
    await uploadArtworks();
    await api_cm.logout();
}
