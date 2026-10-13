/**
 * Google Apps Script: Orquestador inteligente de invocación a Google Cloud Dataform
 * 
 * Funcionalidad:
 * 1. Escanea la carpeta compartida de Google Drive en busca de ficheros CSV.
 * 2. Mapea el nombre de cada fichero contra los procesos de negocio definidos (ej: prezero_*, absentismo_*).
 * 3. Para cada proceso con ficheros detectados, crea un CompilationResult en Dataform con los IDs/Nombres.
 * 4. Invoca la ejecución del pipeline filtrando EXCLUSIVAMENTE por el tag correspondiente (invocationConfig.includedTags).
 * 
 * Configuración en GCP:
 * - Proyecto: belen-torres-sandbox1
 * - Región: europe-west1
 * - Repositorio: dataform-preZero
 * - Scope en appsscript.json: "https://www.googleapis.com/auth/cloud-platform"
 */

const CONFIG = {
  PROJECT_ID: "belen-torres-sandbox1",
  LOCATION: "europe-west1",
  REPOSITORY_ID: "dataform-preZero",
  DRIVE_FOLDER_ID: "1Wc7Nc1EOnzZP0ZNXyTFwWCAYrG4E77i8",
  DRIVE_FOLDER_URL: "https://drive.google.com/drive/folders/1Wc7Nc1EOnzZP0ZNXyTFwWCAYrG4E77i8",
  DATAFORM_API_BASE: "https://dataform.googleapis.com/v1beta1"
};

/**
 * Mapeo de nombres de fichero a Tags de Dataform
 * Puedes agregar nuevos procesos simplemente añadiendo una entrada a esta lista.
 */
const PROCESS_MAPPING = [
  {
    tag: "prezero",
    regex: /^prezero/i,
    name: "Operaciones PreZero (pesajes, plantas, residuos)"
  },
  {
    tag: "absentismo",
    regex: /^absentismo/i,
    name: "Recursos Humanos (absentismo y bajas laborales)"
  },
  {
    tag: "medioambiente",
    regex: /^soluciones_medioambientales/i,
    name: "Soluciones Medioambientales (proyectos, CO2, huella de carbono)"
  }
];

/**
 * Función principal: detecta CSVs, clasifica por proceso y dispara Dataform por Tag
 */
function processDriveFolder() {
  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const files = folder.getFiles();

  // Agrupador de ficheros por tag: { "prezero": [...], "absentismo": [...] }
  const filesByTag = {};
  PROCESS_MAPPING.forEach(proc => {
    filesByTag[proc.tag] = [];
  });
  const unmappedFiles = [];

  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();
    const fileId = file.getId();

    // Solo procesar archivos CSV
    if (!fileName.toLowerCase().endsWith(".csv")) {
      continue;
    }

    let matched = false;
    for (const proc of PROCESS_MAPPING) {
      if (proc.regex.test(fileName)) {
        filesByTag[proc.tag].push({
          id: fileId,
          name: fileName
        });
        Logger.log(`[${proc.tag}] Archivo clasificado: ${fileName} (${fileId})`);
        matched = true;
        break;
      }
    }

    if (!matched) {
      unmappedFiles.push(fileName);
      Logger.log(`[AVISO] Archivo sin proceso asignado: ${fileName}`);
    }
  }

  // Ejecutar el pipeline de Dataform para cada proceso que tenga ficheros
  for (const proc of PROCESS_MAPPING) {
    const tag = proc.tag;
    const fileList = filesByTag[tag];

    if (fileList.length === 0) {
      Logger.log(`[${tag}] No hay archivos CSV pendientes para este proceso. Omitiendo.`);
      continue;
    }

    Logger.log(`=== Iniciando pipeline para Tag [${tag}] con ${fileList.length} fichero(s) ===`);

    try {
      // 1. Crear compilación con variables específicas para este tag y sus ficheros
      const compilationResultName = createCompilation(tag, fileList);
      Logger.log(`[${tag}] Compilación creada: ${compilationResultName}`);

      // 2. Invocar Dataform filtrando por el tag del proceso
      const invocationName = executeWorkflowForTag(compilationResultName, tag);
      Logger.log(`[${tag}] Invocación iniciada exitosamente: ${invocationName}`);

    } catch (err) {
      Logger.log(`[${tag}] ERROR al ejecutar Dataform: ${err.toString()}`);
    }
  }

  if (unmappedFiles.length > 0) {
    Logger.log(`Archivos no procesados por falta de regla de mapeo: ${unmappedFiles.join(", ")}`);
  }
}

/**
 * Crea la compilación en Dataform pasando active_tag y csv_files_json en vars
 */
function createCompilation(tag, fileList) {
  const url = `${CONFIG.DATAFORM_API_BASE}/projects/${CONFIG.PROJECT_ID}/locations/${CONFIG.LOCATION}/repositories/${CONFIG.REPOSITORY_ID}/compilationResults`;

  const payload = {
    gitCommitish: "main",
    codeCompilationConfig: {
      vars: {
        active_tag: tag,
        csv_files_json: JSON.stringify(fileList),
        raw_dataset: "bq_stg_euw1",
        bronze_dataset: "bq_bronze_euw1",
        silver_dataset: "bq_silver_euw1",
        gold_dataset: "bq_gold_euw1",
        assertions_dataset: "bq_assertions_euw1"
      }
    }
  };

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${ScriptApp.getOAuthToken()}`
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const statusCode = response.getResponseCode();
  const data = JSON.parse(response.getContentText());

  if (statusCode !== 200 && statusCode !== 201) {
    throw new Error(`Error en compilationResults.create (${statusCode}): ${JSON.stringify(data)}`);
  }

  return data.name;
}

/**
 * Invoca Dataform ejecutando ÚNICAMENTE las acciones con el tag indicado
 */
function executeWorkflowForTag(compilationResultName, tag) {
  const url = `${CONFIG.DATAFORM_API_BASE}/projects/${CONFIG.PROJECT_ID}/locations/${CONFIG.LOCATION}/repositories/${CONFIG.REPOSITORY_ID}/workflowInvocations`;

  const payload = {
    compilationResult: compilationResultName,
    invocationConfig: {
      includedTags: [tag],
      transitiveDependenciesIncluded: true,
      transitiveDependentsIncluded: true
    }
  };

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${ScriptApp.getOAuthToken()}`
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const statusCode = response.getResponseCode();
  const data = JSON.parse(response.getContentText());

  if (statusCode !== 200 && statusCode !== 201) {
    throw new Error(`Error en workflowInvocations.create (${statusCode}): ${JSON.stringify(data)}`);
  }

  return data.name;
}
