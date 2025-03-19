import os
import time as t

from flask import Flask, render_template, request, session, redirect, url_for
import joblib
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import subprocess
import shutil
from sklearn.feature_extraction.text import HashingVectorizer

from tools import optimize_audio, translate_breath, create_waveform
from tools.get_features import get_features_frame

from src.utils import *

UPLOAD_FOLDER = '/data'
MODELS_FOLDER = 'models'

ie_model = joblib.load(f"{MODELS_FOLDER}/model_svm.pkl")
transcript_model = joblib.load(f"{MODELS_FOLDER}/model_transcript.pkl")
hash_vectorizer = HashingVectorizer(analyzer='char_wb', ngram_range=(3, 5), n_features=50)


app = Flask(__name__)
app.config.update(
    TEMPLATES_AUTO_RELOAD=True
)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER


@app.route('/')
def index():
    return render_template("index.html")


@app.route('/save_file', methods=['GET', 'POST'])
def save_file():
    if request.method == "POST":
        print(request.files)
        data = request.files["audio_data"]
        prefix = request.form.get("prefix")
        starting_point = request.form.get("starting_point")
        current_step = request.form.get("current_step")
        filename = data.filename
        # filename = request.files["prefix"] + "/" + filename
        data.save(filename)
        data.flush()
        data.close()


        # change codec
        if not os.path.exists(f'web_recordings/{prefix}'):
            os.makedirs(f'web_recordings/{prefix}')
            os.makedirs(f'web_recordings/{prefix}/audio')
            os.makedirs(f'web_recordings/{prefix}/graphs')

        if current_step != "auto":
            output_filename = f'web_recordings/{prefix}/audio/{prefix}_{current_step}_{starting_point}.wav'
        else:
            output_filename = 'temp_proccessed.wav'
        subprocess.run([
            "ffmpeg", "-y", "-i", filename, "-ar", "44100", "-ac", "2", "-f", "wav", output_filename
            ])
        
        print("finished subprocess")
        # t.sleep(0.5)
        
        # get transcript
        # output_filename_debug = f'web_recordings/{prefix}/mod_{prefix}_{current_step}_{starting_point}.wav'
        optimize_audio.optimize_once(output_filename, output_filename)

        recording_time = t.strftime('%d.%m.%Y %X')

        # Inhale/Exhale detection
        if current_step == "auto":
            df_classification = get_features_frame([output_filename], 1).transpose()
            for dropped_columns in [0, 6, 7]:
                df_classification = df_classification.drop(dropped_columns, axis=1)

            for dropped_columns in range(21, 33):
                df_classification = df_classification.drop(dropped_columns, axis=1)

            for dropped_columns in range(34, 68):
                df_classification = df_classification.drop(dropped_columns, axis=1)

            prediction = ie_model.predict(df_classification)
            print(f"Predicted class: {prediction}")
            current_step = 'exhale' if prediction[0] == 1 else 'inhale'
            final_output_filename = f'web_recordings/{prefix}/audio/{prefix}_{current_step}_{recording_time}.wav'
            shutil.copyfile(output_filename, final_output_filename)

        transcript = translate_breath.translate_breath(output_filename)

        # create graph
        graph_path = f'web_recordings/{prefix}/graphs/{prefix}_{current_step}_{recording_time}.png'
        create_waveform.create_waveform(output_filename, transcript, graph_path)

        # Activity detection
        if prefix.find('_auto') != -1:
            detected_activity_cluster = int(transcript_model.predict(hash_vectorizer.fit_transform([transcript]))[0])
            prefix = 'Active' if detected_activity_cluster == 2 else 'Resting' if detected_activity_cluster == 1 else 'Other'
        # transcript_prefix = f'{prefix} {current_step} {starting_point}: '

        
        return {
            'transcript' : transcript, 
            'recording_time' : recording_time,
            'inhale_exhale' : current_step,
            'activity' : prefix
            }
    

# @app.route('/create_csv', methods=['GET', 'POST'])
# def create_csv():
#     if request.method == "POST":
#         data = request
#         print(data)
#         return data


if __name__ == "__main__":
    # app.secret_key = os.urandom(30).hex()
    app.run(host='0.0.0.0', port='5001', debug=True, ssl_context="adhoc")
    