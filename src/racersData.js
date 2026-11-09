// Datos oficiales de los 8 corredores (Corredores/Lista de corredores.txt)
// y trazado exacto del Kartódromo Ciudad de Buenos Aires (Pistas/Kartódromo-V1.jpeg)

window.RACERS_LIST = [
  {
    id: 1,
    number: 1,
    rawName: "1-Nahuel",
    name: "Nahuel",
    primaryColor: "#262930",    // Negro Grafito (estilo kart #16 de referencia)
    secondaryColor: "#E51C23",  // Rojo Competición
    stripeColor: "#FFFFFF",     // Blanco
    suitColor: "#2B2E36",
    suitAccent: "#D8DEE9",
    helmetColor: "#434854",
    helmetStripe: "#1E88E5",
    gloveColor: "#1B1D22",
    gloveAccent: "#1E88E5",
    flagType: "AR",
    aiPace: 1.005,
    aiLineOffset: -0.6
  },
  {
    id: 2,
    number: 2,
    rawName: "2-Ayrton",
    name: "Ayrton",
    primaryColor: "#FF9100",    // Naranja / Amarillo Fuego (estilo kart #17 de referencia)
    secondaryColor: "#1E2126",  // Negro
    stripeColor: "#FFFFFF",     // Blanco
    suitColor: "#C86414",
    suitAccent: "#F5F7FA",
    helmetColor: "#FFB300",
    helmetStripe: "#1565C0",
    gloveColor: "#22252A",
    gloveAccent: "#FFB300",
    flagType: "BR",
    aiPace: 1.000,
    aiLineOffset: 0.7
  },
  {
    id: 3,
    number: 3,
    rawName: "3-Santiago",
    name: "Santiago",
    primaryColor: "#E51C23",    // Rojo Competición (estilo kart rojo de referencia)
    secondaryColor: "#1565C0",  // Azul
    stripeColor: "#FFFFFF",
    suitColor: "#C62828",
    suitAccent: "#FFFFFF",
    helmetColor: "#D32F2F",
    helmetStripe: "#FFFFFF",
    gloveColor: "#1C1F24",
    gloveAccent: "#E51C23",
    flagType: "AR",
    aiPace: 0.992,
    aiLineOffset: -1.4
  },
  {
    id: 4,
    number: 4,
    rawName: "4-Alejandro",
    name: "Alejandro",
    primaryColor: "#1565C0",    // Azul Eléctrico (estilo kart azul de referencia)
    secondaryColor: "#11151C",  // Negro
    stripeColor: "#FFFFFF",
    suitColor: "#1554A6",
    suitAccent: "#E3F2FD",
    helmetColor: "#1976D2",
    helmetStripe: "#FFFFFF",
    gloveColor: "#181B20",
    gloveAccent: "#29B6F6",
    flagType: "AR",
    aiPace: 0.985,
    aiLineOffset: 1.4
  },
  {
    id: 5,
    number: 5,
    rawName: "5-Eduardo",
    name: "Eduardo",
    primaryColor: "#00893E",    // Verde Racing (estilo cockpit 1ª imagen)
    secondaryColor: "#D32F2F",  // Rojo
    stripeColor: "#FFFFFF",
    suitColor: "#00692F",
    suitAccent: "#FFFFFF",
    helmetColor: "#00893E",
    helmetStripe: "#FFD600",
    gloveColor: "#181A1D",
    gloveAccent: "#1E88E5",
    flagType: "AR",
    aiPace: 0.978,
    aiLineOffset: -0.3
  },
  {
    id: 6,
    number: 6,
    rawName: "6-Mariano",
    name: "Mariano",
    primaryColor: "#7B1FA2",    // Púrpura / Violeta Competición
    secondaryColor: "#FFD600",  // Amarillo Oro
    stripeColor: "#FFFFFF",
    suitColor: "#5E1680",
    suitAccent: "#FFD600",
    helmetColor: "#8E24AA",
    helmetStripe: "#FFD600",
    gloveColor: "#1D1A22",
    gloveAccent: "#BA68C8",
    flagType: "AR",
    aiPace: 0.970,
    aiLineOffset: 0.5
  },
  {
    id: 7,
    number: 7,
    rawName: "7-Adrian",
    name: "Adrian",
    primaryColor: "#00ACC1",    // Turquesa / Cian
    secondaryColor: "#FF6D00",  // Naranja
    stripeColor: "#181B20",
    suitColor: "#00838F",
    suitAccent: "#FFFFFF",
    helmetColor: "#00ACC1",
    helmetStripe: "#FF6D00",
    gloveColor: "#1A1D21",
    gloveAccent: "#00E5FF",
    flagType: "AR",
    aiPace: 0.962,
    aiLineOffset: -1.1
  },
  {
    id: 8,
    number: 8,
    rawName: "8-Lucas",
    name: "Lucas",
    primaryColor: "#ECEFF1",    // Blanco Perla
    secondaryColor: "#E51C23",  // Rojo
    stripeColor: "#0288D1",     // Celeste
    suitColor: "#CFD8DC",
    suitAccent: "#1C2026",
    helmetColor: "#FFFFFF",
    helmetStripe: "#0288D1",
    gloveColor: "#1C2026",
    gloveAccent: "#E51C23",
    flagType: "AR",
    aiPace: 0.955,
    aiLineOffset: 1.1
  }
];

// Coordenadas en píxeles (sobre imagen 1600x1037 de Pistas/Kartódromo-V1.jpeg)
// Siguiendo exactamente las flechas de sentido de giro y las 10 curvas numeradas:
window.TRACK_PIXEL_POINTS = [
  // Recta Principal (Largada / Llegada, sentido Este -> Oeste hacia Curva 1)
  { px: 1290, py: 946, speedHint: 1.00 },
  { px: 1170, py: 946, speedHint: 1.00, isStartLine: true },
  { px: 1055, py: 946, speedHint: 0.72 },
  // Curva 1 (Horquilla derecha 180°)
  { px: 992,  py: 916, speedHint: 0.52, corner: 1 },
  { px: 978,  py: 855, speedHint: 0.50 },
  { px: 1002, py: 798, speedHint: 0.56 },
  { px: 1070, py: 782, speedHint: 0.65 },
  { px: 1145, py: 782, speedHint: 0.62 },
  // Curva 2 (Codo izquierdo cerrado hacia recta diagonal)
  { px: 1200, py: 762, speedHint: 0.54, corner: 2 },
  { px: 1212, py: 712, speedHint: 0.65 },
  { px: 1175, py: 660, speedHint: 0.85 },
  // Recta Diagonal Interna (hacia Curva 3)
  { px: 1090, py: 590, speedHint: 1.00 },
  { px: 990,  py: 508, speedHint: 1.00 },
  { px: 890,  py: 425, speedHint: 0.92 },
  // Curva 3 (Curvón izquierdo superior interno)
  { px: 790,  py: 358, speedHint: 0.70, corner: 3 },
  { px: 690,  py: 335, speedHint: 0.64 },
  { px: 600,  py: 365, speedHint: 0.72 },
  // Recta Interior Descendente (hacia Curva 4)
  { px: 545,  py: 445, speedHint: 0.92 },
  { px: 502,  py: 552, speedHint: 0.96 },
  { px: 458,  py: 658, speedHint: 0.80 },
  // Curva 4 (Curvón inferior izquierdo hacia el oeste)
  { px: 395,  py: 732, speedHint: 0.62, corner: 4 },
  { px: 305,  py: 755, speedHint: 0.60 },
  { px: 215,  py: 722, speedHint: 0.68 },
  // Curva 5 (Curvón exterior oeste)
  { px: 150,  py: 650, speedHint: 0.74, corner: 5 },
  { px: 125,  py: 560, speedHint: 0.80 },
  { px: 142,  py: 460, speedHint: 0.85 },
  // Curva 6 (Curva noroeste hacia la recta opuesta larga)
  { px: 182,  py: 360, speedHint: 0.72, corner: 6 },
  { px: 245,  py: 280, speedHint: 0.76 },
  { px: 345,  py: 235, speedHint: 0.92 },
  // Recta Opuesta Principal (6 -> 7)
  { px: 495,  py: 198, speedHint: 1.00 },
  { px: 655,  py: 162, speedHint: 1.00 },
  { px: 815,  py: 132, speedHint: 1.00 },
  { px: 935,  py: 122, speedHint: 0.78 },
  // Curva 7 (Derecha rápida en el extremo norte)
  { px: 1020, py: 150, speedHint: 0.62, corner: 7 },
  { px: 1052, py: 218, speedHint: 0.66 },
  { px: 1036, py: 300, speedHint: 0.70 },
  // Curva 8 (Contra-curva izquierda de la Ese)
  { px: 1038, py: 372, speedHint: 0.62, corner: 8 },
  { px: 1098, py: 408, speedHint: 0.68 },
  { px: 1185, py: 416, speedHint: 0.76 },
  // Curva 9 (Curvón derecho hacia recta de retorno)
  { px: 1265, py: 452, speedHint: 0.74, corner: 9 },
  { px: 1318, py: 538, speedHint: 0.92 },
  { px: 1368, py: 650, speedHint: 1.00 },
  { px: 1418, py: 765, speedHint: 0.85 },
  // Curva 10 (Horquilla / Codo final derecho hacia Recta Principal)
  { px: 1452, py: 865, speedHint: 0.56, corner: 10 },
  { px: 1432, py: 928, speedHint: 0.58 },
  { px: 1368, py: 946, speedHint: 0.88 }
];

// Posiciones de los carteles de las 10 curvas (en píxeles de Kartódromo-V1.jpeg)
window.TRACK_CORNER_LABELS = [
  { num: 1,  px: 915,  py: 855 },
  { num: 2,  px: 1280, py: 750 },
  { num: 3,  px: 785,  py: 265 },
  { num: 4,  px: 355,  py: 820 },
  { num: 5,  px: 52,   py: 560 },
  { num: 6,  px: 168,  py: 255 },
  { num: 7,  px: 950,  py: 48  },
  { num: 8,  px: 1068, py: 465 },
  { num: 9,  px: 1330, py: 365 },
  { num: 10, px: 1540, py: 840 }
];

// Inmutabilidad de datos para prevenir adulteración en tiempo de ejecución / Prototype Pollution
window.RACERS_LIST.forEach(function (r) { Object.freeze(r); });
Object.freeze(window.RACERS_LIST);
window.TRACK_PIXEL_POINTS.forEach(function (p) { Object.freeze(p); });
Object.freeze(window.TRACK_PIXEL_POINTS);
window.TRACK_CORNER_LABELS.forEach(function (c) { Object.freeze(c); });
Object.freeze(window.TRACK_CORNER_LABELS);


