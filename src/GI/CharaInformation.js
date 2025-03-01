import CONFIG from '../utils/config.js';
import LOGGER from '../utils/logger.js';
import mw from '../utils/mediawiki.js';
import { readData } from '../utils/data.js';
import fs from 'fs';
import ProgressBar from 'progress';
import Colors from 'colors/safe.js';

const api = new mw.Api({
    url: CONFIG.ZH_API,
    botUsername: CONFIG.USERNAME, 
    botPassword: CONFIG.PASSWORD, 
    cookie: CONFIG.COOKIE
});

const charaList = readData('GI', 'chara_list');
const redirects = readData('GI', 'chara_redirects');
const colors = {
    '#37FFFF': '文3', '#FFD780FF': '文',
    '#80FFD7FF': '风', '#FFE699FF': '岩', '#FFACFFFF': '雷', '#99FF88FF': '草', '#80C0FFFF': '水', '#FF9999FF': '火', '#99FFFFFF': '冰'
};

let STRUCTURE = [
    {
        heading: '天赋',
        level: 3,
        enabled: true,
        render: async (segment, data) => {
            if(hasSpecialContent(segment)) {
                LOGGER.warn(`天赋检测到额外内容。\n`);
                return segment;
            }

            const putParamIntoDesc = (desc, params) => {
                return desc.replaceAll(/{param(\d+):(.+?)}/g, (_, index, method) => {
                    index = parseInt(index) - 1;
                    switch(method) {
                        case 'F1P':
                            return (
                                parseFloat((params[index] * 100).toString().replace(/\.(.)4999/, '.$15000')) 
                                    + Number.EPSILON
                            ).toFixed(1) + '%';
                        case 'F2P':
                            return (params[index] * 100 + Number.EPSILON).toFixed(2) + '%';
                        case 'P':
                            return (params[index] * 100 + Number.EPSILON).toFixed(0) + '%';
                        case 'F1':
                            return (params[index] + Number.EPSILON).toFixed(1);
                        case 'F2':
                            return (params[index] + Number.EPSILON).toFixed(2);
                        case 'I':
                            return new Intl.NumberFormat('en-US').format((params[index] + Number.EPSILON).toFixed(0));
                    }
                });
            };
            let ret = `{| class="mw-collapsible wikitable" width=100%\n`
                    + `!style="width:10em"| 天赋 !! 天赋介绍\n`
                    + ``;

            /**
             * 战斗天赋
             */
            for(let talent of data.Skills) {
                let attrNames = [],
                    attrValues = {},
                    longestAttrName = '';
                for(let i in talent.Promote["0"].Desc) {
                    if(talent.Promote["0"].Desc[i] == '') {
                        break;
                    }
                    attrNames.push(talent.Promote["0"].Desc[i].match(/(.+)\|.+/)[1]);
                    attrValues[i] = [];
                    longestAttrName = longestAttrName.length < attrNames[i].length ? attrNames[i] : longestAttrName;
                }
                for(let level of Object.values(talent.Promote)) {
                    for(let i in level.Desc) {
                        if(level.Desc[i] == '') {
                            break;
                        }
                        let value = putParamIntoDesc(level.Desc[i].match(/.+\|(.+)/)[1], level.Param);
                        attrValues[i].push(value);
                    }
                }

                const columnWidth = longestAttrName.replaceAll(/\/|·/g, '').length 
                                  + 0.33 * (longestAttrName.match(/\/|·/g) ?? []).length
                                  + 1;
                let talentAttrTable = `{| style="min-width:max-content;border-collapse:collapse;text-align:center;line-height:1.9"\n`
                                 + `|-\n`
                                 + `!style="position:sticky;left:0;background:#f8f9fa;min-width:${columnWidth}em"| 详细属性\n`
                                 + `!　!!Lv.1!!　!!Lv.2!!　!!Lv.3!!　!!Lv.4!!　!!Lv.5!!　!!Lv.6!!　!!Lv.7!!　!!Lv.8!!　!!Lv.9!!　!!Lv.10!!　!!{{color|blue|Lv.11}}!!　!!{{color|blue|Lv.12}}!!　!!{{color|blue|Lv.13}}!!　!!{{color|grey|Lv.14}}!!　!!{{color|grey|Lv.15}}\n`
                                 + ``;
                Object.entries(attrValues).forEach(([nameIndex, values]) => {
                    let valuesJoined = '';
                    if(values[0] == values[1]) {
                        valuesJoined = `style="position:sticky;left:${columnWidth + 1.3}em"| ${values[0]}`;
                    } else {
                        valuesJoined = values.join('||||');
                    }
                    talentAttrTable += `|-\n`
                                  + `|style="position:sticky;left:0;background:#f8f9fa"| ${attrNames[nameIndex]}\n`
                                  + `|||${valuesJoined}\n`
                                  + ``;
                });

                ret += `|-\n`
                     + `|align=center rowspan=2| '''${talent.Name}'''<br/><span style="font-size:13px">战斗天赋</span>\n`
                     + `|<poem>\n`
                     + `${processDataText(talent.Desc, { removeLineBreak: false })}\n`
                     + `</poem>\n`
                     + `|-\n`
                     + `|style="max-width:0;padding:0"|<div style="overflow:auto">\n`
                     + `${talentAttrTable}|-\n`
                     + `|}\n`
                     + `</div>\n`
                     + ``;
            }

            /**
             * 固有天赋
             */
            for(let passive of data.Passives) {
                ret += `|-\n`
                     + `|align=center| '''${passive.Name}'''<br/><span style="font-size: 13px;">固有天赋</span>\n`
                     + `|<poem>\n`
                     + `${processDataText(passive.Desc, { removeLineBreak: false })}\n`
                     + `</poem>\n`
                     + ``;
            }

            return ret + '|}';
        }
    },
    {
        heading: '命之座',
        level: 3,
        enabled: true,
        render: async (segment, data) => {
            const header = (segment.match(/^(.+?){\|/s) ?? ['', ''])[1].replace(/{{genshintext(?:\|N)?}}\n/, '');
            const footer = (segment.match(/\|}(.+?)$/s) ?? ['', ''])[1];

            segment = segment.replace(/{\|.*?\n(?:\|-)?/, '').replace(/(?:\n\|-)?\n\|}/, '');
            let lines = segment
                .split(/\|-\n\|(?: ?style=".+?" ?\|)?/)
                .map((s) => s.split('||'))
                .filter((s) => s.length == 2);

            let ret = [['']],
                longestAttrName = '',
                footprint = {};
            for(let i = 0; i < data.Constellations.length; i++) {
                let con = data.Constellations[i],
                    pushName = `'''${con.Name}'''<br/><span style="font-size:13px;">第${i + 1}层</span>`,
                    pushDesc = `${processDataText(con.Desc)}\n`;

                for(let [currentName, currentDesc] of lines) {
                    let pCurrentName = purifyCurrentText(currentName).replace(/<br ?\/?>.*/g, '');
                    if(!!footprint[pCurrentName]) {
                        continue;
                    }
                    if(pCurrentName != con.Name) {
                        continue;
                    }

                    if(hasSpecialContent(currentName, { removeColor: true })) {
                        LOGGER.warn(
                            `${Colors.white(data.Name)} 的命之座名称 ${Colors.bgGray.brightWhite(currentName)} 检测到额外内容。\n`, 
                            { noRepeat: true }
                        );
                        pushName = currentName.trim();
                    }
                    if(hasSpecialContent(currentDesc)) {
                        LOGGER.warn(
                            `${Colors.white(data.Name)} 的命之座 ${Colors.bgGray.brightWhite(pCurrentName)} 的描述检测到额外内容。\n`, 
                            { noRepeat: true }
                        );
                        pushDesc = currentDesc.trimStart();
                    }
                    footprint[pCurrentName] = true;
                }

                ret.push([pushName, pushDesc]);
                longestAttrName = longestAttrName.length < con.Name.length ? con.Name : longestAttrName;
            }

            ret = `{| class="mw-collapsible wikitable"\n`
                + `! style="min-width:${longestAttrName.length + 1}em;" | 名称 !! 介绍\n`
                + `${ret.map((s) => s.join(' || ')).join('|-\n| style="text-align:center;" | ')}|}`;
            return header + ret + footer;
        }
    },
    {
        heading: '资料',
        level: 3,
        enabled: true,
        render: async (segment, data) => {
            return data.Desc;
        }
    },
    {
        heading: '故事',
        level: 4,
        enabled: true,
        render: async (segment, data) => {
            if(['钟离', '纳西妲', '芙宁娜'].includes(data.Name)) {
                return segment;
            }
            const header = (segment.match(/^(.+?){\|/s) ?? ['', ''])[1];
            const footer = (segment.match(/\|}(.+?)$/s) ?? ['', ''])[1];

            segment = segment.replace(/{\|.*?\n(?:\|-)?/, '').replace(/(?:\n\|-)?\n\|}/, '');
            let lines = segment
                .split('|-\n!')
                .map((s) => s.split(/\|-\n\| ?<poem>\n/))
                .filter((s) => s.length == 2);

            let ret = [ [''] ],
                footprint = {};
            for(let story of data.CharaInfo.Stories) {
                let pushTitle = `${processDataText(story.Title)}`,
                    pushText = `<poem>\n${processDataText(story.Text, { removeLineBreak: false })}\n</poem>\n`;
                if(story.Unlock.length != 0) {
                    pushTitle += `<br/>{{nobold|1=<span style="font-size:13px;">${story.Unlock.reverse().join('<br/>')}</span>}}\n`;
                } else {
                    pushTitle += '\n';
                }

                for(let [currentTitle, currentText] of lines) {
                    let pCurrentTitle = purifyCurrentText(currentTitle).replace(/<br ?\/?>.*/g, '');
                    if(!!footprint[pCurrentTitle]) {
                        continue;
                    }
                    if(pCurrentTitle != story.Title) {
                        continue;
                    }

                    if(hasSpecialContent(currentTitle, { removeColor: true })) {
                        LOGGER.warn(
                            `${Colors.white(data.Name)} 的故事标题 ${Colors.bgGray.brightWhite(currentTitle)} 检测到额外内容。\n`, 
                            { noRepeat: true }
                        );
                        pushTitle = currentTitle.trimStart();
                    }
                    if(hasSpecialContent(currentText, { removeColor: true })) {
                        LOGGER.warn(
                            `${Colors.white(data.Name)} 的故事 ${Colors.bgGray.brightWhite(pCurrentTitle)} 的文本检测到额外内容。\n`, 
                            { noRepeat: true }
                        );
                        pushText = `<poem>\n${currentText.trimStart()}`;
                    }
                    footprint[pCurrentTitle] = true;
                }

                ret.push([pushTitle, pushText]);
            }

            ret = `{| class="wikitable"\n`
                + `${ret.map((s) => s.join('|-\n| ')).join('|-\n! ')}|}`;
            return header + ret + footer;
        }
    },
    {
        heading: '语音',
        level: 4,
        enabled: true,
        render: async (segment, data) => {
            const header = (segment.match(/^(.*?){\|/s) ?? ['', ''])[1];
            const footer = segment.slice(match(segment, segment.search(/{\|/), /{\|/, /\|}/));
            segment = segment.slice(0, match(segment, segment.search(/{\|/), /{\|/, /\|}/));

            // 避免开头和末尾的 |- 或 {| 或 |} 影响表格分割 
            segment = segment.replace(/{\|.*?\n(?:\|-)?/, '').replace(/(?:\n\|-)?\n\|}/, '');
            /**
             * 执行 filter 操作前 lines 预期的结构：
             * [
             *   [ '! 场合 !! 台词\n' ],
             *   [ '', title, text ],      <= 单条语音
             *   ...
             *   [ '', title, text ],
             *   [ '! 场合 !! 战斗台词' ],
             *   [ '', title, text ],
             *   ...
             *   [ '', title, text ],
             * ]
             */
            let lines = segment
                .split('|-')
                .map((s) => s.split('\n|'))
                .filter((s) => s.length == 3);

            /**
             * 将数据库中的语音 (quote.***) 与现有语音 (current***) 逐一进行匹配:
             * 
             *   1. 现有语音中检查到额外内容 (hasSpecialContent), 则保持原样
             *      (避免覆盖用户添加的额外内容, 缺点是不能格式化)
             * 
             *   2. 现有语音无额外内容, 则使用数据库的内容
             *      (从而能够更新内容, 格式化, 修补各种衍夺讹舛等)
             * 
             *   3. 未匹配到现有语音, 则添加数据库的内容
             *      (从反面讲, 与数据库匹配不上的、 且无额外内容的现有语音会被删除)
             * 
             * 流程简图：
             *   
             *   $C_TITLE$ ──────────> ::has_special_content?:: ──o──> [Case 1] ──> $C_TITLE$ ──> [End]
             *                                   │
             *                                   x
             *                                   │
             *                                   ↓
             *                               $C_TITLE$
             *                                   │
             *                               (c_purify)
             *                                   │
             *                                   ↓
             *   $D_TITLE$ ───(d_purify)───> ::equal?:: ──o──> [Case 2]
             *                                   │                │
             *                                   x                │
             *                                   │                │
             *                                   ↓                │
             *                                [Case 3] ───────────┴── $D_TITLE$ ───(d_process)──> [End]
             * 
             * 此外, footprint 用于减少比对次数, 提升匹配性能
             */
            let ret = [['']],
                footprint = {},
                nameLinkFootprint = {};
            nameLinkFootprint[data.Name] = true;
            for(let quote of data.CharaInfo.Quotes) {
                let pushTitle = processDataText(quote.Title),
                    pushText = `${processDataText(quote.Text)}\n`;
                quote.Title = purifyDataTitle(quote.Title);

                for(let [_, currentTitle, currentText] of lines) {
                    let pCurrentTitle = purifyCurrentText(currentTitle, { removeColor: true });
                    if(!!footprint[pCurrentTitle]) {
                        continue;
                    }
                    if(pCurrentTitle != quote.Title) {
                        continue;
                    }

                    if(hasSpecialContent(currentTitle, { removeLink: false, removeColor: true })) {
                        LOGGER.warn(
                            `${Colors.white(data.Name)} 的语音标题 ${Colors.bgGray.brightWhite(currentTitle)} 检测到额外内容。\n`, 
                            { noRepeat: true }
                        );
                        pushTitle = currentTitle.trimStart();
                    }
                    if(hasSpecialContent(currentText)) {
                        LOGGER.warn(
                            `${Colors.white(data.Name)} 的语音 ${Colors.bgGray.brightWhite(pCurrentTitle)} 的文本检测到额外内容。\n`, 
                            { noRepeat: true }
                        );
                        pushText = currentText.trimStart();
                    }
                    footprint[pCurrentTitle] = true;
                }

                // 语音标题加入角色链接
                const pushTitleWithoutLink = pushTitle.replaceAll(/\[\[(?:.*?\|)?(.+?)\]\]/g, '$1');
                for(let name of Object.keys(charaList)) {
                    if(!!nameLinkFootprint[name]) {
                        continue;
                    }
                    if(pushTitleWithoutLink.search(name) == -1) {
                        continue;
                    }

                    pushTitle = pushTitleWithoutLink.replace(
                        new RegExp(`${name}(?!\\]\\])`), 
                        redirects[name] === undefined 
                            ? `[[${name}]]`
                            : `[[${redirects[name]}|${name}]]`
                    );
                    nameLinkFootprint[name] = true;
                }

                ret.push(['', pushTitle, pushText]);
            }

            ret = `{| class="mw-collapsible wikitable"\n`
                + `! style="min-width:min(20vw, 11em);" | 场合 !! 台词\n`
                + `${ret.map((s) => s.join('\n| ')).join('|-')}|}`;
            ret = ret.replace(/(\|-\n\| .*?突破的感受·合.*?\n\| .+?\n)/, '$1|-\n! 场合 !! 战斗台词\n');
            return header + ret + footer;
        }
    },
    {
        heading: '生日',
        level: 4,
        enabled: true,
        render: async (segment, data) => segment
    }
];


function processDataText(text, { removeLineBreak = true } = {}) {
    return text
        .replace(/^#/, '')  // 含有变量的文本开头有 "#"
        .replaceAll('\\n·', '\n*')
        .replaceAll('\\n', removeLineBreak ? '<br/>' : '\n')
        .replaceAll(/<color=(.+?)>(.+?)<\/color>/gs, (_, hex, innerText) => `{{genshincolor|${colors[hex]}|${innerText}}}`)
        .replaceAll(/<i>(.+?)<\/i>/gs, '\'\'$1\'\'')
        .replaceAll(/{M# ?(.+?)}{F# ?(.+?)}/g, '$1 / $2')
        .replaceAll(/{PLAYERAVATAR#SEXPRO\[INFO_MALE_PRONOUN_HE\|INFO_FEMALE_PRONOUN_SHE\]}/g, '他 / 她')
        .replaceAll(/{MATEAVATAR#SEXPRO\[INFO_MALE_PRONOUN_BOYD\|INFO_FEMALE_PRONOUN_GIRLD\]}/g, '王子 / 公主')
        .replaceAll(/{NICKNAME}/g, '{{UserName}}')
        .replaceAll(/{REALNAME\[ID\(1\)\]}/g, '流浪者')
        .replaceAll(/[^{]({[^{}]+?})[^}]/g, (whole, variable) => {
            LOGGER.error(
                `在数据中检测到未被替换的变量 ${variable} 。\n`, 
                { noRepeat: true }
            );
            return whole;
        });
}

function purifyDataTitle(text) {
    return text
        .replace(/^#/, '')
        .replaceAll(/{REALNAME\[ID\(1\)\]}/g, '流浪者');
}

function purifyCurrentText(text, { removeLink = true, removeColor = false } = {}) {
    return text
        .trim()
        .replaceAll(/<!--.+?-->/gs, '')
        .replaceAll(/\[\[(?:(.*?)\|)?(.+?)\]\]/g, (whole, link, text) => {
            /**
             * 遇到诸如 [[纳西妲|小吉祥草王]] 或 [[ (未实装角色) ]] 的情况
             * 临时加入 charaList 和 redirects, 以便语音标题加入角色链接时使用
             */
            if(charaList[text] === undefined) {
                charaList[text] = '';
                if(redirects[text] === undefined) {
                    redirects[text] = link;
                }
                LOGGER.warn(
                    `文本 ${Colors.bgGray.brightWhite(whole.replaceAll('\n', '\\n').slice(0, 20) + '...')} 检测到额外链接。\n`, 
                    { noRepeat: true }
                );
            }
            return removeLink ? text : whole;
        })
        .replaceAll(/<ref>.+?<\/ref>/gs, '')
        .replaceAll(/{{genshincolor\|.+?\|(.+?)}}/g, (whole, text) => {
            return removeColor ? text : whole;
        })
        .replaceAll(/-{(?:.+?\|)?(.+?)}-/gs, (whole, text) => {
            LOGGER.warn(
                `文本 ${Colors.bgGray.brightWhite(whole.replaceAll('\n', '\\n').slice(0, 20) + '...')} 检测到手动繁简转换。\n`, 
                { noRepeat: true }
            );
            return text;
        });
}

function hasSpecialContent(text, flags = { removeLink: false }) {
    return purifyCurrentText(text, flags) != text.trim();
}

function check(text, start, keyword) {
    if(text.slice(start).search(keyword) == 0) {
        return text.slice(start).match(keyword)[0].length;
    } else {
        return 0;
    }
}

function match(text, index, start, end) {
    let balance = 0;
    for(let i = index; i < text.length; i++) {
        if(check(text, i, start)) {
            balance++;
        } else if(check(text, i, end)) {
            balance--;
        }

        if(balance == 0) {
            return i + check(text, i, end);
        }
    }
}

(async () => {
    const FLAG_TESTING = true && !CONFIG.PRODUCTION;
    const FLAG_PRODUCTION = CONFIG.PRODUCTION;

    /**
     * 预处理
     */
    if(!FLAG_TESTING) {
        await api.login();
    }
    STRUCTURE = STRUCTURE.filter((struct) => struct.enabled);
    Object.freeze(STRUCTURE);

    let queue = [];
    if(FLAG_PRODUCTION) {
        if(![7, 14, 21, 28].includes(new Date().getDate())) {
            await api.logout();
            return;
        }
        const charaCount = Object.keys(charaList).length;
        const partLength = parseInt(charaCount / 4);
        const partIndex = new Date().getDate() / 7;
        queue = Object.entries(charaList)
            .slice(
                partLength * (partIndex - 1),
                partIndex != 4
                    ? partLength * partIndex
                    : charaCount
            )
            .filter((chara) => chara[0] != '埃洛伊');
    } else {
        queue = [
            '菲米尼'
            //'琴', '安柏', '丽莎', '凯亚', '芭芭拉', '迪卢克', '雷泽', '温迪', '可莉', '班尼特', '诺艾尔', '菲谢尔', '砂糖', '莫娜', '迪奥娜', '阿贝多', '罗莎莉亚', '优菈', '米卡'
            //'魈', '北斗', '凝光', '香菱', '行秋', '重云', '刻晴', '七七', '钟离', '辛焱', '甘雨', '胡桃', '烟绯', '云堇', '申鹤', '夜兰', '瑶瑶', '白术', '闲云', '嘉明', '蓝砚'
        ].map((name) => [name, charaList[name]]);
    }

    for(let [name, id] of queue) {
        LOGGER.info(`正在编辑 ${Colors.white(name)} 条目。\n`);

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
        response = await fetch(`https://api.hakush.in/gi/data/zh/character/${id}.json`);
        const data = await response.json();
        await fetch(`https://gi.yatta.moe/api/v2/chs/avatarFetter/${id}`)
            .then((res) => res.json())
            .then((yattaJson) => {
                // hakushi.in 的角色语音顺序有问题, 需以 yatta.moe 为准重新排序
                const order = Object.fromEntries(
                    Object.entries(yattaJson.data.quotes).map((quote) => [quote[1].title, quote[0]])
                );
                data.CharaInfo.Quotes.sort((a, b) => parseInt(order[a.Title]) - parseInt(order[b.Title]));
                /** 
                 * hakushi.in 的角色故事缺失变动后的文本, 需检查 yatta.moe 并添加
                 * 目前只有钟离、纳西妲、芙宁娜有此情况
                 */
                /*
                Object.entries(yattaJson.data.story).forEach(([index, story]) => {
                    if(story.title2 !== null) {
                        data.CharaInfo.Stories[index].Title2 = story.title2;
                        data.CharaInfo.Stories[index].Text2 = story.text2;
                    }
                });
                */
            });

        /**
         * 检测并插入二级标题
         */
        const infoHeading = `\n== ${data.CharaInfo.Title}·${name}(${data.CharaInfo.Vision}) ==`;
        let infoStart = code.search(new RegExp(`${data.CharaInfo.Title} ?· ?${name}\\(${data.CharaInfo.Vision}\\)`));
        if(infoStart == -1) {
            infoStart = code.search(/\n== *角色相关 *== */);
            infoStart += code.slice(infoStart).indexOf('\n');
            const offset = code.slice(infoStart).search(/\n== *[^=]+? *== */);
            if(offset == -1) {
                infoStart = code.length;
            } else {
                infoStart += offset;
            }
            code = code.slice(0, infoStart) + infoHeading + code.slice(infoStart);
            infoStart += infoHeading.length;
        } else {
            infoStart += code.slice(infoStart).indexOf('\n');
        }

        /**
         * 在源码中添加 STRUCTURE 中的节标题
         */
        let infoEnd = infoStart;
        for(let i in STRUCTURE) {
            const heading = STRUCTURE[i].heading;
            const level = STRUCTURE[i].level;
            let search = code.search(new RegExp(`\\n==+ *${heading} *==+ *\\n?`));

            if(search == -1) {
                let sectionHeading = `\n${'='.repeat(level)} ${heading} ${'='.repeat(level)}\n`;
                code = code.slice(0, infoEnd) + sectionHeading + code.slice(infoEnd);
                infoEnd += sectionHeading.length;
            } else {
                search += code.slice(search + 1).indexOf('\n') + 1;
                const next = code.slice(search).search(/\n==+ *[^=]+? *==+ */);
                if(next != -1) {
                    infoEnd = search + code.slice(search).search(/\n==+ *[^=]+? *==+ */);
                } else {
                    infoEnd = code.length;
                }
            }
        }

        /**
         * 按节检索源码, 在对应的节填入生成的新代码
         */
        let infoCode = code.slice(infoStart, infoEnd);
        const sectionHeadings = infoCode
            .matchAll(/\n(==+ *[^=]+? *==+ *)/g)
            .toArray()
            .map((match) => match[1]);
        for(let i = 0; i < sectionHeadings.length; i++) {
            const heading = sectionHeadings[i].match(/==+ *([^=]+?) *==+/)[1];
            for(let struct of STRUCTURE) {
                if(struct.heading != heading) {
                    continue;
                }

                const sectionStart = infoCode.indexOf(sectionHeadings[i]) + sectionHeadings[i].length + 1;
                const sectionEnd = i < sectionHeadings.length - 1 
                        ? infoCode.indexOf(sectionHeadings[i + 1]) - 1
                        : infoCode.length;
                let newSegment = await struct.render(infoCode.slice(sectionStart, sectionEnd), data);
                if(!newSegment.endsWith('\n')) {
                    newSegment += '\n';
                }
                infoCode = infoCode.slice(0, sectionStart) + newSegment + infoCode.slice(sectionEnd);
            }
        }
        code = code.slice(0, infoStart) + infoCode + code.slice(infoEnd);
        if(!code.endsWith('\n')) {
            code += '\n';
        }
        if(!code.endsWith('\n\n')) {
            code += '\n';
        }
        code += codeFooter;
        
        /**
         * 提交处理后的源码
         */
        if(FLAG_TESTING) {
            fs.writeFileSync('./code.out', code);
            break;
        }

        //fs.writeFileSync('./code.out', code);
        //break;
        if(code == rawCode) {
            LOGGER.info('条目没有变化。\n');
        } else {
            response = await api.post({
                action: 'edit',
                title: '' || (redirects[name] ?? name),
                text: code,
                //summary: `/* ${data.CharaInfo.Title}·${name}(${data.CharaInfo.Vision}) */`,
                summary: `/* ${data.CharaInfo.Title}·${name}(${data.CharaInfo.Vision}) */` + CONFIG.SUMMARY('编辑角色数据'),
                bot: true,
                tags: 'Bot',
                token: await api.getToken('csrf', true)
            }).then((res) => LOGGER.info(Colors.white(JSON.stringify(res)) + '\n'));
        }

        /**
         * 待机，防止频繁访问 API
         */
        const interval = 300;
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

    if(!FLAG_TESTING) {
        if(FLAG_PRODUCTION) {
            await LOGGER.endAndUpload(api, `User:${CONFIG.USERNAME.replace('@', '/')}/Log`);
        }
        await api.logout();
    }
})();
