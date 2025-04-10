const socket = io();

let mediaRecorder;
let stream;
let last_time = document.getElementById('stopwatch').innerHTML;
window.cuts = [last_time];

async function sendData() {
    const formData = new FormData(document.getElementById('audio-sender'));
    console.log(formData);
    formData.append('last_time', last_time);
    formData.append('current_step', document.getElementById('step').innerHTML);

    try {
        const response = await fetch("/cut", {
            method: 'POST',
            body:  formData 
        });

        if (response.ok) {
            console.log("Form data successfully sent to server.");
            const textResponse = await response.text();
            const data = JSON.parse(textResponse);  // Use .json() if Content-Type is application/json

            const transcript = data.transcript;
            const inhale_exhale = data.inhale_exhale;
            const inhale_exhale_predicted = data.inhale_exhale_predicted;
            const recording_time = data.recording_time;
            const activity = data.activity;

            document.getElementById("transcript").innerHTML += `<tr>
                <td>${transcript}</td>
                <td>${recording_time}</td>
                <td>${inhale_exhale}</td>
                <td>${inhale_exhale_predicted}</td>
                <td>${activity}</td>
                </tr>`

        } else {
            console.error("Failed to send form data.");
        }
    } catch (error) {
        console.error("Error sending form data:", error);
    }
}

// Start recording and streaming audio
document.getElementById('mic-button').addEventListener('click', async () => {
    startStopwatch();
    // if (document.querySelector('input[name="record_type"]:checked').value === "manual_ie") {
        document.getElementById('step').innerHTML = "inhale";
    // }
    try {
        // Use the modern getUserMedia API
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Create a MediaRecorder instance; the browser selects the best supported MIME type
        mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });

        // When data is available, send the audio chunk via socket.io
        mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
            // Socket.IO supports sending Blob objects (binary data)
            socket.emit('audio_chunk', event.data);
        }
        };

        // Start recording with a short timeslice (e.g., 250ms) for low latency streaming.
        mediaRecorder.start(200);
    } catch (err) {
        console.error('Error accessing microphone:', err);
    }
});

// Stop recording and release audio resources
document.getElementById('mic-stop').addEventListener('click', async () => {
    sendData();
    stopStopwatch();
if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    last_time = document.getElementById('stopwatch').innerHTML;
    window.cuts.push(last_time);
    console.log(cuts);
    stream.getTracks().forEach(track => track.stop());
    const formData = new FormData(document.getElementById('audio-sender'));
    try {
        const response = await fetch("/stop", {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            console.log("Recording finished, playing audio.");
            const blob = await response.blob();
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);
            const wavesurfer = WaveSurfer.create({...window.options, url: audioUrl})
            
              wavesurfer.on('interaction', () => {
                wavesurfer.play()
              })
        } else {
            console.error("Failed to send request.");
        }
    } catch (error) {
        console.error("Error sending request:", error);
    }
}
});

document.getElementById('mic-cut').addEventListener('click', async () => {
    sendData();
    last_time = document.getElementById('stopwatch').innerHTML;
    window.cuts.push(last_time);
    // if (document.querySelector('input[name="record_type"]:checked').value === "manual_ie") {
        if (document.getElementById('step').innerHTML === "inhale") 
            document.getElementById('step').innerHTML = "exhale";
        else
            document.getElementById('step').innerHTML = "inhale";
    // }
});


socket.on('transcription_result', function(data) {
    console.log("Received transcription:", data.letter);
    // Optionally display it in the UI
    document.getElementById("live-transcript").innerText += data.letter;
});