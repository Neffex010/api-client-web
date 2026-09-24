const LS = {
    history: 'miniPostman:history',
    collections: 'miniPostman:collections',
    environments: 'miniPostman:environments',
    activeEnv: 'miniPostman:activeEnv',
    lastRequest: 'miniPostman:lastRequest',
    reqTab: 'miniPostman:reqTab',
    respTab: 'miniPostman:respTab',
    sidebarTab: 'miniPostman:sidebarTab',
    onboarded: 'miniPostman:onboarded'
};

function defaultAuth() {
    return { type: 'none', token: '', username: '', password: '', apiKeyName: '', apiKeyValue: '', apiKeyIn: 'header' };
}

function defaultRequest() {
    return {
        name: 'Nueva petición',
        method: 'GET',
        url: '',
        params: [{ key: '', value: '', enabled: true }],
        headers: [{ key: '', value: '', enabled: true }],
        bodyMode: 'none',
        bodyJson: '',
        bodyText: '',
        bodyUrlencoded: [{ key: '', value: '', enabled: true }],
        bodyForm: [{ key: '', value: '', enabled: true }],
        auth: defaultAuth(),
        tests: ''
    };
}

function cloneRequest(request, name) {
    const base = defaultRequest();
    const copy = JSON.parse(JSON.stringify(request));
    const merged = { ...base, ...copy, auth: { ...base.auth, ...(copy.auth || {}) } };
    merged.params = merged.params || base.params;
    merged.headers = merged.headers || base.headers;
    merged.bodyUrlencoded = merged.bodyUrlencoded || base.bodyUrlencoded;
    merged.bodyForm = merged.bodyForm || base.bodyForm;
    if (name) merged.name = name;
    return merged;
}

const state = {
    request: defaultRequest(),
    response: null,
    history: [],
    collections: [],
    environments: [{ name: 'Entorno por defecto', variables: [] }],
    activeEnv: 0,
    sidebarTab: 'history',
    reqTab: 'params',
    respTab: 'body'
};

function saveAll() {
    try {
        localStorage.setItem(LS.history, JSON.stringify(state.history));
        localStorage.setItem(LS.collections, JSON.stringify(state.collections));
        localStorage.setItem(LS.environments, JSON.stringify(state.environments));
        localStorage.setItem(LS.activeEnv, String(state.activeEnv));
        localStorage.setItem(LS.lastRequest, JSON.stringify(state.request));
        localStorage.setItem(LS.reqTab, state.reqTab);
        localStorage.setItem(LS.respTab, state.respTab);
        localStorage.setItem(LS.sidebarTab, state.sidebarTab);
    } catch (e) {
    }
}

function loadState() {
    const read = (key) => {
        try {
            return JSON.parse(localStorage.getItem(key));
        } catch (e) {
            return null;
        }
    };

    const last = read(LS.lastRequest);
    if (last) state.request = cloneRequest(last);

    const history = read(LS.history);
    if (Array.isArray(history)) state.history = history;

    const collections = read(LS.collections);
    if (Array.isArray(collections)) state.collections = collections;

    const envs = read(LS.environments);
    if (Array.isArray(envs) && envs.length) state.environments = envs;

    const activeEnv = Number(localStorage.getItem(LS.activeEnv));
    if (Number.isFinite(activeEnv) && activeEnv >= 0 && activeEnv < state.environments.length) {
        state.activeEnv = activeEnv;
    }

    const reqTab = localStorage.getItem(LS.reqTab);
    if (reqTab) state.reqTab = reqTab;

    const respTab = localStorage.getItem(LS.respTab);
    if (respTab) state.respTab = respTab;

    const sidebarTab = localStorage.getItem(LS.sidebarTab);
    if (sidebarTab) state.sidebarTab = sidebarTab;
}

function activeVariables() {
    const env = state.environments[state.activeEnv];
    return env ? env.variables.filter((v) => v.enabled && v.key) : [];
}

function runTests(code, response, request) {
    const results = [];
    const pm = {
        test(name, fn) {
            try {
                const pass = !!fn();
                results.push({ name, pass, error: null });
                return pass;
            } catch (error) {
                results.push({ name, pass: false, error: error.message });
                return false;
            }
        },
        response: {
            status: response.status,
            text: () => response.data,
            json: () => JSON.parse(response.data),
            time: response.time,
            size: response.size,
            headers: Object.keys(response.headers).reduce((acc, k) => {
                acc[k.toLowerCase()] = response.headers[k];
                return acc;
            }, {})
        },
        request: { method: request.method, url: request.url }
    };
    const tests = {};
    try {
        new Function('pm', 'tests', code)(pm, tests);
    } catch (error) {
        results.push({ name: 'Error de ejecución', pass: false, error: error.message });
    }
    Object.entries(tests).forEach(([name, pass]) => {
        results.push({ name, pass: !!pass, error: null });
    });
    return results;
}

async function doSend() {
    const btn = $('#send-btn');
    const request = cloneRequest(state.request);
    request.url = normalizeUrl(request.url);

    if (!request.url) {
        notify('Ingresa una URL válida', 'error');
        return;
    }

    try {
        const parsed = new URL(resolveVariables(request.url, activeVariables()));
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            notify('Solo se permiten URLs http o https', 'error');
            return;
        }
    } catch (e) {
        notify('URL inválida. Ej: https://api.ejemplo.com', 'error');
        return;
    }

    if (request.bodyMode === 'json' && request.bodyJson.trim()) {
        try {
            JSON.parse(resolveVariables(request.bodyJson, activeVariables()));
        } catch (e) {
            notify('Body JSON inválido', 'error');
            return;
        }
    }

    const unresolved = unresolvedVariables(request, activeVariables());
    if (unresolved.length) {
        notify('Variables sin definir: ' + unresolved.join(', '), 'warn');
    }

    btn.disabled = true;
    $('#status-info').textContent = 'Enviando...';

    const start = performance.now();
    try {
        const built = buildRequest(request, activeVariables());
        const res = await fetch('/.netlify/functions/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(built)
        });
        const text = await res.text();
        let result;
        try {
            result = JSON.parse(text);
        } catch (e) {
            result = { error: 'El proxy respondió en un formato inesperado. ¿Está desplegada la función /proxy?' };
        }
        const elapsed = Math.round(performance.now() - start);

        if (!res.ok) {
            throw Object.assign(new Error(result.error || 'Error del proxy'), { statusCode: res.status });
        }

        state.response = {
            status: Number(result.status) || 0,
            statusText: String(result.statusText || ''),
            headers: result.headers || {},
            data: String(result.data || ''),
            time: elapsed,
            size: new Blob([result.data || '']).size
        };

        state.history.unshift({ timestamp: Date.now(), request: cloneRequest(request) });
        if (state.history.length > 25) state.history = state.history.slice(0, 25);
        saveAll();
    } catch (error) {
        let data = error.message;
        if (error instanceof TypeError) {
            data = 'No se pudo conectar con el proxy. Despliega la app en Netlify o ejecuta `netlify dev`.';
        } else if (error.statusCode === 404) {
            data = 'La función del proxy no existe. Usa `netlify dev` o despliega la app.';
        }
        state.response = {
            status: error.statusCode || 0,
            statusText: '',
            headers: {},
            data,
            time: Math.round(performance.now() - start),
            size: new Blob([data]).size
        };
    } finally {
        btn.disabled = false;
        renderStatusInfo();
        renderResponse(state.respTab);
    }
}

function loadRequest(request) {
    state.request = cloneRequest(request);
    $('#method').value = state.request.method;
    $('#url').value = state.request.url;
    renderRequestTab(state.reqTab);
    saveAll();
}

function exportCollections() {
    const blob = new Blob([JSON.stringify(state.collections, null, 2)], { type: 'application/json' });
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mini-postman-collections.json';
    a.click();
    URL.revokeObjectURL(a.href);
    notify('Exportadas ' + state.collections.length + ' colección(es)', 'ok');
}

function importCollections(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            if (!Array.isArray(data)) throw new Error('Formato inválido');
            let added = 0;
            data.forEach((collection) => {
                if (!collection || typeof collection.name !== 'string') return;
                if (!Array.isArray(collection.requests)) collection.requests = [];
                state.collections.push({
                    name: collection.name,
                    requests: collection.requests.map((req) => cloneRequest(req))
                });
                added += 1;
            });
            saveAll();
            renderSidebar(state.sidebarTab);
            notify(added ? 'Importadas ' + added + ' colección(es)' : 'No se encontraron colecciones válidas', added ? 'ok' : 'warn');
        } catch (e) {
            notify('Archivo de colecciones inválido', 'error');
        }
    };
    reader.readAsText(file);
}

function maybeShowOnboarding() {
    try {
        if (localStorage.getItem(LS.onboarded)) return;
    } catch (e) {
        return;
    }
    renderOnboarding($('#onboarding'));
}

function init() {
    if (!window.localStorage) return;
    loadState();

    $('#method').value = state.request.method;
    $('#url').value = state.request.url;

    $('#send-btn').addEventListener('click', doSend);
    $('#method').addEventListener('change', (e) => {
        state.request.method = e.target.value;
        saveAll();
    });
    $('#url').addEventListener('input', (e) => {
        state.request.url = e.target.value;
        saveAll();
    });
    $('#url').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            doSend();
        }
    });
    $('#env-select').addEventListener('change', (e) => {
        state.activeEnv = Number(e.target.value);
        saveAll();
    });

    document.querySelectorAll('#req-tabs .tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            state.reqTab = btn.getAttribute('data-reqtab');
            renderReqTabs();
            renderRequestTab(state.reqTab);
            saveAll();
        });
    });
    document.querySelectorAll('#resp-tabs .tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            state.respTab = btn.getAttribute('data-resptab');
            renderRespTabs();
            renderResponse(state.respTab);
            saveAll();
        });
    });
    document.querySelectorAll('.sidebar-tabs .tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            state.sidebarTab = btn.getAttribute('data-sidebar');
            renderSidebarTabs();
            renderSidebar(state.sidebarTab);
        });
    });

    renderSidebarTabs();
    renderReqTabs();
    renderRespTabs();
    renderEnvSelect();
    renderRequestTab(state.reqTab);
    renderSidebar(state.sidebarTab);
    renderStatusInfo();
    renderResponse(state.respTab);

    maybeShowOnboarding();
}

init();