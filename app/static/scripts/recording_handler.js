const mic_button = document.getElementById("mic-button");
const stop_button = document.getElementById("mic-stop");
const playback = document.querySelector(".playback");
const recording_status = document.getElementById("record-status");

mic_button.addEventListener('click', ToggleMic);
stop_button.addEventListener('click', StopRecording);

let can_record = false;
let is_recording = false;
let recorder = null;

let first_record = true;

let prefix = "";
let starting_point = 0;
let current_step = "";
let transcript = "";

let chunks = [];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function AudioSetup() {
    console.log("Setting up");
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({
            audio: true
        })
        .then (StreamSetup)
        .catch (err => {
            console.error(err)
        });
    }
}

function StreamSetup(stream) {
    recorder = new MediaRecorder(stream);

    recorder.ondataavailable = e => {
        chunks.push(e.data);
    }

    recorder.onstop = e => {
        const blob = new Blob(chunks, {'type': "audio/wav"});
        chunks = [];
        const audio_url = window.URL.createObjectURL(blob);
        playback.src = audio_url;

        const xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() {
            if (xhr.readyState == XMLHttpRequest.DONE) {
                serverResponse = xhr.responseText;
                serverResponse = JSON.parse(serverResponse);
                console.log(serverResponse.activity);
                document.getElementById("transcript").innerHTML += `<tr>
                <td>${serverResponse.transcript}</td>
                <td>${serverResponse.recording_time}</td>
                <td>${serverResponse.inhale_exhale}</td>
                <td>${serverResponse.activity}</td>
                </tr>`
            }
        }

        var fd = new FormData();
        fd.append("audio_data", blob, 'temp.wav');


        fd.set("prefix", prefix);

        if (current_step != "auto")
            fd.set("starting_point", starting_point.toString());
        else
            fd.set("starting_point", "0");
        fd.set("current_step", current_step);
        
        if (current_step == "inhale")
            current_step = "exhale";
        else if (current_step == "exhale") {
            current_step = "inhale";
            starting_point += 1;
        }
        

        for (const [key, value] of fd.entries()) {
            console.log(key, value);
          }

        xhr.open('post', '/save_file', true);

        xhr.send(fd);
        // .then(function (response) {

        //     if (response.ok) {
        //         response.json()
        //             .then(function (response) {
        //                 transcript = response['transcript'];
        //                 document.getElementById("transcript").innerHTML += `\n${transcript}`
        //                 return(1);
        //             });
        //     } else {
        //         throw Error('Something went wrong');
        //     }
        // })
        // .catch(function (error) {
        //     console.log(error);
        // });
    }

    can_record = true;
}

function ToggleMic() {
    if (!can_record)
        return;

    console.log(is_recording);

    if (first_record) {
        prefix = document.getElementById('prefix').value;
        starting_point = 0;
        record_type = document.querySelector(`[name="record_type"]:checked`).value;
        if (record_type == "manual_ie") {
            current_step = "inhale";
            starting_point = parseInt(document.getElementById('start').value);
        }
        else
            current_step = "auto";
        
        activity_mode = document.querySelector(`[name="mode"]:checked`).value;
        if (activity_mode == 'automatic_activity') {
            prefix += '_auto';
        }
        first_record = false;
    }


    is_recording = !is_recording;

    if (is_recording) {
        recorder.start();
        recording_status.innerHTML = `Recording...`;
    } else {
        recorder.stop();
        recording_status.innerHTML = "Not Recording";
        sleep(500).then(() => {
            is_recording = !is_recording;
            recorder.start();
            recording_status.innerHTML = `Recording...`;
        })

    }
}

function StopRecording() {
    if (!first_record) {
        recorder.stop();
        recording_status.innerHTML = "Not recording";
    }
}

AudioSetup();