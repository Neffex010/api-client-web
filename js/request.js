const METHODS_WITH_BODY = ['POST', 'PUT', 'PATCH', 'DELETE'];

function normalizeUrl(value) {
    const v = String(value || '').trim();
    if (!v) return '';
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(v)) return v;
    return 'https://' + v;
}

function findUnresolved(text, variableKeys) {
    const found = new Set();
    if (typeof text !== 'string' || !text) return found;
    const re = /\{\{\s*([\s\S]+?)\s*\}\}/g;
    let m;
    while ((m = re.exec(text))) {
        if (!variableKeys.includes(m[1])) found.add(m[1]);
    }
    return found;
}

function unresolvedVariables(request, variables) {
    const keys = variables.map((v) => v.key);
    const set = new Set();
    const scan = (text) => findUnresolved(text, keys).forEach((n) => set.add(n));
    scan(request.url);
    request.params.forEach((p) => {
        scan(p.key);
        scan(p.value);
    });
    request.headers.forEach((h) => {
        scan(h.key);
        scan(h.value);
    });
    scan(request.bodyJson);
    scan(request.bodyText);
    request.bodyUrlencoded.forEach((f) => {
        scan(f.key);
        scan(f.value);
    });
    request.bodyForm.forEach((f) => {
        scan(f.key);
        scan(f.value);
    });
    const a = request.auth;
    scan(a.token);
    scan(a.username);
    scan(a.password);
    scan(a.apiKeyName);
    scan(a.apiKeyValue);
    return Array.from(set);
}

function resolveVariables(value, variables) {
    if (typeof value !== 'string') return value;
    const map = {};
    variables.forEach((v) => {
        if (v) map[v.key] = v.value;
    });
    return value.replace(/\{\{\s*([\s\S]+?)\s*\}\}/g, (match, keyName) => (
        keyName in map ? String(map[keyName]) : match
    ));
}

function appendQueryParams(url, params, variables) {
    const pairs = params
        .filter((p) => p.enabled && p.key)
        .map((p) => `${encodeURIComponent(resolveVariables(p.key, variables))}=${encodeURIComponent(resolveVariables(p.value || '', variables))}`);
    if (!pairs.length) return url;
    const sep = url.includes('?') ? '&' : '?';
    return url + sep + pairs.join('&');
}

function authHeaders(auth) {
    if (auth.type === 'bearer' && auth.token) {
        return { Authorization: 'Bearer ' + auth.token };
    }
    if (auth.type === 'basic' && auth.username) {
        return { Authorization: 'Basic ' + btoa(`${auth.username}:${auth.password}`) };
    }
    return {};
}

function bodyFor(mode, request, variables) {
    const method = request.method.toUpperCase();
    if (!METHODS_WITH_BODY.includes(method)) return { body: null, contentType: null };

    if (mode === 'json') {
        return { body: resolveVariables(request.bodyJson, variables), contentType: 'application/json' };
    }
    if (mode === 'text') {
        return { body: resolveVariables(request.bodyText, variables), contentType: 'text/plain' };
    }
    if (mode === 'xml') {
        return { body: resolveVariables(request.bodyText, variables), contentType: 'application/xml' };
    }
    if (mode === 'urlencoded') {
        const pairs = request.bodyUrlencoded
            .filter((f) => f.enabled && f.key)
            .map((f) => `${encodeURIComponent(f.key)}=${encodeURIComponent(resolveVariables(f.value || '', variables))}`);
        return { body: pairs.join('&'), contentType: 'application/x-www-form-urlencoded' };
    }
    if (mode === 'form') {
        const boundary = 'mini' + Math.random().toString(36).slice(2);
        const parts = request.bodyForm
            .filter((f) => f.enabled && f.key)
            .map((f) => `--${boundary}\r\nContent-Disposition: form-data; name="${resolveVariables(f.key, variables)}"\r\n\r\n${resolveVariables(f.value || '', variables)}\r\n`);
        return { body: parts.join('') + `--${boundary}--\r\n`, contentType: `multipart/form-data; boundary=${boundary}` };
    }
    return { body: null, contentType: null };
}

function buildRequest(request, variables) {
    let url = resolveVariables(request.url, variables);
    url = appendQueryParams(url, request.params, variables);

    const headers = {};
    request.headers.forEach((h) => {
        if (h.enabled && h.key) {
            headers[resolveVariables(h.key, variables)] = resolveVariables(h.value || '', variables);
        }
    });

    const auth = request.auth;
    if (auth.type === 'apiKey' && auth.apiKeyName) {
        const value = resolveVariables(auth.apiKeyValue || '', variables);
        if (auth.apiKeyIn === 'query') {
            url = appendQueryParams(url, [{ key: auth.apiKeyName, value, enabled: true }], []);
        } else {
            headers[resolveVariables(auth.apiKeyName, variables)] = value;
        }
    }
    Object.assign(headers, authHeaders({
        type: auth.type,
        token: resolveVariables(auth.token || '', variables),
        username: resolveVariables(auth.username || '', variables),
        password: resolveVariables(auth.password || '', variables)
    }));

    const bodyData = bodyFor(request.bodyMode, request, variables);
    const hasContentType = Object.keys(headers).some((k) => k.toLowerCase() === 'content-type');
    if (bodyData.contentType && !hasContentType) {
        headers['Content-Type'] = bodyData.contentType;
    }

    return { method: request.method, url, headers, body: bodyData.body };
}