// pages/_app.js
"use client";
import Script from 'next/script';

function MyApp({ Component, pageProps }) {
  return (
    <>
      {/* Load Socket.io client from your server: */}
      <Script
        src="/socket.io/socket.io.js"
        strategy="beforeInteractive"
      />

      {/* Then load your handler script */}
      <Script
        src="/recording_handler.js"
        strategy="afterInteractive"
      />

      <Component {...pageProps} />
    </>
  );
}

export default MyApp;
