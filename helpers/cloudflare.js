const axios = require('axios');


async function setupCloudflare({email, apiKey, domains, ipAddresses, settings}) {
    const results = [];
    const headers = {
        'X-Auth-Email': email,
        'X-Auth-Key': apiKey,
        'Content-Type': 'application/json'
    };

    for (const domain of domains) {
        try {
            let zoneId = await getZoneId(domain, headers) || await createDomain(domain, headers)
            //console.log(zoneId)
            //zoneId = !zoneId?await createDomain(domain, headers):zoneId;
            results.push({domain, action: 'getOrCreateZone', result: 'success', zoneId});

            const dnsRecords = await getDnsRecords(zoneId, headers);
            results.push({domain, action: 'getDnsRecords', result: 'success', dnsRecords});

            if (settings?.deleteOldRecords === 'on')
            await Promise.all(dnsRecords.map(record => deleteDnsRecord(zoneId, record.id, headers)
                .then(() => results.push({domain, action: 'deleteDnsRecord', recordId: record.id, result: 'success'}))
                .catch(error => handleError(results, domain, 'deleteDnsRecord', error, {recordId: record.id}))));

            await addDnsRecord(zoneId, domain, ipAddresses, headers)
                .then(() => results.push({domain, action: 'addDnsRecord', result: 'success'}))
                .catch(error => handleError(results, domain, 'addDnsRecord', error));

            /*if (settings?.deleteOldRecords === 'on')
                await disableIPv6(zoneId, headers)
                    .then(() => results.push({domain, action: 'deleteOldRecords', result: 'success'}))
                    .catch(error => handleError(results, domain, 'deleteOldRecords', error));*/

            if (settings?.clearCache === 'on')
                await clearCache(zoneId, headers)
                    .then(() => results.push({domain, action: 'clearCache', result: 'success'}))
                    .catch(error => handleError(results, domain, 'clearCache', error));

            if (settings?.useHttps === 'on')
                await enableHttps(zoneId, headers)
                    .then(() => results.push({domain, action: 'enableHttps', result: 'success'}))
                    .catch(error => handleError(results, domain, 'enableHttps', error));

        } catch (error) {
            handleError(results, domain, 'setupCloudflare', error);
        }
    }

    console.log(results)
    return results.map(i => [i.domain, i.action, i.result, i.error || ""]);
}

async function apiCall(url, method, headers, data = {}) {
    try {
        const res = await axios({url, method, headers, data});
        //console.log(res.data.errors.map(i=>i.message).join(';'))
        if (!res.data.success) throw new Error(res.data.errors.map(i => i.message).join(';'));
        return res.data.result;
    } catch (error) {
        let e = error?.response?.data?.errors ? error.response.data.errors.map(i => i.message).join(';') : error.response?.data || error.message
        //console.log(e)
        throw new Error(e);
    }
}

const createDomain = (name, headers) => apiCall('https://api.cloudflare.com/client/v4/zones', 'POST', headers, {
    type: 'full',
    name
}).then(res => res.id);
const getZoneId = (domain, headers) => apiCall(`https://api.cloudflare.com/client/v4/zones?name=${domain}`, 'GET', headers).then(res => res[0]?.id || null);
const getDnsRecords = (zoneId, headers) => apiCall(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, 'GET', headers);
const deleteDnsRecord = (zoneId, recordId, headers) => apiCall(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`, 'DELETE', headers);
const addDnsRecord = (zoneId, domain, ipAddresses, headers) => apiCall(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, 'POST', headers, {
    type: 'A',
    name: domain,
    content: ipAddresses,
    ttl: 1,
    proxied: true
});
const disableIPv6 = (zoneId, headers) => apiCall(`https://api.cloudflare.com/client/v4/zones/${zoneId}/settings/ipv6`, 'PATCH', headers, {value: 'off'});
const clearCache = (zoneId, headers) => apiCall(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, 'POST', headers, {purge_everything: true});
const enableHttps = (zoneId, headers) => apiCall(`https://api.cloudflare.com/client/v4/zones/${zoneId}/settings/always_use_https`, 'PATCH', headers, {value: 'on'});

function handleError(results, domain, action, error, extra = {}) {

    results.push({domain, action, result: 'error', error: error.message, ...extra});
}

module.exports = {setupCloudflare};
