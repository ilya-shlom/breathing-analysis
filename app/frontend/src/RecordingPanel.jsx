
import { useState, useRef, forwardRef, useImperativeHandle, useEffect } from "react";
import WaveSurfer from 'wavesurfer.js';
import Spectrogram from 'wavesurfer.js/dist/plugins/spectrogram.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js'

import Table from "./Table";
import useRowsOverlay from './useRowsOverlay';


function timeStringToSeconds (t) {
  const [h, m, s, ms] = t.split(':').map(Number)
  return h * 3600 + m * 60 + s + ms / 1000
}

function rowsToCSV(rows) {
  if (!rows || rows.length === 0) return "";

  // Get all unique keys from first row
  const headers = Object.keys(rows[0]);
  const csvRows = [
    headers.join(","), // header row
    ...rows.map(row =>
      headers.map(h => JSON.stringify(row[h] ?? "")).join(",")
    )
  ];
  return csvRows.join("\n");
}

const RecordingPanel = forwardRef(({ onSubmit, isRecording, finished, rows, setRows, streamMode, setStreamMode, playbackUrl, cuts }, ref) => {
  // ────────────────────────── state ──────────────────────────
  const [autoBreath, setAutoBreath] = useState(false);
  const [autoBreathByText, setAutoBreathByText] = useState(false);
  const [autoBreathByAudio, setAutoBreathByAudio] = useState(false);

  const [autoActivity, setAutoActivity] = useState(false);
  const [autoActivityByText, setAutoActivityByText] = useState(false);
  const [autoActivityByAudio, setAutoActivityByAudio] = useState(false);

  const [rowsOverlay, RowsOverlay] = useRowsOverlay();


  const [autoBreathMarkup, setAutoBreathMarkup] = useState(false);
  const [sound, setSound] = useState(true);

  const [fileName, setFileName] = useState("");

  const [resultsSection, setResultsSection] = useState(0);

  // ────────────────────────── helpers ──────────────────────────

  const formRef = useRef(null);


  const handleSubmit = (e) => {
    if (e?.preventDefault) e.preventDefault();
    const data = {
      autoBreath,
      autoBreathByText,
      autoBreathByAudio,
      autoActivity,
      autoActivityByText,
      autoActivityByAudio,
      autoBreathMarkup,
      sound,
      fileName,
    };
    onSubmit?.(data);
  };

  useImperativeHandle(ref, () => ({
    submit: handleSubmit,
    getFormData: () => ({
    autoBreath,
    autoBreathByText,
    autoBreathByAudio,
    autoActivity,
    autoActivityByText,
    autoActivityByAudio,
    autoBreathMarkup,
    sound,
    fileName,
  }),
  }));
  const resetIfDisabled = (parentChecked, setters) => {
    if (!parentChecked) setters.forEach((fn) => fn());
  };

 const handleDownloadCSV = () => {
  const csv = rowsToCSV(rows);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = fileName ? `${fileName}.csv` : "results.csv";
  a.click();
  URL.revokeObjectURL(url);
};
  

  // ────────────────────────── render ──────────────────────────
  return (
    <form ref={formRef} onSubmit={handleSubmit}>
    <div className="fixed bottom-0 left-0 h-120 z-10 w-full rounded-t-4xl bg-[var(--bg-blue)] shadow-2xl">
      <div className="  flex flex-col justify-center items-center">

        {!isRecording ?
        finished ? 
        (<>
        <div className="flex my-3 gap-1 bg-[#80A8B6]/70 rounded-full text-md font-regular">
          <button className={`rounded-full px-4 py-2 text-white cursor-pointer transition
            ${resultsSection === 0 ? "bg-[#70919E] shadow-lg" : "hover:bg-[#70919E]/50"}`} 
            onClick={() => setResultsSection(0)}>
            Таблица
          </button>
          <button className={`rounded-full px-4 py-2 text-white cursor-pointer transition
            ${resultsSection === 1 ? "bg-[#70919E] shadow-lg" : "hover:bg-[#70919E]/50"}`} 
            onClick={() => setResultsSection(1)}>
            Спектрограмма
          </button>
          <button className={`rounded-full px-4 py-2 text-white cursor-pointer transition
            ${resultsSection === 2 ? "bg-[#70919E] shadow-lg" : "hover:bg-[#70919E]/50"}`} 
            onClick={() => setResultsSection(2)}>
            Текст и волна
          </button>
        </div>
        
        <div className="bg-[var(--bg-blue)] fixed bottom-0 h-105 w-full rounded-t-4xl flex flex-row justify-center py-2">
          <div className="flex justify-between mt-5 px-20 gap-15 w-full">
          {resultsSection === 0 &&
          <Table 
          rows={rows} 
          autoActivityByAudio={autoActivityByAudio} 
          autoActivityByText={autoActivityByText} 
          autoBreathByAudio={autoBreathByAudio} 
          autoBreathByText={autoBreathByText} 
          />}
          {resultsSection === 1 && <SpectrogramComponent playbackUrl={playbackUrl} />}
          {resultsSection === 2 && 
          <div className="overflow-y-auto pr-1
          [&::-webkit-scrollbar]:w-1
          [&::-webkit-scrollbar-track]:bg-black/10
          [&::-webkit-scrollbar-thumb]:bg-white/70 [&::-webkit-scrollbar-thumb]:rounded">
            <h3>Полная расшифровка дыхания</h3>
            <div className="flex flex-col bg-[#EBEBEB] p-2 w-120">
              <div className="flex flex-wrap">
                {rows.map((r, i) => (
                  <p
                    key={i} // make sure to add a unique key
                    className={r.inhale_exhale === 'inhale' ? 'text-[#00bdff]' : 'text-[#ff0000]'}
                  >
                    {r.transcript}&nbsp;
                  </p>
                ))}
              </div>
              <div className="mt-3 flex flex-row gap-5">
                <span className="flex flex-row align-center items-center gap-1"><div className="w-3 h-3 bg-[#00BDFF]"></div>Вдох</span>
                <span className="flex flex-row align-center items-center gap-1"><div className="w-3 h-3 bg-[#FF0000]"></div>Выдох</span>
              </div>
            </div>
            <h3 className="mt-3">Размеченная волна</h3>
            <WaveComponent playbackUrl={playbackUrl} cuts={cuts} coloring={rows.map(r => r.inhale_exhale)} />

            {autoBreathByText &&
            <>
              <h3 className="mt-5">Полная расшифровка дыхания по тексту</h3>
              <div className="flex flex-col bg-[#EBEBEB] p-2 w-120">
                <div className="flex flex-wrap">
                  {rows.map((r, i) => (
                    <p
                      key={i} // make sure to add a unique key
                      className={r.ie_predicted_text === 'inhale' ? 'text-[#00bdff]' : 'text-[#ff0000]'}
                    >
                      {r.transcript}&nbsp;
                    </p>
                  ))}
                </div>
                <div className="mt-3 flex flex-row gap-5">
                  <span className="flex flex-row align-center items-center gap-1"><div className="w-3 h-3 bg-[#00BDFF]"></div>Вдох</span>
                  <span className="flex flex-row align-center items-center gap-1"><div className="w-3 h-3 bg-[#FF0000]"></div>Выдох</span>
                </div>
              </div>
              <h3 className="mt-3">Размеченная волна</h3>
              <WaveComponent playbackUrl={playbackUrl} cuts={cuts} coloring={rows.map(r => r.ie_predicted_text)} />
            </>}
            {autoBreathByAudio &&
            <>
              <h3 className="mt-5">Полная расшифровка дыхания по аудио</h3>
              <div className="flex flex-col bg-[#EBEBEB] p-2 w-120">
                <div className="flex flex-wrap">
                  {rows.map((r, i) => (
                    <p
                      key={i} // make sure to add a unique key
                      className={r.ie_predicted_audio === 'inhale' ? 'text-[#00bdff]' : 'text-[#ff0000]'}
                    >
                      {r.transcript}&nbsp;
                    </p>
                  ))}
                </div>
                <div className="mt-3 flex flex-row gap-5">
                  <span className="flex flex-row align-center items-center gap-1"><div className="w-3 h-3 bg-[#00BDFF]"></div>Вдох</span>
                  <span className="flex flex-row align-center items-center gap-1"><div className="w-3 h-3 bg-[#FF0000]"></div>Выдох</span>
                </div>
              </div>
              <h3 className="mt-3">Размеченная волна</h3>
              <WaveComponent playbackUrl={playbackUrl} cuts={cuts} coloring={rows.map(r => r.ie_predicted_audio)} />
            </>}
          </div>
          }
        <div className="text-right justify-self-end">
          <h4 className="font-md">Параметры записи:</h4>
          <p>Название файла: {fileName}</p>
          <p>Режим: потоковая запись</p>
          <p>Автоопределение вдоха/выдоха: {autoBreath ? "да" : "нет"}</p>
          {autoBreath && (
            <>
              <p>По тексту: {autoBreathByText ? "да" : "нет"}</p>
              <p>По аудио: {autoBreathByAudio ? "да" : "нет"}</p>
            </>
          )}
          <p>Автоопределение активности: {autoActivity ? "да" : "нет"}</p>
          {autoActivity && (
            <>
              <p>По тексту: {autoActivityByText ? "да" : "нет"}</p>
              <p>По аудио: {autoActivityByAudio ? "да" : "нет"}</p>
            </>
          )}
          <p>Авторазметка: {autoBreathMarkup ? "да" : "нет"}</p>
          <div className="flex flex-col gap-2 justify-self-end mt-2">
            {(resultsSection === 0 || resultsSection === 2) && <><button className="bg-white text-black rounded-full w-full px-8 py-3 outline-none cursor-pointer" onClick={() => rowsOverlay.open(rows, setRows)}>Изменить вручную</button>
            <button className="bg-white text-black rounded-full w-full px-8 py-3 outline-none cursor-pointer" onClick={() => {}}>Авторазметка</button></>}
            {resultsSection === 0 && <button className="bg-white text-black rounded-full w-full px-8 py-3 outline-none cursor-pointer" onClick={handleDownloadCSV}>Сохранить в CSV</button>}
          </div>
        </div>
      </div>
        </div>
        </>)

        :

        (<>
        <div className="flex my-3 gap-1 bg-[#80A8B6]/70 rounded-full text-md font-regular">
          <button className={`rounded-full px-4 py-2 text-white cursor-pointer transition
            ${streamMode === true ? "bg-[#70919E] shadow-lg" : "hover:bg-[#70919E]/50"}`} 
            onClick={() => setStreamMode(true)}>
            Потоковая запись
          </button>
          <button className={`rounded-full px-4 py-2 text-white cursor-pointer transition
            ${streamMode === false ? "bg-[#70919E] shadow-lg" : "hover:bg-[#70919E]/50"}`} 
            onClick={() => setStreamMode(false)}>
            Загрузка файла
          </button>
        </div>
        <div className="bg-[var(--bg-blue)] fixed bottom-0 h-105 w-full rounded-t-4xl flex flex-col py-2">
          <h2 className="mb-6 text-center text-2xl font-semibold text-white">
            {streamMode ? "Параметры записи" : "Параметры обработки"}
          </h2>

          {/* Grid */}
          <div className="grid grid-cols-1 gap-8 text-white md:grid-cols-2 w-full px-10 mx-auto">
            {/* Left column */}
            <div>
              {/* File name */}
              <label className="mb-4 block w-120">
                {streamMode && <input
                  type="text"
                  placeholder="Название файла"
                  className="w-full rounded-none border-2 border-black bg-white px-3 py-2 placeholder-black/40 focus:placeholder-black/20 focus:outline-none text-black transition"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                /> }
              </label>
              <Checkbox
                checked={autoBreath}
                onChange={() => {
                  setAutoBreath((v) => !v);
                  resetIfDisabled(!autoBreath, [
                    () => setAutoBreathByText(false),
                    () => setAutoBreathByAudio(false),
                  ]);
                }}
                className="mt-4"
                label="Автоопределение вдоха/выдоха"
                tooltip="Автоматически определять, является ли фрагмент вдохом или выдохом"
              />

              <div className="mt-6 space-y-2">
                <Checkbox
                  checked={autoBreathByText}
                  disabled={!autoBreath}
                  onChange={() => setAutoBreathByText((v) => !v)}
                  label="По тексту"
                  tooltip="Использовать текстовую расшифровку для определения вдоха и выдоха"
                />
                <Checkbox
                  checked={autoBreathByAudio}
                  disabled={!autoBreath}
                  onChange={() => setAutoBreathByAudio((v) => !v)}
                  label="По аудио"
                  tooltip="Использовать анализ аудио для определения вдоха и выдоха"
                />
              </div>

              <Checkbox
                className="mt-8"
                checked={autoBreathMarkup}
                onChange={() => setAutoBreathMarkup((v) => !v)}
                label="Авторазметка дыхания"
                tooltip="Автоматически отмечать вдохи и выдохи на звуковой волне"
              />

              {streamMode && <Checkbox
                className="mt-18"
                checked={sound}
                onChange={() => setSound((v) => !v)}
                label="Включить звук"
                tooltip="Записывать звук вместе с данными"
              />}
            </div>

            {/* Right column */}
            <div className="mt-17">
              <Checkbox
                checked={autoActivity}
                onChange={() => {
                  setAutoActivity((v) => !v);
                  resetIfDisabled(!autoActivity, [
                    () => setAutoActivityByText(false),
                    () => setAutoActivityByAudio(false),
                  ]);
                }}
                label="Автоопределение активности"
                tooltip="Автоматически определять активность пользователя"
              />

              <div className="mt-4 space-y-2">
                <Checkbox
                  checked={autoActivityByText}
                  disabled={!autoActivity}
                  onChange={() => setAutoActivityByText((v) => !v)}
                  label="По тексту"
                  tooltip="Использовать текстовую расшифровку для определения активности"
                />
                <Checkbox
                  checked={autoActivityByAudio}
                  disabled={!autoActivity}
                  onChange={() => setAutoActivityByAudio((v) => !v)}
                  label="По аудио"
                  tooltip="Использовать анализ аудио для определения активности"
                />
              </div>
            </div>
          </div>
        </div>
        </>)

        : 

        (
        <>
        <h2 className="mb-3 mt-2 text-center text-2xl font-md text-white">
          Распознанные данные
        </h2>
        <div className="flex justify-between mt-5 px-20 gap-15 w-full">
          <Table 
          rows={rows} 
          autoActivityByAudio={autoActivityByAudio} 
          autoActivityByText={autoActivityByText} 
          autoBreathByAudio={autoBreathByAudio} 
          autoBreathByText={autoBreathByText} 
          />
        <div className="text-right">
          <h4 className="font-md">Параметры записи:</h4>
          <p>Название файла: {fileName}</p>
          <p>Режим: потоковая запись</p>
          <p>Автоопределение вдоха/выдоха: {autoBreath ? "да" : "нет"}</p>
          {autoBreath && (
            <>
              <p>По тексту: {autoBreathByText ? "да" : "нет"}</p>
              <p>По аудио: {autoBreathByAudio ? "да" : "нет"}</p>
            </>
          )}
          <p>Автоопределение активности: {autoActivity ? "да" : "нет"}</p>
          {autoActivity && (
            <>
              <p>По тексту: {autoActivityByText ? "да" : "нет"}</p>
              <p>По аудио: {autoActivityByAudio ? "да" : "нет"}</p>
            </>
          )}
          <p>Авторазметка: {autoBreathMarkup ? "да" : "нет"}</p>
        </div>
      </div>
      </>
        )}
      </div>
    </div>
    <RowsOverlay />
    </form>
  );
})

/* -------------------------------------------------------------------------- */
/*                                  helpers                                   */
/* -------------------------------------------------------------------------- */

function Checkbox({ label, tooltip, className = "", ...props }) {
  return (
    <label
      className={`inline-flex items-center gap-2 pr-4 relative ${
        props.disabled ? "cursor-not-allowed" : "cursor-pointer"
      } ${className}`}
    >
      <span className="relative flex items-center">
        <input
          type="checkbox"
          className="peer appearance-none w-7 h-7 border-2 border-black bg-white rounded-none transition-colors"
          {...props}
        />
        <svg
          className="pointer-events-none absolute left-0 top-0 w-7 h-7 hidden peer-checked:block"
          fill="none"
          stroke="black"
          strokeWidth="3"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 13l4 4L17 7" />
        </svg>
      </span>
      <span className={`text-lg ${props.disabled ? "text-white/50" : undefined}`}>
        {label}
      </span>
      {/* Tooltip icon */}
      <span className="ml-1 select-none text-md leading-none text-black border border-black rounded-full w-5 h-5 flex items-center justify-center relative group">
        ?
        <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center w-5">
          <div className="w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent border-r-4 border-r-black/70" />
          <div className="ml-0 px-2 py-1 bg-black/70 text-white text-sm rounded shadow-lg w-40">
            {tooltip || "Help"}
          </div>
        </div>
      </span>
    </label>
  );
}

function SpectrogramComponent({ playbackUrl }) {
  const containerRef = useRef(null);
  const spectroRef = useRef(null);
  const waveSurferRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !spectroRef.current || !playbackUrl) return;

    // Create hidden dummy container for waveform
    const dummy = document.createElement('div');
    dummy.style.height = '0';
    dummy.style.overflow = 'hidden';
    containerRef.current.appendChild(dummy);

    const ws = WaveSurfer.create({
      container: dummy,
      url: playbackUrl,
      height: 0,
      interact: false,
      normalize: true,
      barWidth: 0,
      cursorWidth: 0,
    });

    ws.registerPlugin(
      Spectrogram.create({
        container: spectroRef.current,
        labels: true,
        height: 300,
        splitChannels: false,
        scale: 'mel',
        frequencyMax: 8000,
        frequencyMin: 0,
        fftSamples: 1024,
        labelsBackground: 'rgba(0, 0, 0, 0.1)',
      })
    );

    waveSurferRef.current = ws;

    return () => {
      if (waveSurferRef.current) {
        waveSurferRef.current.destroy();
        waveSurferRef.current = null;
      }
      // Safely remove dummy node if it still exists
      if (containerRef.current && dummy.parentNode === containerRef.current) {
        containerRef.current.removeChild(dummy);
      }
    };
  }, [playbackUrl]);

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <div ref={spectroRef} style={{ width: '100%', height: 200 }} />
    </div>
  );
}

function WaveComponent({ playbackUrl, cuts, coloring }) {
  const containerRef = useRef(null);
  const waveSurferRef = useRef(null);

  useEffect(() => {
    if (!playbackUrl) return;
    // Clean up any existing instance
    waveSurferRef.current && waveSurferRef.current.destroy();

    // Create regions plugin
    const regionsPlugin = RegionsPlugin.create();
    // Initialize WaveSurfer
    const ws = WaveSurfer.create({
      container: containerRef.current,
      url: playbackUrl,
      normalize: true,
      cursorWidth: 0,
      height: 100,
       waveColor: '#000000',
      plugins: [regionsPlugin],
    });
    waveSurferRef.current = ws;

    console.log(coloring)
    console.log("cuts", cuts)

    // When audio is ready, add regions using provided cuts and coloring
    ws.on('decode', () => {
      if (!Array.isArray(cuts)) return;
      cuts.forEach((time, index) => {
        if (index < cuts.length - 1) {
          regionsPlugin.addRegion({
            start: timeStringToSeconds(time),
            end: timeStringToSeconds(cuts[index + 1]),
            drag: false,
            resize: false,
            color: coloring[index] === 'inhale' ? 'rgba(204,241,255,0.5)' : 'rgba(255,204,204,0.5)',
            // content: coloring[index] === 'inhale' ? 'Вдох' : 'Выдох',

          });
        }
      });
    });

    // Cleanup on unmount or playbackUrl change
    return () => {
      ws.destroy();
      waveSurferRef.current = null;
    };
  }, [playbackUrl, cuts, coloring]);

  return <div ref={containerRef} style={{ width: '100%' }} />;
}

export default RecordingPanel;