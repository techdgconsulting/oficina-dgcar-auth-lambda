const {
  classifyError,
  maskCpf,
  resolveCorrelationId
} = require("../src/observability");

describe("observability helpers", () => {
  test("masks CPF keeping only the last two digits", () => {
    expect(maskCpf("529.982.247-25")).toBe("***.***.***-25");
    expect(maskCpf("invalid")).toBe("NAO_INFORMADO");
  });

  test("reads correlation id case-insensitively or generates one", () => {
    expect(resolveCorrelationId({
      headers: {
        "x-correlation-id": "corr-abc"
      }
    })).toBe("corr-abc");

    expect(resolveCorrelationId({ headers: {} })).toMatch(/[a-f0-9-]{36}/);
  });

  test("classifies operational errors", () => {
    expect(classifyError(new Error("Missing required environment variable: DB_HOST"))).toBe("CONFIGURACAO");
    expect(classifyError(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }))).toBe("BANCO");
    expect(classifyError({ name: "JsonWebTokenError", message: "invalid token" })).toBe("TOKEN");
  });
});
