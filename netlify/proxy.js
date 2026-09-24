exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        const { url, method, headers, body } = JSON.parse(event.body);

        const fetchOptions = {
            method: method || 'GET',
            headers: headers || {}
        };

        if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
            fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        const apiResponse = await fetch(url, fetchOptions);
        const responseText = await apiResponse.text();

        const responseHeaders = {};
        apiResponse.headers.forEach((value, key) => {
            responseHeaders[key] = value;
        });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                status: apiResponse.status,
                statusText: apiResponse.statusText,
                headers: responseHeaders,
                data: responseText
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message })
        };
    }
};