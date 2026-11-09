# 🏎️ KartLibre3D (Kart-Racer 3D)

Juego de carreras de kartings en 3D ambientado en el **Kartódromo Ciudad de Buenos Aires** (circuito oficial de 10 curvas), desarrollado con WebGL / Three.js y ejecutable directamente en el navegador sin necesidad de servidores externos.

## ✨ Características Principales

- **8 Corredores Oficiales con Karts Personalizados**:
  1. `#1 Nahuel` (Negro Grafito / Rojo)
  2. `#2 Ayrton` (Naranja Fuego / Negro)
  3. `#3 Santiago` (Rojo Competición / Azul)
  4. `#4 Alejandro` (Azul Eléctrico / Negro)
  5. `#5 Eduardo` (Verde Racing / Rojo)
  6. `#6 Mariano` (Púrpura / Amarillo Oro)
  7. `#7 Adrian` (Turquesa / Naranja)
  8. `#8 Lucas` (Blanco Perla / Rojo y Celeste)
- **Formato Oficial de Gran Premio (3 Etapas)**:
  - **Etapa 1**: 1 Vuelta de Reconocimiento.
  - **Etapa 2**: 3 Vueltas de Clasificación (ordena la parrilla de largada según el mejor tiempo de vuelta).
  - **Etapa 3**: 30 Vueltas de Carrera Final rueda a rueda contra los otros 7 corredores.
- **IA con Trazada Ideal y 3 Niveles de Dificultad**:
  - Configuración desde el menú inicial: **🟢 Fácil**, **🟡 Medio** y **🔴 Difícil**.
  - Los bots respetan los límites de la cinta asfáltica trazando las 10 curvas (Exterior → Ápice → Exterior) sin cortar por el pasto.
- **Física de Manejo Realista**:
  - Dirección progresiva sensible a la velocidad.
  - Derrape y deslizamiento centrífugo al entrar pasado de velocidad en curva (con sonido dinámico de chirrido de neumáticos).
- **Cámaras Duales y Clima Dinámico**:
  - Vista en **1ª Persona (Cockpit / Casco)** con telemetría digital MyChron en el volante y gotas de lluvia refractivas sobre el visor.
  - Vista en **3ª Persona (Exterior)** con modelo 3D anatómico del piloto (casco con bisagras, collarín HANS, arnés de 4 puntos, guantes y botas).

## 🎮 Controles

| Acción | Teclado | Pantalla / Mouse |
| :--- | :--- | :--- |
| **Acelerar** | `W` o `↑` | Pedal `ACEL` |
| **Frenar / Reversa** | `S` o `↓` | Pedal `FRENO` |
| **Doblar Izquierda / Derecha** | `A` / `D` o `←` / `→` | Botones `◀` / `▶` |
| **Boost / KERS** | `Espacio` o `Shift` | Botón `⚡ BOOST` |
| **Pausar / Salir al Menú** | `P` o `Esc` | Botón `⏸️ Pausa` |
| **Cambiar Cámara (1ªP / 3ªP)** | `C` | Botón `🎥 Cámara` |
| **Cambiar Clima (Lluvia / Seco)** | `V` | Botón `🌧️ Clima` |

## 🚀 Cómo Ejecutar

Haz doble clic en `Iniciar-Juego.bat` o abre `index.html` directamente en cualquier navegador moderno (Chrome, Edge, Firefox, Brave).

