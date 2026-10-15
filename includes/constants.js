/**
 * Constantes del proyecto Dataform - PreStaff Sandbox
 * Proyecto GCP: belen-torres-sandbox1
 */

const PROJECT_ID = "belen-torres-sandbox1";

const SCHEMAS = {
  RAW: dataform.projectConfig.vars.drive_dataset || dataform.projectConfig.vars.raw_dataset || "bq_drive_euw1",
  DRIVE: dataform.projectConfig.vars.drive_dataset || dataform.projectConfig.vars.raw_dataset || "bq_drive_euw1",
  BRONZE: dataform.projectConfig.vars.bronze_dataset || "bq_bronze_euw1",
  SILVER: dataform.projectConfig.vars.silver_dataset || "bq_silver_euw1",
  GOLD: dataform.projectConfig.vars.gold_dataset || "bq_gold_euw1",
  ASSERTIONS: dataform.projectConfig.vars.assertions_dataset || "bq_assertions_euw1"
};

const DRIVE_CONFIG = {
  FOLDER_ID: dataform.projectConfig.vars.drive_folder_id || "1Wc7Nc1EOnzZP0ZNXyTFwWCAYrG4E77i8",
  FOLDER_URL: "https://drive.google.com/drive/folders/1Wc7Nc1EOnzZP0ZNXyTFwWCAYrG4E77i8",
  DEFAULT_FILE_ID: dataform.projectConfig.vars.drive_file_id || "default_file_id_placeholder",
  DEFAULT_FILE_NAME: dataform.projectConfig.vars.drive_file_name || "drive_raw_input",
  FILE_TYPE: dataform.projectConfig.vars.drive_file_type || "GOOGLE_SHEETS",
  SKIP_LEADING_ROWS: Number(dataform.projectConfig.vars.sheet_skip_leading_rows || 1)
};

const STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED"
};

const TAGS = {
  PROCESO_PRESTAFF: "proceso_prestaff",
  PRESTAFF: "prestaff",
  ABSENTISMO: "absentismo",
  MEDIOAMBIENTE: "medioambiente"
};

module.exports = {
  PROJECT_ID,
  SCHEMAS,
  DRIVE_CONFIG,
  STATUS,
  TAGS
};
