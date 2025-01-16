import { env } from 'process';

const CONFIG = {
    PASSWORD: env.PASSWORD,
    SSO_USER_ID: env.SSO_USER_ID,
    SSO_TOKEN: env.SSO_TOKEN
};

export default CONFIG;
