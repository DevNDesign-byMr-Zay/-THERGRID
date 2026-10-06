/**
 * Groq Server-Side Voice Transcription Adapter
 * Converts speech audio streams/buffers to text via Groq Whisper API.
 */

export function createGroqVoiceAdapter(options = {}) {
  const apiKey = options.apiKey || process.env.AETHERGRID_OPENAI_API_KEY || process.env.AETHERGRID_AI_API_KEY || '';
  const baseUrl = options.baseUrl || 'https://api.groq.com/openai/v1';

  return {
    async transcribeAudioBuffer(buffer, mimeType = 'audio/wav') {
      if (!apiKey) {
        return {
          success: false,
          status: 'unconfigured',
          error: 'Groq API key not configured for voice transcription'
        };
      }

      try {
        const formData = new FormData();
        const blob = new Blob([buffer], { type: mimeType });
        formData.append('file', blob, 'recording.wav');
        formData.append('model', 'whisper-large-v3-turbo');

        const res = await fetch(`${baseUrl}/audio/transcriptions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`
          },
          body: formData
        });

        if (!res.ok) {
          const errText = await res.text();
          return {
            success: false,
            status: 'failed',
            error: `Groq Whisper API returned ${res.status}: ${errText.substring(0, 100)}`
          };
        }

        const data = await res.json();
        return {
          success: true,
          status: 'configured',
          text: data.text || ''
        };
      } catch (err) {
        return {
          success: false,
          status: 'failed',
          error: err.message
        };
      }
    }
  };
}
