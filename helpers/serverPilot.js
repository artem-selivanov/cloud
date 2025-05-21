const axios = require('axios');

async function setupServer({id, api, name, domain, password, ipAddresses, wp}) {
    const results = []
    const update = []
    domain = domain.replace("www.", "")
    const auth = Buffer.from(`${id}:${api}`).toString('base64');
    try {
        const server = await getServers(auth, ipAddresses)
        console.log(server)
        results.push({domain, result: 'success', action: 'getServer serverPilot'})
        const user = await getUsers(auth, server.id) || await createUser(auth, server.id, password)
        results.push({domain, result: 'success', action: 'findOrCreate User serverPilot'})
        const app = await createApp(auth, user.id, domain, name, wp)
        results.push({domain, result: 'success', action: `create ${wp?'WP':'HTML'} App`})
        update.push({domain, auth, app})
        /*await waitForSeconds(60)
        await enableSSL(auth, app)
        results.push({domain, result: 'success', action: 'enableSSL'})
        await forceRedirect(auth, app)
        results.push({domain, result: 'success', action: 'forceRedirect'})*/
    } catch (error) {
        console.log(error)
        results.push({...error, domain})
    }
    return {logs: results, update}
}

async function getUsers(auth, server) {
    const response = await axios.get(`https://api.serverpilot.io/v1/sysusers`, {
        headers: {
            'Authorization': `Basic ${auth}`
        }
    })
    return response.data.data.find(i => i.name === 'user' && i.serverid === server)
}

async function getServers(auth, ipAddresses) {
    try {
        const response = await axios.get(`https://api.serverpilot.io/v1/servers`, {
            headers: {
                'Authorization': `Basic ${auth}`
            }
        })
        if (response.data.data.length == 0 || !response.data.data.find(i => i.lastaddress == ipAddresses)) throw {
            result: 'error',
            error: `Cant find server with ip ${ipAddresses} in account`,
            action: 'getServer in ServerPilot'
        }
        return response.data.data.find(i => i.lastaddress == ipAddresses)
    } catch (e) {
        if (e?.action) {
            throw {
                result: 'error',
                error: 'Cant find server in account',
                action: 'getServer in ServerPilot'
            }
        } else {
            throw {
                result: 'error',
                error: e.response.data.error.message,
                action: 'getServer in ServerPilot'
            }
        }
    }
}

async function createUser(auth, server, password) {
    const data = {
        serverid: server,
        name: "user",
        password
    };
    try {
        const response = await axios.post(`https://api.serverpilot.io/v1/sysusers`, data, {
            headers: {
                'Authorization': `Basic ${auth}`
            }
        })
        return response.data.data
    } catch (e) {
        console.log(e.response.data)
    }

    return
}

async function createApp(auth, sysuserid, domain, name, wp) {
    const site_title = capitalizeFirstLetter(domain.split(".")[0])
    const data = {
        name,
        sysuserid,
        runtime: "php7.4",
        domains: [domain, `www.${domain}`],
    };

    if (wp) {
        data.wordpress = {
            site_title,
            admin_user: "user",
            admin_password: "serverserver3103",
            admin_email: `${domain}@gmail.com`
        };
    }



    try {
        const response = await axios.post('https://api.serverpilot.io/v1/apps', data, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            }
        })
        console.log(response.data.data)
        return response.data.data.id

    } catch (e) {
        throw {
            result: 'error',
            error: e.response.data.error.message,
            action: 'WP APP Creation ServerPilot'
        }
    }

    return
}

async function enableSSL(auth, appId) {
    try {
        const response = await axios.post(`https://api.serverpilot.io/v1/apps/${appId}/ssl`, {auto: true}, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {

        throw {
            result: 'error',
            error: error.response.data.error.message,
            action: 'Enable SSL'
        }
    }
}

async function forceRedirect(auth, appId) {
    try {
        const response = await axios.post(`https://api.serverpilot.io/v1/apps/${appId}/ssl`, {force: true}, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        throw {
            result: 'error',
            error: error.response.data.error.message,
            action: 'Force redirect'
        }
    }
}


function handleError(results, domain, action, error, extra = {}) {

    results.push({domain, action, result: 'error', error: error.message, ...extra});
}

function capitalizeFirstLetter(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

async function waitForSeconds(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

module.exports = {setupServer, enableSSL, forceRedirect};
