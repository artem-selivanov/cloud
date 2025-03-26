try {
    const express = require('express');
    const bodyParser = require('body-parser');
    require('dotenv').config();
    const spreadsheet = require('./helpers/spreadsheet')
    const cloudflare = require('./helpers/cloudflare')
    const {DateTime} = require("luxon");
    const app = express();

    app.set('view engine', 'ejs');
    app.use(express.static('public'));

    app.use(bodyParser.urlencoded({extended: true}));
    app.use(bodyParser.json());

    app.get('/', (req, res) => {
        res.render('index');  // Render form via ejs template
    });

    app.post('/process-form', async (req, res) => {
        try {
            const {login, apiKey, domains, ipAddresses, settings} = req.body;
            const domainList = domains.split('\n').map(domain => domain.trim());
            console.log({login, apiKey, domains, ipAddresses, settings});
            const logs = await cloudflare.setupCloudflare({login, apiKey, domains: domainList, ipAddresses, settings});
            //console.log(logs)
            // add here
            const nowInKyiv = DateTime.now().setZone("Europe/Kyiv").toFormat("dd.MM.yyyy HH:mm")
            await spreadsheet.addRows(process.env.SHEET, process.env.TAB, logs.map(i => [nowInKyiv, ...i]))
            res.render('result', {logs});
        } catch (error) {
            console.error('Error during form processing:', error);
            res.status(500).send('An error occurred while processing the form.');
        }
    });

    app.listen(5200, () => {
        console.log('Server running on port 5200');
    });
} catch (e) {
    console.log(e)
}


