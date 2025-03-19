import librosa
import numpy as np
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

