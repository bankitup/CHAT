export function shouldLogVoiceThreadDiagnostics() {
  return (
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_CHAT_DEBUG_VOICE === '1'
  );
}

export function logVoiceThreadDiagnostic(
  stage: string,
  details: Record<string, unknown>,
) {
  if (!shouldLogVoiceThreadDiagnostics()) {
    return;
  }

  console.info('[voice-thread]', stage, details);
}

export function logVoiceThreadProof(
  stage: string,
  details: Record<string, unknown>,
) {
  if (!shouldLogVoiceThreadDiagnostics()) {
    return;
  }

  console.info('[voice-proof]', stage, details);
}
