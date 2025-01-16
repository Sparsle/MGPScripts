import { env } from 'process';

const CONFIG = {
    USER_AGENT: env.USER_AGENT,
    PASSWORD: env.PASSWORD,
    SSO_USER_ID: env.SSO_USER_ID,
    SSO_TOKEN: env.SSO_TOKEN
};

export default CONFIG;
