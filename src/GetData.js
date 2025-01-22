import fs from 'fs';

function getData(dataName) {
    let ret = JSON.parse(fs.readFileSync('./data.json', 'utf8'))[dataName];
    if(ret !== undefined) {
        return ret;
    } else {
        throw new ReferenceError(`Data ${dataName} does not exist.`);
    }
}

export default getData;
