import { Mic, ContentCut, Stop, PlayArrow, Pause, Refresh } from "@mui/icons-material";
import Stopwatch from "./Stopwatch";
import RecordingPanel from "./RecordingPanel";
import React, { useRef, useState, useEffect } from "react";
import io from 'socket.io-client'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js'
import WaveOptions from "./WaveOptions";



const GateProcessorCode = `
class GateProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors () {
    return [
      { name: 'threshold', defaultValue: -45 },
      { name: 'ratio',     defaultValue: 20  },
      { name: 'attack',    defaultValue: 0.005 },
      { name: 'release',   defaultValue: 0.08  }
    ];
  }
  constructor () {
    super();
    this._env = 0;
  }
  dB2lin (dB) { return Math.pow(10, dB / 20); }
  process (inputs, outputs, params) {
    const i = inputs[0][0];
    const o = outputs[0][0];
    if (!i) return true;

    const atkC = Math.exp(-1 / (params.attack[0]  * sampleRate));
    const relC = Math.exp(-1 / (params.release[0] * sampleRate));
    const thr  = this.dB2lin(params.threshold[0]);
    const invRatio = 1 / params.ratio[0];

    for (let n = 0; n < i.length; n++) {
      const x = Math.abs(i[n]);
      this._env = x > this._env ? atkC * (this._env - x) + x : relC * (this._env - x) + x;
      const g = this._env < thr ? (this._env / thr) ** invRatio : 1;
      o[n] = i[n] * g;
    }
    return true;
  }
}
registerProcessor('gate-processor', GateProcessor)
`

export default function Home() {
  const stopwatchRef = useRef();

  const [socket, setSocket] = useState(0);

  const [isRecording, setIsRecording] = useState(null);
  const [finished, setFinished] = useState(false);

  // ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------
function timeStringToSeconds (t) {
  const [h, m, s, ms] = t.split(':').map(Number)
  return h * 3600 + m * 60 + s + ms / 1000
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

  /* -----------------------------------------------------------------------
   * Refs & State
   * ---------------------------------------------------------------------*/
  const audioCtxRef     = useRef(null)
  const workletReadyRef = useRef(false)
  const mediaRecRef     = useRef(null)
  const rawStreamRef    = useRef(null)
  const cleanupFns      = useRef([])
  const sidRef          = useRef(null)
  const wavesurferRef   = useRef(null)
  const panelRef = useRef(null);

  const [liveText, setLiveText]       = useState('')
  const [rows, setRows]               = useState([])  // transcript table
  const [step, setStep]               = useState('inhale')
  const [clock, setClock]             = useState('00:00:00:000')
  const cutsRef                       = useRef([clock])
  const timerRef                      = useRef(null)

  const MONITOR_AUDIO = false

  const [playbackUrl, setPlaybackUrl] = useState(null);
  const [isPlaying, setIsPlaying]     = useState(false);

  /* ---------------------------------------------------------------------
   * Stopwatch helpers
   * -------------------------------------------------------------------*/
  const startStopwatch = () => {
    const t0 = performance.now()
    timerRef.current = setInterval(() => {
      const dt = performance.now() - t0
      const h  = String(Math.floor(dt / 3600000)).padStart(2, '0')
      const m  = String(Math.floor((dt % 3600000) / 60000)).padStart(2, '0')
      const s  = String(Math.floor((dt % 60000) / 1000)).padStart(2, '0')
      const ms = String(Math.floor(dt % 1000)).padStart(3, '0')
      setClock(`${h}:${m}:${s}:${ms}`)
    }, 50)
  }
  const stopStopwatch = () => {
    clearInterval(timerRef.current)
    timerRef.current = null
  }
  

  /* ---------------------------------------------------------------------
   * Socket wiring
   * -------------------------------------------------------------------*/
  useEffect(() => {
    const socketio = io('http://localhost:5001');
    setSocket(socketio);

    return () => {
      socketio.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('connect', () => { sidRef.current = socket.id })
    socket.on('transcription_result', ({ letter }) => setLiveText(t => t + letter))
    // socket.on('transcription_result', ({ letter }) => console.log("got a letter:", letter))
    socket.on('silence', () => handleCut())
    return () => socket.disconnect()
  }, [socket])

  /* ---------------------------------------------------------------------
   * Build DSP chain & processed MediaStream
   * -------------------------------------------------------------------*/
  const buildProcessedStream = async (stream) => {
    let ctx = audioCtxRef.current
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' })
      audioCtxRef.current = ctx
    } else if (ctx.state === 'suspended') {
      await ctx.resume()
    }

    if (!workletReadyRef.current) {
      const url = URL.createObjectURL(new Blob([GateProcessorCode], { type: 'text/javascript' }))
      await ctx.audioWorklet.addModule(url)
      URL.revokeObjectURL(url)
      workletReadyRef.current = true
    }

    const src  = ctx.createMediaStreamSource(stream)
    const hp   = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 50
    const gate = new AudioWorkletNode(ctx, 'gate-processor')
    gate.parameters.get('threshold').value = -45
    gate.parameters.get('ratio').value     = 20
    gate.parameters.get('attack').value    = 0.005
    gate.parameters.get('release').value   = 0.08
    const bell = ctx.createBiquadFilter(); bell.type = 'peaking'; bell.frequency.value = 1400; bell.gain.value = 3; bell.Q.value = 1.4
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -30; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.15
    const lim  = ctx.createDynamicsCompressor(); lim.threshold.value = -1; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.05
    const dst  = ctx.createMediaStreamDestination()

    src.connect(hp).connect(gate).connect(bell).connect(comp).connect(lim).connect(dst)
    if (MONITOR_AUDIO) lim.connect(ctx.destination)

    cleanupFns.current = [src, hp, gate, bell, comp, lim, dst].map(node => () => node.disconnect())
    return dst.stream
  }

  /* ---------------------------------------------------------------------
   * sendData → POST /cut
   * -------------------------------------------------------------------*/
  const sendData = async () => {
    setLiveText(t => t + '/')
    const fd = new FormData()
    fd.append('last_time', clock)
    fd.append('current_step', step)
    fd.append('sid', sidRef.current)

    try {
      const r = await fetch('http://127.0.0.1:5001/cut', { method: 'POST', body: fd,   credentials: 'include', })
      if (!r.ok) return console.error('POST /cut failed')
      const { transcript, inhale_exhale, recording_time, activity, 
    activity_predicted_text, activity_predicted_audio, ie_predicted_text, ie_predicted_audio } = await r.json()
      setRows(rows => [...rows, { transcript, recording_time, inhale_exhale, activity,
        activity_predicted_text, activity_predicted_audio, ie_predicted_text, ie_predicted_audio
       }])
    } catch (e) { console.error(e) }
  }

  /* ---------------------------------------------------------------------
   * Recording workflow
   * -------------------------------------------------------------------*/
  const startRecording = async () => {
    startStopwatch()
    setStep('inhale')

    const fd = new FormData()
    fd.append('sid', sidRef.current)
    console.log(panelRef.current)
    const panelData = panelRef.current?.getFormData?.();
    if (panelData) {
      Object.entries(panelData).forEach(([key, value]) => {
        fd.append(key, value);
      });
    }    
    await fetch('http://127.0.0.1:5001/start', { method: 'POST', body: fd,   credentials: 'include', })

    try {
      rawStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
      const processed = await buildProcessedStream(rawStreamRef.current)

      mediaRecRef.current = new MediaRecorder(processed, { mimeType: 'audio/webm;codecs=opus' })
      mediaRecRef.current.ondataavailable = ({ data }) => {socket.emit('audio_chunk', data, (response) => {
  // This function runs when the server calls the callback
  if (response?.status === 'ok') {
    console.log('Audio chunk received by server!');
  } else {
    console.error('Server error:', response?.error);
  }
});}
      mediaRecRef.current.start()

      // flush every 200ms
      const flushInt = setInterval(() => mediaRecRef.current.requestData(), 200)
      cleanupFns.current.push(() => clearInterval(flushInt))
    } catch (err) {
      console.error('mic error', err)
    }
  }

  const handleCut = async () => {
    await sendData()
    cutsRef.current.push(clock)
    setStep(s => (s === 'inhale' ? 'exhale' : 'inhale'))
  }

  const stopRecording = async () => {
    await sendData()
    stopStopwatch()

    if (mediaRecRef.current?.state !== 'inactive') mediaRecRef.current.stop()
    rawStreamRef.current?.getTracks().forEach(t => t.stop())

    cutsRef.current.push(clock)

    const fd = new FormData(); fd.append('sid', sidRef.current)
    try {
      const res = await fetch('http://localhost:5001/stop', { method: 'POST', body: fd })
      if (res.ok) {
        const blob = await res.blob()
        const url  = URL.createObjectURL(blob)
        setPlaybackUrl(url)
      }
    } catch (e) { console.error(e) }

    cleanupFns.current.forEach(fn => fn())
    cleanupFns.current = []
    if (audioCtxRef.current) { await audioCtxRef.current.close(); audioCtxRef.current = null; workletReadyRef.current = false }
  }

useEffect(() => {
  if (finished && playbackUrl) {
    playBack(playbackUrl);
  }
}, [finished, playbackUrl, rows]);

  /* ---------------------------------------------------------------------
   * Playback with WaveSurfer
   * -------------------------------------------------------------------*/
  const playBack = async (url) => {
    wavesurferRef.current?.destroy()

    const regions = RegionsPlugin.create()
    const ws = WaveSurfer.create({ ...WaveOptions, url, plugins: [regions] })
    wavesurferRef.current = ws

    ws.on('interaction', () => {
      ws.play();
      setIsPlaying(true);
    })

    ws.on('decode', () => {
      const cuts = cutsRef.current;

      /* ── clear old regions ───────────────────────────── */
      if (typeof regions.clear === 'function') {
        regions.clear();
      } else {
        Object.values(regions.regions || {}).forEach(r => r.remove());
      }

      /* ── redraw with current rows colouring ──────────── */
      for (let i = 0; i < cuts.length - 1; i++) {
        const ie = rows[i]?.inhale_exhale;
        regions.addRegion({
          start: timeStringToSeconds(cuts[i]),
          end:   timeStringToSeconds(cuts[i + 1]),
          content: ie === 'inhale' ? 'Вдох' : 'Выдох',
          color:
            ie === 'inhale'
              ? 'rgba(204,241,255,0.5)'
              : 'rgba(255,204,204,0.5)',
          drag: false,
          resize: false,
        });
      }
    });

    ws.on('finish', () => {
      setIsPlaying(false); 
    });
  }


  /* ---------------------------------------------------------------------
   * Player buttons handlers
   * -------------------------------------------------------------------*/

  const handleStartRecording = () => {
    setIsRecording(true);
    startRecording();
    stopwatchRef.current?.start();
    panelRef.current?.submit();
  };

  const handleStopRecording = () => {
    setFinished(true);
    setIsRecording(false);
    stopRecording();
    stopwatchRef.current?.pause();
  };

  const handleRestart = () => {
    setFinished(false);
    setIsRecording(false);
    stopwatchRef.current?.reset();
    setRows([]);
    setLiveText('');
  }

  const handlePlay = () => {
    !isPlaying ? wavesurferRef.current?.play() : wavesurferRef.current?.pause();
    setIsPlaying((p) => !p);
  }

  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollLeft = el.scrollWidth;
    }
  }, [liveText]);

  return (
    <div className="height-screen grid grid-rows-[auto_1fr_auto]">
      {/* Load Socket.io client from your server: */}

      <main className="flex flex-row gap-[32px] row-start-2 items-center sm:items-start">
        <div className="h-[100px] w-full p-20 flex flex-row justify-start gap-20 items-center">
         <div className={`flex flex-row items-center justify-between p-1 gap-[16px] rounded-full h-12 w-70
          ${isRecording ? 'bg-[#FFD8D8]' : 'bg-[#E9E9E9]'}`}>
          {!isRecording ? 
          finished ? 
          (
            <div className="h-10 w-20 rounded-full bg-white/60 hover:cursor-pointer flex flex-row items-center justify-between px-2">
              {!isPlaying ? <PlayArrow onClick={handlePlay} /> : <Pause onClick={handlePlay} />}
                <div style={{
                  width: '1px',
                  height: '30px',
                  background: 'black'
                }} />
              <Refresh onClick={handleRestart} />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-full bg-white/60 hover:cursor-pointer flex items-center justify-center">
              <Mic onClick={handleStartRecording} id="mic-button" />
            </div>
          ) : (
            <div className="h-10 w-20 rounded-full bg-white/60 hover:cursor-pointer flex flex-row items-center justify-between px-2">
              <ContentCut id="mic-cut" onClick={handleCut} />
                <div style={{
                  width: '1px',
                  height: '30px',
                  background: 'black'
                }} />
              <Stop onClick={handleStopRecording} id="mic-stop" />
            </div>
          )}
          
          <div className="mr-2">
            <Stopwatch ref={stopwatchRef} />
          </div>
         </div>
         <div className="text-xl font-bold pr-10">
          {!isRecording && !finished ? (
            <p>Начните запись, чтобы увидеть расшифровку дыхания</p>) : (
              <div className="flex flex-col gap-2">
              <div
                ref={scrollRef}
                className="bg-[#EBEBEB] h-10 py-1 w-200 overflow-x-scroll overflow-y-hidden whitespace-nowrap text-right 
                  [&::-webkit-scrollbar]:h-1
                  [&::-webkit-scrollbar-track]:bg-black/0
                  [&::-webkit-scrollbar-thumb]:bg-gray-400/80"
              >
                <p>{liveText}</p>
              </div>
              <div id="waveform" className="w-200 font-regular text-sm"></div>
              </div>
            )}
         </div>
        </div>
        <RecordingPanel 
        ref={panelRef} 
        isRecording={isRecording} 
        finished={finished} 
        playbackUrl={playbackUrl}
        rows={rows}
        setRows={setRows}
        cuts={cutsRef.current} />
      </main>
      
    </div>
  );
}
