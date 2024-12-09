import requests
import base64
import json
import pyaudio
import wave
import tempfile
import os

# PyAudio configuration
CHUNK = 1024
FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 44100
RECORD_SECONDS = 5

# URL of your Flask application
url = 'http://localhost:5000/process_audio'

def record_audio():
    p = pyaudio.PyAudio()

    stream = p.open(format=FORMAT,
                    channels=CHANNELS,
                    rate=RATE,
                    input=True,
                    frames_per_buffer=CHUNK)

    print("Recording...")

    frames = []

    for i in range(0, int(RATE / CHUNK * RECORD_SECONDS)):
        data = stream.read(CHUNK)
        frames.append(data)

    print("Recording finished.")

    stream.stop_stream()
    stream.close()
    p.terminate()

    # Save the recorded audio to a temporary file
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_audio_file:
        wf = wave.open(temp_audio_file.name, 'wb')
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(p.get_sample_size(FORMAT))
        wf.setframerate(RATE)
        wf.writeframes(b''.join(frames))
        wf.close()

    return temp_audio_file.name

# Record audio from microphone
temp_audio_path = record_audio()

# Read the temporary audio file
with open(temp_audio_path, 'rb') as audio_file:
    files = {'audio': ('audio.wav', audio_file, 'audio/wav')}
    
    # Send POST request to the Flask app
    response = requests.post(url, files=files)

# Remove the temporary audio file
os.unlink(temp_audio_path)

# Check if the request was successful
if response.status_code == 200:
    # Parse the JSON response
    data = response.json()
    
    # Extract and print the transcription and ChatGPT response
    print("Transcription:", data['transcription'])
    print("ChatGPT Response:", data['chatgpt_response'])
    
    # Decode and save the audio response
    audio_data = base64.b64decode(data['response'])
    with open('response_audio.wav', 'wb') as audio_file:
        audio_file.write(audio_data)
    print("Audio response saved as 'response_audio.wav'")
else:
    print("Error:", response.status_code, response.text)