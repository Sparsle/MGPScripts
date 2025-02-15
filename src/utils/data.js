import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readData(dataName, itemName='') {
    const filePath = path.join(__dirname, `../../data/${dataName}.json`);
    let ret = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if(itemName != '') {
        ret = ret[itemName];
    }
    if(ret !== undefined) {
        return ret;
    } else {
        throw new ReferenceError(`Data ${itemName} does not exist.`);
    }
}

function writeData(dataName, itemName, data) {
    const filePath = path.join(__dirname, `../../data/${dataName}.json`);
    if(itemName == '') {
        fs.writeFileSync(filePath, data);
    } else {
        let wholeData = readData(dataName);
        wholeData[itemName] = data;
        fs.writeFileSync(filePath, JSON.stringify(wholeData));
    }
}

export { readData, writeData };
