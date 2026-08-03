// Módulo de Almacenamiento e Importación/Exportación para Quint

const STORAGE_KEY = 'quint_project_state';

// Guarda el proyecto en localStorage
export function saveProject(stageMeters, fixtures, objects) {
  try {
    const data = {
      version: '1.0',
      timestamp: Date.now(),
      stageMeters,
      fixtures,
      objects
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Error al guardar en localStorage:', error);
    return false;
  }
}

// Carga el proyecto desde localStorage
export function loadProject() {
  try {
    const dataStr = localStorage.getItem(STORAGE_KEY);
    if (!dataStr) return null;
    
    const data = JSON.parse(dataStr);
    // Validación básica de datos
    if (data && data.stageMeters && Array.isArray(data.fixtures) && Array.isArray(data.objects)) {
      return data;
    }
    return null;
  } catch (error) {
    console.error('Error al cargar de localStorage:', error);
    return null;
  }
}

// Limpia el proyecto en localStorage
export function clearProject() {
  localStorage.removeItem(STORAGE_KEY);
}

// Exporta el proyecto actual como un archivo JSON descargable
export function exportProjectJSON(stageMeters, fixtures, objects, projectName = 'Planta_Luces') {
  const data = {
    appName: 'Quint',
    version: '1.0',
    timestamp: Date.now(),
    projectName,
    stageMeters,
    fixtures,
    objects
  };

  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  // Formatear fecha para el nombre del archivo
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${projectName.replace(/\s+/g, '_')}_${dateStr}.json`;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Procesa e importa un archivo JSON subido
export function importProjectJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        
        // Validación estricta de estructura
        if (!parsed.stageMeters || typeof parsed.stageMeters.w !== 'number' || typeof parsed.stageMeters.d !== 'number') {
          throw new Error('Estructura de escenario inválida en el archivo.');
        }
        if (!Array.isArray(parsed.fixtures)) {
          throw new Error('La lista de focos debe ser un arreglo.');
        }
        if (!Array.isArray(parsed.objects)) {
          throw new Error('La lista de objetos debe ser un arreglo.');
        }
        
        resolve({
          stageMeters: parsed.stageMeters,
          fixtures: parsed.fixtures,
          objects: parsed.objects,
          projectName: parsed.projectName || 'Proyecto Importado'
        });
      } catch (err) {
        reject(new Error('Archivo JSON no válido: ' + err.message));
      }
    };
    
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.readAsText(file);
  });
}
