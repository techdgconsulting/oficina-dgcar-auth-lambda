const jwt = require("jsonwebtoken");

jest.mock("../src/clientRepository", () => ({
  findClientByCpf: jest.fn()
}));

const { findClientByCpf } = require("../src/clientRepository");
const { handler } = require("../src/handler");

const jwtSecret = "01234567890123456789012345678901";

describe("auth CPF handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CLIENT_JWT_SECRET = jwtSecret;
    process.env.CLIENT_JWT_ISSUER = "oficina-dgcar-auth-lambda";
    process.env.CLIENT_JWT_AUDIENCE = "oficina-dgcar-api";
    process.env.CLIENT_JWT_EXPIRES_IN = "15m";
    process.env.CLIENT_ALLOWED_STATUSES = "ATIVO";
  });

  test("returns 400 for invalid CPF", async () => {
    const response = await handler(event({ cpf: "11111111111" }));

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toBe("CPF_INVALIDO");
    expect(findClientByCpf).not.toHaveBeenCalled();
  });

  test("returns 404 when client does not exist", async () => {
    findClientByCpf.mockResolvedValue(null);

    const response = await handler(event({ cpf: "529.982.247-25" }));

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body).error).toBe("CLIENTE_NAO_ENCONTRADO");
    expect(findClientByCpf).toHaveBeenCalledWith("52998224725");
  });

  test("returns 403 for blocked client status", async () => {
    findClientByCpf.mockResolvedValue({
      clienteId: 10,
      status: "BLOQUEADO"
    });

    const response = await handler(event({ cpf: "529.982.247-25" }));

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body).error).toBe("CLIENTE_SEM_ACESSO");
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
    expect(body.tokenType).toBe("Bearer");
    expect(decoded.sub).toBe("52998224725");
    expect(decoded.clienteId).toBe("10");
    expect(decoded.tipo).toBe("CLIENTE");
    expect(decoded.status).toBe("ATIVO");
    expect(decoded.role).toBeUndefined();
    expect(decoded.perfis).toBeUndefined();
  });

  test("returns 400 for malformed JSON", async () => {
    const response = await handler({
      body: "{invalid-json"
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toBe("JSON_INVALIDO");
  });
});

function event(body) {
  return {
    version: "2.0",
    routeKey: "POST /auth/cpf",
    body: JSON.stringify(body),
    isBase64Encoded: false
  };
}
