// Enhanced recording_handler.js – adds realtime audio‑processing chain (HP‑filter → gate → EQ → compressor → limiter) using the Web Audio API.
// The MediaRecorder now records the **processed** stream so everything you hear is what you get.

/* ---------------------------------------------------------------------------
 * 1.  Globals
 * -------------------------------------------------------------------------*/
const socket = io();

let audioCtx;                 // shared AudioContext
let workletReady = false;     // flag when GateProcessor is loaded

let mediaRecorder;            // MediaRecorder that records the *processed* stream
let rawStream;                // raw getUserMedia stream (for clean stop)
let last_time = document.getElementById('stopwatch').innerHTML;
let cuts = [last_time];
let sid;

/* ---------------------------------------------------------------------------
 * 2.  Utilities (unchanged)
 * -------------------------------------------------------------------------*/
function timeStringToSeconds(timeStr) {
  const [hours, minutes, seconds, milliseconds] = timeStr.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

async function sendData() {
  // same as original implementation ...
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
          const textResponse = await response.text();
          const data = JSON.parse(textResponse);

          const { transcript, inhale_exhale, inhale_exhale_predicted, recording_time, activity } = data;

          document.getElementById("transcript").innerHTML += `<tr>
              <td>${transcript}</td>
              <td>${recording_time}</td>
              <td>${inhale_exhale}</td>
              <td>${inhale_exhale_predicted}</td>
              <td>${activity}</td>
              </tr>`;

      } else {
          console.error("Failed to send form data.");
      }
  } catch (error) {
      console.error("Error sending form data:", error);
  }
}

/* ---------------------------------------------------------------------------
 * 3.  Inline AudioWorklet code (gate / expander)
 * -------------------------------------------------------------------------*/
const gateProcessorCode = `
class GateProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors () {
    return [
      { name: 'threshold', defaultValue: -45 },
      { name: 'ratio',      defaultValue: 20 },
      { name: 'attack',     defaultValue: 0.005 },
      { name: 'release',    defaultValue: 0.08 }
    ];
  }
  constructor () {
    super();
    this._env = 0.0;
    this._sampleRate = sampleRate;
  }
  dB2lin (dB) { return Math.pow(10, dB / 20); }
  process (inputs, outputs, parameters) {
    const inp = inputs[0][0];
    const out = outputs[0][0];
    if (!inp) return true;
    const atk = parameters.attack[0] * this._sampleRate;
    const rel = parameters.release[0] * this._sampleRate;
    const thr = this.dB2lin(parameters.threshold[0]);
    const rat = parameters.ratio[0];
    for (let i = 0; i < inp.length; i++) {
      const x = Math.abs(inp[i]);
      this._env += (x - this._env) / (x > this._env ? atk : rel);
      const gain = this._env < thr ? Math.pow(this._env / thr, rat - 1) : 1.0;
      out[i] = inp[i] * gain;
    }
    return true;
  }
}
registerProcessor('gate-processor', GateProcessor);
`;

/* ---------------------------------------------------------------------------
 * 4.  Build DSP chain for a gUM stream → MediaRecorder
 * -------------------------------------------------------------------------*/
async function buildProcessedStream (stream) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') await audioCtx.resume();

  if (!workletReady) {
    const blobURL = URL.createObjectURL(new Blob([gateProcessorCode], { type: 'application/javascript' }));
    await audioCtx.audioWorklet.addModule(blobURL);
    workletReady = true;
  }

  const src = audioCtx.createMediaStreamSource(stream);

  const hp = audioCtx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 90;

  const gate = new AudioWorkletNode(audioCtx, 'gate-processor');
  gate.parameters.get('threshold').value = -45;
  gate.parameters.get('ratio').value = 20;
  gate.parameters.get('attack').value = 0.005;
  gate.parameters.get('release').value = 0.08;

  const eqBell = audioCtx.createBiquadFilter();
  eqBell.type = 'peaking';
  eqBell.frequency.value = 1400;
  eqBell.gain.value = 3;
  eqBell.Q.value = 1.4;

  const comp = audioCtx.createDynamicsCompressor();
  comp.threshold.value = -30;
  comp.ratio.value = 3;
  comp.attack.value = 0.01;
  comp.release.value = 0.15;

  const limiter = audioCtx.createDynamicsCompressor();
  limiter.threshold.value = -1;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.05;

  const dst = audioCtx.createMediaStreamDestination();

  src.connect(hp).connect(gate).connect(eqBell).connect(comp).connect(limiter).connect(dst);

  return dst.stream;
}

/* ---------------------------------------------------------------------------
 * 5.  UI: Start Recording
 * -------------------------------------------------------------------------*/
document.getElementById('mic-button').addEventListener('click', async () => {
  startStopwatch();
  document.getElementById('step').innerHTML = 'inhale';
  try {
    rawStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const processedStream = await buildProcessedStream(rawStream);
    mediaRecorder = new MediaRecorder(processedStream, { mimeType: 'audio/webm;codecs=opus' });
    mediaRecorder.ondataavailable = (evt) => {
      if (evt.data && evt.data.size > 0) socket.emit('audio_chunk', evt.data);
    };
    mediaRecorder.start(200);
  } catch (err) {
    console.error('Error accessing microphone:', err);
  }
});

/* ---------------------------------------------------------------------------
 * 6.  UI: Stop Recording
 * -------------------------------------------------------------------------*/
document.getElementById('mic-stop').addEventListener('click', async () => {
  sendData();
  stopStopwatch();
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    last_time = document.getElementById('stopwatch').innerHTML;
    cuts.push(last_time);
    rawStream.getTracks().forEach(t => t.stop());
  }
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
});

/* ---------------------------------------------------------------------------
 * 7.  UI: Manual cut button (restored)
 * -------------------------------------------------------------------------*/
document.getElementById('mic-cut').addEventListener('click', async () => {
  sendData();
  last_time = document.getElementById('stopwatch').innerHTML;
  cuts.push(last_time);

  if (document.getElementById('step').innerHTML === 'inhale')
    document.getElementById('step').innerHTML = 'exhale';
  else
    document.getElementById('step').innerHTML = 'inhale';
});

/* ---------------------------------------------------------------------------
 * 8.  Socket.IO callbacks (unchanged)
 * -------------------------------------------------------------------------*/
socket.on('transcription_result', (data) => {
  document.getElementById('live-transcript').innerText += data.letter;
});

socket.on('silence', () => {
  document.getElementById('mic-cut').click();
});

socket.on('connect', () => {
  sid = socket.id;
});
