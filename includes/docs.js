/**
 * Diccionario centralizado de documentación y descripciones de columnas
 */

const columns = {
  // Identificadores y Claves
  record_id: "Identificador único o clave de negocio del registro",
  record_sk: "Surrogate Key (clave subrogada) hash SHA-256 generada deterministamente",
  
  // Datos descriptivos y categorización
  category: "Categoría o tipo de clasificación del registro de datos",
  status: "Estado del registro o entidad (ACTIVE, INACTIVE, etc.)",
  description: "Descripción o texto de detalle asociado al registro",
  
  // Métricas y fechas
  metric_value: "Valor numérico o métrica cuantificada del registro",
  event_date: "Fecha asociada al evento u operación registrada",
  event_timestamp: "Timestamp exacto en que ocurrió el evento u operación",

  // Metadatos de auditoría y procedencia (Drive)
  _source_file_id: "ID único de Google Drive del fichero origen procesado",
  _source_file_name: "Nombre del fichero de Google Drive procesado según parámetros enviados por Apps Script",
  _dw_loaded_at: "Timestamp en UTC del momento de inserción y procesamiento en BigQuery por Dataform",
  _dw_loaded_by: "Cuenta de servicio o usuario que ejecutó la invocación de Dataform"
};

module.exports = {
  columns
};
