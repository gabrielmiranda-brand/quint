// Catálogo de Luminarias y Filtros Gel Reales para Quint

export const CATALOG = [
  {
    id: 'generic-rgbw',
    name: 'PAR LED Genérico RGBW',
    brand: 'Genérico',
    type: 'led',
    subType: 'wash',
    colorMode: 'rgbw',
    beamAngle: 30,
    minAngle: 10,
    maxAngle: 60,
    defaultColor: '#ffffff',
    description: 'PAR LED estándar con mezcla de color RGBW y apertura variable.'
  },
  {
    id: 'par-led-18x10',
    name: 'PAR LED 18x10W RGBW',
    brand: 'Neo / Genérico',
    type: 'led',
    subType: 'wash',
    colorMode: 'rgbw',
    beamAngle: 25,
    minAngle: 25,
    maxAngle: 25, // Fijo
    defaultColor: '#ffffff',
    description: 'Bañador LED clásico de alta potencia y haz fijo de 25°.'
  },
  {
    id: 'par-led-36x3',
    name: 'PAR LED 36x3W RGB',
    brand: 'Neo Flash',
    type: 'led',
    subType: 'wash',
    colorMode: 'rgb',
    beamAngle: 30,
    minAngle: 30,
    maxAngle: 30, // Fijo
    defaultColor: '#ffffff',
    description: 'Luminaria LED clásica con mezcla RGB. No posee canal blanco dedicado.'
  },
  {
    id: 'beam-7r-230',
    name: 'Cabezal Móvil Beam 7R 230W',
    brand: 'Clay Paky / Genérico',
    type: 'led', // Comportamiento electrónico de mezcla
    subType: 'beam',
    colorMode: 'rgb',
    beamAngle: 4,
    minAngle: 2,
    maxAngle: 10,
    defaultColor: '#ffffff',
    description: 'Haz ultraconcentrado y potente de 4° con bordes definidos. Ideal para efectos aéreos.'
  },
  {
    id: 'fresnel-1000',
    name: 'Fresnel Halógeno 1000W',
    brand: 'Antari / Strand',
    type: 'conventional',
    subType: 'wash',
    colorMode: 'tungsten',
    beamAngle: 35,
    minAngle: 10,
    maxAngle: 55,
    defaultColor: '#ffb347', // Tungsteno cálido por defecto (3200K)
    description: 'Luz convencional halógena de bordes suaves. Permite acoplar portafiltros para geles.'
  },
  {
    id: 'etc-source-four',
    name: 'Elipsoidal ETC Source Four 750W',
    brand: 'ETC',
    type: 'conventional',
    subType: 'spot',
    colorMode: 'tungsten',
    beamAngle: 26,
    minAngle: 19,
    maxAngle: 36, // Selección de lentes común
    defaultColor: '#ffb347',
    description: 'Recorte de precisión con haz definido. Muy utilizado para luz de frente o gobos. Permite geles.'
  },
  {
    id: 'minibrute-4',
    name: 'Cegador Catarina (Mini-Brute 4)',
    brand: 'Genérico',
    type: 'conventional',
    subType: 'wash',
    colorMode: 'tungsten',
    beamAngle: 60,
    minAngle: 50,
    maxAngle: 70,
    defaultColor: '#ffa834', // Muy cálido al dimerizar
    description: 'Cegador de escenario con 4 lámparas halógenas. Baño de luz cálido y amplio.'
  }
];

export const GELS = [
  { id: 'none', name: 'Luz Directa (3200K)', hex: '#ffb347', code: 'Sin Gel' },
  // Rojos y Rosados
  { id: 'l106', name: 'Primary Red', hex: '#ff0000', code: 'Lee 106' },
  { id: 'l026', name: 'Bright Red', hex: '#ff3b30', code: 'Lee 026' },
  { id: 'l128', name: 'Bright Pink', hex: '#ff69b4', code: 'Lee 128' },
  
  // Ambares y Amarillos
  { id: 'l134', name: 'Golden Amber', hex: '#ffb200', code: 'Lee 134' },
  { id: 'l101', name: 'Yellow', hex: '#ffea00', code: 'Lee 101' },
  { id: 'r22', name: 'Deep Amber', hex: '#ff6600', code: 'Rosco 22' },
  
  // Azules
  { id: 'l119', name: 'Dark Blue', hex: '#00008b', code: 'Lee 119' },
  { id: 'l181', name: 'Congo Blue', hex: '#2000aa', code: 'Lee 181' },
  { id: 'l201', name: 'Full CT Blue (Tungsteno a Día)', hex: '#cbebff', code: 'Lee 201' },
  { id: 'l202', name: 'Half CT Blue (Corrección Media)', hex: '#e3f3ff', code: 'Lee 202' },
  { id: 'l203', name: 'Quarter CT Blue (Suave)', hex: '#f0f8ff', code: 'Lee 203' },
  { id: 'l204', name: 'Full CT Orange (Día a Tungsteno)', hex: '#ff9d3b', code: 'Lee 204' },
  { id: 'l205', name: 'Half CT Orange (Corrección Media)', hex: '#ffc37a', code: 'Lee 205' },
  { id: 'l206', name: 'Quarter CT Orange (Suave)', hex: '#ffe2bd', code: 'Lee 206' },
  { id: 'l711', name: 'Cold Blue', hex: '#00a2e8', code: 'Lee 711' },
  { id: 'r80', name: 'Primary Blue', hex: '#0033cc', code: 'Rosco 80' },

  
  // Verdes y Lavandas
  { id: 'l139', name: 'Primary Green', hex: '#00aa00', code: 'Lee 139' },
  { id: 'l124', name: 'Dark Green', hex: '#006400', code: 'Lee 124' },
  { id: 'l136', name: 'Pale Lavender', hex: '#e6e6fa', code: 'Lee 136' },
  { id: 'l058', name: 'Lavender', hex: '#a18df7', code: 'Lee 058' }
];

export function getFixtureDefaults(modelId) {
  const model = CATALOG.find(m => m.id === modelId) || CATALOG[0];
  return {
    modelId: model.id,
    name: model.name,
    type: model.type,
    subType: model.subType,
    beamAngle: model.beamAngle,
    color: model.defaultColor,
    gelId: model.type === 'conventional' ? 'none' : null,
    minAngle: model.minAngle,
    maxAngle: model.maxAngle,
    intensity: 80,
    strobe: false
  };
}
