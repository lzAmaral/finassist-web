export const notificationKinds = {
  weekly_digest: 'Resumo semanal',
  review: 'Revisão de gastos',
  goals: 'Metas em risco',
  reminders: 'Lembretes de compromissos'
} as const;
export type NotificationKind = keyof typeof notificationKinds;
export interface NotificationPreferences {
  types: Record<NotificationKind, boolean>;
  hour: number;
  minute: number;
  weekday: number;
  timeZone: string;
  hideAmounts: boolean;
  telegram: boolean;
}
export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  dismissedAt: string | null;
  deliveryStatus: string;
  attempts: number;
  lastError: string;
}
export interface NotificationsData {
  preferences: NotificationPreferences;
  notifications: NotificationItem[];
  telegramReady: boolean;
  schedulerRunning: boolean;
}
export const weekdays = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado'
];
export function maskNotification(text: string, hidden: boolean): string {
  return hidden ? text.replace(/R\$\s*-?[\d.,]+/g, 'R$ ••••••') : text;
}
export function notificationDelivery(item: NotificationItem): string {
  const labels: Record<string, string> = {
    in_app: 'Disponível no aplicativo',
    pending: 'Telegram na fila',
    sending: 'Envio em andamento',
    sent: 'Enviado ao Telegram',
    retry: `Nova tentativa pendente (${item.attempts}/3)`,
    failed:
      item.lastError === 'delivery_uncertain'
        ? 'Entrega incerta; envio não será repetido'
        : 'Falha de entrega após as tentativas',
    cancelled: 'Envio cancelado pela preferência'
  };
  return labels[item.deliveryStatus] ?? 'Estado de entrega desconhecido';
}
export function validateNotificationPreferences(
  p: NotificationPreferences
): string {
  if (
    !Number.isInteger(p.hour) ||
    p.hour < 0 ||
    p.hour > 23 ||
    !Number.isInteger(p.minute) ||
    p.minute < 0 ||
    p.minute > 59
  )
    return 'Informe um horário válido.';
  if (!Number.isInteger(p.weekday) || p.weekday < 0 || p.weekday > 6)
    return 'Escolha o dia do resumo.';
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: p.timeZone }).format();
  } catch {
    return 'Informe um fuso como America/Sao_Paulo.';
  }
  return '';
}
export async function notificationsRequest<T>(
  path: string,
  method = 'GET',
  body?: unknown
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers:
      method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let result: T & { error?: string };
  try {
    result = await response.json();
  } catch {
    throw new Error('Resposta de notificações inválida. Tente recarregar.');
  }
  if (!response.ok)
    throw new Error(
      result.error || 'Não foi possível acessar as notificações.'
    );
  return result;
}
