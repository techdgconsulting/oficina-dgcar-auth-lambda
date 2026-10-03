function normalizeCpf(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function isValidCpf(value) {
  const cpf = normalizeCpf(value);

  if (!/^\d{11}$/.test(cpf)) {
    return false;
  }

  if (new Set(cpf).size === 1) {
    return false;
  }

  const firstDigit = calculateDigit(cpf.slice(0, 9), 10);
  const secondDigit = calculateDigit(`${cpf.slice(0, 9)}${firstDigit}`, 11);

  return Number(cpf[9]) === firstDigit && Number(cpf[10]) === secondDigit;
}

function calculateDigit(base, initialWeight) {
  const sum = [...base].reduce((total, digit, index) => {
    return total + Number(digit) * (initialWeight - index);
  }, 0);

  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

module.exports = {
  normalizeCpf,
  isValidCpf
};
