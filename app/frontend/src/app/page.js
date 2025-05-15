"use client";
import Image from "next/image";
import { Mic } from "@mui/icons-material";
import Stopwatch from "@/components/Stopwatch";
import RecordingPanel from "@/components/RecordingPanel";
import React, { useRef } from "react";


export default function Home() {
  const stopwatchRef = useRef();

  const handleStart = () => {
    stopwatchRef.current?.start();
  };

  const handleReset = () => {
    stopwatchRef.current?.reset();
  };

  return (
    <div className="height-screen grid grid-rows-[auto_1fr_auto]">
      <main className="flex flex-row gap-[32px] row-start-2 items-center sm:items-start">
        <div className="h-[100px] w-full p-20 flex flex-row justify-between items-center">
         <div className="flex flex-row items-center justify-between p-1 gap-[16px] rounded-full bg-[#E9E9E9] h-12 w-70">
          <div className="h-10 w-10 rounded-full bg-white/60 hover:cursor-pointer flex items-center justify-center">
            <Mic onClick={handleStart} />
          </div>
          <div className="mr-2">
            <Stopwatch ref={stopwatchRef} />
          </div>
         </div>
         <div className="text-xl font-bold pr-10">
          <p>Начните запись, чтобы увидеть расшифровку дыхания</p>
         </div>
        </div>
        <RecordingPanel />
      </main>
      
    </div>
  );
}
