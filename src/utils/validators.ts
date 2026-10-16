export function validateCPF(cpf: string): boolean {
  cpf = cpf.replace(/[^\d]+/g, '');
  if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
  const cpfArray = cpf.split('').map(el => parseInt(el));
  const rest = (count: number) => {
    return ((cpfArray.slice(0, count - 12).reduce((soma, el, index) => soma + el * (count - index), 0) * 10) % 11) % 10;
  };
  return rest(10) === cpfArray[9] && rest(11) === cpfArray[10];
}

export function validateCNPJ(cnpj: string): boolean {
  cnpj = cnpj.replace(/[^\d]+/g, '');
  if (cnpj.length !== 14 || !!cnpj.match(/(\d)\1{13}/)) return false;
  const b = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const c = cnpj.split('');
  let n = 0;
  for (let i = 0; i < 12; n += parseInt(c[i]) * b[i + 1], i++);
  n = 11 - n % 11;
  n = n >= 10 ? 0 : n;
  if (parseInt(c[12]) !== n) return false;
  n = 0;
  for (let i = 0; i <= 12; n += parseInt(c[i]) * b[i], i++);
  n = 11 - n % 11;
  n = n >= 10 ? 0 : n;
  if (parseInt(c[13]) !== n) return false;
  return true;
}
