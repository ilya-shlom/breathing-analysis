"use client";

import { useState } from "react";

/**
 * Bottom‑of‑screen panel that reproduces the UI shown in the screenshot.
 * Drop it anywhere inside a Next.js page – it is fixed to the viewport bottom.
 * This version is plain **JavaScript/JSX** (no TypeScript types).
 */
export default function RecordingPanel() {
  // ────────────────────────── state ──────────────────────────
  const [autoBreath, setAutoBreath] = useState(false);
  const [autoBreathByText, setAutoBreathByText] = useState(false);
  const [autoBreathByAudio, setAutoBreathByAudio] = useState(false);

  const [autoActivity, setAutoActivity] = useState(false);
  const [autoActivityByText, setAutoActivityByText] = useState(false);
  const [autoActivityByAudio, setAutoActivityByAudio] = useState(false);

  const [autoBreathMarkup, setAutoBreathMarkup] = useState(false);
  const [sound, setSound] = useState(true);

  // ────────────────────────── helpers ──────────────────────────
  const resetIfDisabled = (parentChecked, setters) => {
    if (!parentChecked) setters.forEach((fn) => fn());
  };

  // ────────────────────────── render ──────────────────────────
  return (
    <div className="fixed bottom-0 left-0 h-120 z-10 w-full rounded-t-4xl bg-[var(--bg-blue)] shadow-2xl">
      <div className="  flex flex-col justify-center items-center">
        {/* Tabs */}
        <div className="flex my-3 gap-2 bg-[#80A8B6]/70 rounded-full text-md font-medium">
          <button className="rounded-full bg-[#70919E] px-4 py-2 text-white shadow-lg cursor-pointer transition">
            Потоковая запись
          </button>
          <button className="rounded-full px-4 py-2 text-white/80 hover:bg-[#70919E]/50 cursor-pointer transition">
            Загрузка файла
          </button>
        </div>

        {/* Heading */}
        <div className="bg-[var(--bg-blue)] fixed bottom-0 h-105 w-full rounded-t-4xl flex flex-col py-2">
          <h2 className="mb-6 text-center text-2xl font-semibold text-white">
            Параметры записи
          </h2>

          {/* Grid */}
          <div className="grid grid-cols-1 gap-8 text-white md:grid-cols-2 w-full px-10 mx-auto">
            {/* Left column */}
            <div>
              {/* File name */}
              <label className="mb-4 block">
                <input
                  type="text"
                  placeholder="Название файла"
                  className="w-full rounded-none border-2 border-black bg-white px-3 py-2 placeholder-black/40 focus:placeholder-black/20 focus:outline-none text-black transition"
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
                label="Автоопределение вдоха/выдоха"
              />

              <div className="mt-2 space-y-2 pl-6">
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
                className="mt-6"
                checked={autoBreathMarkup}
                onChange={() => setAutoBreathMarkup((v) => !v)}
                label="Авторазметка дыхания"
              />

              <Checkbox
                className="mt-6"
                checked={sound}
                onChange={() => setSound((v) => !v)}
                label="Включить звук"
              />
            </div>

            {/* Right column */}
            <div>
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

              <div className="mt-2 space-y-2 pl-6">
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
      </div>
    </div>
  );
}

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
          className="peer appearance-none w-5 h-5 border-2 border-black bg-white rounded-none transition-colors"
          {...props}
        />
        <svg
          className="pointer-events-none absolute left-0 top-0 w-5 h-5 hidden peer-checked:block"
          fill="none"
          stroke="black"
          strokeWidth="3"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <span className={props.disabled ? "text-white/50" : undefined}>
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
