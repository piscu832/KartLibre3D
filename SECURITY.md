# Política y Arquitectura de Seguridad (KartLibre3D)

Este proyecto ha sido auditado y blindado antes de su publicación en GitHub para prevenir ataques de inyección, robo de datos y adulteración en el cliente.

## Medidas de Seguridad Implementadas

1. **Content Security Policy (CSP) Estricto (`index.html`)**:
   - Se aplica una política `<meta http-equiv="Content-Security-Policy">` con `default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none';`.
   - **Bloqueo total de scripts inline y `eval()`**: `script-src 'self'` no incluye `'unsafe-inline'` ni `'unsafe-eval'`, impidiendo la ejecución de scripts inyectados por terceros o extensiones maliciosas.
   - **Cero conexiones externas (`connect-src 'self'`)**: El juego funciona 100% de manera local sin telemetría ni carga de scripts desde CDNs externos (Three.js r128 está alojado localmente en `src/three.min.js`).

2. **Prevención Total de DOM XSS (`src/gameEngine.js`)**:
   - Se eliminó por completo el uso de `innerHTML` y `outerHTML` en el código del juego.
   - Toda la interfaz dinámica (tabla de posiciones, tarjetas de los 8 corredores y resultados de cada etapa) se construye exclusivamente mediante nodos seguros del DOM (`document.createElement` y `.textContent`).
   - Los colores de los corredores se validan mediante la expresión regular estricta `/^#[0-9A-Fa-f]{3,8}$/` (`safeHexColor`) antes de asignarse a propiedades de estilo.

3. **Inmutabilidad y Protección contra Prototype Pollution (`src/racersData.js`, `src/gameEngine.js`)**:
   - Todas las estructuras globales de configuración (`window.RACERS_LIST`, `window.TRACK_PIXEL_POINTS`, `window.TRACK_CORNER_LABELS`, `window.KART_MODEL_PARTS`, `STAGE_CONFIG` y `DIFFICULTY_CONFIG`) están selladas con `Object.freeze()` en profundidad para impedir su adulteración en tiempo de ejecución.

4. **Validación por Lista Blanca (Whitelisting) de Parámetros URL (`src/gameEngine.js`)**:
   - Todos los parámetros recibidos por `URLSearchParams` (`racer`, `stage`, `cam`, `rain`) son validados contra listas blancas estrictas usando `Object.prototype.hasOwnProperty.call` y rangos enteros verificados.

5. **Higiene del Repositorio (`.gitignore`)**:
   - Exclusión estricta de archivos `.env`, claves privadas (`*.pem`, `*.key`, `*.pfx`), configuraciones locales de usuario (`.vscode/`) y metadatos del sistema operativo.

