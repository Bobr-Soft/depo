type DiagnosticLevel = 'info' | 'warn' | 'error';

type DiagnosticPayload = Record<string, unknown>;

function safeSerialize(payload: DiagnosticPayload): string {
  try {
    return JSON.stringify(payload);
  } catch {
    return JSON.stringify({ serializationError: true });
  }
}

export function logDiagnostic(event: string, payload: DiagnosticPayload = {}, level: DiagnosticLevel = 'info'): void {
  const data = {
    ts: new Date().toISOString(),
    event,
    ...payload,
  };

  const line = `[diag] ${safeSerialize(data)}`;

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}
