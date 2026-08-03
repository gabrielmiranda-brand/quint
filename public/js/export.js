// Módulo de Exportación para Quint (PNG y PDF Técnico)

// Exporta un Canvas a PNG
export function exportCanvasAsPNG(canvas, viewName = 'planta') {
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `Quint_${viewName}_${dateStr}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Genera un PDF técnico con la vista gráfica y la tabla de parcheo de luces
export function exportProjectPDF(canvas, stageMeters, fixtures, objects, projectName = 'Sin Título', currentViewName = 'Planta') {
  // Aseguramos que jsPDF esté disponible (se carga desde index.html vía CDN)
  if (!window.jspdf) {
    alert('La librería PDF no se ha cargado todavía. Por favor, asegúrate de estar conectado a internet.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4'); // Hoja A4 vertical (210mm x 297mm)
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = margin;

  // 1. Encabezado del documento
  doc.setFillColor(23, 23, 27); // Color oscuro premium
  doc.rect(0, 0, pageWidth, 28, 'F');
  
  doc.setTextColor(255, 179, 71); // Acento ámbar
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('QUINT', margin, 12);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('HERRAMIENTA DE DISEÑO DE ILUMINACIÓN', margin, 17);

  const dateStr = new Date().toLocaleDateString('es-ES', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  doc.setFontSize(8);
  doc.text(`Fecha: ${dateStr}`, pageWidth - margin - 50, 12);
  doc.text(`Escenario: ${stageMeters.w}m x ${stageMeters.d}m (Alto: ${stageMeters.h}m)`, pageWidth - margin - 50, 17);

  y = 35;

  // 2. Información del Proyecto
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`Proyecto: ${projectName}`, margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Vista gráfica capturada: ${currentViewName === 'plan' ? 'Planta (Técnica)' : 'Perfil (Público)'}`, margin, y);
  y += 8;

  // 3. Captura gráfica (Canvas)
  try {
    const canvasDataUrl = canvas.toDataURL('image/png');
    // Calculamos dimensiones para ajustar en la página manteniendo ratio
    const imgWidth = pageWidth - (margin * 2); // 180mm
    const imgHeight = imgWidth * (canvas.height / canvas.width); // ~118mm
    
    // Dibujamos un borde sutil para el canvas
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin - 0.5, y - 0.5, imgWidth + 1, imgHeight + 1);
    
    // Agregamos la imagen al PDF
    doc.addImage(canvasDataUrl, 'PNG', margin, y, imgWidth, imgHeight);
    y += imgHeight + 12;
  } catch (error) {
    console.error('Error al agregar el canvas al PDF:', error);
    doc.setTextColor(255, 0, 0);
    doc.text('[Error al renderizar el plano gráfico]', margin, y);
    y += 15;
  }

  // 4. Tabla Técnica (Focos y Parcheo)
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Planilla de Parcheo y Direccionamiento', margin, y);
  y += 6;

  // Encabezados de tabla
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(240, 240, 243);
  doc.rect(margin, y, pageWidth - (margin * 2), 6, 'F');
  
  doc.text('ID', margin + 2, y + 4.5);
  doc.text('Luminaria', margin + 10, y + 4.5);
  doc.text('Dirección', margin + 65, y + 4.5);
  doc.text('Color / Gel', margin + 95, y + 4.5);
  doc.text('Intensidad', margin + 130, y + 4.5);
  doc.text('Altura', margin + 152, y + 4.5);
  doc.text('Pos (X, Y)', margin + 168, y + 4.5);
  
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setDrawColor(220, 220, 225);

  fixtures.forEach((f, idx) => {
    // Si la tabla se sale del A4, creamos una nueva página
    if (y > pageHeight - 20) {
      doc.addPage();
      y = margin;
      
      // Volvemos a dibujar cabeceras en la nueva página
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(240, 240, 243);
      doc.rect(margin, y, pageWidth - (margin * 2), 6, 'F');
      
      doc.text('ID', margin + 2, y + 4.5);
      doc.text('Luminaria', margin + 10, y + 4.5);
      doc.text('Dirección', margin + 65, y + 4.5);
      doc.text('Color / Gel', margin + 95, y + 4.5);
      doc.text('Intensidad', margin + 130, y + 4.5);
      doc.text('Altura', margin + 152, y + 4.5);
      doc.text('Pos (X, Y)', margin + 168, y + 4.5);
      
      y += 6;
      doc.setFont('helvetica', 'normal');
    }

    // Dibujamos la fila
    doc.line(margin, y, pageWidth - margin, y);
    
    // Obtener etiqueta de color/gel
    let colorLabel = f.color;
    if (f.type === 'conventional') {
      colorLabel = f.gelCode ? `${f.gelCode}` : 'Sin Gel';
    }

    doc.text(f.id.toString(), margin + 2, y + 4.5);
    doc.text(f.name || 'Genérico', margin + 10, y + 4.5);
    doc.text(translateDir(f.dir), margin + 65, y + 4.5);
    doc.text(colorLabel, margin + 95, y + 4.5);
    doc.text(`${f.intensity}%`, margin + 130, y + 4.5);
    doc.text(`${f.height.toFixed(1)}m`, margin + 152, y + 4.5);
    doc.text(`${f.sxm.toFixed(1)}m, ${f.sym.toFixed(1)}m`, margin + 168, y + 4.5);
    
    y += 6;
  });

  // Línea final de la tabla
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // 5. Objetos en escena
  if (objects.length > 0) {
    if (y > pageHeight - 30) {
      doc.addPage();
      y = margin;
    }
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Objetos y Elementos de Escena:', margin, y);
    y += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const objText = objects.map(o => `${o.type === 'persona' ? 'Persona' : 'Caja/Objeto'} (ID ${o.id}) en [${o.sxm.toFixed(1)}m, ${o.sym.toFixed(1)}m]`).join('  |  ');
    doc.text(objText, margin, y, { maxWidth: pageWidth - (margin * 2) });
  }

  // Descargar el PDF
  const filename = `${projectName.replace(/\s+/g, '_')}_ficha_tecnica.pdf`;
  doc.save(filename);
}

function translateDir(dir) {
  const dirs = {
    'frente': 'Frente',
    'contra': 'Contra (Retro)',
    'calle-izq': 'Calle Izquierda',
    'calle-der': 'Calle Derecha'
  };
  return dirs[dir] || dir;
}
