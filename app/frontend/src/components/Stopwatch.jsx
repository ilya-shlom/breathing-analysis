// components/Stopwatch.js
"use client";
import React, { useState, useRef, useImperativeHandle, forwardRef } from "react";
import { Roboto } from 'next/font/google';

const roboto = Roboto({
  weight: ['400', '700'], // Choose weights you need
  subsets: ['latin'],     // Choose the character subsets you need
});

const Stopwatch = forwardRef((props, ref) => {
  const [isActive, setIsActive] = useState(false);
  const [time, setTime] = useState(0); // ms
  const intervalRef = useRef(null);

  // Expose start and reset methods to parent
  useImperativeHandle(ref, () => ({
    start() {
      if (!isActive) {
        const startTime = Date.now() - time;
        intervalRef.current = setInterval(() => {
          setTime(Date.now() - startTime);
        }, 10);
        setIsActive(true);
      }
    },
    reset() {
      clearInterval(intervalRef.current);
      setIsActive(false);
      setTime(0);
    },
    pause() {
      clearInterval(intervalRef.current);
      setIsActive(false);
    }
  }));

  // Cleanup
  React.useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  const formatTime = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centiseconds = Math.floor((ms % 1000) / 10);
    return (
      String(minutes).padStart(2, "0") +
      ":" +
      String(seconds).padStart(2, "0") +
      ":" +
      String(centiseconds).padStart(2, "0")
    );
  };

  return (
    <span className={`${roboto.className} text-2xl`} id="stopwatch">
      {formatTime(time)}
    </span>
  );
});

Stopwatch.displayName = "Stopwatch";


export default Stopwatch;