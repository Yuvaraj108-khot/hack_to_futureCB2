import os
import base64
import io
import tempfile
import subprocess
import sys
from pathlib import Path

local_deps = Path(__file__).resolve().parents[1] / ".pythonlibs"
if local_deps.exists():
    sys.path.insert(0, str(local_deps))

try:
    from groq import Groq
except ModuleNotFoundError:
    Groq = None

# Strict extraction prompt — NEVER evaluates truth, ONLY extracts the raw claim as stated
_EXTRACT_SYSTEM = """You are a claim extraction tool. Your ONLY job is to rephrase the core news claim being made in the content into a short, neutral, declarative sentence.

STRICT RULES:
- Do NOT fact-check, evaluate, or say whether the claim is true or false.
- Do NOT add phrases like "it is false that..." or "there is no evidence that..."
- Do NOT add your own opinion or knowledge.
- Return the claim EXACTLY as it is being asserted in the content, reworded as a simple news statement.
- Maximum 1-2 sentences.
- If the content says "Modi is dead", you return: "Prime Minister Narendra Modi has died."
- If the content says "WhatsApp is being banned", you return: "WhatsApp is being banned in India."
- Never refuse. Always return the claim as stated."""

_EXTRACT_IMAGE_PROMPT = """Look at this image and find the main news claim or headline being asserted.

STRICT RULES:
- Do NOT fact-check or say whether it is true or false.
- Do NOT add phrases like "it is false that..." or "there is no evidence that..."
- Simply rephrase what the image is CLAIMING as a short declarative sentence.
- Return ONLY 1-2 sentences. No preamble. No explanation.
- Example: If image says "MODI DEAD", return: "Prime Minister Narendra Modi has died."
- Example: If image says "WhatsApp banned", return: "WhatsApp has been banned in India."
"""


class MediaService:
    def __init__(self):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY")) if Groq else None

    def _require_client(self):
        if not self.client:
            raise RuntimeError("The 'groq' package is not installed. Run: python -m pip install groq")
        return self.client

    def _image_to_base64(self, file_bytes: bytes, mime_type: str) -> str:
        return base64.b64encode(file_bytes).decode("utf-8")

    async def extract_claim_from_image(self, file_bytes: bytes, mime_type: str) -> str:
        """
        Uses Groq vision (llama-4-scout) to extract the raw claim from an image
        WITHOUT evaluating truth/falsity.
        """
        b64 = self._image_to_base64(file_bytes, mime_type)

        client = self._require_client()
        response = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime_type};base64,{b64}"}
                        },
                        {
                            "type": "text",
                            "text": _EXTRACT_IMAGE_PROMPT
                        }
                    ]
                }
            ],
            max_tokens=100,
            temperature=0.0,
        )
        return response.choices[0].message.content.strip()

    async def extract_claim_from_audio(self, file_bytes: bytes, filename: str) -> str:
        """
        Uses Groq Whisper to transcribe audio, then extracts the raw claim
        WITHOUT evaluating whether it is true or false.
        """
        client = self._require_client()
        transcription = client.audio.transcriptions.create(
            file=(filename, io.BytesIO(file_bytes)),
            model="whisper-large-v3",
            response_format="text",
            language="en",
        )
        transcript_text = transcription if isinstance(transcription, str) else transcription.text

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": _EXTRACT_SYSTEM},
                {"role": "user", "content": f"Content: {transcript_text}"}
            ],
            max_tokens=80,
            temperature=0.0,
        )
        return response.choices[0].message.content.strip()

    async def extract_claim_from_video(self, file_bytes: bytes, filename: str) -> str:
        """
        Transcribes video audio via Whisper, then extracts the raw claim.
        """
        try:
            client = self._require_client()
            transcription = client.audio.transcriptions.create(
                file=(filename, io.BytesIO(file_bytes)),
                model="whisper-large-v3",
                response_format="text",
            )
            transcript_text = transcription if isinstance(transcription, str) else transcription.text

            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": _EXTRACT_SYSTEM},
                    {"role": "user", "content": f"Content: {transcript_text}"}
                ],
                max_tokens=80,
                temperature=0.0,
            )
            return response.choices[0].message.content.strip()

        except Exception as e:
            return f"Video processing failed: {str(e)}"

    async def extract_claim_from_url(self, url: str) -> str:
        """
        Downloads audio from a YouTube/news video URL via yt-dlp,
        transcribes it with Whisper, then extracts the raw claim.
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            audio_path = os.path.join(tmpdir, "audio.mp3")

            cmd = [
                sys.executable,
                "-m",
                "yt_dlp",
                "--no-playlist",
                "--extract-audio",
                "--audio-format", "mp3",
                "--audio-quality", "5",
                "--match-filter", "duration < 600",
                "-o", audio_path,
                url,
            ]
            env = os.environ.copy()
            env["PYTHONPATH"] = str(local_deps)
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120, env=env)
            if result.returncode != 0:
                raise RuntimeError(f"yt-dlp failed: {result.stderr[:300]}")

            with open(audio_path, "rb") as f:
                audio_bytes = f.read()

        client = self._require_client()
        transcription = client.audio.transcriptions.create(
            file=("audio.mp3", io.BytesIO(audio_bytes)),
            model="whisper-large-v3",
            response_format="text",
        )
        transcript_text = transcription if isinstance(transcription, str) else transcription.text

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": _EXTRACT_SYSTEM},
                {"role": "user", "content": f"Content: {transcript_text[:3000]}"}
            ],
            max_tokens=80,
            temperature=0.0,
        )
        return response.choices[0].message.content.strip()
