import eventlet
eventlet.monkey_patch()

import os
import time as t
import re

from flask import Flask, render_template, request, session, redirect, url_for, jsonify, send_file
from flask_socketio import SocketIO
from flask_cors import CORS

import joblib
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
import subprocess
import shutil
from sklearn.feature_extraction.text import HashingVectorizer
import numpy as np
import soundfile as sf
from pydub import AudioSegment

from PyBreathTranscript import transcript as bt
from PyBreathTranscript.transcript_dtw import get_recognizer, transcribe_file

import PyBreathParams.get_breath_params as get_breath_params

from tools import optimize_audio, create_waveform

from src.utils import *

load_dotenv()



UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'web_recordings')
OFFLINE_UPLOAD_FOLDER = os.getenv('OFFLINE_UPLOAD_FOLDER', 'offline_recordings')
AUDIO_FOLDER = os.getenv('AUDIO_FOLDER', 'audio')
GRAPH_FOLDER = os.getenv('GRAPH_FOLDER', 'graphs')
MODELS_FOLDER = os.getenv('MODELS_FOLDER', 'models')

IE_MODEL_FILE = f"{MODELS_FOLDER}/model_transcript_fingerprint.pkl"

CHUNK_LENGTH = 200
RATE = 44100

SILENCE_LENGTH = 2
LETTERS_BEFORE_SILENCE = 2
SILENCE_VALIDATION = SILENCE_LENGTH + LETTERS_BEFORE_SILENCE
SILENCE_PATTERN = rf'^[^_]{{{LETTERS_BEFORE_SILENCE}}}[_]{{{SILENCE_LENGTH}}}$'

CUT_FILE = 0
CUT_LETTERS = 1
CUTTING_MODE = CUT_LETTERS

DEV_MODE = 0
DATA_COLLECT_MODE = 1
PROD_MODE = 2
APP_MODE = DEV_MODE

def find_silence_indices(s: str) -> list[int]:
    """
    Return a list of all start‐indexes i such that
    s[i : i + WINDOW_SIZE] matches:
      – LETTERS_BEFORE_SILENCE characters that are not “_”
      – followed immediately by SILENCE_LENGTH underscores.
    """
    indices: list[int] = []
    n = len(s)

    # Slide a WINDOW_SIZE‐length window over s
    for i in range(n - SILENCE_VALIDATION + 1):
        window = s[i : i + SILENCE_VALIDATION]
        if re.match(SILENCE_PATTERN, window):
            indices.append(i)

    return indices


def format_milliseconds(ms: int) -> str:
    """
    Convert milliseconds to a string in format "HH:MM:SS:mmm".
    """
    hours = ms // 3600000
    remainder = ms % 3600000
    minutes = remainder // 60000
    remainder = remainder % 60000
    seconds = remainder // 1000
    milliseconds = remainder % 1000
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}:{milliseconds:03d}"


def markdown_breath(filename: str) -> tuple[list[dict], str]:
    silence_transcription = transcribe_file(filename)
    transcription = bt.transcript(filename)
    silence_indices = find_silence_indices(silence_transcription)
    silence_indices = [0, *silence_indices]
    phase = ["inhale", "exhale"]
    breath_markdown = []
    for i in range(len(silence_indices) - 1):
           breath_markdown.append({"time": format_milliseconds(CHUNK_LENGTH * silence_indices[i]), 
                                   "transcript": transcription[silence_indices[i]:silence_indices[i+1]],
                                   "inhale_exhale": phase[i % 2]}) 
    return breath_markdown, transcription



app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:5173"}}, supports_credentials=True)
app.secret_key = os.urandom(24).hex()
app.config.update(
    TEMPLATES_AUTO_RELOAD=True
)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
# app.secret_key = 'tempkey'

socketio = SocketIO(app, async_mode='eventlet', cors_allowed_origins=['http://localhost:5173'])


@socketio.on('connect')
def handle_connect():
    session['socket_id'] = request.sid

from collections import defaultdict
client_data = defaultdict(lambda: {"chunks": 0, 
                                    "transcript": "",
                                    "transcript_silence": "", 
                                    "last_transcript_length": 0,
                                    "autosplit": False,
                                    "fileName": False,
                                    "autoBreath": False,
                                    "autoBreathByText": False,
                                    "autoBreathByAudio": False,
                                    "autoActivity": False,
                                    "autoActivityByText": False,
                                    "autoActivityByAudio": False,
                                    "data_collect_filename": ""})


ie_fingerprint_model = joblib.load(IE_MODEL_FILE)
transcript_model = joblib.load(f"{MODELS_FOLDER}/model_transcript_breath.pkl")
hash_vectorizer = HashingVectorizer(analyzer='char_wb', ngram_range=(3, 5), n_features=50)


# File to which audio chunks are appended in binary mode.
RECORDING_FILE_TEMPLATE = "recording_{sid}.webm"

# Ensure the recording file exists/starts empty.
# with open(RECORDING_FILE, "wb") as f:
#     pass


@app.route('/')
def index():
    return render_template("index.html")



# ------------------
# STREAN HANDLING
# ------------------

@socketio.on('audio_chunk')
def handle_audio_chunk(chunk):
    sid = request.sid
    filename = RECORDING_FILE_TEMPLATE.format(sid=sid)
    # ensure per-client recording file exists
    with open(filename, "ab") as f:
        f.write(chunk)
    client_data[sid]["chunks"] += 1
    # process in background to avoid blocking the event loop
    bg_task = socketio.start_background_task(process_chunk, sid, filename)
        

        
    # print(f"Received chunk at {current_timestamp}, saved to {RECORDING_FILE}")
    # Optionally, you can add any logic (logging, broadcasting, etc.) here.

# ------------------
# OFFLINE PROCESSING
# ------------------

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in request'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    # Save file to OFFLINE_UPLOAD_FOLDER
    filename = secure_filename(file.filename)
    file_path = os.path.join(OFFLINE_UPLOAD_FOLDER, filename)
    file.save(file_path)

    try:
        # Run transcription
        breath_markdown, transcription = markdown_breath(file_path)
        return jsonify({'filename': filename,
                        'full_transcript': transcription,
                        'transcript': breath_markdown}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    

# ------------------
# API CALLS
# ------------------

@app.route('/transcript', methods=['GET', 'POST'])
def transcript():
    if request.method == "GET":
        filename = request.args.get("filename")
        if not filename:
            return jsonify({"error": "Filename parameter is missing"}), 400
        try:
            result = bt.transcript(filename)
            return jsonify({"filename": filename,
                            "transcript": result})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        return jsonify({"error": "Method not allowed"}), 405
    

@app.route('/markdown', methods=['GET'])
def markdown():
    if request.method == "GET":
        filename = request.args.get("filename")
        if not filename:
            return jsonify({"error": "Filename parameter is missing"}), 400
        try:
            breath_markdown, transcription = markdown_breath(filename)
            return jsonify({"filename": filename,
                            "full_transcription": transcription,
                            "transcript": breath_markdown})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

@app.route('/inhale_exhale', methods=['GET'])
def get_phase():
    if request.method == "GET":
        filename = request.args.get("filename")
        method = request.args.get("method")
        if not filename:
            return jsonify({"error": "Filename parameter is missing"}), 400
        if not method:
            method = "wave"
        try:
            if method == "wave":
                result = get_breath_params.predict(get_breath_params.IE, filename)
            elif method == "transcript":
                transcript = bt.transcript(filename)
                prediction = int(ie_fingerprint_model.predict(hash_vectorizer.fit_transform([transcript]))[0])
                result = 'exhale' if prediction == 1 else 'inhale'
            else:
                return jsonify({"error": "Invalid method parameter"}), 400
            return jsonify({"filename": filename,
                            "activity": result})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        return jsonify({"error": "Method not allowed"}), 405


@app.route('/activity', methods=['GET'])
def get_activity():
    if request.method == "GET":
        filename = request.args.get("filename")
        method = request.args.get("method")
        if not filename:
            return jsonify({"error": "Filename parameter is missing"}), 400
        if not method:
            method = "wave"
        try:
            if method == "wave":
                result = get_breath_params.predict(get_breath_params.AR, filename)
            elif method == "transcript":
                transcript = bt.transcript(filename)
                detected_activity_cluster = int(transcript_model.predict(hash_vectorizer.fit_transform([transcript]))[0])
                result = 'active' if detected_activity_cluster == 2 else 'resting' # if detected_activity_cluster == 1 else 'Other'
            else:
                return jsonify({"error": "Invalid method parameter"}), 400
            return jsonify({"filename": filename,
                            "activity": result})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        return jsonify({"error": "Method not allowed"}), 405
    

# ------------------
# LIVE PROCESSING
# ------------------

@app.route('/start', methods=['GET', 'POST'])
def get_start_params():
    print("""
    --------------------------
        RECORDING STARTED
    --------------------------
    """)
    sid = request.form.get('sid') or session.get('socket_id')
    if not sid:
        return jsonify({"error": "Session not initialized"}), 400
    if request.method == "POST":
        filename, \
        autoBreath, autoBreathByText, autoBreathByAudio, \
        autoActivity, autoActivityByText, autoActivityByAudio, \
        autosplit = fetch_file_data(request, ["fileName",
                                            "autoBreath",
                                            "autoBreathByText",
                                            "autoBreathByAudio",
                                            "autoActivity",
                                            "autoActivityByText",
                                            "autoActivityByAudio",
                                            "autoBreathMarkup",]) 
        client_data[sid]["fileName"] = filename
        client_data[sid]["autoBreath"] = str_to_bool(autoBreath)
        client_data[sid]["autoBreathByText"] = str_to_bool(autoBreathByText)
        client_data[sid]["autoBreathByAudio"] = str_to_bool(autoBreathByAudio)
        client_data[sid]["autoActivity"] = str_to_bool(autoActivity)
        client_data[sid]["autoActivityByText"] = str_to_bool(autoActivityByText)
        client_data[sid]["autoActivityByAudio"] = str_to_bool(autoActivityByAudio)
        client_data[sid]["autosplit"] = str_to_bool(autosplit)
        print("WAT??", autosplit, client_data[sid]["autosplit"])
        if APP_MODE == DATA_COLLECT_MODE:
            # Find the next filename based on existing files in the upload folder
            existing_files = [f for f in os.listdir(f"{UPLOAD_FOLDER}/active") if f.endswith(".wav")]
            numbers = [int(re.match(r"(\d{4})\.wav", f).group(1)) for f in existing_files if re.match(r"\d{4}\.wav", f)]
            next_number = max(numbers) + 1 if numbers else 1
            client_data[sid]["data_collect_filename"] = f"{next_number:04d}"

        return jsonify({"status": "success"}), 200
    
    else:
        return jsonify({"error": "Method not allowed"}), 405


@app.route('/cut', methods=['GET', 'POST'])
def save_file():
    print("""
    --------------------------
          CUT CLICKED
    --------------------------
    """)
    # Reminder: include 'sid' as a form field for POST requests if needed.
    sid = request.form.get('sid') or session.get('socket_id')
    if not sid:
        return jsonify({"error": "Session not initialized"}), 400
    if request.method == "POST":
        current_step, time = fetch_file_data(request, [
                                                        "current_step", 
                                                        "last_time", 
                                                        ])
        update = False # TODO: add button to site & fetch in /start
        prefix = client_data[sid]["fileName"]
        ie_predicted_text = None
        ie_predicted_audio = None
        activity_predicted_text = None
        activity_predicted_audio = None

        # print(prefix)
        filename = "temp.webm"
        # filename = request.files["prefix"] + "/" + filename
        shutil.copy(RECORDING_FILE_TEMPLATE.format(sid=sid), filename)

        if APP_MODE == DEV_MODE:
            # change codec
            if not os.path.exists(f'{UPLOAD_FOLDER}/{prefix}'):
                os.makedirs(f'{UPLOAD_FOLDER}/{prefix}')
                os.makedirs(f'{UPLOAD_FOLDER}/{prefix}/{AUDIO_FOLDER}')
                os.makedirs(f'{UPLOAD_FOLDER}/{prefix}/{GRAPH_FOLDER}')

            if not client_data[sid]["autoBreath"]:
                output_filename = f'{UPLOAD_FOLDER}/{prefix}/{AUDIO_FOLDER}/{prefix}_{current_step}_{time}.wav'
            else:
                output_filename = 'temp_proccessed.wav'
                
            time_split = time.split(':')
            cutout = int(time_split[0]) * 3600 * 1000 + int(time_split[1]) * 60 * 1000 + int(time_split[2]) * 1000 + int(time_split[3])
            subprocess.run([
                "ffmpeg", "-y", "-fflags", "+genpts", "-ss", str(cutout / 1000), "-i", filename, "-ar", "44100", "-ac", "2", "-f", "wav", output_filename
            ])

            recording_time = t.strftime('%d.%m.%Y %X')

            if CUTTING_MODE == CUT_FILE:
                transcript = bt.transcript(output_filename, bt.FINGERPRINT)
            elif CUTTING_MODE == CUT_LETTERS:
                full_transcript = client_data[sid]["transcript"]
                last_length = client_data[sid].get("last_transcript_length", 0)
                transcript = full_transcript[last_length:]
                client_data[sid]["last_transcript_length"] = len(full_transcript)

            # Inhale/Exhale detection
            if client_data[sid]["autoBreath"]:
                # Text-based prediction
                if client_data[sid]["autoBreathByText"]:
                    prediction = int(ie_fingerprint_model.predict(hash_vectorizer.fit_transform([transcript]))[0])
                    print(f"Predicted class: {prediction}")
                    ie_predicted_text = 'exhale' if prediction == 1 else 'inhale'
                    final_output_filename = f'{UPLOAD_FOLDER}/{prefix}/{AUDIO_FOLDER}/{prefix}_{ie_predicted_text}_{recording_time}.wav'
                    shutil.copyfile(output_filename, final_output_filename)
                # Audio-based prediction
                if client_data[sid]["autoBreathByAudio"]:
                    ie_predicted_audio = get_breath_params.predict(get_breath_params.IE, output_filename)
            
                # Update model
                if update:
                    if current_step == ie_predicted_text:
                        ie_fingerprint_model.partial_fit(hash_vectorizer.fit_transform([transcript]))
                        with open(IE_MODEL_FILE, 'wb') as f:
                            joblib.dump(ie_fingerprint_model, f)  

            # Activity detection
            if client_data[sid]["autoActivity"]:
                # Text-based prediction
                if client_data[sid]["autoActivityByText"]:
                    detected_activity_cluster = int(transcript_model.predict(hash_vectorizer.fit_transform([transcript]))[0])
                    activity_predicted_text = 'active' if detected_activity_cluster == 2 else 'resting' # if detected_activity_cluster == 1 else 'Other'
                # Audio-based prediction
                if client_data[sid]["autoActivityByAudio"]:
                    activity_predicted_audio = get_breath_params.predict(get_breath_params.AR, output_filename)
            # transcript_prefix = f'{prefix} {current_step} {starting_point}: '

            # create graph
            # graph_path = f'{UPLOAD_FOLDER}/{prefix}/graphs/{prefix}_{current_step}_{recording_time}.png'
            # create_waveform.create_waveform(output_filename, transcript, graph_path)

        elif APP_MODE == DATA_COLLECT_MODE:
            output_filename = f'{UPLOAD_FOLDER}/active/{client_data[sid]["data_collect_filename"]}.wav'
            time_split = time.split(':')
            cutout = int(time_split[0]) * 3600 * 1000 + int(time_split[1]) * 60 * 1000 + int(time_split[2]) * 1000 + int(time_split[3])

            subprocess.run([
                "ffmpeg", "-y", "-fflags", "+genpts", "-ss", str(cutout / 1000), "-i", filename, "-ar", "44100", "-ac", "2", "-f", "wav", output_filename
            ])

            next_number = int(client_data[sid]["data_collect_filename"]) + 1
            client_data[sid]["data_collect_filename"] = f"{next_number:04d}"



        return {
            'transcript' : transcript, 
            'recording_time' : time,
            'inhale_exhale' : current_step,
            'ie_predicted_text' : ie_predicted_text,
            'ie_predicted_audio' : ie_predicted_audio,
            'activity' : prefix,
            'activity_predicted_text' : activity_predicted_text,
            'activity_predicted_audio' : activity_predicted_audio
            }
    

@app.route('/stop', methods=['GET', 'POST'])
def remove_file():
    print("""
    --------------------------
          STOP CLICKED
    --------------------------
    """)
    # Reminder: include 'sid' as a form field for POST requests if needed.
    sid = request.form.get('sid') or session.get('socket_id')
    if not sid:
        return jsonify({"error": "Session not initialized"}), 400
    if request.method == "POST":
        prefix = request.form.get("prefix")
        recording_time = t.strftime('%d.%m.%Y_%H.%M.%S')
        try:
            filename = RECORDING_FILE_TEMPLATE.format(sid=sid)
            if os.path.exists(filename):
                final_filename = os.path.abspath(f'{UPLOAD_FOLDER}/{prefix}/{AUDIO_FOLDER}/{prefix}_full_{recording_time}.wav')
                subprocess.run([
                    "ffmpeg", "-y", "-fflags", "+genpts", "-i", filename, "-ar", "44100", "-ac", "2", "-f", "wav", final_filename
                    ])
                os.remove(filename)
                return send_file(final_filename, mimetype='audio/wav', as_attachment=True)
            else:
                return jsonify({"message": "File not found"}), 404
        except Exception as e:
            return jsonify({"message": f"Error deleting file: {str(e)}"}), 500
    

# @app.route('/create_csv', methods=['GET', 'POST'])
# def create_csv():
#     if request.method == "POST":
#         data = request
#         print(data)
#         return data

def process_chunk(sid, filename):
    # convert to wav
    chunk_output = f"temp_chunk_{sid}.wav"
    subprocess.run([
        "ffmpeg", "-y", "-fflags", "+genpts",
        "-i", filename, "-ar", "44100", "-ac", "2", "-f", "wav", chunk_output
    ])
    audio = AudioSegment.from_wav(chunk_output)
    chunk_index = client_data[sid]["chunks"] - 1
    audio = audio[CHUNK_LENGTH*chunk_index : CHUNK_LENGTH*(chunk_index+1)]
    audio.export(chunk_output, format='wav')

    # Run both transcription algorithms concurrently using eventlet
    silence_checker = eventlet.spawn(get_recognizer().process_chunk, audio, RATE)
    audio_fingerprint = eventlet.spawn(bt.transcript_chunk, chunk_output, bt.WAVEFORM)

    # Wait for both to finish
    silence_symbol = silence_checker.wait()
    transcript_symbol = audio_fingerprint.wait()

    client_data[sid]["transcript_silence"] += silence_symbol
    client_data[sid]["transcript"] += transcript_symbol
    # emit back to the same client only
    socketio.emit('transcription_result', {'letter': transcript_symbol}, room=sid)
    if client_data[sid]["autosplit"]:
        if len(client_data[sid]["transcript_silence"]) > SILENCE_VALIDATION:
            silence_check = client_data[sid]["transcript_silence"][-SILENCE_VALIDATION:]
            if re.match(SILENCE_PATTERN, silence_check):
                print("SILENCE DETECTED")
                socketio.emit('silence', {'silence': True}, room=sid)


if __name__ == "__main__":
    # app.secret_key = os.urandom(30).hex()
    socketio.run(app, host='0.0.0.0', port='5001', debug=True)
