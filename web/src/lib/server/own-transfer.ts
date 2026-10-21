export interface Party {
  name?: string;
  documentNumber?: { value?: string };
}
export interface TransferMetadata {
  type: string;
  category?: string;
  paymentData?: { paymentMethod?: string; payer?: Party; receiver?: Party };
}
export const normalizedName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
export function completeDocument(document: string) {
  if (/[*xX]/.test(document)) return '';
  const digits = document.replace(/\D/g, '');
  return [11, 14].includes(digits.length) ? digits : '';
}
// Identity metadata is compared only in memory. The snapshot gets a boolean,
// never the parties' documents or their bank account identifiers.
export function ownTransfer(
  t: TransferMetadata,
  documents: Set<string>,
  names: Set<string>
) {
  if (
    !/transfer|pix|ted|doc/i.test(
      `${t.category ?? ''} ${t.paymentData?.paymentMethod ?? ''}`
    )
  )
    return false;
  const party =
    t.type === 'CREDIT' ? t.paymentData?.payer : t.paymentData?.receiver;
  const document = completeDocument(party?.documentNumber?.value ?? '');
  if (document) return documents.has(document);
  const name = normalizedName(party?.name ?? '');
  return name.split(' ').length >= 3 && names.has(name);
}
