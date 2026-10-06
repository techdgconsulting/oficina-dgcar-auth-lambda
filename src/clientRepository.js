const { Pool } = require("pg");

const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      host: requiredEnv("DB_HOST"),
      port: Number(process.env.DB_PORT || 5432),
      database: requiredEnv("DB_NAME"),
      user: requiredEnv("DB_USERNAME"),
      password: requiredEnv("DB_PASSWORD"),
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
      max: Number(process.env.DB_POOL_MAX || 2),
      idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 10000)
    });
  }

  return pool;
}

async function findClientByCpf(cpf) {
  const table = sqlIdentifier(process.env.CLIENT_TABLE || "clientes");
  const idColumn = sqlIdentifier(process.env.CLIENT_ID_COLUMN || "id");
  const documentColumn = sqlIdentifier(process.env.CLIENT_DOCUMENT_COLUMN || "documento");
  const statusColumn = optionalSqlIdentifier(process.env.CLIENT_STATUS_COLUMN);
  const passwordHashColumn = sqlIdentifier(process.env.CLIENT_PASSWORD_HASH_COLUMN || "senha_hash");
  const defaultStatus = process.env.CLIENT_DEFAULT_STATUS || "ATIVO";

  const statusExpression = statusColumn ? statusColumn : "$2::text";
  const params = statusColumn ? [cpf] : [cpf, defaultStatus];

  const query = `
    select
      ${idColumn} as "clienteId",
      ${documentColumn} as "documento",
      ${statusExpression} as "status",
      ${passwordHashColumn} as "passwordHash"
    from ${table}
    where regexp_replace(${documentColumn}, '\\D', '', 'g') = $1
    limit 1
  `;

  const result = await getPool().query(query, params);
  return result.rows[0] || null;
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalSqlIdentifier(identifier) {
  if (!identifier) {
    return null;
  }
  return sqlIdentifier(identifier);
}

function sqlIdentifier(identifier) {
  if (!IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error(`Invalid SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

module.exports = {
  findClientByCpf,
  closePool
};
