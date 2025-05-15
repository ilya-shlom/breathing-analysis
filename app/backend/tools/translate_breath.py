import librosa
import numpy as np
import glob
from pydub import AudioSegment
from scipy.signal import correlate



def load_audio(file_path):
    # Load the audio file
    signal, sr = librosa.load(file_path, sr=None)
    return signal, sr

def compare_waveforms(signal1, signal2):
    # Normalize signals
    signal1 = signal1 / np.max(np.abs(signal1))
    signal2 = signal2 / np.max(np.abs(signal2))
    # Compute cross-correlation
    correlation = correlate(signal1, signal2, mode='full')
    max_corr = np.max(correlation)
    return max_corr

letters = glob.glob("letters_source_files/*.wav")

def translate_breath(b):
    transcript = ""
    breath_audio, sr = load_audio(b)
    duration = librosa.get_duration(y=breath_audio, sr=sr) * 1000
    breath = AudioSegment.from_wav(b)

    print(b + ":", end=' ')
    for x in range(0, int(duration), 200):
        breath_fragment = breath[x:x+200]
        temp_output = "temp_fragment.wav"
        breath_fragment.export(temp_output, format='wav')

        # comparing
        best_similarity = {}
        breath_fragment_for_comparing, sr1 = load_audio(temp_output)
        for letter in letters:
            # print(letter)
            current_letter, sr2 = load_audio(letter)
            waveform_similarity = compare_waveforms(breath_fragment_for_comparing, current_letter)
            best_similarity[letter[-5]] = float(waveform_similarity)
        transcript += max(best_similarity, key=best_similarity.get)
    return transcript