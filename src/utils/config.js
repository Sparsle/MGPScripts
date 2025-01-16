import { env } from 'process';

export const CONFIG = {
    PASSWORD: env.PASSWORD,
    SSO_USER_ID: env.SSO_USER_ID,
    SSO_TOKEN: env.SSO_TOKEN
};
