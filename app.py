import base64
import json
from flask import Flask, request, jsonify, send_file, send_from_directory, make_response
import whisper
import os
from dotenv import load_dotenv
import torch
import numpy as np
import openai
import wave
import io
from TTS.api import TTS
import shutil
from functools import wraps

# Load environment variables
load_dotenv()

tts_model = TTS("tts_models/multilingual/multi-dataset/xtts_v2", gpu=True)

# Initialize OpenAI API client with API key from environment variable
openai.api_key = os.getenv("OPENAI_API_KEY")

# Initialize Flask app
app = Flask(__name__, static_folder="simulacrum/build")
# CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})

# Global variable to store the current sample file path
CURRENT_SAMPLE_FILE = "sample.wav"

def allow_cors(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        response = make_response(f(*args, **kwargs))
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        return response
    return decorated_function

@app.route('/change_sample', methods=['POST'])
@allow_cors
def change_sample():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400
    
    audio_file = request.files['audio']
    
    if audio_file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if audio_file:
        # Save the new sample file
        new_sample_path = "sample.wav"
        audio_file.save(new_sample_path)
        
        # Update the global variable
        global CURRENT_SAMPLE_FILE
        CURRENT_SAMPLE_FILE = new_sample_path
        
        return jsonify({'message': 'Sample file updated successfully'}), 200

@app.route('/get_current_sample', methods=['GET'])
@allow_cors
def get_current_sample():
    return send_file(CURRENT_SAMPLE_FILE, mimetype='audio/wav')

# Route to process audio and get transcription + response
@app.route('/process_audio', methods=['POST'])
@allow_cors
def process_audio():
    # Load Whisper model
    model = "base"
    model = model + ".en"
    audio_model = whisper.load_model(model)

    # Get the audio file from the request
    audio_file = request.files['audio']
    audio_data = audio_file.read()
    
    history = json.loads(request.form.get("history"))

    # Save audio temporarily
    audio_path = "temp_audio.wav"
    with open(audio_path, "wb") as f:
        f.write(audio_data)

    # Load the audio into Whisper for transcription
    result = audio_model.transcribe(audio_path)
    transcription = result['text'].strip()

    # Use OpenAI API to generate response based on transcription
    response = openai.chat.completions.create(
        model="gpt-4o",
        messages=history + [{"role": "user", "content": transcription}]
    )
    chat_response = response.choices[0].message.content

    # Remove temporary audio file
    # os.remove(audio_path)
    
    tts_model.tts_to_file(text=chat_response,
        file_path="output.wav",
        speaker_wav=CURRENT_SAMPLE_FILE,
        language="en")
    
    with open("output.wav", "rb") as f:
        audio_encoded = base64.encodebytes(f.read()).decode("utf-8")

    # Return both transcription and ChatGPT response as JSON to frontend
    return jsonify({
        'transcription': transcription,
        'chatgpt_response': chat_response,
        'response': audio_encoded
    })

@app.route('/')
@allow_cors
def serve_static():
    return send_from_directory(app.static_folder, 'index.html')

# This route will handle all other static files
@app.route('/<path:path>')
@allow_cors
def serve_static_files(path):
    return send_from_directory(app.static_folder, path)

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
