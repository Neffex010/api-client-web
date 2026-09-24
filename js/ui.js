const $ = (sel) => document.querySelector(sel);

function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
}

const TAB_HINTS = {
    params: 'Los query params con la casilla activa se añaden autom\u00e1ticamente a la URL al enviar. Puedes usar variables {{var}}.',
    auth: 'La autenticaci\u00f3n elegida se adjunta sola a cada env\u00edo: no necesitas escribir el header manualmente.',
    headers: 'Headers HTTP personalizados como pares clave/valor.',
    body: 'Elige un formato y escribe el contenido. El Content-Type se env\u00eda autom\u00e1ticamente seg\u00fan el modo.',
    tests: 'Los tests se ejecutan al recibir la respuesta. Cada pm.test debe devolver true (ok) o false (fail).'
};

function renderOnboarding(host) {
    const seg = (t, v) => {
        if (t === 'code') return el('code', 'inline-code', v);
        if (t === 'strong') return el('strong', null, v);
        return el('span', null, v);
    };
    const steps = [
        [['text', 'Escribe una URL como '], ['code', 'https://jsonplaceholder.typicode.com/todos/1'], ['text', ' y pulsa '], ['strong', 'Enviar'], ['text', ' o la tecla '], ['strong', 'Enter'], ['text', '.']],
        [['text', 'Personaliza la petici\u00f3n en las pesta\u00f1as '], ['strong', 'Params'], ['text', ', '], ['strong', 'Auth'], ['text', ', '], ['strong', 'Headers'], ['text', ', '], ['strong', 'Body'], ['text', ' y '], ['strong', 'Tests'], ['text', '.']],
        [['text', 'Reutiliza peticiones en '], ['strong', 'Historial'], ['text', ', organ\u00edzalas en '], ['strong', 'Colecciones'], ['text', ' y parametriza con variables '], ['code', '{{var}}'], ['text', ' definidas en '], ['strong', 'Entornos'], ['text', '.']]
    ];
    const box = el('div', 'onboarding');
    const head = el('div', 'onboarding-head');
    head.append(el('span', 'onboarding-title', 'Primeros pasos'), el('span', 'onboarding-badge', 'primeras peticiones'));
    const ol = el('ol', 'onboarding-steps');
    steps.forEach((parts) => {
        const li = el('li');
        parts.forEach((p) => li.append(seg(p[0], p[1])));
        ol.append(li);
    });
    const actions = el('div', 'onboarding-actions');
    const exampleBtn = el('button', 'btn', 'Cargar ejemplo');
    exampleBtn.addEventListener('click', () => {
        state.request.url = 'https://jsonplaceholder.typicode.com/todos/1';
        $('#url').value = state.request.url;
        saveAll();
        notify('URL de ejemplo cargada. Pulsa Enviar.', 'ok');
    });
    const doneBtn = el('button', 'btn', 'Entendido');
    doneBtn.addEventListener('click', () => {
        box.remove();
        try { localStorage.setItem('miniPostman:onboarded', '1'); } catch (e) {}
    });
    actions.append(exampleBtn, doneBtn);
    box.append(head, ol, actions);
    host.append(box);
}

function notify(message, type) {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
        wrap = el('div', 'toast-wrap');
        document.body.appendChild(wrap);
    }
    const toast = el('div', 'toast toast-' + (type || 'info'), message);
    wrap.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function methodClass(method) {
    return (method || '').toLowerCase();
}

function tryPrettyJson(text) {
    try {
        return JSON.stringify(JSON.parse(text), null, 2);
    } catch (e) {
        return null;
    }
}

function highlightJson(text) {
    let html = '';
    let lastIndex = 0;
    const re = /("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
    let m;
    while ((m = re.exec(text))) {
        html += escapeHtml(text.slice(lastIndex, m.index));
        let cls = 'c-punct';
        if (m[1]) cls = m[2] ? 'c-key' : 'c-string';
        else if (m[3]) cls = 'c-literal';
        else if (m[4]) cls = 'c-number';
        html += `<span class="${cls}">${escapeHtml(m[0])}</span>`;
        lastIndex = re.lastIndex;
    }
    html += escapeHtml(text.slice(lastIndex));
    return html;
}

function inputText(value, onInput, placeholder, type) {
    const inp = el('input', 'input');
    if (type) inp.type = type;
    inp.placeholder = placeholder || '';
    inp.value = value;
    inp.addEventListener('input', onInput);
    return inp;
}

function textareaEditor(obj, prop, placeholder) {
    const ta = el('textarea', 'code-editor');
    ta.placeholder = placeholder || '';
    ta.value = obj[prop];
    ta.addEventListener('input', () => {
        obj[prop] = ta.value;
        saveAll();
    });
    return ta;
}

function segment(host, name, options, selected, onSelect) {
    const seg = el('div', 'seg');
    options.forEach(([value, label]) => {
        const labelEl = el('label', 'radio');
        const input = el('input');
        input.type = 'radio';
        input.name = name;
        input.value = value;
        input.checked = selected === value;
        input.addEventListener('change', () => onSelect(value));
        labelEl.append(input, el('span', null, label));
        seg.append(labelEl);
    });
    host.append(seg);
}

function kvTable(host, rows, onChange, onMutate, title) {
    if (title) host.append(el('h3', 'field-title', title));
    const box = el('div', 'kv-box');

    const table = el('table', 'kv-table');
    const head = el('thead');
    const htr = el('tr');
    ['', 'Clave', 'Valor', ''].forEach((t) => htr.append(el('th', null, t)));
    head.append(htr);

    const tbody = el('tbody');
    rows.forEach((row, i) => {
        const tr = el('tr');

        const tdToggle = el('td');
        const check = el('input');
        check.type = 'checkbox';
        check.checked = !!row.enabled;
        check.addEventListener('change', () => {
            row.enabled = check.checked;
            onChange();
        });
        tdToggle.append(check);

        const tdKey = el('td');
        const keyInput = el('input', 'kv-input');
        keyInput.value = row.key;
        keyInput.placeholder = 'clave';
        keyInput.title = 'Clave (puede usar {{variables}} en el valor)';
        keyInput.addEventListener('input', () => {
            row.key = keyInput.value;
            onChange();
        });
        tdKey.append(keyInput);

        const tdValue = el('td');
        const valInput = el('input', 'kv-input');
        valInput.value = row.value;
        valInput.placeholder = 'valor';
        valInput.addEventListener('input', () => {
            row.value = valInput.value;
            onChange();
        });
        tdValue.append(valInput);

        const tdDel = el('td');
        const delBtn = el('button', 'icon-btn', '\u00d7');
        delBtn.title = 'Eliminar';
        delBtn.addEventListener('click', () => {
            rows.splice(i, 1);
            onChange();
            onMutate();
        });
        tdDel.append(delBtn);

        tr.append(tdToggle, tdKey, tdValue, tdDel);
        tbody.append(tr);
    });
    table.append(head, tbody);

    const addBtn = el('button', 'btn', '+ Añadir fila');
    addBtn.addEventListener('click', () => {
        rows.push({ key: '', value: '', enabled: true });
        onChange();
        onMutate();
    });

    box.append(table, addBtn);
    host.append(box);
}

function renderRequestTab(tab) {
    const host = $('#req-tab-content');
    host.textContent = '';
    const r = state.request;

    if (TAB_HINTS[tab]) {
        host.append(el('p', 'tab-hint', TAB_HINTS[tab]));
    }

    if (tab === 'params') {
        kvTable(host, r.params, saveAll, () => renderRequestTab(tab), 'Query params');
    } else if (tab === 'headers') {
        kvTable(host, r.headers, saveAll, () => renderRequestTab(tab), 'Headers');
    } else if (tab === 'body') {
        renderBody(host);
    } else if (tab === 'auth') {
        renderAuth(host);
    } else if (tab === 'tests') {
        const ta = textareaEditor(r, 'tests', 'pm.test("Status es 200", () => pm.response.status === 200);');
        ta.classList.add('code-tests');
        const hint = el('p', 'hint', 'Disponibles: pm.response.status, pm.response.text(), pm.response.json(), pm.response.time, pm.response.size, pm.request.method, pm.request.url, tests["nombre"] = true|false');
        host.append(el('h3', 'field-title', 'Script de test'), ta, hint);
    }
}

function renderBody(host) {
    const r = state.request;
    const modes = [
        ['none', 'None'],
        ['json', 'JSON'],
        ['text', 'Texto'],
        ['xml', 'XML'],
        ['urlencoded', 'x-www-form-urlencoded'],
        ['form', 'Form-data']
    ];
    segment(host, 'bodymode', modes, r.bodyMode, (mode) => {
        r.bodyMode = mode;
        saveAll();
        renderBody(host);
    });

    if (r.bodyMode === 'json') {
        host.append(textareaEditor(r, 'bodyJson', '{\n  "clave": "valor"\n}'));
    } else if (r.bodyMode === 'text' || r.bodyMode === 'xml') {
        host.append(textareaEditor(r, 'bodyText', r.bodyMode === 'xml' ? '<root/>' : 'Texto libre'));
    } else if (r.bodyMode === 'urlencoded') {
        kvTable(host, r.bodyUrlencoded, saveAll, () => renderBody(host), 'Campos del formulario (application/x-www-form-urlencoded)');
    } else if (r.bodyMode === 'form') {
        kvTable(host, r.bodyForm, saveAll, () => renderBody(host), 'Campos del formulario (multipart/form-data)');
    }
}

function field(labelText, ...inputs) {
    const box = el('div', 'field');
    box.append(el('label', 'field-label', labelText), ...inputs);
    return box;
}

function renderAuth(host) {
    const a = state.request.auth;
    const types = [
        ['none', 'None'],
        ['bearer', 'Bearer Token'],
        ['basic', 'Basic Auth'],
        ['apiKey', 'API Key']
    ];
    segment(host, 'authtype', types, a.type, (type) => {
        a.type = type;
        saveAll();
        renderAuth(host);
    });

    if (a.type === 'bearer') {
        host.append(field('Token', inputText(a.token, (e) => {
            a.token = e.target.value;
            saveAll();
        }, 'Bearer <token>')));
    } else if (a.type === 'basic') {
        host.append(
            field('Usuario', inputText(a.username, (e) => {
                a.username = e.target.value;
                saveAll();
            })),
            field('Contraseña', inputText(a.password, (e) => {
                a.password = e.target.value;
                saveAll();
            }, '******', 'password'))
        );
    } else if (a.type === 'apiKey') {
        const sel = el('select', 'input');
        [['header', 'En header'], ['query', 'En query param']].forEach(([value, label]) => {
            const opt = el('option', null, label);
            opt.value = value;
            sel.append(opt);
        });
        sel.value = a.apiKeyIn;
        sel.addEventListener('change', () => {
            a.apiKeyIn = sel.value;
            saveAll();
            renderAuth(host);
        });
        host.append(
            field('Nombre de la clave', inputText(a.apiKeyName, (e) => {
                a.apiKeyName = e.target.value;
                saveAll();
            }, 'x-api-key')),
            field('Valor', inputText(a.apiKeyValue, (e) => {
                a.apiKeyValue = e.target.value;
                saveAll();
            })),
            field('Ubicación', sel)
        );
    }
}

function statusClass(status) {
    if (status >= 500) return 's-5xx';
    if (status >= 400) return 's-4xx';
    if (status >= 300) return 's-3xx';
    if (status >= 200) return 's-2xx';
    return 's-err';
}

function renderStatusInfo() {
    const host = $('#status-info');
    host.textContent = '';
    const resp = state.response;
    if (!resp) return;
    const parts = [];
    if (resp.status) parts.push(String(resp.status));
    if (resp.statusText) parts.push(String(resp.statusText));
    const label = parts.length ? parts.join(' ') : 'Error';
    host.append(el('span', 'status-badge ' + statusClass(resp.status), label));
    if (resp.time != null) host.append(el('span', 'meta', `${resp.time} ms`));
    if (resp.size != null) host.append(el('span', 'meta', `${resp.size} B`));
}

function renderResponse(tab) {
    const host = $('#resp-tab-content');
    host.textContent = '';
    const resp = state.response;
    if (!resp) {
        host.append(el('p', 'placeholder', 'La respuesta aparecer\u00e1 aqu\u00ed. Escribe una URL y pulsa Enviar.'));
        return;
    }

    if (tab === 'body') {
        if (resp.data === '') {
            host.append(el('p', 'placeholder', 'La respuesta no contiene cuerpo.'));
            return;
        }
        const copyBtn = el('button', 'btn', 'Copiar respuesta');
        copyBtn.addEventListener('click', () => {
            if (navigator.clipboard) navigator.clipboard.writeText(resp.data);
        });
        const pre = el('pre', 'code-block');
        const pretty = tryPrettyJson(resp.data);
        if (pretty !== null) pre.innerHTML = highlightJson(pretty);
        else pre.textContent = resp.data;
        host.append(copyBtn, pre);
    } else if (tab === 'headers') {
        const table = el('table', 'kv-table');
        const head = el('thead');
        const htr = el('tr');
        ['Nombre', 'Valor'].forEach((t) => htr.append(el('th', null, t)));
        head.append(htr);
        const tbody = el('tbody');
        Object.entries(resp.headers || {}).forEach(([key, value]) => {
            const tr = el('tr');
            tr.append(el('td', 'kv-input mono', key), el('td', 'kv-input mono', String(value)));
            tbody.append(tr);
        });
        table.append(head, tbody);
        host.append(table);
    } else if (tab === 'tests') {
        const code = state.request.tests;
        if (!code.trim()) {
            host.append(el('p', 'placeholder', 'Define un test en la pestaña Tests de la petición.'));
            return;
        }
        const results = runTests(code, resp, state.request);
        if (!results.length) {
            host.append(el('p', 'placeholder', 'El script no registró ningún test.'));
            return;
        }
        const list = el('ul', 'test-results');
        results.forEach((r) => {
            const li = el('li', r.pass ? 'test-pass' : 'test-fail');
            li.append(el('span', 'test-icon', r.pass ? '\u2713' : '\u2717'), el('span', null, r.name));
            if (r.error) li.append(el('code', 'test-error', r.error));
            list.append(li);
        });
        host.append(list);
    }
}

function renderHistory(host) {
    if (!state.history.length) {
        host.append(el('p', 'placeholder', 'A\u00fan no hay peticiones. Env\u00eda una desde la barra superior y aparecer\u00e1 aqu\u00ed.'));
        return;
    }
    const list = el('ul', 'history-list');
    state.history.forEach((entry) => {
        const item = el('li', 'history-item');
        const info = el('div', 'history-info');
        info.append(
            el('div', 'history-url', entry.request.url || '(sin URL)'),
            el('div', 'history-time', new Date(entry.timestamp).toLocaleString())
        );
        item.append(el('span', 'method-badge ' + methodClass(entry.request.method), entry.request.method), info);
        item.addEventListener('click', () => loadRequest(entry.request));
        list.append(item);
    });
    const clearBtn = el('button', 'btn', 'Borrar historial');
    clearBtn.addEventListener('click', () => {
        if (!window.confirm('¿Borrar todo el historial?')) return;
        state.history = [];
        saveAll();
        renderSidebar(state.sidebarTab);
        notify('Historial borrado', 'ok');
    });
    host.append(list, clearBtn);
}

function renderCollections(host) {
    const bar = el('div', 'sidebar-bar');
    const target = el('select', 'input');
    target.id = 'collection-target';
    state.collections.forEach((collection, i) => {
        const opt = el('option', null, collection.name);
        opt.value = i;
        target.append(opt);
    });
    if (!state.collections.length) {
        const opt = el('option', null, '(aún no hay colecciones)');
        opt.value = '-1';
        opt.disabled = true;
        target.append(opt);
    }

    const saveBtn = el('button', 'btn', 'Guardar petición');
    saveBtn.addEventListener('click', () => {
        const idx = Number(target.value);
        if (Number.isNaN(idx) || idx < 0 || idx >= state.collections.length) {
            notify('Primero crea una colección', 'warn');
            return;
        }
        const name = window.prompt('Nombre para la petición guardada', state.request.url || '');
        if (name === null || !name) return;
        state.collections[idx].requests.push(cloneRequest(state.request, name));
        saveAll();
        renderSidebar(state.sidebarTab);
        notify('Petición guardada en "' + state.collections[idx].name + '"', 'ok');
    });

    const addBtn = el('button', 'btn', '+ Nueva colección');
    addBtn.addEventListener('click', () => {
        const name = window.prompt('Nombre de la colección');
        if (name === null || !name) return;
        state.collections.push({ name, requests: [] });
        saveAll();
        renderSidebar(state.sidebarTab);
        notify('Colección "' + name + '" creada', 'ok');
    });

    const exportBtn = el('button', 'btn', 'Exportar');
    exportBtn.addEventListener('click', exportCollections);

    const fileInput = el('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json';
    fileInput.hidden = true;
    fileInput.addEventListener('change', importCollections);

    const importBtn = el('button', 'btn', 'Importar');
    importBtn.addEventListener('click', () => fileInput.click());

    bar.append(target, saveBtn);
    host.append(bar, addBtn, exportBtn, importBtn, fileInput);

    if (!state.collections.length) {
        host.append(el('p', 'placeholder', 'A\u00fan no hay colecciones. Completa una petici\u00f3n, pulsa Enviar y gu\u00e1rdala aqu\u00ed para reutilizarla.'));
        return;
    }

    state.collections.forEach((collection, ci) => {
        const box = el('div', 'collection');
        const head = el('div', 'collection-head');
        head.append(el('h4', 'collection-title', collection.name));
        const delColBtn = el('button', 'icon-btn', '\u00d7');
        delColBtn.title = 'Eliminar colección';
        delColBtn.addEventListener('click', () => {
            if (!window.confirm('¿Eliminar la colección "' + collection.name + '"?')) return;
            state.collections.splice(ci, 1);
            saveAll();
            renderSidebar(state.sidebarTab);
            notify('Colección eliminada', 'ok');
        });
        head.append(delColBtn);
        box.append(head);

        if (!collection.requests.length) {
            box.append(el('p', 'placeholder', 'Vacía. Guarda una petición para agregar aquí.'));
        }
        collection.requests.forEach((req, ri) => {
            const item = el('div', 'history-item');
            const info = el('div', 'history-info');
            info.append(el('div', 'history-url', req.url || '(sin URL)'), el('div', 'history-time', req.name || req.method));
            const delBtn = el('button', 'icon-btn', '\u00d7');
            delBtn.title = 'Eliminar petición';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!window.confirm('¿Eliminar esta petición guardada?')) return;
                collection.requests.splice(ri, 1);
                saveAll();
                renderSidebar(state.sidebarTab);
                notify('Petición eliminada', 'ok');
            });
            item.append(el('span', 'method-badge ' + methodClass(req.method), req.method), info, delBtn);
            item.addEventListener('click', () => loadRequest(req));
            box.append(item);
        });
        host.append(box);
    });
}

function renderEnvironments(host) {
    const addBtn = el('button', 'btn', '+ Nuevo entorno');
    addBtn.addEventListener('click', () => {
        const name = window.prompt('Nombre del entorno');
        if (name === null || !name) return;
        state.environments.push({ name, variables: [{ key: '', value: '', enabled: true }] });
        saveAll();
        renderEnvironments(host);
        renderEnvSelect();
    });
    host.append(addBtn);

    if (!state.environments.length) {
        host.append(el('p', 'placeholder', 'A\u00fan no hay entornos. Crea uno para definir variables y usarlas como {{var}} en tus peticiones.'));
        return;
    }

    state.environments.forEach((env, i) => {
        const box = el('div', 'collection');
        const head = el('div', 'collection-head');
        head.append(el('h4', 'collection-title', env.name));
        const activeBtn = el('button', 'btn', state.activeEnv === i ? 'Activo \u2713' : 'Activar');
        activeBtn.addEventListener('click', () => {
            state.activeEnv = i;
            saveAll();
            renderSidebar(state.sidebarTab);
            renderEnvSelect();
        });
        const delBtn = el('button', 'icon-btn', '\u00d7');
        delBtn.title = 'Eliminar entorno';
        delBtn.addEventListener('click', () => {
            if (state.environments.length <= 1) {
                notify('No puedes eliminar el último entorno', 'warn');
                return;
            }
            if (!window.confirm('¿Eliminar el entorno "' + env.name + '"?')) return;
            state.environments.splice(i, 1);
            if (state.activeEnv >= state.environments.length) state.activeEnv = state.environments.length - 1;
            saveAll();
            renderSidebar(state.sidebarTab);
            renderEnvSelect();
            notify('Entorno eliminado', 'ok');
        });
        head.append(activeBtn, delBtn);
        box.append(head);
        kvTable(box, env.variables, saveAll, () => renderSidebar(state.sidebarTab), 'Variables {{var}}');
        host.append(box);
    });
}

function renderSidebar(tab) {
    const host = $('#sidebar-content');
    host.textContent = '';
    if (tab === 'history') {
        renderHistory(host);
    } else if (tab === 'collections') {
        renderCollections(host);
    } else {
        renderEnvironments(host);
    }
}

function renderEnvSelect() {
    const sel = $('#env-select');
    sel.textContent = '';
    state.environments.forEach((env, i) => {
        const opt = el('option', null, env.name);
        opt.value = i;
        sel.append(opt);
    });
    sel.value = String(state.activeEnv);
}

function renderReqTabs() {
    document.querySelectorAll('#req-tabs .tab-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-reqtab') === state.reqTab);
    });
}

function renderRespTabs() {
    document.querySelectorAll('#resp-tabs .tab-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-resptab') === state.respTab);
    });
}

function renderSidebarTabs() {
    document.querySelectorAll('.sidebar-tabs .tab-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-sidebar') === state.sidebarTab);
    });
}