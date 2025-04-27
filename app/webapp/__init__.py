import eventlet
eventlet.monkey_patch()

import os
import time as t
import re

from flask import Flask, render_template, request, session, redirect, url_for, jsonify, send_file
from flask_socketio import SocketIO
import joblib
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import subprocess
import shutil
from sklearn.feature_extraction.text import HashingVectorizer
import numpy as np
import soundfile as sf
from pydub import AudioSegment

from PyBreathTranscript import transcript as bt
from PyBreathTranscript.transcript_dtw import get_recognizer

from tools import optimize_audio, create_waveform

from src.utils import *

UPLOAD_FOLDER = '/data'
MODELS_FOLDER = 'models'

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


app = Flask(__name__)
app.secret_key = os.urandom(24).hex()
app.config.update(
    TEMPLATES_AUTO_RELOAD=True
)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
# app.secret_key = 'tempkey'

socketio = SocketIO(app, async_mode='eventlet', cors_allowed_origins='*')

@socketio.on('connect')
def handle_connect():
    session['socket_id'] = request.sid

from collections import defaultdict
client_data = defaultdict(lambda: {"chunks": 0, "transcript": "", "transcript_silence": "", "last_transcript_length": 0})


ie_model = joblib.load(f"{MODELS_FOLDER}/model_svm.pkl")
ie_fingerprint_model = joblib.load(IE_MODEL_FILE)
transcript_model = joblib.load(f"{MODELS_FOLDER}/model_transcript.pkl")
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


@app.route('/audio')
def audio():
    # Serve the current recording.
    # Note: Depending on your OS, reading a file while it's being written to may require extra care.
    # Reminder: include 'sid' as a query parameter (?sid=...) if needed.
    sid = request.args.get('sid') or session.get('socket_id')
    if not sid:
        return jsonify({"error": "Session not initialized"}), 400
    return send_file(RECORDING_FILE_TEMPLATE.format(sid=sid), mimetype='audio/webm')

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
        prefix, record_type, mode, current_step, time, update = fetch_file_data(request, ["prefix",
                                                                                "record_type",
                                                                                "mode", 
                                                                                "current_step", 
                                                                                "last_time", 
                                                                                "update"])
        
        current_step_predicted = '-'
        # Здесь поменять названия переменных и обновить логику в соответствии с новыми названиями 

        # print(prefix)
        filename = "temp.webm"
        # filename = request.files["prefix"] + "/" + filename
        shutil.copy(RECORDING_FILE_TEMPLATE.format(sid=sid), filename)


        # change codec
        if not os.path.exists(f'web_recordings/{prefix}'):
            os.makedirs(f'web_recordings/{prefix}')
            os.makedirs(f'web_recordings/{prefix}/audio')
            os.makedirs(f'web_recordings/{prefix}/graphs')

        if record_type != "automatic_ie":
            output_filename = f'web_recordings/{prefix}/audio/{prefix}_{current_step}_{time}.wav'
        else:
            output_filename = 'temp_proccessed.wav'
        subprocess.run([
            "ffmpeg", "-y", "-fflags", "+genpts", "-i", filename, "-ar", "44100", "-ac", "2", "-f", "wav", output_filename
            ])

        # data.save(output_filename)
        # data.flush()
        # data.close()
        
        print("finished subprocess")
        # t.sleep(0.5)
        
        # get transcript
        # output_filename_debug = f'web_recordings/{prefix}/mod_{prefix}_{current_step}_{starting_point}.wav'
        time_split = time.split(':')
        # cutout = int(time_split[0]) * 3600 * 1000 + int(time_split[1]) * 60 * 1000 + int(time_split[2]) * 1000 + int(time_split[3])
        # optimize_audio.optimize_once(output_filename, output_filename, cutout)

        recording_time = t.strftime('%d.%m.%Y %X')

        if CUTTING_MODE == CUT_FILE:
            transcript = bt.transcript(output_filename, bt.FINGERPRINT)
        elif CUTTING_MODE == CUT_LETTERS:
            full_transcript = client_data[sid]["transcript"]
            last_length = client_data[sid].get("last_transcript_length", 0)
            transcript = full_transcript[last_length:]
            client_data[sid]["last_transcript_length"] = len(full_transcript)

        # Inhale/Exhale detection
        if record_type == "automatic_ie":
            prediction = int(ie_fingerprint_model.predict(hash_vectorizer.fit_transform([transcript]))[0])
            print(f"Predicted class: {prediction}")
            current_step_predicted = 'exhale' if prediction == 1 else 'inhale'
            final_output_filename = f'web_recordings/{prefix}/audio/{prefix}_{current_step_predicted}_{recording_time}.wav'
            shutil.copyfile(output_filename, final_output_filename)
        
        # Update model
        if update:
            if current_step == current_step_predicted:
                ie_fingerprint_model.partial_fit(hash_vectorizer.fit_transform([transcript]))
                with open(IE_MODEL_FILE, 'wb') as f:
                    joblib.dump(ie_fingerprint_model, f)  

        # Activity detection
        if prefix.find('_auto') != -1:
            detected_activity_cluster = int(transcript_model.predict(hash_vectorizer.fit_transform([transcript]))[0])
            prefix = 'Active' if detected_activity_cluster == 2 else 'Resting' if detected_activity_cluster == 1 else 'Other'
        # transcript_prefix = f'{prefix} {current_step} {starting_point}: '

        # create graph
        graph_path = f'web_recordings/{prefix}/graphs/{prefix}_{current_step}_{recording_time}.png'
        create_waveform.create_waveform(output_filename, transcript, graph_path)

        return {
            'transcript' : transcript, 
            'recording_time' : time,
            'inhale_exhale' : current_step,
            'inhale_exhale_predicted' : current_step_predicted,
            'activity' : prefix
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
                final_filename = os.path.abspath(f'web_recordings/{prefix}/audio/{prefix}_full_{recording_time}.wav')
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
    # optimize_audio.optimize_once(chunk_output, chunk_output, 0)
    # audio_optimized = AudioSegment.from_wav(chunk_output)
    # get letter
    # Run both transcription algorithms concurrently using eventlet
    silence_checker = eventlet.spawn(get_recognizer().process_chunk, audio, RATE)
    audio_fingerprint = eventlet.spawn(bt.transcript_chunk, chunk_output)
    # Wait for both to finish
    silence_symbol = silence_checker.wait()
    transcript_symbol = audio_fingerprint.wait()
    # Choose primary result by default; adjust merging logic as needed
    client_data[sid]["transcript_silence"] += silence_symbol
    client_data[sid]["transcript"] += transcript_symbol
    # emit back to the same client only
    socketio.emit('transcription_result', {'letter': transcript_symbol}, room=sid)
    if len(client_data[sid]["transcript_silence"]) > SILENCE_VALIDATION:
        silence_check = client_data[sid]["transcript_silence"][-SILENCE_VALIDATION:]
        if re.match(SILENCE_PATTERN, silence_check):
            print("SILENCE DETECTED")
            socketio.emit('silence', {'silence': True}, room=sid)


if __name__ == "__main__":
    # app.secret_key = os.urandom(30).hex()
    socketio.run(app, host='0.0.0.0', port='5001', debug=True)
