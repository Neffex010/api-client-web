document.getElementById('send-btn').addEventListener('click', async () => {
    const method = document.getElementById('method').value;
    const url = document.getElementById('url').value;
    const headersRaw = document.getElementById('headers').value;
    const bodyRaw = document.getElementById('body').value;
    const output = document.getElementById('response-output');
    const statusInfo = document.getElementById('status-info');

    if (!url) {
        alert('Ingresa una URL válida');
        return;
    }

    let headers = {};
    try {
        if (headersRaw.trim()) headers = JSON.parse(headersRaw);
    } catch (e) {
        alert('Formato de Headers JSON inválido');
        return;
    }

    let body = null;
    try {
        if (bodyRaw.trim() && ['POST', 'PUT', 'PATCH'].includes(method)) {
            body = JSON.parse(bodyRaw);
        }
    } catch (e) {
        alert('Formato de Body JSON inválido');
        return;
    }

    output.textContent = 'Enviando petición...';
    statusInfo.textContent = '';

    try {
        const response = await fetch('/.netlify/functions/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, method, headers, body })
        });

        const result = await response.json();
        
        statusInfo.innerHTML = `Estado: <strong>${result.status} ${result.statusText}</strong>`;
        
        try {
            const parsedData = JSON.parse(result.data);
            output.textContent = JSON.stringify(parsedData, null, 2);
        } catch {
            output.textContent = result.data;
        }
    } catch (error) {
        output.textContent = `Error interno: ${error.message}`;
    }
});