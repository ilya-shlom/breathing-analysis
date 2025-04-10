import os
import time as t

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

from tools import optimize_audio, create_waveform
from tools.get_features import get_features_frame

from src.utils import *

UPLOAD_FOLDER = '/data'
MODELS_FOLDER = 'models'

IE_MODEL_FILE = f"{MODELS_FOLDER}/model_transcript_fingerprint.pkl"

CHUNK_LENGTH = 200

CUT_FILE = 0
CUT_LETTERS = 1
CUTTING_MODE = CUT_FILE

user_data = {
    "chunks": 0,
    "transcript": ""
}


ie_model = joblib.load(f"{MODELS_FOLDER}/model_svm.pkl")
ie_fingerprint_model = joblib.load(IE_MODEL_FILE)
transcript_model = joblib.load(f"{MODELS_FOLDER}/model_transcript.pkl")
transcript_model = joblib.load(f"{MODELS_FOLDER}/model_transcript_breath.pkl")
hash_vectorizer = HashingVectorizer(analyzer='char_wb', ngram_range=(3, 5), n_features=50)


app = Flask(__name__)
app.config.update(
    TEMPLATES_AUTO_RELOAD=True
)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
# app.secret_key = 'tempkey'

socketio = SocketIO(app)


# File to which audio chunks are appended in binary mode.
RECORDING_FILE = "recording.webm"

# Ensure the recording file exists/starts empty.
with open(RECORDING_FILE, "wb") as f:
    pass


@app.route('/')
def index():
    user_data = {
    "chunks": 0,
    "transcript": ""
    }
    return render_template("index.html")


@app.route('/audio')
def audio():
    # Serve the current recording.
    # Note: Depending on your OS, reading a file while it's being written to may require extra care.
    return send_file(RECORDING_FILE, mimetype='audio/webm')

@socketio.on('audio_chunk')
def handle_audio_chunk(chunk):
    global last_timestamp  
    current_timestamp = t.time()  
    # 'chunk' is binary data from the client.
    with open(RECORDING_FILE, "ab") as f:
        f.write(chunk)
    
    last_timestamp = current_timestamp  # Store last timestamp for debugging
    user_data["chunks"] += 1
    chunk_output = "temp_chunk.wav"

    subprocess.run([
        "ffmpeg", "-y", "-fflags", "+genpts", "-i", RECORDING_FILE, "-ar", "44100", "-ac", "2", "-f", "wav", chunk_output
        ])
    chunk_audio = AudioSegment.from_wav(chunk_output)
    chunk_audio = chunk_audio[CHUNK_LENGTH*(user_data["chunks"] - 1):CHUNK_LENGTH*(user_data["chunks"])]
    chunk_audio.export(chunk_output, format='wav')
    optimize_audio.optimize_once(chunk_output, chunk_output, 0)

    best_letter = bt.transcript_chunk(chunk_output, bt.FINGERPRINT)
    user_data["transcript"] += best_letter
    socketio.emit('transcription_result', {'letter': best_letter})

        
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
        shutil.copy(RECORDING_FILE, filename)


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
        cutout = int(time_split[0]) * 3600 * 1000 + int(time_split[1]) * 60 * 1000 + int(time_split[2]) * 1000 + int(time_split[3])
        optimize_audio.optimize_once(output_filename, output_filename, cutout)

        recording_time = t.strftime('%d.%m.%Y %X')

        if CUTTING_MODE == CUT_FILE:
            transcript = bt.transcript(output_filename, bt.FINGERPRINT)
        elif CUTTING_MODE == CUT_LETTERS:
            chunks_amount = user_data["chunks"]
            transcript = user_data["transcript"]
            transcript = transcript[len(transcript) - chunks_amount:]
            print("chunks & transcript: ", chunks_amount, transcript)
            user_data["chunks"] = 0

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
    if request.method == "POST":
        prefix = request.form.get("prefix")
        recording_time = t.strftime('%d.%m.%Y_%H.%M.%S')
        try:
            if os.path.exists(RECORDING_FILE):
                final_filename = os.path.abspath(f'web_recordings/{prefix}/audio/{prefix}_full_{recording_time}.wav')
                subprocess.run([
                    "ffmpeg", "-y", "-fflags", "+genpts", "-i", RECORDING_FILE, "-ar", "44100", "-ac", "2", "-f", "wav", final_filename
                    ])
                os.remove(RECORDING_FILE)
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


if __name__ == "__main__":
    # app.secret_key = os.urandom(30).hex()
    socketio.run(app, host='0.0.0.0', port='5001', debug=True, ssl_context="adhoc")
