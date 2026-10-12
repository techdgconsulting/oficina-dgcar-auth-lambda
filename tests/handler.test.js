const jwt = require("jsonwebtoken");

jest.mock("../src/clientRepository", () => ({
  findClientByCpf: jest.fn()
}));

const { findClientByCpf } = require("../src/clientRepository");
const { handler } = require("../src/handler");

const jwtSecret = "01234567890123456789012345678901";

describe("auth CPF handler", () => {
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    process.env.CLIENT_JWT_SECRET = jwtSecret;
    process.env.CLIENT_JWT_ISSUER = "oficina-dgcar-auth-lambda";
    process.env.CLIENT_JWT_AUDIENCE = "oficina-dgcar-api";
    process.env.CLIENT_JWT_EXPIRES_IN = "15m";
    process.env.CLIENT_ALLOWED_STATUSES = "ATIVO";
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test("returns 400 for invalid CPF", async () => {
    const response = await handler(event({ cpf: "11111111111" }));

    expect(response.statusCode).toBe(400);
    expect(response.headers["X-Correlation-Id"]).toMatch(/[a-f0-9-]{36}/);
    expect(JSON.parse(response.body).error).toBe("CPF_INVALIDO");
    expect(findClientByCpf).not.toHaveBeenCalled();
    expect(lastLog()).toMatchObject({
      level: "warn",
      message: "auth_cpf_failed",
      cpf: "***.***.***-11",
      reason: "CPF_INVALIDO"
    });
  });

  test("returns 404 when client does not exist", async () => {
    findClientByCpf.mockResolvedValue(null);

    const response = await handler(event({ cpf: "529.982.247-25" }));

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body).error).toBe("CLIENTE_NAO_ENCONTRADO");
    expect(findClientByCpf).toHaveBeenCalledWith("52998224725");
    expect(lastLog()).toMatchObject({
      level: "warn",
      message: "auth_cpf_failed",
      cpf: "***.***.***-25",
      reason: "CLIENTE_NAO_ENCONTRADO"
    });
  });

  test("returns 403 for blocked client status", async () => {
    findClientByCpf.mockResolvedValue({
      clienteId: 10,
      status: "BLOQUEADO"
    });

    const response = await handler(event({ cpf: "529.982.247-25" }));

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body).error).toBe("CLIENTE_SEM_ACESSO");
    expect(lastLog()).toMatchObject({
      level: "warn",
      message: "auth_cpf_failed",
      cpf: "***.***.***-25",
      reason: "CLIENTE_SEM_ACESSO",
      status: "BLOQUEADO"
    });
  });

  test("returns client JWT with external claims", async () => {
    findClientByCpf.mockResolvedValue({
      clienteId: 10,
      status: "ATIVO"
    });

    const response = await handler(event({ cpf: "529.982.247-25" }));
    const body = JSON.parse(response.body);
    const decoded = jwt.verify(body.accessToken, jwtSecret, {
      issuer: "oficina-dgcar-auth-lambda",
      audience: "oficina-dgcar-api"
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["X-Correlation-Id"]).toMatch(/[a-f0-9-]{36}/);
    expect(body.tokenType).toBe("Bearer");
    expect(decoded.sub).toBe("52998224725");
    expect(decoded.clienteId).toBe("10");
    expect(decoded.tipo).toBe("CLIENTE");
    expect(decoded.status).toBe("ATIVO");
    expect(decoded.role).toBeUndefined();
    expect(decoded.perfis).toBeUndefined();
    expect(lastLog()).toMatchObject({
      level: "info",
      message: "auth_cpf_success",
      cpf: "***.***.***-25",
      clienteId: 10,
      status: "ATIVO"
    });
  });

  test("returns 400 for malformed JSON", async () => {
    const response = await handler({
      headers: {
        "x-correlation-id": "corr-malformed-json"
      },
      body: "{invalid-json"
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["X-Correlation-Id"]).toBe("corr-malformed-json");
    expect(JSON.parse(response.body).error).toBe("JSON_INVALIDO");
    expect(lastLog()).toMatchObject({
      level: "warn",
      message: "auth_cpf_failed",
      correlationId: "corr-malformed-json",
      reason: "JSON_INVALIDO"
    });
  });

  test("keeps incoming correlation id in response and logs", async () => {
    findClientByCpf.mockResolvedValue({
      clienteId: 10,
      status: "ATIVO"
    });

    const response = await handler(event(
      { cpf: "529.982.247-25" },
      { "X-Correlation-Id": "corr-123" }
    ));

    expect(response.statusCode).toBe(200);
    expect(response.headers["X-Correlation-Id"]).toBe("corr-123");
    expect(lastLog()).toMatchObject({
      message: "auth_cpf_success",
      correlationId: "corr-123",
      cpf: "***.***.***-25"
    });
  });

  test("logs configuration error without leaking CPF", async () => {
    delete process.env.CLIENT_JWT_SECRET;
    findClientByCpf.mockResolvedValue({
      clienteId: 10,
      status: "ATIVO"
    });

    const response = await handler(event(
      { cpf: "529.982.247-25" },
      { "X-Correlation-Id": "corr-config" }
    ));

    expect(response.statusCode).toBe(500);
    expect(lastError()).toMatchObject({
      level: "error",
      message: "auth_cpf_lambda_failure",
      correlationId: "corr-config",
      cpf: "***.***.***-25",
      errorType: "CONFIGURACAO"
    });
    expect(errorSpy.mock.calls[0][0]).not.toContain("52998224725");
  });
});

function event(body, headers = {}) {
  return {
    version: "2.0",
    routeKey: "POST /auth/cpf",
    headers,
    body: JSON.stringify(body),
    isBase64Encoded: false
  };
}

function lastLog() {
  const calls = console.log.mock.calls;
  return JSON.parse(calls[calls.length - 1][0]);
}

function lastError() {
  const calls = console.error.mock.calls;
  return JSON.parse(calls[calls.length - 1][0]);
}
