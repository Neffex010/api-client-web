# Mini Postman Web

Cliente de API REST en el navegador con backend proxy desplegado en Netlify Functions. Permite enviar peticiones HTTP hacia cualquier API pública sin bloquearlo por CORS.

## Qué hace

- Envía peticiones `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD` y `OPTIONS` desde el navegador.
- Editor de peticiones estilo Postman con pestañas:
  - **Params**: query params en tabla clave/valor (activables/desactivables).
  - **Headers**: headers en tabla clave/valor.
  - **Auth**: None, Bearer Token, Basic Auth y API Key (header o query).
  - **Body**: None, JSON, texto, XML, `x-www-form-urlencoded` y `multipart/form-data`.
  - **Tests**: scripts de aserción con `pm.test(name, fn)`, `pm.response` y `tests["nombre"] = true|false`.
- Respuesta con estado coloreado por código (2xx/3xx/4xx/5xx), tiempo de respuesta, tamaño, pestañas de Headers y resultado de tests, y resaltado de sintaxis JSON.
- **Historial** de las últimas 25 peticiones (localStorage), reutilizables con un clic.
- **Colecciones**: crear colecciones, guardar/recuperar peticiones, exportarlas e importarlas en JSON.
- **Entornos y variables**: definición de variables en entornos y sustitución automática de `{{variable}}` en URL, params, headers y body.

## Cómo usarlo

1. Selecciona el método HTTP.
2. Escribe la URL destino (solo `http`/`https`).
3. Opcional: completa *Headers* y *Body* en formato JSON.
4. Pulsa **Enviar** y verás el estado y la respuesta.

## Despliegue en Netlify

La app está pensada para Netlify. Conecta este repositorio en Netlify o despliega con la CLI:

```bash
netlify deploy --prod
```

Las funciones se declararan automáticamente gracias a `netlify.toml`.

### Desarrollo local

```bash
netlify dev
```

Sirve la página estática y las funciones en `http://localhost:8888`.

## Estructura

```
api-client-web/
├── index.html              # Interfaz de usuario
├── app.js                  # Estado, persistencia, envío y runner de tests
├── styles.css              # Estilos (tema oscuro)
├── js/
│   ├── request.js          # Construcción de la petición (auth, body, variables)
│   └── ui.js               # Renderizados, tablas clave/valor y resaltado JSON
├── netlify.toml            # Configuración de Netlify (publish y functions)
└── netlify/
    └── functions/
        └── proxy.js        # Netlify Function: hace la petición HTTP real
```

## Seguridad del proxy

`netlify/functions/proxy.js` es el único punto donde se ejecuta la petición hacia la API destino. Incluye protecciones:

- **Anti-SSRF**: resuelve el hostname por DNS y bloquea IPs privadas/reservadas (127.x, 10.x, 172.16-31, 192.168, 169.254, IPv6 link-local y ULA, etc.).
- **Solo http/https**: rechaza otros protocolos.
- **Timeout**: aborta la petición a los 10 segundos.
- **Sin seguimiento de redirecciones** (`redirect: 'manual'`) para evitar saltos a hosts internos.