import os
from pydub import AudioSegment
import subprocess

def change_audio_tempo(audio_path, target_length, output_path):
    """
    Change the tempo of an audio file to match the target length without changing pitch.

    Parameters:
        audio_path (str): Path to the input audio file.
        target_length (float): Target duration in seconds.
        output_path (str): Path to save the processed audio file.
    """
    # Load the audio file
    audio = AudioSegment.from_file(audio_path)
    current_length = len(audio)

    # Calculate the tempo change ratio
    tempo_ratio = target_length

    # Use rubberband to adjust the tempo
    temp_output = "temp_audio.wav"
    audio.export(temp_output, format="wav")  # Export as WAV for rubberband

    # Run rubberband to change tempo
    processed_output = "stretched_audio.wav"
    subprocess.run([
        "rubberband", "-D", str(tempo_ratio), temp_output, processed_output
    ])

    # Load the processed audio and save to the final format
    stretched_audio = AudioSegment.from_file(processed_output)
    stretched_audio.export(output_path, format="wav")

    # Cleanup temporary files
    os.remove(temp_output)
    os.remove(processed_output)

# Directory processing
def process_directory(input_dir, target_length, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    for filename in os.listdir(input_dir):
        if filename.endswith(".mp3") or filename.endswith(".wav"):
            input_path = os.path.join(input_dir, filename)
            output_path = os.path.join(output_dir, filename)
            print(f"Processing {filename}...")
            change_audio_tempo(input_path, target_length, output_path)
            print(f"Saved: {output_path}")

# Example usage
input_directory = "modified_letters"
output_directory = "letters_source_files"
target_duration = 0.2  # Target length in seconds

process_directory(input_directory, target_duration, output_directory)
