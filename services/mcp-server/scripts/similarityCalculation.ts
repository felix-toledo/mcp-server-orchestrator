// Función para normalizar texto (sin tildes, mayúsculas, caracteres especiales)
function normalizarTexto(texto: string): string {
  return texto
    .toUpperCase()
    .normalize('NFD') // Descomponer caracteres con tildes
    .replace(/[\u0300-\u036f]/g, '') // Remover tildes y diacríticos
    .replace(/[^A-Z0-9\s]/g, '') // Solo letras, números y espacios
    .trim();
}

// Función para separar y normalizar nombres
function separarNombreApellido(nombreCompleto: string) {
  // Limpiar comillas y espacios extra
  const nombreLimpio = nombreCompleto.replace(/"/g, '').trim();

  // Ejemplo: "Gómez, Maria Margarita"
  const partes = nombreLimpio.split(',');

  if (partes.length !== 2) {
    return { apellidos: [], nombres: [] };
  }

  const apellidos = partes[0]
    .trim()
    .split(' ')
    .map((a) => normalizarTexto(a))
    .filter((a) => a.length > 0);
  const nombres = partes[1]
    .trim()
    .split(' ')
    .map((n) => normalizarTexto(n))
    .filter((n) => n.length > 0);

  return { apellidos, nombres };
}

// Función para calcular similitud entre dos palabras
function calcularSimilitud(palabra1: string, palabra2: string): number {
  if (palabra1 === palabra2) return 1.0; // 100% iguales

  const len1 = palabra1.length;
  const len2 = palabra2.length;

  // Si una palabra es muy corta, ser más estricto
  if (len1 <= 2 || len2 <= 2) {
    return palabra1 === palabra2 ? 1.0 : 0.0;
  }

  // Calcular distancia de Levenshtein
  const matriz = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matriz[i][0] = i;
  for (let j = 0; j <= len2; j++) matriz[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const costo = palabra1[i - 1] === palabra2[j - 1] ? 0 : 1;
      matriz[i][j] = Math.min(
        matriz[i - 1][j] + 1, // eliminación
        matriz[i][j - 1] + 1, // inserción
        matriz[i - 1][j - 1] + costo, // sustitución
      );
    }
  }

  const distancia = matriz[len1][len2];
  const maxLen = Math.max(len1, len2);
  const similitud = 1 - distancia / maxLen;

  return similitud;
}

// Función para verificar si dos palabras son similares
function palabrasSimilares(palabra1: string, palabra2: string, umbral: number = 0.5): boolean {
  const similitud = calcularSimilitud(palabra1, palabra2);
  console.log(`🔍 Similitud "${palabra1}" vs "${palabra2}": ${(similitud * 100).toFixed(1)}%`);
  return similitud >= umbral;
}

// Función para validar coincidencia de persona
function validarCoincidenciaPersona(
  nombreCSV: string,
  apellidoTabla: string,
  nombreTabla: string,
): boolean {
  const { apellidos: apellidosCSV, nombres: nombresCSV } = separarNombreApellido(nombreCSV);

  // Normalizar datos de la tabla
  const apellidosTabla = normalizarTexto(apellidoTabla)
    .split(' ')
    .filter((a) => a.length > 0);
  const nombresTabla = normalizarTexto(nombreTabla)
    .split(' ')
    .filter((n) => n.length > 0);

  console.log(`\n🔍 VALIDANDO SIMILITUD:`);
  console.log(`📝 CSV: "${nombreCSV}"`);
  console.log(`📋 Tabla: "${apellidoTabla} ${nombreTabla}"`);
  console.log(
    `📝 CSV - Apellidos: [${apellidosCSV.join(', ')}] | Nombres: [${nombresCSV.join(', ')}]`,
  );
  console.log(
    `📋 Tabla - Apellidos: [${apellidosTabla.join(', ')}] | Nombres: [${nombresTabla.join(', ')}]`,
  );

  // Verificar que al menos uno de los apellidos coincida (umbral más bajo)
  const apellidoCoincide = apellidosCSV.some((apellidoCSV) =>
    apellidosTabla.some(
      (apellidoTabla) => palabrasSimilares(apellidoCSV, apellidoTabla, 0.5), // Umbral más permisivo
    ),
  );

  // Verificar que al menos uno de los nombres coincida (umbral más bajo)
  const nombreCoincide = nombresCSV.some((nombreCSV) =>
    nombresTabla.some(
      (nombreTabla) => palabrasSimilares(nombreCSV, nombreTabla, 0.5), // Umbral más permisivo
    ),
  );

  console.log(
    `✅ RESULTADO: Apellido coincide: ${apellidoCoincide} | Nombre coincide: ${nombreCoincide}`,
  );
  console.log(
    `🎯 VALIDACIÓN: ${apellidoCoincide && nombreCoincide ? 'PERSONA CORRECTA' : 'PERSONA INCORRECTO'}\n`,
  );

  return apellidoCoincide && nombreCoincide;
}
