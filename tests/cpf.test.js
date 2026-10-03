const { isValidCpf, normalizeCpf } = require("../src/cpf");

describe("CPF validation", () => {
  test("normalizes formatted CPF", () => {
    expect(normalizeCpf("529.982.247-25")).toBe("52998224725");
  });

  test("accepts valid CPF", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
  });

  test("rejects invalid CPF digit", () => {
    expect(isValidCpf("52998224726")).toBe(false);
  });

  test("rejects repeated digits", () => {
    expect(isValidCpf("11111111111")).toBe(false);
  });
});
