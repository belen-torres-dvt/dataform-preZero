/**
 * Funciones de utilidad y macros para transformaciones en Dataform
 */

/**
 * Genera un Surrogate Key determinista mediante SHA256 combinando las columnas dadas.
 * Maneja valores nulos de forma segura reemplazándolos con '_null_'.
 *
 * @param {string[]} columns - Lista de nombres de columnas a concatenar.
 * @returns {string} Fragmento SQL con TO_HEX(SHA256(...))
 */
function surrogateKey(columns) {
  if (!columns || columns.length === 0) {
    throw new Error("surrogateKey requiere al menos un nombre de columna");
  }
  const concatParts = columns
    .map(col => `COALESCE(CAST(${col} AS STRING), '_null_')`)
    .join(", '||', ");
  return `TO_HEX(SHA256(CONCAT(${concatParts})))`;
}

/**
 * Genera columnas de auditoría estándar, permitiendo conservar los metadatos de fichero por fila.
 *
 * @param {boolean} preserveRowMetadata - Si es true, usa los campos _source_file_id y _source_file_name de la fila
 * @returns {string} Fragmento SQL con columnas de auditoría
 */
function auditColumns(preserveRowMetadata = false) {
  if (preserveRowMetadata) {
    return `
      CURRENT_TIMESTAMP() AS _dw_loaded_at,
      SESSION_USER() AS _dw_loaded_by,
      _source_file_id,
      _source_file_name
    `;
  }
  const fileId = dataform.projectConfig.vars.drive_file_id || "unknown";
  const fileName = dataform.projectConfig.vars.drive_file_name || "unknown";
  return `
    CURRENT_TIMESTAMP() AS _dw_loaded_at,
    SESSION_USER() AS _dw_loaded_by,
    '${fileId}' AS _source_file_id,
    '${fileName}' AS _source_file_name
  `;
}

/**
 * Limpia y normaliza cadenas de texto (TRIM y conversión de '' a NULL).
 *
 * @param {string} col - Expresión o nombre de columna
 * @returns {string} Fragmento SQL con NULLIF(TRIM(...), '')
 */
function cleanString(col) {
  return `NULLIF(TRIM(CAST(${col} AS STRING)), '')`;
}

/**
 * Construye el URI de Google Drive compatible con BigQuery External Tables.
 *
 * @param {string} fileId - ID del fichero en Google Drive
 * @param {string} fileType - Tipo de fichero ("GOOGLE_SHEETS" o "CSV")
 * @returns {string} URL formateada para BigQuery OPTIONS (uris=[...])
 */
function driveUri(fileId, fileType = "CSV") {
  if (fileType === "GOOGLE_SHEETS") {
    return `https://docs.google.com/spreadsheets/d/${fileId}`;
  }
  return `https://drive.google.com/open?id=${fileId}`;
}

/**
 * Obtiene la lista de ficheros CSV asignados a un tag de negocio específico.
 * Si active_tag está definido y no coincide con targetTag, retorna lista vacía para no procesar datos cruzados.
 *
 * @param {string} targetTag - Tag de proceso esperado (ej: "prezero", "absentismo")
 * @returns {Array<{id: string, name: string}>} Lista de ficheros a compilar
 */
function getFilesForTag(targetTag) {
  const activeTag = dataform.projectConfig.vars.active_tag || "";
  if (activeTag && activeTag !== targetTag) {
    return [];
  }
  try {
    const raw = dataform.projectConfig.vars.csv_files_json || "[]";
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (e) {
    // Si falla el parseo, se evalúa si hay un único fichero en las variables individuales
  }

  const driveFileId = dataform.projectConfig.vars.drive_file_id || "";
  if (driveFileId && driveFileId !== "default_file_id_placeholder" && (!activeTag || activeTag === targetTag)) {
    return [{
      id: driveFileId,
      name: dataform.projectConfig.vars.drive_file_name || `${targetTag}_sample.csv`
    }];
  }

  return [];
}

module.exports = {
  surrogateKey,
  auditColumns,
  cleanString,
  driveUri,
  getFilesForTag
};
