// Lightweight voice architecture using the Web Speech API.
// Prepared for future integration with server-side STT/TTS (Lovable AI Gateway).

type SR = typeof globalThis extends { SpeechRecognition: infer T } ? T : unknown;

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export type DictationHandle = {
  stop: () => void;
};

export function startDictation(opts: {
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (err: string) => void;
  lang?: string;
}): DictationHandle | null {
  if (!isSpeechRecognitionSupported()) return null;
  const Ctor =
    (window as unknown as { SpeechRecognition?: SR }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: SR }).webkitSpeechRecognition;
  if (!Ctor) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rec: any = new (Ctor as any)();
  rec.continuous = false;
  rec.interimResults = true;
  rec.lang = opts.lang ?? "en-US";

  let finalText = "";
  rec.onresult = (e: {
    results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> & { length: number };
  }) => {
    let interim = "";
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (interim && opts.onPartial) opts.onPartial(interim);
  };
  rec.onerror = (e: { error?: string }) => opts.onError?.(e.error ?? "speech-error");
  rec.onend = () => {
    if (finalText.trim()) opts.onFinal(finalText.trim());
  };
  try {
    rec.start();
  } catch {
    return null;
  }
  return { stop: () => rec.stop() };
}

export function speak(text: string, opts?: { rate?: number; pitch?: number; voiceName?: string }) {
  if (!isSpeechSynthesisSupported()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const clean = text.replace(/```[\s\S]*?```/g, " code block ").replace(/[*_`#>]/g, "");
  const utter = new SpeechSynthesisUtterance(clean);
  utter.rate = opts?.rate ?? 1;
  utter.pitch = opts?.pitch ?? 1;
  const voices = synth.getVoices();
  const preferred =
    (opts?.voiceName && voices.find((v) => v.name === opts.voiceName)) ||
    voices.find((v) => /en(-|_)?US/i.test(v.lang) && /female|samantha|google/i.test(v.name)) ||
    voices.find((v) => v.lang.startsWith("en"));
  if (preferred) utter.voice = preferred;
  synth.speak(utter);
}

export function stopSpeaking() {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
}
