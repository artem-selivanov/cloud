const {google} = require('googleapis')
const os = require('os');
let keys;
if (os.platform() === 'win32') {
    // Windows
    keys = require('../assets/credentials.json');
} else { //if (os.platform() === 'linux')
    // Linux
    keys = require('/www/wwwroot/cloud/assets/credentials.json');
}



//11
async function getSheet(sheet, list) {
    const sheet_cl = new google.auth.GoogleAuth({
        credentials: {
            private_key: keys.private_key,
            client_email: keys.client_email,
        },
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets',
        ],
    });
    const authClientObject = await sheet_cl.getClient();
    const gsapi = google.sheets({
        version: 'v4',
        auth: authClientObject,
    })
    const updateOptions = {
        spreadsheetId: sheet,
        range: `${list}`,
    }

    const responce = await gsapi.spreadsheets.values.get(updateOptions)
    //console.log(responce.data)
    //const result = responce.data.values
    return responce.data?.values||[]
}

async function addRows(sheet, tab, arr) {
    const tmp = await getSheet(sheet, tab)
    //console.log(tmp)
    const index = tmp.length + 1
    await setValues(sheet, tab, arr, `A${index}`)
}



async function setValues(sheet, tab, arr, range) {
    const updateOptions = {
        spreadsheetId: sheet,
        range: `${tab}!${range}`,
        valueInputOption: 'USER_ENTERED',
        resource: {values: arr}
    }
    //console.log(updateOptions)
    const sheet_cl = new google.auth.GoogleAuth({
        credentials: {
            private_key: keys.private_key,
            client_email: keys.client_email,
        },
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets',
        ],
    });
    const authClientObject = await sheet_cl.getClient();
    const api = google.sheets({
        version: 'v4',
        auth: authClientObject,
    })
    const responce = await api.spreadsheets.values.update(updateOptions)
    return responce
}

module.exports = {addRows}