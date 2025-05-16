"use client";
import Image from "next/image";
import { Mic, ContentCut, Stop } from "@mui/icons-material";
import Stopwatch from "@/components/Stopwatch";
import RecordingPanel from "@/components/RecordingPanel";
import React, { useRef, useState } from "react";
import Script from 'next/script';


export default function Home() {
  const stopwatchRef = useRef();

  const [isRecording, setIsRecording] = useState(false);

  const handleStartRecording = () => {
    setIsRecording(true);
    stopwatchRef.current?.start();
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    stopwatchRef.current?.pause();
  };

  return (
    <div className="height-screen grid grid-rows-[auto_1fr_auto]">
      {/* Load Socket.io client from your server: */}
      <Script
        src="https://cdn.socket.io/4.6.1/socket.io.min.js"
        strategy="beforeInteractive"
      />

      {/* Then load your handler script */}
      <Script
        src="/recording_handler.js"
        strategy="afterInteractive"
      />
      <main className="flex flex-row gap-[32px] row-start-2 items-center sm:items-start">
        <div className="h-[100px] w-full p-20 flex flex-row justify-between items-center">
         <div className="flex flex-row items-center justify-between p-1 gap-[16px] rounded-full bg-[#E9E9E9] h-12 w-70">
          {!isRecording ? (
            <div className="h-10 w-10 rounded-full bg-white/60 hover:cursor-pointer flex items-center justify-center">
              <Mic onClick={handleStartRecording} id="mic-button" />
            </div>
          ) : (
            <div className="h-10 w-20 rounded-full bg-white/60 hover:cursor-pointer flex flex-row items-center justify-between px-2">
              <ContentCut id="mic-cut" />
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
          {!isRecording ? (
            <p>Начните запись, чтобы увидеть расшифровку дыхания</p>) : null}
            <p id="live-transcript"></p>
         </div>
        </div>
        <RecordingPanel />
      </main>
      
    </div>
  );
}
