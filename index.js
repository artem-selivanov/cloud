try {
    const express = require('express');
    const bodyParser = require('body-parser');
    const {processForm} = require('./main')
    const app = express();
    const port = 5213;
    app.set('view engine', 'ejs');
    app.use(express.static('public'));
    app.use(bodyParser.urlencoded({extended: true}));
    app.use(bodyParser.json());

    app.get('/', (req, res) => {
        res.render('index');  // Render form via ejs template
    });

    app.post('/process-form', async (req, res) => {
        try {
            const logs = await processForm(req.body);
            res.render('result', { logs });  // ✅ Render result here
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


