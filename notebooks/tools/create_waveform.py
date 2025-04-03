import librosa
import matplotlib.pyplot as plt
import matplotlib
import numpy as np


def create_waveform(audio_path, translate, graph_path):
    matplotlib.use('Agg')

    x , sr = librosa.load(audio_path)
    highest_amplitude = np.max(x)

    # time = np.linspace(0, len(x) / sr, len(x))  # Create a time array
    plt.figure(figsize=(20, 5))
    # plt.plot(time, x, color='blue')
    librosa.display.waveshow(x, sr=sr)
    plt.xlabel("Time (s)")
    plt.ylabel("Amplitude")
    plt.title(audio_path)
    duration = librosa.get_duration(y=x, sr=sr)
    time_points = np.arange(0.1, duration, 0.2)

    letters = list(translate)

    # Add letters under the x-axis
    for t, letter in zip(time_points, letters):
        plt.text(t, -highest_amplitude - 0.05, letter, ha='center', va='center', fontsize=10, transform=plt.gca().transData)
        plt.axvline(x=t-0.1, color='gray', linestyle='--', linewidth=1)  # Vertical line at time 't-0.1'
        plt.axvline(x=t+0.1, color='gray', linestyle='--', linewidth=1)  # Vertical line at time 't+0.1'


    # Adjust the limits and show the plot
    plt.ylim(-highest_amplitude - 0.1, highest_amplitude + 0.1)  # Adjust the y-axis to avoid overlap
    plt.savefig(graph_path)


# output_filename = f'web_recordings/z/audio/z_inhale_1.wav'
# transcript = "abcde"
# graph_path = f'web_recordings/z/audio/z_test_1.png'
# create_waveform(output_filename, transcript, graph_path)