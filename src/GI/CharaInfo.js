import CONFIG from '../utils/config.js';
import LOGGER from '../utils/logger.js';
import mw from '../utils/mediawiki.js';
import { readData } from '../utils/data.js';
import Diff from '../utils/onp.js';
import Big from 'big.js';
import fs from 'fs';
import ProgressBar from 'progress';
import Colors from 'colors/safe.js';

const api = new mw.Api({
    url: CONFIG.ZH_API,
    botUsername: CONFIG.USERNAME, 
    botPassword: CONFIG.ZH_PASSWORD, 
    cookie: CONFIG.COOKIE
});

const charaList = readData('GI', 'chara_list');
const redirects = readData('GI', 'chara_redirects');
const colors = {
    '#37FFFF': '文3', '#FFD780FF': '文',
    '#80FFD7FF': '风', '#FFE699FF': '岩', '#FFACFFFF': '雷', '#99FF88FF': '草', '#80C0FFFF': '水', '#FF9999FF': '火', '#99FFFFFF': '冰'
};

let STRUCTURE = [
    /*
     * 命之座
     */
    {
        heading: '命之座',
        enabled: true,
        render: async (data) => {
            let newCode = '';
            Object.values(data.constellation).forEach((con, i) => {
                newCode += `|命之座${i+1}名称 = ${con.name}\n` +
                           `|命之座${i+1}图标 = GI_${con.icon}.png\n` +
                           `|命之座${i+1}描述 = ${processDataText(con.description)}\n`;
            });

            return newCode;
        }
    },

    /*
     * 天赋
     */
    {
        heading: '天赋',
        enabled: true,
        render: async (data) => {
            const putParamIntoDesc = (desc, params) => {
                return desc.replaceAll(/{param(\d+):(.+?)}/g, (_, index, format) => {
                    index = parseInt(index) - 1;
                    const param = new Big(params[index]);
                    switch(format) {
                        case 'F1P':
                            return new Big(
                                param.mul(100).toString().replace(/\.(.)4999/, '.$15000')
                            ).toFixed(1) + '%';
                        case 'F2P':
                            return param.mul(100).toFixed(2) + '%';
                        case 'P':
                            return param.mul(100).toFixed(0) + '%';
                        case 'F1':
                            return param.toFixed(1);
                        case 'F2':
                            return param.toFixed(2);
                        case 'I':
                            return Intl.NumberFormat('en-US').format(param.round(0).toNumber());
                    }
                });
            };

            let newCode = '',
                count = 0,
                offset = 0;
            Object.values(data.talent).forEach((talent, i) => {
                if(!talent.name) {
                    offset++;
                    return;
                }
                let no = i - offset + 1;

                if(!talent.promote) {
                    newCode += `|天赋${no}名称 = ${talent.name}\n` +
                            `|天赋${no}类型 = 突破天赋\n` +
                            `|天赋${no}图标 = GI_${talent.icon}.png\n` +
                            `|天赋${no}描述 = <poem>\n${processDataText(talent.description, { removeLineBreak: false })}\n</poem>\n\n`;
                    return;
                }

                let type;
                if(talent.description.indexOf('替代冲刺') == -1) {
                    type = ['普通攻击', '元素战技', '元素爆发'][count++];
                } else {
                    type = '战斗天赋';
                }
                newCode += `|天赋${no}名称 = ${talent.name}\n` +
                           `|天赋${no}类型 = ${type}\n` +
                           `|天赋${no}图标 = GI_${talent.icon}.png\n` +
                           `|天赋${no}描述 = <poem>\n${processDataText(talent.description, { removeLineBreak: false })}\n</poem>\n`;

                talent.promote = Object.values(talent.promote);
                let attrNames = talent.promote[0].description
                    //.filter((desc) => desc != '')
                    .map((desc) => desc != '' ? desc.match(/(.+)\|.+/)[1] : '');
                let attrValues = Array.from({ length: attrNames.length }, () => []);
                for(let level of talent.promote) {
                    for(let j in attrNames) {
                        if(level.description[j] == '') {
                            continue;
                        }
                        attrValues[j].push(
                            putParamIntoDesc(level.description[j].match(/.+\|(.+)/)[1], level.params)
                        );
                    }
                }
                for(let j in attrNames) {
                    if(attrNames[j] == '') {
                        continue;
                    }
                    newCode += `|天赋${no}属性${parseInt(j)+1} = ${attrNames[j]}\n` +
                               `|天赋${no}数值${parseInt(j)+1} = ${attrValues[j].join('{{!!}}')}\n`;
                }

                newCode += '\n';
            });

            return newCode;
        }
    },

    /*
     * 语音
     */
    {
        heading: '语音',
        enabled: true,
        render: async (data) => {
            const quoteStart = data.quotes.findIndex((ele) => ele.title.startsWith('初次见面'));
            const quoteEnd = data.quotes.findIndex((ele) => ele.title == '元素战技·其一');
            let Quotes;
            if(quoteStart < quoteEnd) {
                Quotes = data.quotes.slice(quoteStart, quoteEnd);
            } else {
                Quotes = data.quotes.slice(quoteStart);
            }

            let newCode = '',
                linksAdded = {};
            linksAdded[data.name] = true;
            Quotes.forEach((quote, i) => {
                // 语音标题加入角色链接
                let title = processDataText(quote.title);
                for(let name of Object.keys(charaList)) {
                    if(title.search('弹琴') != -1) {
                        continue;
                    }
                    if(!linksAdded[name] && title.search(name) != -1) {
                        title = title.replace(
                            new RegExp(`${name}(?!\\]\\])`), 
                            redirects[name] === undefined 
                                ? `[[${name}]]`
                                : `[[${redirects[name]}|${name}]]`
                        );
                        linksAdded[name] = true;
                    }
                }

                newCode += `|语音${i+1}标题 = ${title}\n` +
                           `|语音${i+1}文本 = ${processDataText(quote.text).replaceAll(/<br\/>/g, '\n\n')}\n`;
            })

            return newCode;
        }
    },

    /*
     * 战斗语音
     */
    {
        heading: '战斗语音',
        enabled: true,
        render: async (data) => {
            const quoteStart = data.quotes.findIndex((ele) => ele.title == '元素战技·其一');
            const quoteEnd = data.quotes.findIndex((ele) => ele.title.startsWith('初次见面'));
            let Quotes;
            if(quoteStart < quoteEnd) {
                Quotes = data.quotes.slice(quoteStart, quoteEnd);
            } else {
                Quotes = data.quotes.slice(quoteStart);
            }

            let newCode = '';
            Quotes.forEach((quote, i) => {
                newCode += `|战斗语音${i+1}标题 = ${processDataText(quote.title)}\n` +
                           `|战斗语音${i+1}文本 = ${processDataText(quote.text).replaceAll(/<br\/>/g, '\n\n')}\n`;
            });

            return newCode;
        }
    },

    /*
     * 故事
     */
    {
        heading: '故事',
        enabled: true,
        render: async (data) => {
            let newCode = '';
            Object.values(data.story).forEach((story, i) => {
                newCode += `|故事${i+1}标题 = ${processDataText(story.title)}\n` +
                           (!!story.tips
                                ? `|故事${i+1}副题 = ${story.tips}\n`
                                : '') +
                           `|故事${i+1}文本 = \n${processDataText(story.text).replaceAll(/<br\/>/g, '\n\n')}\n`;
            });

            return newCode;
        }
    },
];
STRUCTURE = STRUCTURE.filter((struct) => struct.enabled);
Object.freeze(STRUCTURE);


function processDataText(text, { removeLineBreak = true } = {}) {
    return text
        .replace(/^#/, '')  // 含有变量的文本开头有 "#"
        .replaceAll('\\n·', '\n*')
        .replaceAll('\\n', removeLineBreak ? '<br/>' : '\n')
        .replaceAll(/{LINK#.+?}(.+?){\/LINK}/g, '$1')
        .replaceAll(/<color=(.+?)>(.+?)<\/color>/gs, (_, hex, innerText) => `{{genshincolor|${colors[hex]}|${innerText}}}`)
        .replaceAll(/<i>(.+?)<\/i>/gs, '\'\'$1\'\'')
        .replaceAll(/{M# ?(.+?)}{F# ?(.+?)}/g, '$1 / $2')
        .replaceAll(/{PLAYERAVATAR#SEXPRO\[INFO_MALE_PRONOUN_HE\|INFO_FEMALE_PRONOUN_SHE\]}/g, '他 / 她')
        .replaceAll(/{MATEAVATAR#SEXPRO\[INFO_MALE_PRONOUN_BOYD\|INFO_FEMALE_PRONOUN_GIRLD\]}/g, '王子 / 公主')
        .replaceAll(/{NICKNAME}/g, '{{UserName}}')
        .replaceAll(/{REALNAME\[ID\(1\)\]}/g, '流浪者')
        .replaceAll(/[^{]({[^{}]+?})[^}]/g, (whole, variable) => {
            LOGGER.error(`在数据中检测到未被替换的变量 ${variable} 。\n`);
            return whole;
        });
}

const ML_ = '<!--(-->';
const _MR = '<!--)-->';
function stripMarkers(text) {
    return text
        // 代码注释
        //.replaceAll(/(<!--.+?-->)/gs, `${ML_}$1${_MR}`)
        // 条目注释
        .replaceAll(/(<ref>.+?<\/ref>)/gs, `${ML_}$1${_MR}`)
        // 繁简转换
        .replaceAll(/-{(.+?)}-/gs, (_, content) => {
            if(content.search('|') == -1) {
                let [options, text] = content.split('|');
                return `${ML_}-{${options}${_MR}${text}${ML_}}-${_MR}`;
            } else {
                return `${ML_}-{${_MR}${content}${ML_}}-${_MR}`;
            }
        })
        // 特殊链接
        .replaceAll(/\[\[(?:(.*?)\|)?(.+?)\]\]/g, (whole, link, text) => {
            if(link !== undefined && redirects[text] != link) {
                return `${ML_}[[${link}|${_MR}${text}${ML_}]]${_MR}`;
            } else if(charaList[text] === undefined) {
                return `${ML_}[[${_MR}${text}${ML_}]]${_MR}`;
            } else {
                return whole;
            }
        });
}

function settleMarkers(oldCode, newCode) {
    let markers = [];
    oldCode = oldCode.replaceAll(/<!--\(-->(.+?)<!--\)-->/gs, (_, innerText) => {
        markers.push(innerText);
        return '§';
    });
    oldCode = stripMarkers(oldCode);
    oldCode = oldCode.replaceAll(/<!--\(-->(.+?)<!--\)-->/gs, (_, innerText) => {
        markers.push(innerText);
        return '§';
    });
    //console.log(markers);
    //console.log(oldCode);

    let diff = new Diff(oldCode, newCode);
    diff.compose();
    let ses = diff.getses(),
        output = '',
        count = 0;
    let tmp = '';
    for(let i = 0; i < ses.length; i++) {
        if(ses[i].t === diff.SES_COMMON) {
            tmp += ses[i].elem;
        } else if(ses[i].t === diff.SES_DELETE) {
            tmp += `[-${ses[i].elem}]`;
        } else if(ses[i].t === diff.SES_ADD) {
            tmp += `[+${ses[i].elem}]`;
        }
        if(ses[i].t === diff.SES_COMMON || ses[i].t === diff.SES_ADD) {
            output += ses[i].elem;
        } else if(ses[i].t === diff.SES_DELETE && ses[i].elem == '§') {
            output += `<!--(-->${markers[count++]}<!--)-->`;
        }
    }
    //console.log(tmp);

    return output;
}

(async () => {
    const FLAG_TESTING = false && !CONFIG.PRODUCTION;
    const FLAG_PRODUCTION = CONFIG.PRODUCTION;

    /**
     * 预处理
     */
    let queue = [];
    if(FLAG_PRODUCTION) {
        const today = new Date().getDate();
        if(today > 28) {
            return;
        }
        const charaCount = Object.keys(charaList).length;
        const partLength = charaCount / 28;
        queue = Object.entries(charaList)
            .slice(
                parseInt(partLength * (today - 1)),
                today != 28
                    ? parseInt(partLength * today)
                    : charaCount
            )
            .filter((chara) => !['钟离', '纳西妲', '芙宁娜', '埃洛伊'].includes(chara[0]));
    } else {
        queue = [
            //'琴', '安柏', '丽莎', '凯亚', '芭芭拉', '迪卢克', '雷泽', '温迪', '可莉', '班尼特', '诺艾尔', '菲谢尔', '砂糖', '莫娜', '迪奥娜', '阿贝多', '罗莎莉亚', '优菈', '米卡'
        ].map((name) => [name, charaList[name]]);
    }
    if(!FLAG_TESTING) {
        await api.login();
    }

    /**
     * 逐一编辑条目
     */
    for(let [name, id] of queue) {
        LOGGER.info(`正在编辑 ${Colors.white(name)}（${Colors.white(id)}） 条目。\n`);

        /**
         * 获取页面源码
         */
        let response,
            code;
        if(!FLAG_TESTING) {
            response = await api.post({
                action: 'query',
                prop: 'revisions',
                titles: '' || (redirects[name] ?? name),
                rvprop: 'content'
            });
            code = response.query.pages[0].revisions[0].content;
        } else {
            code = fs.readFileSync('./code.in', 'utf8');
        }
        const rawCode = code;
        let codeFooter = '';
        if(code.search(/{{原神\|角色}}/) != -1) {
            codeFooter = code.slice(code.search(/{{原神\|角色}}/));
            code = code.slice(0, code.search(/{{原神\|角色}}/));
        }

        /**
         * 获取角色数据
         * @todo https://gi.yatta.moe/api/v2/CHS/furniture/${furnitureId} 是同伴语音
         *       其中 furnitureId 来自 https://gi.yatta.moe/api/v2/chs/avatar/${id}
         */
        const dataAvatar = await(await fetch(`https://gi.yatta.moe/api/v2/chs/avatar/${id}`)).json();
        const dataAvaterFetter = await(await fetch(`https://gi.yatta.moe/api/v2/chs/avatarFetter/${id}`)).json();
        const data = {
            ...dataAvatar.data,
            ...dataAvaterFetter.data
        };
        data.quotes = Object.values(data.quotes);

        /**
         * 生成模板代码
         */
        let templateNew = '';
        for(let struct of STRUCTURE) {
            let newSegment = await struct.render(data);
            if(!newSegment.endsWith('\n')) {
                newSegment += '\n';
            }
            templateNew += `<!--\n\n  ${struct.heading}开始\n\n-->\n` + newSegment + `<!--\n\n  ${struct.heading}结束\n\n-->`;
        }
        templateNew = '\n{{原神角色2\n' + templateNew + '\n}}\n';

        /**
         * 替换原有模板
         */
        let templateStart = code.indexOf('{{原神角色2');
        if(templateStart != -1) {
            let templateEnd;
            let balance = 0;
            for(templateEnd = templateStart; templateEnd < code.length; templateEnd++) {
                if(code[templateEnd] == '{') balance++;
                else if(code[templateEnd] == '}') balance--;

                if(balance == 0) break;
            }

            const templateOld = code.slice(templateStart, templateEnd+1);
            code = code.replace(
                templateOld, 
                settleMarkers(templateOld, templateNew)
            );
            if(!code.endsWith('\n')) {
                code += '\n';
            }
            if(!code.endsWith('\n\n')) {
                code += '\n';
            }
            code += codeFooter;
        } else {
            const infoHeading = `\n== 角色资料 ==`;
            let infoStart = code.search(/\n== *角色资料 *== */);
            if(infoStart == -1) {
                infoStart = code.search(/\n== *角色相关 *== */);
                infoStart += code.slice(infoStart + 1).indexOf('\n') + 1;
                const offset = code.slice(infoStart).search(/\n== *[^=]+? *== */);
                if(offset == -1) {
                    infoStart = code.length;
                } else {
                    infoStart += offset;
                }
                code = code.slice(0, infoStart) + infoHeading + code.slice(infoStart);
                infoStart += infoHeading.length;
            } else {
                infoStart += code.slice(infoStart + 1).indexOf('\n') + 1;
            }

            code = code.slice(0, infoStart) + templateNew + code.slice(infoStart);
            code += codeFooter;
        }
        
        /**
         * 提交处理后的源码
         */
        if(FLAG_TESTING) {
            fs.writeFileSync('./code.out', code);
            break;
        }
        if(code == rawCode) {
            LOGGER.info('条目没有变化。\n', { noRepeat: false });
        } else {
            response = await api.post({
                action: 'edit',
                title: '' || (redirects[name] ?? name),
                text: code,
                summary: `/* 角色资料 */` + CONFIG.SUMMARY('编辑角色数据'),
                bot: true,
                tags: 'Bot',
                token: await api.getToken('csrf', true)
            }).then((res) => LOGGER.info(Colors.white(JSON.stringify(res)) + '\n'));
        }

        /**
         * 待机，防止频繁访问 API
         */
        const interval = 30;
        if(!FLAG_PRODUCTION) {
            const bar = new ProgressBar(
                `[${Colors.blue('WAITING')}] │:bar│  :currents/${interval}s`, 
                {
                    total: interval,
                    width: 30,
                    complete: '█',
                    incomplete: '░'
                }
            );
            while(!bar.complete) {
                bar.tick();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } else {
            await new Promise(resolve => setTimeout(resolve, interval * 1000));
        }
    }

    /**
     * 收尾
     */
    if(!FLAG_TESTING) {
        //if(FLAG_PRODUCTION) {
        //    await LOGGER.endAndUpload(api, `User:${CONFIG.USERNAME}/Bot/Log`);
        //}
        await api.logout();
    }
})();
