const spreadsheet = require('./helpers/spreadsheet');
const cloudflare = require('./helpers/cloudflare');
const { DateTime } = require("luxon");
require('dotenv').config();

async function processForm(body) {
    const { login, apiKey, domains, ipAddresses, settings, macSelection, serverPilot, spSelection, domainService} = body;
    console.log(settings)
    //const domainList = domains//.split('\n').map(domain => domain.trim());
    const domain = domains.trim()
    const serverName = serverPilot.replace(/[ _\/+,]/g, "-").replaceAll('--', "-").toLowerCase();
    const macApi = domainService=='dynadot'?process.env[macSelection.toUpperCase()]:domainService=='porkbun'?process.env[`${macSelection.toUpperCase()}_PORKBUN`]:process.env[`${macSelection.toUpperCase()}_NAMECHEAP`];
    const secret = domainService=='porkbun'?process.env[`${macSelection.toUpperCase()}_SECRETPB`]:process.env[`${macSelection.toUpperCase()}_NCUASER`];
    const password = process.env[`${spSelection.toUpperCase()}_PASSWORD`];
    const spid = process.env[`${spSelection.toUpperCase()}_ID`];
    const spapi = process.env[`${spSelection.toUpperCase()}_API`];
    console.log({login, apiKey, domain, ipAddresses, settings, macSelection, macApi, serverName, spid, spapi, password, domainService, secret});
    /*const logs = []
    const update = []*/

    const { logs, update } = await cloudflare.setupCloudflare({
        login, apiKey, domain, ipAddresses, settings,
        macApi, serverName, spid, spapi, password, secret, domainService
    });

    const nowInKyiv = DateTime.now().setZone("Europe/Kyiv").toFormat("dd.MM.yyyy HH:mm");
    await spreadsheet.addRows(process.env.SHEET, process.env.TAB, logs.map(i => [nowInKyiv, ...i]));

    // Delayed update in background
    if (update.length > 0) {
        setTimeout(async () => {
            try {
                const logs2 = await cloudflare.finalSteps(update);
                const nowInKyiv2 = DateTime.now().setZone("Europe/Kyiv").toFormat("dd.MM.yyyy HH:mm");
                await spreadsheet.addRows(process.env.SHEET, process.env.TAB, logs2.map(i => [nowInKyiv2, ...i]));
            } catch (err) {
                console.error("Unhandled error in delayed function:", err);
            }
        }, 5 * 60 * 1000);
    }

    return logs;  //
}

module.exports = { processForm };