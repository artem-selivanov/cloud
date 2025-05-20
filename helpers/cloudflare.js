const axios = require('axios');
const sp = require('../helpers/serverPilot')
const querystring = require('querystring');
const xml2js = require('xml2js');


async function setupCloudflare({
                                   login,
                                   apiKey,
                                   domain,
                                   ipAddresses,
                                   settings,
                                   macApi,
                                   serverName,
                                   spid,
                                   spapi,
                                   password,
                                   domainService,
                                   secret
                               }) {
    const email = `${login}@gmail.com`
    const results = [];
    const updateNext = []
    const headers = {
        'X-Auth-Email': email,
        'X-Auth-Key': apiKey,
        'Content-Type': 'application/json'
    };

    //for (let domain of domains) {
    domain = domain.replace("www.", "")
    try {
        let {zoneId, ns} = await getZoneId(domain, headers);
        if (!zoneId) {
            ({zoneId, ns} = await createDomain(domain, headers));
        }
        results.push({domain, action: 'getOrCreateZone', result: 'success', zoneId});

        const dnsRecords = await getDnsRecords(zoneId, headers);
        results.push({domain, action: 'getDnsRecords', result: 'success', dnsRecords});


        if (settings?.deleteOldRecords === 'on')
            await Promise.all(dnsRecords.map(record => deleteDnsRecord(zoneId, record.id, headers)
                .then(() => results.push({
                    domain,
                    action: 'deleteDnsRecord',
                    recordId: record.id,
                    result: 'success'
                }))
                .catch(error => handleError(results, domain, 'deleteDnsRecord', error, {recordId: record.id}))));

        await addDnsRecord(zoneId, domain, ipAddresses, headers)
            .then(() => results.push({domain, action: 'addDnsRecord', result: 'success'}))
            .catch(error => handleError(results, domain, 'addDnsRecord', error));
        await addDnsRecord(zoneId, `www.${domain}`, ipAddresses, headers)
            .then(() => results.push({domain, action: 'addDnsRecord', result: 'success'}))
            .catch(error => handleError(results, domain, 'addDnsRecord', error));


        if (settings?.clearCache === 'on')
            await clearCache(zoneId, headers)
                .then(() => results.push({domain, action: 'clearCache', result: 'success'}))
                .catch(error => handleError(results, domain, 'clearCache', error));

        if (settings?.useHttps === 'on')
            await enableHttps(zoneId, headers)
                .then(() => results.push({domain, action: 'enableHttps', result: 'success'}))
                .catch(error => handleError(results, domain, 'enableHttps', error));
        if (!ns || ns.length < 2) {
            handleError(results, domain, 'getNsServers', 'Not 2 ns servers')
        }
        //console.log(ns)
        //macApi
        //const ns = ['dns1.d5.com.ua','dns2.d5.com.ua']

        const updateNs = await changeNS({api: macApi, domain, ns, domainService, secret})
        results.push(updateNs)

        if (updateNs.result == 'success') {
            const {logs, update} = await sp.setupServer({
                id: spid,
                api: spapi,
                name: serverName,
                domain,
                password,
                ipAddresses
            });
            results.push(...logs)
            updateNext.push(...update)
        }
    } catch (error) {
        console.log(error)
        handleError(results, domain, 'setupCloudflare', error);
    }
    // }

    console.log(results)
    //
    return {logs: results.map(i => [i.domain, i.action, i.result, i.error || ""]), update: updateNext};
}

async function finalSteps(update) {
    const results = []
    for (let {domain, auth, app} of update) {
        try {
            await sp.enableSSL(auth, app)
            results.push({domain, result: 'success', action: 'enableSSL'})
            await sp.forceRedirect(auth, app)
            results.push({domain, result: 'success', action: 'forceRedirect'})
        } catch (error) {
            console.log(error)
            results.push({...error, domain})
        }

    }
    return results.map(i => [i.domain, i.action, i.result, i.error || ""])

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
}).then(res => {
    //console.log(res);
    return {zoneId: res?.id, ns: res?.name_servers};
}); //
const getZoneId = (domain, headers) => apiCall(`https://api.cloudflare.com/client/v4/zones?name=${domain}`, 'GET', headers).then(res => {
    return {zoneId: res[0]?.id || null, ns: res[0]?.name_servers}
});
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


async function changeNS({api: macApi, domain, ns, secret, domainService}) {
    const params = {api: macApi, domain, ns, secret};
    console.log(domainService)
    switch (domainService) {
        case 'dynadot':
            return await dynadot(params);
        case 'porkbun':
            return await porkbun(params);
        default:
            return await namecheap(params);
    }
}

async function dynadot({api, domain, ns}) {
    const response = await axios.get(`https://api.dynadot.com/api3.json?key=${api}&command=set_ns&domain=${domain}&ns0=${ns[0]}&ns1=${ns[1]}`)
    let result = {domain, action: "update NS Dynadot", result: 'success'}
    //console.log(response.data)
    if (response.data?.Response?.ResponseCode == '-1') result = {
        ...result,
        result: 'error',
        error: response.data.Response.Error
    }
    if (response.data?.SetNsResponse?.Status == 'error') result = {
        ...result,
        result: 'error',
        error: response.data.SetNsResponse.Error
    }
    return result
}

async function porkbun({api, secret, domain, ns}) {
    let result = {domain, action: "update NS porkBun", result: 'success'}
    try {
        const response = await axios.post(`https://api.porkbun.com/api/json/v3/domain/updateNs/${domain}`, {
            apikey: api,
            secretapikey: secret,
            domain: domain,
            nameservers: ns
        });
        if (response.data.status === 'SUCCESS') {
            console.log('NS сервера успешно обновлены:', NS_SERVERS);
        } else {
            console.error('Ошибка обновления NS серверов:', response.data);
            result = {
                ...result,
                result: 'error',
                error: response.data
            }
        }
    } catch (error) {

        console.error('Ошибка при запросе к API:', error.message);
        console.log(error.response.data.message)
        result = {
            ...result,
            result: 'error',
            error: error?.response?.data?.message || error.message
        }
    }
    return result
}

async function namecheap({api, secret, domain, ns}) {

    let result = {domain, action: "update NS namecheap", result: 'success'}
    const [SLD, TLD] = domain.split('.');
    const ip = await getPublicIp()
    if (ip === null) return {
        ...result,
        result: 'error',
        error: 'Cant parse ip address'
    }
    //
    const params = {
        ApiUser: secret,
        ApiKey: api,
        UserName: secret,
        ClientIp: ip,
        Command: 'namecheap.domains.dns.setCustom',
        SLD,
        TLD,
        NameServers: ns.join(',')
    };


    const url = 'https://api.namecheap.com/xml.response?' + querystring.stringify(params);
    //console.log(url)
    try {
        const response = await axios.get(url);
        //console.log('Namecheap API:\n', response.data);
        const errorText = await getErrorText(response.data)
        if (errorText != null) result = {
            ...result,
            result: 'error',
            error: errorText
        }

    } catch (error) {
        console.error('Error Namecheap API:', error.message);
        result = {
            ...result,
            result: 'error',
            error: error?.response?.data?.message || error.message
        }
    }
    //xml2js?
    return result
}

async function getPublicIp() {
    try {
        const response = await axios.get('https://api.ipify.org?format=json');
        //console.log('Public IP address:', response.data.ip);
        return response.data.ip
    } catch (error) {
        console.error('Error fetching public IP:', error.message);
        return null
    }
}


function handleError(results, domain, action, error, extra = {}) {

    results.push({domain, action, result: 'error', error: error.message, ...extra});
}

async function getErrorText(xml) {
    const parser = new xml2js.Parser({explicitArray: false});

    try {
        const result = await parser.parseStringPromise(xml);
        const error = result.ApiResponse.Errors.Error;
        const errorText = typeof error === 'object' ? error._ : error;
        return errorText;
    } catch (err) {
        console.error('XML Parse Error:', err);
        return null;
    }
}

module.exports = {setupCloudflare, finalSteps};
