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

// ==================== NUEVO CIRCUITO: KARTÓDROMO V2 (Pistas/Kartódromo-V2.jpeg) ====================
// Circuito internacional rodeado de barreras continuas de llantas blancas de contención (3 llantas de alto)
window.TRACK_V2_PIXEL_POINTS = [
  { px: 1215.0, py: 416.0, speedHint: 0.95, isStartLine: true },
  { px: 1175.0, py: 427.7, speedHint: 0.94 },
  { px: 1148.0, py: 432.2, speedHint: 0.92 },
  { px: 1121.0, py: 436.8, speedHint: 0.90 },
  { px: 1094.0, py: 441.4, speedHint: 0.85 },
  { px: 1067.0, py: 446.1, speedHint: 0.81 },
  { px: 1040.1, py: 449.4, speedHint: 0.76 },
  { px: 1013.3, py: 446.8, speedHint: 0.72 },
  { px: 988.4, py: 433.7, speedHint: 0.69 },
  { px: 968.8, py: 414.2, speedHint: 0.69 },
  { px: 948.5, py: 395.6, speedHint: 0.70 },
  { px: 923.6, py: 384.7, speedHint: 0.73 },
  { px: 896.0, py: 382.4, speedHint: 0.77 },
  { px: 869.0, py: 385.2, speedHint: 0.81 },
  { px: 842.0, py: 388.3, speedHint: 0.84 },
  { px: 814.9, py: 392.5, speedHint: 0.85 },
  { px: 787.9, py: 396.8, speedHint: 0.84 },
  { px: 761.1, py: 401.2, speedHint: 0.81 },
  { px: 734.8, py: 406.5, speedHint: 0.76 },
  { px: 708.0, py: 415.0, speedHint: 0.71 },
  { px: 684.4, py: 430.3, speedHint: 0.67 },
  { px: 668.1, py: 453.0, speedHint: 0.64 },
  { px: 661.2, py: 480.7, speedHint: 0.61 },
  { px: 660.4, py: 509.2, speedHint: 0.60 },
  { px: 654.1, py: 536.1, speedHint: 0.60 },
  { px: 639.4, py: 560.5, speedHint: 0.61 },
  { px: 617.4, py: 576.7, speedHint: 0.62 },
  { px: 591.3, py: 586.1, speedHint: 0.65 },
  { px: 563.9, py: 586.9, speedHint: 0.69 },
  { px: 537.0, py: 583.6, speedHint: 0.73 },
  { px: 510.0, py: 583.2, speedHint: 0.77 },
  { px: 483.8, py: 588.6, speedHint: 0.80 },
  { px: 457.2, py: 597.6, speedHint: 0.82 },
  { px: 431.7, py: 609.3, speedHint: 0.83 },
  { px: 406.1, py: 620.3, speedHint: 0.83 },
  { px: 379.2, py: 628.6, speedHint: 0.83 },
  { px: 352.2, py: 632.9, speedHint: 0.82 },
  { px: 324.8, py: 633.8, speedHint: 0.82 },
  { px: 298.0, py: 631.4, speedHint: 0.82 },
  { px: 270.8, py: 626.5, speedHint: 0.82 },
  { px: 244.8, py: 618.4, speedHint: 0.84 },
  { px: 219.5, py: 607.2, speedHint: 0.85 },
  { px: 195.7, py: 593.5, speedHint: 0.87 },
  { px: 173.0, py: 578.0, speedHint: 0.89 },
  { px: 152.1, py: 560.9, speedHint: 0.89 },
  { px: 130.6, py: 543.3, speedHint: 0.88 },
  { px: 109.4, py: 525.5, speedHint: 0.84 },
  { px: 88.5, py: 508.3, speedHint: 0.79 },
  { px: 67.8, py: 490.2, speedHint: 0.72 },
  { px: 50.5, py: 469.3, speedHint: 0.65 },
  { px: 42.3, py: 443.1, speedHint: 0.60 },
  { px: 47.4, py: 416.8, speedHint: 0.56 },
  { px: 63.7, py: 393.7, speedHint: 0.55 },
  { px: 86.1, py: 377.2, speedHint: 0.57 },
  { px: 114.0, py: 370.7, speedHint: 0.61 },
  { px: 141.4, py: 377.3, speedHint: 0.66 },
  { px: 165.7, py: 393.4, speedHint: 0.72 },
  { px: 188.4, py: 411.4, speedHint: 0.76 },
  { px: 211.7, py: 429.0, speedHint: 0.80 },
  { px: 235.2, py: 444.6, speedHint: 0.82 },
  { px: 260.3, py: 458.5, speedHint: 0.81 },
  { px: 286.8, py: 468.8, speedHint: 0.79 },
  { px: 313.9, py: 476.3, speedHint: 0.77 },
  { px: 342.3, py: 480.1, speedHint: 0.74 },
  { px: 369.7, py: 480.0, speedHint: 0.71 },
  { px: 397.5, py: 475.7, speedHint: 0.69 },
  { px: 424.2, py: 465.4, speedHint: 0.69 },
  { px: 447.0, py: 449.0, speedHint: 0.69 },
  { px: 462.8, py: 426.9, speedHint: 0.70 },
  { px: 475.4, py: 402.2, speedHint: 0.71 },
  { px: 490.2, py: 378.5, speedHint: 0.73 },
  { px: 509.1, py: 357.1, speedHint: 0.75 },
  { px: 532.8, py: 341.6, speedHint: 0.78 },
  { px: 558.8, py: 331.1, speedHint: 0.81 },
  { px: 587.0, py: 324.7, speedHint: 0.85 },
  { px: 615.1, py: 319.5, speedHint: 0.89 },
  { px: 643.1, py: 314.1, speedHint: 0.93 },
  { px: 671.0, py: 309.3, speedHint: 0.95 },
  { px: 698.8, py: 305.3, speedHint: 0.97 },
  { px: 727.0, py: 301.4, speedHint: 0.98 },
  { px: 755.1, py: 297.6, speedHint: 0.98 },
  { px: 783.2, py: 293.3, speedHint: 0.98 },
  { px: 811.0, py: 289.0, speedHint: 0.97 },
  { px: 839.0, py: 284.3, speedHint: 0.94 },
  { px: 867.0, py: 279.9, speedHint: 0.91 },
  { px: 895.0, py: 275.7, speedHint: 0.88 },
  { px: 923.2, py: 272.7, speedHint: 0.84 },
  { px: 951.7, py: 272.4, speedHint: 0.79 },
  { px: 979.1, py: 275.6, speedHint: 0.76 },
  { px: 1005.7, py: 284.7, speedHint: 0.73 },
  { px: 1028.9, py: 302.2, speedHint: 0.72 },
  { px: 1050.7, py: 320.4, speedHint: 0.72 },
  { px: 1075.3, py: 334.9, speedHint: 0.74 },
  { px: 1104.1, py: 339.6, speedHint: 0.77 },
  { px: 1133.0, py: 337.0, speedHint: 0.81 },
  { px: 1160.9, py: 333.1, speedHint: 0.86 },
  { px: 1189.0, py: 328.2, speedHint: 0.90 },
  { px: 1217.0, py: 323.1, speedHint: 0.94 },
  { px: 1244.9, py: 318.3, speedHint: 0.95 },
  { px: 1273.0, py: 313.7, speedHint: 0.96 },
  { px: 1301.0, py: 308.8, speedHint: 0.95 },
  { px: 1329.0, py: 304.5, speedHint: 0.92 },
  { px: 1357.0, py: 301.1, speedHint: 0.88 },
  { px: 1384.1, py: 296.5, speedHint: 0.83 },
  { px: 1410.7, py: 287.7, speedHint: 0.77 },
  { px: 1436.1, py: 275.1, speedHint: 0.71 },
  { px: 1462.7, py: 266.6, speedHint: 0.65 },
  { px: 1491.4, py: 266.8, speedHint: 0.59 },
  { px: 1517.4, py: 277.5, speedHint: 0.56 },
  { px: 1536.0, py: 299.4, speedHint: 0.55 },
  { px: 1542.1, py: 328.1, speedHint: 0.55 },
  { px: 1534.2, py: 355.2, speedHint: 0.58 },
  { px: 1513.2, py: 374.3, speedHint: 0.64 },
  { px: 1486.3, py: 380.8, speedHint: 0.70 },
  { px: 1458.0, py: 380.0, speedHint: 0.77 },
  { px: 1430.8, py: 381.2, speedHint: 0.84 },
  { px: 1404.1, py: 385.5, speedHint: 0.89 },
  { px: 1377.0, py: 390.5, speedHint: 0.93 },
  { px: 1349.9, py: 395.8, speedHint: 0.95 },
  { px: 1323.1, py: 401.0, speedHint: 0.96 },
  { px: 1296.0, py: 406.1, speedHint: 0.97 },
  { px: 1269.0, py: 411.0, speedHint: 0.96 },
  { px: 1242.1, py: 415.8, speedHint: 0.96 }
];

window.TRACK_V2_CORNER_LABELS = [
  { num: 1,  px: 1002, py: 481 },
  { num: 2,  px: 934,  py: 350 },
  { num: 3,  px: 659,  py: 405 },
  { num: 4,  px: 666,  py: 585 },
  { num: 5,  px: 506,  py: 547 },
  { num: 6,  px: 6,    py: 445 },
  { num: 7,  px: 472,  py: 475 },
  { num: 8,  px: 486,  py: 330 },
  { num: 9,  px: 1021, py: 252 },
  { num: 10, px: 1064, py: 369 },
  { num: 11, px: 1565, py: 374 }
];

// Catálogo maestro de pistas para selección en Menú y Configuración
window.TRACKS_CATALOG = {
  V1: {
    id: "V1",
    name: "Kartódromo Ciudad de Buenos Aires",
    shortName: "Kartódromo V1 (Bs. As.)",
    image: "Pistas/Kartódromo-V1.jpeg",
    imgWidth: 1600,
    imgHeight: 1037,
    pixelPoints: window.TRACK_PIXEL_POINTS,
    cornerLabels: window.TRACK_CORNER_LABELS,
    hasWhiteTireWalls: false,
    scale: 0.34,
    centerX: 800,
    centerY: 520,
    startSampleIndex: 16,
    cornerCount: 10,
    description: "Circuito clásico con boxes, torre de control y 10 curvas técnicas."
  },
  V2: {
    id: "V2",
    name: "Kartódromo Internacional V2",
    shortName: "Kartódromo V2 (Llantas Blancas)",
    image: "Pistas/Kartódromo-V2.jpeg",
    imgWidth: 1600,
    imgHeight: 900,
    pixelPoints: window.TRACK_V2_PIXEL_POINTS,
    cornerLabels: window.TRACK_V2_CORNER_LABELS,
    hasWhiteTireWalls: true,
    scale: 0.34,
    centerX: 800,
    centerY: 450,
    startSampleIndex: 0,
    cornerCount: 11,
    description: "Circuito rápido y fluido con suelo de tierra removida, completamente rodeado por barreras de llantas blancas (3 llantas de alto)."
  }
};

// Inmutabilidad de datos para prevenir adulteración en tiempo de ejecución / Prototype Pollution
window.RACERS_LIST.forEach(function (r) { Object.freeze(r); });
Object.freeze(window.RACERS_LIST);
window.TRACK_PIXEL_POINTS.forEach(function (p) { Object.freeze(p); });
Object.freeze(window.TRACK_PIXEL_POINTS);
window.TRACK_CORNER_LABELS.forEach(function (c) { Object.freeze(c); });
Object.freeze(window.TRACK_CORNER_LABELS);
window.TRACK_V2_PIXEL_POINTS.forEach(function (p) { Object.freeze(p); });
Object.freeze(window.TRACK_V2_PIXEL_POINTS);
window.TRACK_V2_CORNER_LABELS.forEach(function (c) { Object.freeze(c); });
Object.freeze(window.TRACK_V2_CORNER_LABELS);
Object.freeze(window.TRACKS_CATALOG.V1);
Object.freeze(window.TRACKS_CATALOG.V2);
Object.freeze(window.TRACKS_CATALOG);


