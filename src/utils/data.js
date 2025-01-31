import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readData(dataName, itemName) {
    const filePath = path.join(__dirname, `../../data/${dataName}.json`);
    const ret = JSON.parse(fs.readFileSync(filePath, 'utf8'))[itemName];
    if(ret !== undefined) {
        return ret;
    } else {
        throw new ReferenceError(`Data ${itemName} does not exist.`);
    }
}

function writeData(dataName, data) {
    const filePath = path.join(__dirname, `../../data/${dataName}.json`);
    fs.writeFileSync(filePath, data);
}

export { readData, writeData };
