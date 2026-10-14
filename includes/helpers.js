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
 * Genera columnas de auditoría estándar, permitiendo conservar los metadatos de fichero por fila o inferirlos del tag.
 *
 * @param {boolean|string} tagOrPreserve - Si es true, usa los campos existentes en la fila; si es string (tag), busca el fichero asignado; de lo contrario usa vars globales.
 * @returns {string} Fragmento SQL con columnas de auditoría
 */
function auditColumns(tagOrPreserve = false) {
  if (tagOrPreserve === true) {
    return `
      CURRENT_TIMESTAMP() AS _dw_loaded_at,
      SESSION_USER() AS _dw_loaded_by,
      file_id,
      file_name,
      _source_file_id,
      _source_file_name
    `;
  }
  let fileId = dataform.projectConfig.vars.drive_file_id || "";
  let fileName = dataform.projectConfig.vars.drive_file_name || "";
  if (typeof tagOrPreserve === "string") {
    const tagFiles = getFilesForTag(tagOrPreserve);
    if (tagFiles.length > 0) {
      fileId = fileId || tagFiles[0].id;
      fileName = fileName || tagFiles[0].name;
    }
  }
  fileId = fileId || "unknown";
  fileName = fileName || "unknown";
  return `
    CURRENT_TIMESTAMP() AS _dw_loaded_at,
    SESSION_USER() AS _dw_loaded_by,
    '${fileId}' AS file_id,
    '${fileName}' AS file_name,
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
 * Soporta tanto `archivos_json` como `csv_files_json`.
 * Si no se especifica active_tag, filtra automáticamente por el nombre del archivo.
 *
 * @param {string} targetTag - Tag de proceso esperado (ej: "prestaff", "absentismo", "medioambiente")
 * @returns {Array<{id: string, name: string}>} Lista de ficheros a compilar
 */
function getFilesForTag(targetTag) {
  const activeTag = dataform.projectConfig.vars.active_tag ||
                    dataform.projectConfig.vars.tag ||
                    dataform.projectConfig.vars.tags ||
                    "";
  if (activeTag && activeTag !== targetTag) {
    return [];
  }

  let fileList = [];
  try {
    const raw = dataform.projectConfig.vars.archivos_json ||
                dataform.projectConfig.vars.csv_files_json ||
                "[]";
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed) && parsed.length > 0) {
      fileList = parsed.map(item => {
        if (typeof item === "string") {
          return { id: item, name: item };
        }
        return {
          id: item.id || item.fileId || item.id_fichero || item.file_id || "",
          name: item.name || item.nombre || item.fileName || item.nombre_fichero || item.file_name || item.id || ""
        };
      }).filter(f => Boolean(f.id));
    }
  } catch (e) {
    // Si falla el parseo JSON
  }

  if (fileList.length > 0) {
    const tagPatterns = {
      prestaff: /prestaff|pre_staff/i,
      absentismo: /absentismo|bajas_laborales|absenteeism/i,
      medioambiente: /soluciones_medioambientales|medioambiente|medio_ambiente/i
    };

    const pattern = tagPatterns[targetTag] || new RegExp(targetTag, "i");
    const matchedFiles = fileList.filter(f => pattern.test(f.name));

    if (matchedFiles.length > 0) {
      return matchedFiles;
    }

    if (activeTag && activeTag === targetTag) {
      return fileList;
    }

    return [];
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

/**
 * Devuelve la lista formateada en SQL ('file1.csv', 'file2.csv') de nombres de archivos para un tag.
 * Si no hay archivos, devuelve "''".
 *
 * @param {string} targetTag - Tag de proceso esperado
 * @returns {string} Fragmento SQL de nombres de archivo entre comillas simples
 */
function getFileNamesSqlList(targetTag) {
  const files = getFilesForTag(targetTag);
  if (!files || files.length === 0) {
    return "''";
  }
  return files.map(f => `'${f.name.replace(/'/g, "\\'")}'`).join(", ");
}

/**
 * Indica si hay archivos asignados al tag dado.
 *
 * @param {string} targetTag
 * @returns {boolean}
 */
function hasFilesForTag(targetTag) {
  return getFilesForTag(targetTag).length > 0;
}

module.exports = {
  surrogateKey,
  auditColumns,
  cleanString,
  driveUri,
  getFilesForTag,
  getFileNamesSqlList,
  hasFilesForTag
};
