const bcrypt = require("bcryptjs");
const { isValidCpf, normalizeCpf } = require("./cpf");
const { findClientByCpf } = require("./clientRepository");
const { createClientToken } = require("./tokenService");
const { jsonResponse, parseJsonBody } = require("./http");
const {
  CORRELATION_HEADER,
  logError,
  logInfo,
  logWarn,
  maskCpf,
  resolveCorrelationId
} = require("./observability");

async function handler(event) {
  const correlationId = resolveCorrelationId(event);
  const response = (statusCode, body) => jsonResponse(statusCode, body, {
    [CORRELATION_HEADER]: correlationId
  });
  let maskedCpf = "NAO_INFORMADO";

  try {
    const payload = parseJsonBody(event);
    const cpf = normalizeCpf(payload.cpf);
    const senha = typeof payload.senha === "string" ? payload.senha : "";
    maskedCpf = maskCpf(cpf);

    if (!isValidCpf(cpf)) {
      logWarn("auth_cpf_failed", {
        correlationId,
        cpf: maskedCpf,
        reason: "CPF_INVALIDO"
      });
      return response(400, {
        error: "CPF_INVALIDO",
        message: "CPF informado e invalido."
      });
    }

    if (!senha.trim()) {
      logWarn("auth_cpf_failed", {
        correlationId,
        cpf: maskedCpf,
        reason: "SENHA_OBRIGATORIA"
      });
      return response(400, {
        error: "SENHA_OBRIGATORIA",
        message: "Senha obrigatoria para autenticacao do cliente."
      });
    }

    const client = await findClientByCpf(cpf);
    if (!client) {
      logWarn("auth_cpf_failed", {
        correlationId,
        cpf: maskedCpf,
        reason: "CLIENTE_NAO_ENCONTRADO"
      });
      return response(404, {
        error: "CLIENTE_NAO_ENCONTRADO",
        message: "Cliente nao encontrado para o CPF informado."
      });
    }

    if (!client.senhaHash || !(await bcrypt.compare(senha, client.senhaHash))) {
      logWarn("auth_cpf_failed", {
        correlationId,
        cpf: maskedCpf,
        clienteId: client.clienteId,
        reason: "CREDENCIAIS_INVALIDAS"
      });
      return response(401, {
        error: "CREDENCIAIS_INVALIDAS",
        message: "CPF ou senha invalidos."
      });
    }

    const status = String(client.status || "").toUpperCase();
    const allowedStatuses = parseAllowedStatuses();

    if (!allowedStatuses.has(status)) {
      logWarn("auth_cpf_failed", {
        correlationId,
        cpf: maskedCpf,
        clienteId: client.clienteId,
        reason: "CLIENTE_SEM_ACESSO",
        status
      });
      return response(403, {
        error: "CLIENTE_SEM_ACESSO",
        message: "Cliente nao possui status permitido para autenticacao.",
        status
      });
    }

    const token = createClientToken(
      {
        clienteId: client.clienteId,
        status
      },
      cpf
    );

    logInfo("auth_cpf_success", {
      correlationId,
      cpf: maskedCpf,
      clienteId: client.clienteId,
      status
    });

    return response(200, {
      tokenType: "Bearer",
      accessToken: token,
      expiresIn: process.env.CLIENT_JWT_EXPIRES_IN || "15m"
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      logWarn("auth_cpf_failed", {
        correlationId,
        cpf: maskedCpf,
        reason: "JSON_INVALIDO"
      });
      return response(400, {
        error: "JSON_INVALIDO",
        message: "Corpo da requisicao deve ser um JSON valido."
      });
    }

    logError("auth_cpf_lambda_failure", error, {
      correlationId,
      cpf: maskedCpf
    });

    return response(500, {
      error: "ERRO_INTERNO",
      message: "Nao foi possivel autenticar o cliente."
    });
  }
}

function parseAllowedStatuses() {
  return new Set(
    (process.env.CLIENT_ALLOWED_STATUSES || "ATIVO")
      .split(",")
      .map((status) => status.trim().toUpperCase())
      .filter(Boolean)
  );
}

module.exports = {
  handler,
  parseAllowedStatuses
};
