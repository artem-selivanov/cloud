try {
    const express = require('express');
    const bodyParser = require('body-parser');
    require('dotenv').config();
    const spreadsheet = require('./helpers/spreadsheet')
    const cloudflare = require('./helpers/cloudflare')

    const {DateTime} = require("luxon");
    const app = express();
    const port = 5211;
    app.set('view engine', 'ejs');
    app.use(express.static('public'));

    app.use(bodyParser.urlencoded({extended: true}));
    app.use(bodyParser.json());

    app.get('/', (req, res) => {
        res.render('index');  // Render form via ejs template
    });

    app.post('/process-form', async (req, res) => {
        try {
            const {login, apiKey, domains, ipAddresses, settings, macSelection, serverPilot, spSelection} = req.body;
            const domainList = domains.split('\n').map(domain => domain.trim());
            const serverName = serverPilot.replace(/[ _\/+,]/g, "-").replaceAll('--',"-").toLowerCase()
            //console.log(macSelection)
            const macApi = process.env[macSelection.toUpperCase()]
            const password = process.env[`${spSelection.toUpperCase()}_PASSWORD`]
            const spid = process.env[`${spSelection.toUpperCase()}_ID`]
            const spapi = process.env[`${spSelection.toUpperCase()}_API`]
            console.log({login, apiKey, domains:domainList, ipAddresses, settings, macSelection, macApi, serverName, spid, spapi, password});
            const {logs, update} = await cloudflare.setupCloudflare({login, apiKey, domains: domainList, ipAddresses, settings, macApi, serverName, spid, spapi, password});
            const nowInKyiv = DateTime.now().setZone("Europe/Kyiv").toFormat("dd.MM.yyyy HH:mm")
            await spreadsheet.addRows(process.env.SHEET, process.env.TAB, logs.map(i => [nowInKyiv, ...i]))
            res.render('result', {logs});
            if (update.length > 0) {
                console.log('Waiting for update')
                setTimeout(async () => {
                    try {
                        console.log('Updating')
                        const logs2 = await cloudflare.finalSteps(update);
                        const nowInKyiv2 = DateTime.now().setZone("Europe/Kyiv").toFormat("dd.MM.yyyy HH:mm");
                        await spreadsheet.addRows(process.env.SHEET, process.env.TAB, logs2.map(i => [nowInKyiv2, ...i]));
                    } catch (err) {
                        console.error("Unhandled error in delayed function:", err);
                    }
                }, 5 * 60 * 1000);
            }
        } catch (error) {
            console.error('Error during form processing:', error);
            res.status(500).send('An error occurred while processing the form.');
        }
    });

    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
} catch (e) {
    console.log(e)
}


