import numpy as np
import librosa
from pydub import AudioSegment
from scipy.ndimage import maximum_filter
import pandas as pd
from math import exp, sqrt
import ast

def load_audio(file_path):
    # Load the audio file
    signal, sr = librosa.load(file_path, sr=None)
    return signal, sr

def compute_spectrogram(audio_file):
    """
    Load an audio file and compute its STFT magnitude spectrogram.
    The spectrogram is converted to dB scale.
    """
    y, sr = librosa.load(audio_file, sr=None)
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=512))
    S_db = librosa.amplitude_to_db(S, ref=np.max)
    return S_db, sr

def extract_peaks(S_db, amp_min=-40, neighborhood_size=(20, 20)):
    """
    Identify local spectral peaks in the dB-scaled spectrogram.
    Only peaks above the amp_min threshold are retained.
    """
    local_max = maximum_filter(S_db, size=neighborhood_size) == S_db
    detected_peaks = np.where(local_max & (S_db >= amp_min))
    peaks = list(zip(detected_peaks[0], detected_peaks[1]))
    return peaks

def generate_features_from_peaks(peaks, fan_value=5, delta_time_max=10):
    """
    Instead of generating discrete hash strings, generate numerical fingerprint
    features. Each feature is a tuple: (freq1, freq2, time_delta)
    where freq1 and freq2 are frequency bins of paired peaks and time_delta is their time difference.
    """
    peaks.sort(key=lambda x: x[1])  # sort by time
    features = []
    num_peaks = len(peaks)
    
    for i in range(num_peaks):
        freq1, time1 = peaks[i]
        for j in range(1, fan_value + 1):
            if i + j < num_peaks:
                freq2, time2 = peaks[i + j]
                time_delta = time2 - time1
                if 0 < time_delta <= delta_time_max:
                    features.append((freq1, freq2, time_delta))
    return features

def extract_audio_fingerprint(audio_file):
    """
    Extract continuous fingerprint features from an audio file.
    Returns a list of tuples (freq1, freq2, time_delta)
    """
    S_db, sr = compute_spectrogram(audio_file)
    peaks = extract_peaks(S_db, amp_min=-40, neighborhood_size=(20, 20))
    features = generate_features_from_peaks(peaks, fan_value=5, delta_time_max=10)
    return features

def feature_distance(feat1, feat2):
    """
    Compute Euclidean distance between two fingerprint features.
    Each feature is a tuple (freq1, freq2, time_delta).
    """
    return sqrt(sum((a - b) ** 2 for a, b in zip(feat1, feat2)))

def gaussian_similarity(distance, sigma=10.0):
    """
    Convert a distance to a similarity score using a Gaussian kernel.
    The score is in the range (0, 1], where 0 means no similarity and 1 means perfect match.
    """
    return exp(- (distance ** 2) / (2 * sigma ** 2))

def compute_continuous_similarity(fp_features1, fp_features2, sigma=10.0):
    """
    Compute a continuous similarity score between two sets of fingerprint features.
    
    For each feature in the first fingerprint, find the closest feature in the second fingerprint
    (using Euclidean distance), convert that distance into a similarity score via a Gaussian kernel,
    and average these scores. Repeat symmetrically and then average both directions.
    """
    if not fp_features1 or not fp_features2:
        return 0.0

    def avg_similarity(features_A, features_B):
        total_sim = 0.0
        for feat_A in features_A:
            # Find the minimum distance to any feature in features_B
            min_dist = min(feature_distance(feat_A, feat_B) for feat_B in features_B)
            total_sim += gaussian_similarity(min_dist, sigma=sigma)
        return total_sim / len(features_A)
    
    sim1 = avg_similarity(fp_features1, fp_features2)
    sim2 = avg_similarity(fp_features2, fp_features1)
    # Average the two directional similarities
    return (sim1 + sim2) / 2

letters = pd.read_csv("fingerprint.csv")

def parse_fingerprint(fingerprint_str):
    try:
        if pd.isna(fingerprint_str):
            return []
        parsed_list = eval(fingerprint_str.strip())
        return [(np.int64(a), np.int64(b), np.int64(c)) for (a, b, c) in parsed_list]
    except (SyntaxError, ValueError, TypeError) as e:
        print(f"Error parsing row: {fingerprint_str} — {e}")
        return []

letters["fingerprint"] = letters["fingerprint"].apply(parse_fingerprint)

def translate_breath(b):
    transcript = ""
    breath_audio, sr = load_audio(b)
    duration = librosa.get_duration(y=breath_audio, sr=sr) * 1000
    breath = AudioSegment.from_wav(b)


    for x in range(0, int(duration), 200):
        breath_fragment = breath[x:x+200]
        temp_output = "temp_fragment.wav"
        breath_fragment.export(temp_output, format='wav')

        # comparing
        best_similarity = {}
        breath_fragment_fp = extract_audio_fingerprint(temp_output)
        # print(f"breath fragment fingerprint: {breath_fragment_fp}")
        # Apply compute_continuous_similarity to each row
        letters["similarity"] = letters["fingerprint"].apply(
            lambda fingerprint: compute_continuous_similarity(breath_fragment_fp, fingerprint)
        )
        # print(letters["similarity"])
        # Find the letter with the highest similarity
        best_letter = letters.loc[letters["similarity"].idxmax(), "letter"]
        transcript += best_letter
    return transcript
