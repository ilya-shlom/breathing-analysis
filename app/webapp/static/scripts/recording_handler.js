const socket = io();

let mediaRecorder;
let stream;
let last_time = document.getElementById('stopwatch').innerHTML;
let cuts = [last_time];
let sid;

function timeStringToSeconds(timeStr) {
    const [hours, minutes, seconds, milliseconds] = timeStr.split(':').map(Number);
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
  }

async function sendData() {
    document.getElementById("live-transcript").innerText += "/";
    const formData = new FormData(document.getElementById('audio-sender'));
    formData.append('last_time', last_time);
    formData.append('current_step', document.getElementById('step').innerHTML);
    formData.append('sid', sid);

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
    cuts.push(last_time);
    stream.getTracks().forEach(track => track.stop());
    const formData = new FormData(document.getElementById('audio-sender'));
    formData.append("sid", sid);
    try {
        const response = await fetch("/stop", {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            console.log("Recording finished, playing audio.");
            const blob = await response.blob();
            const audioUrl = URL.createObjectURL(blob);

            // WaveSurfer
            const regions = WaveSurfer.Regions.create();
            const wavesurfer = WaveSurfer.create({...window.options, url: audioUrl, plugins: [regions]})
            
              wavesurfer.on('interaction', () => {
                wavesurfer.play()
              })

              wavesurfer.on('decode', () => {
                for (let i = 0; i < cuts.length - 1; i++) {
                    regions.addRegion({
                        start: timeStringToSeconds(cuts[i]),
                        end: timeStringToSeconds(cuts[i + 1]),
                        content: i % 2 === 0 ? 'Inhale' : 'Exhale',
                        color: i % 2 === 0 ? "rgba(174, 255, 147, 0.5)" : "rgba(147, 188, 255, 0.5)",
                        drag: false,
                        resize: false,
                    })
            }
              })

            //   wavesurfer.on('decode', () => {
                
                // })
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
    cuts.push(last_time);
    // if (document.querySelector('input[name="record_type"]:checked').value === "manual_ie") {
        if (document.getElementById('step').innerHTML === "inhale") 
            document.getElementById('step').innerHTML = "exhale";
        else
            document.getElementById('step').innerHTML = "inhale";
    // }
});


socket.on('transcription_result', function(data) {
    // Optionally display it in the UI
    document.getElementById("live-transcript").innerText += data.letter;
});

socket.on('connect', () => {
    sid = socket.id;
})