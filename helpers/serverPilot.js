const axios = require('axios');


async function setupServer({id, api, name, domains,password}) {
    const results = []
    const auth = Buffer.from(`${id}:${api}`).toString('base64');
    try {
        const servers = await getServers(auth)
        results.push({domain: domains.join("; "), result: 'success', action: 'getServer serverPilot'})
        const user = await getUsers(auth, servers[0].id) || await createUser(auth, servers[0].id, password)
        results.push({domain: domains.join("; "), result: 'success', action: 'findOrCreate User serverPilot'})
        const resutls = []
        for (let domain of domains) {
            domain = domain.replace("www.", "")
            try {
                const app = await createApp(auth, user.id, domain, name)
                results.push({domain, result: 'success', action: 'create WP App'})
                await enableSSL(auth, app)
                results.push({domain, result: 'success', action: 'enableSSL'})
                await forceRedirect(auth, app)
                results.push({domain, result: 'success', action: 'forceRedirect'})
            } catch (e) {
                results.push({...e, domain})
            }
        }
    } catch (error) {
        results.push({...error, domain: domains.join("; ")})
    }
    return results.map(i => [i.domain, i.action, i.result, i.error || ""]);
}

async function getUsers(auth, server) {
    const response = await axios.get(`https://api.serverpilot.io/v1/sysusers`, {
        headers: {
            'Authorization': `Basic ${auth}`
        }
    })
    return response.data.data.find(i => i.name === 'user' && i.serverid === server)
}

async function getServers(auth) {
    try {
        const response = await axios.get(`https://api.serverpilot.io/v1/servers`, {
            headers: {
                'Authorization': `Basic ${auth}`
            }
        })
        //console.log(response.data.data)
        if (response.data.data.length == 0) throw {
            result: 'error',
            error: 'Cant find server in account',
            action: 'getServer in ServerPilot'
        }
        return response.data.data
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

async function createApp(auth, sysuserid, domain, name) {
    const site_title = capitalizeFirstLetter(domain.split(".")[0])
    const data = {
        name,
        sysuserid,
        runtime: "php7.4",
        domains: [`${domain}`, `www.${domain}`],
        wordpress: {
            site_title,
            admin_user: "user",
            admin_password: "serverserver3103",
            admin_email: `${domain}@gmail.com`
        }
    };


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

module.exports = {setupServer};
