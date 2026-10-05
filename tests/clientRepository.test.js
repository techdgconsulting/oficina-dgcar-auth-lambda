jest.mock("pg", () => {
  const query = jest.fn();
  const end = jest.fn();

  return {
    Pool: jest.fn(() => ({ query, end })),
    __mock: { query, end }
  };
});

const pg = require("pg");
const { findClientByCpf, closePool } = require("../src/clientRepository");

describe("client repository", () => {
  beforeEach(async () => {
    await closePool();
    jest.clearAllMocks();
    process.env.DB_HOST = "localhost";
    process.env.DB_PORT = "5432";
    process.env.DB_NAME = "oficina";
    process.env.DB_USERNAME = "oficina";
    process.env.DB_PASSWORD = "secret";
    process.env.CLIENT_TABLE = "clientes";
    process.env.CLIENT_ID_COLUMN = "id";
    process.env.CLIENT_DOCUMENT_COLUMN = "documento";
    delete process.env.CLIENT_STATUS_COLUMN;
    process.env.CLIENT_DEFAULT_STATUS = "ATIVO";
  });

  test("queries client by normalized document and default status", async () => {
    pg.__mock.query.mockResolvedValue({
      rows: [{ clienteId: 1, documento: "52998224725", status: "ATIVO" }]
    });

    const client = await findClientByCpf("52998224725");

    expect(client.clienteId).toBe(1);
    expect(pg.__mock.query).toHaveBeenCalledWith(expect.stringContaining('"clientes"'), [
      "52998224725",
      "ATIVO"
    ]);
  });

  test("rejects unsafe SQL identifiers", async () => {
    process.env.CLIENT_TABLE = "clientes;drop table clientes";

    await expect(findClientByCpf("52998224725")).rejects.toThrow("Invalid SQL identifier");
  });
});
