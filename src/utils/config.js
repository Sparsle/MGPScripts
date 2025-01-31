import { env } from 'process';

const CONFIG = eval(env.CONFIG)();
CONFIG.PRODUCTION = true;

export default CONFIG;
