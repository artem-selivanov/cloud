const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.render('index');  // Render form via ejs template
});

app.post('/process-form', async (req, res) => {
    try {
        const { email, apiKey, domains, ipAddresses, settings } = req.body;
        const domainList = domains.split('\n').map(domain => domain.trim());
        console.log({ email, apiKey, domains, ipAddresses, settings });

        const result = await setupCloudflare({ email, apiKey, domains: domainList, ipAddresses, settings });
        res.render('result', { email, apiKey, domainList, ipAddresses, settings, result });
    } catch (error) {
        console.error('Error during form processing:', error);
        res.status(500).send('An error occurred while processing the form.');
    }
});

app.listen(4000, () => {
    console.log('Server running on port 3000');
});

async function setupCloudflare({ email, apiKey, domains, ipAddresses, settings }) {
    const statuses = [];
    const headers = {
        'X-Auth-Email': email,
        'X-Auth-Key': apiKey,
        'Content-Type': 'application/json'
    };
    console.log('here')
    for (const domain of domains) {
        try {
            console.log(domain)
            const zoneId = await createDomain(domain, headers);
            console.log(zoneId)
            /*
            const zoneId = await getZoneId(domain, headers);
            if (!zoneId) {
                statuses.push(`Domain ${domain} not found in Cloudflare.`);
                console.log()
                continue;
            }*/

            statuses.push(`Domain ${domain} created`);
            const dnsRecords = await getDnsRecords(zoneId, headers);

            // Delete old DNS records in parallel
            await Promise.all(dnsRecords.map(record => deleteDnsRecord(zoneId, record.id, headers)));

            // Add new A record
            await addDnsRecord(zoneId, domain, ipAddresses, headers);

            // Handle settings (IPv6, cache, HTTPS) in parallel
            await Promise.all([
                settings?.deleteOldRecords === 'on' && disableIPv6(zoneId, headers),
                settings?.clearCache === 'on' && clearCache(zoneId, headers),
                settings?.useHttps === 'on' && enableHttps(zoneId, headers)
            ]);
            console.log(`Domain ${domain} successfully configured`)
            statuses.push(`Domain ${domain} successfully configured`);
        } catch (error) {
            console.error(`Error configuring domain ${domain}:`, error.response?.data || error.message);
            statuses.push(`Error configuring domain ${domain}`);
        }
    }

    return statuses.join('\n');
}


async function createDomain(name, headers) {
    const res = await axios.post(`https://api.cloudflare.com/client/v4/zones`, {
        type: 'full',
        name,
    }, { headers });

    return res.data.result.id
}

async function getZoneId(domain, headers) {
    const res = await axios.get('https://api.cloudflare.com/client/v4/zones', { headers, params: { name: domain } });
    console.log(res.data)
    if (res.data.result.length === 0) return null;
    return res.data.result[0].id;
}

async function getDnsRecords(zoneId, headers) {
    const res = await axios.get(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, { headers });
    console.log(res.data)
    return res.data.result;
}

async function deleteDnsRecord(zoneId, recordId, headers) {
    const res =  await axios.delete(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`, { headers });
    console.log(res.data)
}

async function addDnsRecord(zoneId, domain, ipAddresses, headers) {
    const res =  await axios.post(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
        type: 'A',
        name: domain,
        content: ipAddresses,
        ttl: 1,
        proxied: true
    }, { headers });
    console.log(res.data)
}

async function disableIPv6(zoneId, headers) {
    const res =  await axios.patch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/settings/ipv6`, { value: 'off' }, { headers });
    console.log(res.data)
}

async function clearCache(zoneId, headers) {
    const res =  await axios.post(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, { purge_everything: true }, { headers });
    console.log(res.data)
}

async function enableHttps(zoneId, headers) {
    const res =  await axios.patch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/settings/always_use_https`, { value: 'on' }, { headers });
    console.log(res.data)
}
