/**
 * ElevenLabs drop-in. Same return shape as the Edge provider:
 *   { samples, sampleRate, duration, words, sentences, voice, text, provider }
 *
 * Not called unless a script sets `tts.provider` to "elevenlabs".
 * Wire the HTTP call in `synthesizeElevenLabs` when an API key is available.
 * Word timestamps should fill `words` the same way Edge does
 * ({ text, start, end } in seconds) so mouth and captions keep working.
 */

export async function synthesizeElevenLabs({ text, voice }) {
  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error(
      "ElevenLabs 需要環境變數 ELEVENLABS_API_KEY。腳本的 tts.provider 改回 \"edge\" 即可繼續用免費語音。",
    );
  }
  throw new Error(
    `ElevenLabs provider 已留好介面（voice=${voice}，${text.length} 字），尚未送出 /v1/text-to-speech。` +
      "在 src/tts/elevenlabs.mjs 接上 API 與字級時間戳後即可替換 Edge。",
  );
}
