import glob
from pydub.utils import get_array_type
from pydub import AudioSegment
from scipy.signal import butter, filtfilt
import scipy.io.wavfile as wavfile
from scipy.signal.windows import hann
import numpy as np


def normalize_audio(input_file, output_file, target_dBFS=-15.0):
    sound = AudioSegment.from_file(input_file)

    change_in_dBFS = target_dBFS - sound.dBFS
    normalized_sound = sound.apply_gain(change_in_dBFS)

    normalized_sound.export(output_file, format="wav")


def custom_equalizer(input_file, output_file):
    sample_rate, data = wavfile.read(input_file)

    # Handle stereo audio (convert to mono if needed)
    if len(data.shape) > 1:
        data = data.mean(axis=1).astype(data.dtype)

    # Apply a window function (Hann window)
    window = hann(len(data))
    windowed_data = data * window

    # Apply FFT (Fast Fourier Transform)
    freq_data = np.fft.rfft(windowed_data)
    frequencies = np.fft.rfftfreq(len(data), d=1/sample_rate)

    # Define gain adjustments (example: boost low, cut mid, boost high)
    gain = np.ones_like(frequencies)
    gain[(frequencies >= 630) & (frequencies < 800)] *= 0.9 
    gain[(frequencies >= 800) & (frequencies < 1000)] *= 0.8
    gain[(frequencies >= 1000) & (frequencies < 2500)] *= 0.4
    gain[frequencies > 2500] *= 0  

    # Apply the gain to frequency data
    equalized_freq_data = freq_data * gain

    # Inverse FFT to get back to time domain
    equalized_audio = np.fft.irfft(equalized_freq_data).astype(data.dtype)

    wavfile.write(output_file, sample_rate, equalized_audio)


def noise_gate(audio_file, output_file, threshold_db=-6.0, level_reduction_db=-24.0, 
                     attack_ms=10, hold_ms=50, decay_ms=100):
    audio = AudioSegment.from_file(audio_file)
    samples = np.array(audio.get_array_of_samples())
    sample_rate = audio.frame_rate
    sample_width = audio.sample_width
    channels = audio.channels
    
    # Convert attack, hold, and decay from ms to samples
    attack_samples = int(sample_rate * (attack_ms / 1000))
    hold_samples = int(sample_rate * (hold_ms / 1000))
    decay_samples = int(sample_rate * (decay_ms / 1000))
    
    # Threshold and level reduction in linear scale
    threshold_linear = 10 ** (threshold_db / 20)
    reduction_factor = 10 ** (level_reduction_db / 20)
    
    # Process samples
    envelope = 0  # Tracks signal envelope
    hold_counter = 0
    processed_samples = []
    
    for i, sample in enumerate(samples):
        amplitude = abs(sample) / (2 ** (8 * sample_width - 1))  # Normalize amplitude
        
        # Noise gate logic
        if amplitude > threshold_linear:
            envelope = max(envelope, amplitude)  # Update envelope
            hold_counter = hold_samples         # Reset hold counter
        else:
            if hold_counter > 0:
                hold_counter -= 1
            else:
                envelope -= (1 / decay_samples)  # Gradually reduce envelope
                envelope = max(envelope, 0)      # Prevent negative values
        
        # Apply attack smoothing
        if envelope > amplitude:
            amplitude = amplitude + (envelope - amplitude) / attack_samples
        
        # Apply level reduction if gated
        if envelope < threshold_linear:
            amplitude *= reduction_factor
        
        # Re-scale back to sample range
        processed_sample = int(amplitude * (2 ** (8 * sample_width - 1)))
        processed_samples.append(processed_sample)
    
    # Convert processed samples back to AudioSegment
    gated_audio = audio._spawn(np.array(processed_samples, dtype=np.int16).tobytes())
    gated_audio = gated_audio.set_frame_rate(sample_rate)
    
    # Save output audio
    gated_audio.export(output_file, format="wav")


def optimize_audio(parent_dir, modified_dir):
    print("optimizing..")
    wavs = glob.glob(parent_dir + '*.wav')
    for song in wavs:
        print(f"Boosting {song}...")
        wav = AudioSegment.from_wav(song)
        wav_cutout = wav # [750:]
        boosted_wav = wav_cutout + 10
        boosted_wav.export(modified_dir + song[len(parent_dir):], format='wav')

    wavs = glob.glob(modified_dir + '*.wav')
    for song in wavs:
        print(f"Processing {song}...")
        noise_gate(song, song)
        # apply_low_pass_filter(song, 3500, song)
        normalize_audio(song, song)
        custom_equalizer(song, song)
        # remove_high_freq(song, song)

def optimize_once(parent, modified, cutout=0):
    print("optimizing..")
    wav = AudioSegment.from_wav(parent)
    wav_cutout = wav[cutout:] # [750:]
    boosted_wav = wav_cutout + 10
    boosted_wav.export(modified)
    noise_gate(modified, modified)
    # apply_low_pass_filter(song, 3500, song)
    normalize_audio(modified, modified)
    custom_equalizer(modified, modified)
    print("optimized successfully")
