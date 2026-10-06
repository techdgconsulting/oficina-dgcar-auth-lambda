const { isValidCpf, normalizeCpf } = require("./cpf");
const { findClientByCpf } = require("./clientRepository");
const { verifyPassword } = require("./passwordService");
const { createClientToken } = require("./tokenService");
const { jsonResponse, parseJsonBody } = require("./http");

async function handler(event) {
  try {
    const payload = parseJsonBody(event);
    const cpf = normalizeCpf(payload.cpf);
    const senha = payload.senha;

    if (!isValidCpf(cpf)) {
      return jsonResponse(400, {
        error: "CPF_INVALIDO",
        message: "CPF informado e invalido."
      });
    }

    if (!senha || typeof senha !== "string") {
      return jsonResponse(400, {
        error: "SENHA_OBRIGATORIA",
        message: "Senha do cliente e obrigatoria."
      });
    }

    const client = await findClientByCpf(cpf);
    if (!client) {
      return jsonResponse(404, {
        error: "CLIENTE_NAO_ENCONTRADO",
        message: "Cliente nao encontrado para o CPF informado."
      });
    }

    const passwordMatches = await verifyPassword(senha, client.passwordHash);
    if (!passwordMatches) {
      return jsonResponse(401, {
        error: "CREDENCIAIS_INVALIDAS",
        message: "CPF ou senha invalidos."
      });
    }

    const status = String(client.status || "").toUpperCase();
    const allowedStatuses = parseAllowedStatuses();

    if (!allowedStatuses.has(status)) {
      return jsonResponse(403, {
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

    return jsonResponse(200, {
      tokenType: "Bearer",
      accessToken: token,
      expiresIn: process.env.CLIENT_JWT_EXPIRES_IN || "15m"
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonResponse(400, {
        error: "JSON_INVALIDO",
        message: "Corpo da requisicao deve ser um JSON valido."
      });
    }

    console.error(JSON.stringify({
      level: "error",
      message: "auth_cpf_lambda_failure",
      error: error.message
    }));

    return jsonResponse(500, {
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
