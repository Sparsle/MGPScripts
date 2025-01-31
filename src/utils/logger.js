import winston from 'winston';
import fs from 'fs';
const format = winston.format;

const loggerLevels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    waiting: 999
}
const loggerColors = {
    ERROR: 'red',
    WARN: 'yellow',
    INFO: 'green',
    DEBUG: 'blue',
    WAITING: 'white'
}

let loggedContent = [];
const logger = winston.createLogger({
    levels: loggerLevels,
    format: format.combine(
        format.padLevels({ levels: loggerLevels }),
        format((info) => {
            info.level = info.level.toUpperCase();
            return info;
        })(),
        format.colorize({
            all: true,
            colors: loggerColors
        }),
        format.printf((info) => `[${info.level}] ${info.message}`),
    ),
    transports: [
        new winston.transports.Stream({
            stream: fs.createWriteStream('./log')
        }),
        new winston.transports.Console()
    ],
});

const LOGGER = {};
for(let level of Object.keys(loggerLevels)) {
    LOGGER[level] = (message, {noRepeat = false} = {}) => {
        if(noRepeat) {
            if(loggedContent.includes(level + message)) {
                return;
            }
        }
        loggedContent.push(level + message);
        logger[level](message);
    }
}

LOGGER.endAndUpload = async (api, title) => {
    logger.on('finish', async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
        const log = fs.readFileSync('./log', 'utf8')
            .replaceAll(/\[.+?m/g, '');
        await api.post({
            action: 'edit',
            title: title,
            text: `__NOINDEX__<pre>\n${log}</pre>`,
            bot: true,
            tags: 'Bot',
            token: await api.getToken('csrf', true)
        }).then(console.log);
    });
    logger.end();
}

export default LOGGER;
