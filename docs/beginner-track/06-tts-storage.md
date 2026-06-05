# Task 06 — TTS & Storage

## Gemini TTS

API: Google Cloud Text-to-Speech REST (Gemini model)

```json
{
  "audioConfig": { "audioEncoding": "LINEAR16", "pitch": 0, "speakingRate": 1 },
  "input": { "prompt": "Read aloud in a warm, welcoming tone.", "text": "..." },
  "voice": {
    "languageCode": "he-IL",
    "modelName": "gemini-3.1-flash-tts-preview",
    "name": "Achernar"
  }
}
```

> Note: Use the latest available Gemini TTS model name from Google Cloud docs. Configurable via `beginner_curriculum.json`.

## Chunking

- One TTS request per sentence (records exact sentence timing while concatenating audio)
- Concatenate WAV segments with pydub → export MP3

## Supabase Storage

- Bucket: `episode-audio` (public read)
- Path: `{level_slug}/{episode_number:02d}.mp3`
- Public URL: `{SUPABASE_URL}/storage/v1/object/public/episode-audio/...`

## Env

Gemini TTS requires OAuth2 (service account), **not** an API key:

```
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
SUPABASE_AUDIO_BUCKET=episode-audio
```

Enable **Cloud Text-to-Speech API** on the GCP project and grant the service account a role that includes `cloud-platform` access (e.g. `roles/cloudtexttospeech.user` or `roles/editor` for dev).

**Gemini TTS also requires Vertex AI** (models run on `aiplatform.googleapis.com`):

1. Enable **Vertex AI API** (`aiplatform.googleapis.com`)
2. Grant your service account **Vertex AI User**: `roles/aiplatform.user`
3. Ensure **billing** is enabled on the project

```bash
gcloud services enable texttospeech.googleapis.com aiplatform.googleapis.com
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SA@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```
