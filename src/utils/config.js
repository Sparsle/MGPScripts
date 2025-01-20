import { env } from 'process';

const CONFIG = {
    USER_AGENT: env.USER_AGENT,
    ZH_API: env.ZH_API,
    USERNAME: env.USERNAME,
    PASSWORD: env.PASSWORD,
    COOKIE: eval(env.COOKIE)(),
};

export default CONFIG;
