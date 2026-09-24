const { URL } = require('url');
const net = require('net');
const dns = require('dns/promises');

const TIMEOUT_MS = 10000;
const METHODS_WITH_BODY = ['POST', 'PUT', 'PATCH', 'DELETE'];

function normalizeIp(ip) {
    ip = ip.toLowerCase();
    if (ip.startsWith('::ffff:')) {
        const ipv4 = ip.slice(7);
        if (net.isIP(ipv4) === 4) return ipv4;
    }
    return ip;
}

function isBlockedIp(ip) {
    ip = normalizeIp(ip);

    if (net.isIP(ip) === 4) {
        const parts = ip.split('.').map(Number);
        const [a, b] = parts;
        return (
            a === 0 ||
            a === 10 ||
            a === 127 ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) ||
            (a === 100 && b >= 64 && b <= 127)
        );
    }

    if (net.isIP(ip) === 6) {
        return ip === '::1' || ip.startsWith('fe80') || ip.startsWith('fc') || ip.startsWith('fd');
    }

    return true;
}

async function assertPublicUrl(rawUrl) {
    if (typeof rawUrl !== 'string') {
        throw Object.assign(new Error('URL inválida'), { code: 400 });
    }

    let parsed;
    try {
        parsed = new URL(rawUrl);
    } catch (e) {
        throw Object.assign(new Error('URL mal formada'), { code: 400 });
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw Object.assign(new Error('Solo se permiten URLs http/https'), { code: 400 });
    }

    const { hostname } = parsed;
    if (!hostname) {
        throw Object.assign(new Error('URL sin hostname'), { code: 400 });
    }

    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses.length || addresses.some(({ address }) => isBlockedIp(address))) {
        throw Object.assign(new Error('No se permiten peticiones a direcciones privadas o locales'), { code: 400 });
    }

    return parsed.href;
}

exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        const { url, method, headers, body } = JSON.parse(event.body);
        const safeUrl = await assertPublicUrl(url);

        const fetchOptions = {
            method: method || 'GET',
            headers: headers || {},
            redirect: 'manual'
        };

        if (body && METHODS_WITH_BODY.includes(method.toUpperCase())) {
            fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
        let apiResponse;
        try {
            apiResponse = await fetch(safeUrl, { ...fetchOptions, signal: controller.signal });
        } finally {
            clearTimeout(timeout);
        }
        const responseText = await apiResponse.text();

        const responseHeaders = {};
        apiResponse.headers.forEach((value, key) => {
            responseHeaders[key] = value;
        });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: apiResponse.status,
                statusText: apiResponse.statusText,
                headers: responseHeaders,
                data: responseText
            })
        };
    } catch (error) {
        const statusCode = typeof error.code === 'number' ? error.code : 500;
        return {
            statusCode,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message })
        };
    }
};