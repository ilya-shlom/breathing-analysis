
"use client";
import React, { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import io from 'socket.io-client'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js'

// ---------------------------------------------------------------------------
// Socket (client‑side only – no SSR)
// ---------------------------------------------------------------------------
const socket = io("127.0.0.1:5001");

// ---------------------------------------------------------------------------
// Lightweight GateProcessor – identical to original, runs in AudioWorklet
// ---------------------------------------------------------------------------
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
function BreathRecorder () {
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

  const [liveText, setLiveText]       = useState('')
  const [rows, setRows]               = useState([])  // transcript table
  const [step, setStep]               = useState('inhale')
  const [clock, setClock]             = useState('00:00:00:000')
  const cutsRef                       = useRef([clock])
  const timerRef                      = useRef(null)

  const MONITOR_AUDIO = false

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
    console.log(socket)
  }, [socket]);

  useEffect(() => {
    socket.on('connect', () => { sidRef.current = socket.id })
    // socket.on('transcription_result', ({ letter }) => setLiveText(t => t + letter))
    socket.on('transcription_result', ({ letter }) => console.log("got a letter:", letter))
    socket.on('silence', () => handleCut())
    return () => socket.disconnect()
  }, [])

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
      const { transcript, inhale_exhale, inhale_exhale_predicted, recording_time, activity } = await r.json()
      setRows(rows => [...rows, { transcript, recording_time, inhale_exhale, inhale_exhale_predicted, activity }])
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

      // flush every 200 ms
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
        await playBack(url)
      }
    } catch (e) { console.error(e) }

    cleanupFns.current.forEach(fn => fn())
    cleanupFns.current = []
    if (audioCtxRef.current) { await audioCtxRef.current.close(); audioCtxRef.current = null; workletReadyRef.current = false }
  }

  /* ---------------------------------------------------------------------
   * Playback with WaveSurfer
   * -------------------------------------------------------------------*/
  const playBack = async (url) => {
    wavesurferRef.current?.destroy()

    const regions = RegionsPlugin.create()
    const ws = WaveSurfer.create({ container: '#waveform', url, plugins: [regions] })
    wavesurferRef.current = ws

    ws.on('interaction', () => ws.play())
    ws.on('decode', () => {
      const cuts = cutsRef.current
      for (let i = 0; i < cuts.length - 1; i++) {
        regions.addRegion({
          start: timeStringToSeconds(cuts[i]),
          end:   timeStringToSeconds(cuts[i + 1]),
          content: i % 2 === 0 ? 'Inhale' : 'Exhale',
          color:  i % 2 === 0 ? 'rgba(174,255,147,0.5)' : 'rgba(147,188,255,0.5)',
          drag: false,
          resize: false,
        })
      }
    })
  }

  /* ---------------------------------------------------------------------
   * Render UI
   * -------------------------------------------------------------------*/
  if (typeof window === 'undefined') return null // prevent SSR errors

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center space-x-2">
        <button className="bg-green-600 text-white px-4 py-2 rounded" onClick={startRecording}>Record</button>
        <button className="bg-red-600   text-white px-4 py-2 rounded" onClick={stopRecording}>Stop</button>
        <button className="bg-blue-600  text-white px-4 py-2 rounded" onClick={handleCut}>Cut</button>
        <span className="font-mono ml-4">{clock}</span>
        <span className="ml-2 text-sm bg-gray-100 px-2 py-1 rounded capitalize">{step}</span>
      </div>

      <div className="border p-2 h-24 overflow-auto text-sm whitespace-pre-wrap">
        <strong>Live transcript:</strong> {liveText}
      </div>

      <table className="w-full text-xs border">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-1">Transcript</th>
            <th className="border px-1">Time</th>
            <th className="border px-1">Actual</th>
            <th className="border px-1">Predicted</th>
            <th className="border px-1">Activity</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="border px-1">{r.transcript}</td>
              <td className="border px-1">{r.recording_time}</td>
              <td className="border px-1">{r.inhale_exhale}</td>
              <td className="border px-1">{r.inhale_exhale_predicted}</td>
              <td className="border px-1">{r.activity}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div id="waveform" className="w-full h-24" />
    </div>
  )
}

// Export with SSR disabled so browser‑only APIs are safe
export default dynamic(() => Promise.resolve(BreathRecorder), { ssr: false })
