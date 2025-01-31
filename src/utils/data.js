import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, './data.json');

function readData(dataName) {
    const ret = JSON.parse(fs.readFileSync(filePath, 'utf8'))[dataName];
    if(ret !== undefined) {
        return ret;
    } else {
        throw new ReferenceError(`Data ${dataName} does not exist.`);
    }
}

function writeData(data) {
    fs.writeFileSync(filePath, data);
}

export { readData, writeData };
