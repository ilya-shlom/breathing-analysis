
import { useState, useRef, forwardRef, useImperativeHandle } from "react";
import WaveSurfer from 'wavesurfer.js';
import Spectrogram from 'wavesurfer.js/dist/plugins/spectrogram.js';


import Table from "./Table";

const RecordingPanel = forwardRef(({ onSubmit, isRecording, finished, rows }, ref) => {
  // ────────────────────────── state ──────────────────────────
  const [autoBreath, setAutoBreath] = useState(false);
  const [autoBreathByText, setAutoBreathByText] = useState(false);
  const [autoBreathByAudio, setAutoBreathByAudio] = useState(false);

  const [autoActivity, setAutoActivity] = useState(false);
  const [autoActivityByText, setAutoActivityByText] = useState(false);
  const [autoActivityByAudio, setAutoActivityByAudio] = useState(false);

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
          {resultsSection === 1 && <p>Спектрограмма</p>}
          {resultsSection === 2 && <p>Текст и волна</p>}
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
        </div>
      </div>
        </div>
        </>)

        :

        (<>
        <div className="flex my-3 gap-1 bg-[#80A8B6]/70 rounded-full text-md font-regular">
          <button className="rounded-full bg-[#70919E] px-4 py-2 text-white shadow-lg cursor-pointer transition">
            Потоковая запись
          </button>
          <button className="rounded-full px-4 py-2 text-white/80 hover:bg-[#70919E]/50 cursor-pointer transition">
            Загрузка файла
          </button>
        </div>
        <div className="bg-[var(--bg-blue)] fixed bottom-0 h-105 w-full rounded-t-4xl flex flex-col py-2">
          <h2 className="mb-6 text-center text-2xl font-semibold text-white">
            Параметры записи
          </h2>

          {/* Grid */}
          <div className="grid grid-cols-1 gap-8 text-white md:grid-cols-2 w-full px-10 mx-auto">
            {/* Left column */}
            <div>
              {/* File name */}
              <label className="mb-4 block w-120">
                <input
                  type="text"
                  placeholder="Название файла"
                  className="w-full rounded-none border-2 border-black bg-white px-3 py-2 placeholder-black/40 focus:placeholder-black/20 focus:outline-none text-black transition"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                />
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
              />

              <div className="mt-6 space-y-2">
                <Checkbox
                  checked={autoBreathByText}
                  disabled={!autoBreath}
                  onChange={() => setAutoBreathByText((v) => !v)}
                  label="По тексту"
                />
                <Checkbox
                  checked={autoBreathByAudio}
                  disabled={!autoBreath}
                  onChange={() => setAutoBreathByAudio((v) => !v)}
                  label="По аудио"
                />
              </div>

              <Checkbox
                className="mt-8"
                checked={autoBreathMarkup}
                onChange={() => setAutoBreathMarkup((v) => !v)}
                label="Авторазметка дыхания"
              />

              <Checkbox
                className="mt-18"
                checked={sound}
                onChange={() => setSound((v) => !v)}
                label="Включить звук"
              />
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
              />

              <div className="mt-4 space-y-2">
                <Checkbox
                  checked={autoActivityByText}
                  disabled={!autoActivity}
                  onChange={() => setAutoActivityByText((v) => !v)}
                  label="По тексту"
                />
                <Checkbox
                  checked={autoActivityByAudio}
                  disabled={!autoActivity}
                  onChange={() => setAutoActivityByAudio((v) => !v)}
                  label="По аудио"
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
    </form>
  );
})

/* -------------------------------------------------------------------------- */
/*                                  helpers                                   */
/* -------------------------------------------------------------------------- */

function Checkbox({ label, className = "", ...props }) {
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
      <span
        className="ml-1 select-none text-md leading-none text-black border-1 border-black rounded-full w-5 h-5 flex items-center justify-center"
        title="Что это значит?"
      >
        ?
      </span>
    </label>
  );
}

export default RecordingPanel;