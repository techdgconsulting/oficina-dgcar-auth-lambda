const crypto = require("crypto");

const CORRELATION_HEADER = "X-Correlation-Id";

function resolveCorrelationId(event) {
  const headerValue = getHeader(event?.headers, CORRELATION_HEADER)
    || getHeader(event?.headers, "X-Request-Id");

  if (isValidCorrelationId(headerValue)) {
    return headerValue;
  }

  return crypto.randomUUID();
}

function maskCpf(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 11) {
    return "NAO_INFORMADO";
  }

  return `***.***.***-${digits.slice(-2)}`;
}

function logInfo(message, attributes = {}) {
  writeLog("info", message, attributes);
}

function logWarn(message, attributes = {}) {
  writeLog("warn", message, attributes);
}

function logError(message, error, attributes = {}) {
  writeLog("error", message, {
    ...attributes,
    errorType: classifyError(error),
    errorName: error?.name,
    errorMessage: error?.message
  });
}

function classifyError(error) {
  const message = String(error?.message || "");
  const name = String(error?.name || "");

  if (message.includes("Missing required environment variable")
      || message.includes("CLIENT_JWT_SECRET")
      || message.includes("Invalid SQL identifier")) {
    return "CONFIGURACAO";
  }

  if (name.includes("JsonWebToken") || name.includes("Token") || message.toLowerCase().includes("jwt")) {
    return "TOKEN";
  }

  if (error?.code || name.includes("Database") || name.includes("Postgres") || name.includes("Timeout")) {
    return "BANCO";
  }

  return "ERRO_INTERNO";
}

function writeLog(level, message, attributes) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: "oficina-dgcar-auth-lambda",
    ...attributes
  };

  const output = JSON.stringify(entry);
  if (level === "error") {
    console.error(output);
    return;
  }

  console.log(output);
}

function getHeader(headers = {}, name) {
  const expected = name.toLowerCase();
  const key = Object.keys(headers || {}).find((headerName) => headerName.toLowerCase() === expected);
  return key ? headers[key] : undefined;
}

function isValidCorrelationId(value) {
  return typeof value === "string"
    && /^[a-zA-Z0-9._:-]{1,128}$/.test(value);
}

module.exports = {
  CORRELATION_HEADER,
  classifyError,
  logError,
  logInfo,
  logWarn,
  maskCpf,
  resolveCorrelationId
};
