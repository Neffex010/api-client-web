# Mini Postman Web

Cliente de API REST en el navegador con backend proxy desplegado en Netlify Functions. Permite enviar peticiones HTTP hacia cualquier API pública sin bloquearlo por CORS.

## Qué hace

- Envía peticiones `GET`, `POST`, `PUT`, `DELETE` y `PATCH` desde el navegador.
- Permite definir headers y body en JSON.
- Muestra el estado de la respuesta, los headers y el cuerpo (formateado si es JSON).
- El proxy de Netlify evita los problemas de CORS al hacer la petición desde el servidor.

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
├── app.js                  # Lógica del cliente: lee el formulario y llama al proxy
├── styles.css              # Estilos (tema oscuro)
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