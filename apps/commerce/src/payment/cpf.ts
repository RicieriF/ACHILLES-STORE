export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidCpf(value: string): boolean {
  const cpf = normalizeCpf(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (length: number): number => {
    let sum = 0;
    for (let index = 0; index < length; index += 1)
      sum += Number(cpf[index]) * (length + 1 - index);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export function assertValidCpf(value: string): string {
  const cpf = normalizeCpf(value);
  if (!isValidCpf(cpf)) throw new Error("CPF_INVALID");
  return cpf;
}

export function maskCpf(value: string): string {
  const cpf = normalizeCpf(value);
  return cpf.length === 11 ? `***.***.***-${cpf.slice(-2)}` : "***";
}
