import WaveSurfer from 'https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/wavesurfer.esm.js'
// import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'


window.options = {
  /** HTML element or CSS selector (required) */
  container: '#waveform',
  /** The height of the waveform in pixels */
  height: 128,
  /** The width of the waveform in pixels or any CSS value; defaults to 100% */
  width: 300,
  /** Render each audio channel as a separate waveform */
  splitChannels: false,
  /** Stretch the waveform to the full height */
  normalize: false,
  /** The color of the waveform */
  waveColor: '#ff4e00',
  /** The color of the progress mask */
  progressColor: '#dd5e98',
  /** The color of the playpack cursor */
  cursorColor: '#ddd5e9',
  /** The cursor width */
  cursorWidth: 1,
  /** Render the waveform with bars like this: ▁ ▂ ▇ ▃ ▅ ▂ */
  barWidth: NaN,
  /** Spacing between bars in pixels */
  barGap: NaN,
  /** Rounded borders for bars */
  barRadius: NaN,
  /** A vertical scaling factor for the waveform */
  barHeight: 6,
  /** Vertical bar alignment **/
  barAlign: '',
  /** Minimum pixels per second of audio (i.e. zoom level) */
  minPxPerSec: 1,
  /** Stretch the waveform to fill the container, true by default */
  fillParent: true,
  /** Audio URL */
  // url: '/static/audio/example.wav',
  /** Whether to show default audio element controls */
  mediaControls: true,
  /** Play the audio on load */
  autoplay: false,
  /** Pass false to disable clicks on the waveform */
  interact: true,
  /** Allow to drag the cursor to seek to a new position */
  dragToSeek: false,
  /** Hide the scrollbar */
  hideScrollbar: false,
  /** Audio rate */
  audioRate: 1,
  /** Automatically scroll the container to keep the current position in viewport */
  autoScroll: true,
  /** If autoScroll is enabled, keep the cursor in the center of the waveform during playback */
  autoCenter: true,
  /** Decoding sample rate. Doesn't affect the playback. Defaults to 8000 */
  sampleRate: 8000,
}


// fetch('/stop', {
//   method: 'POST',
//   body: new FormData(document.querySelector('#your-form')),
// })
// .then(response => response.blob())
// .then(blob => {
//   const audioUrl = URL.createObjectURL(blob);
//   const audio = new Audio(audioUrl);
//   const wavesurfer = WaveSurfer.create({...options, url: audio})

//   wavesurfer.on('interaction', () => {
//     wavesurfer.play()
//   })
// });



// // Regions plugin

// import WaveSurfer from 'https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/wavesurfer.esm.js'

// // Initialize the Regions plugin
// const regions = RegionsPlugin.create()

// // if (window.final_filename) {
// const ws = WaveSurfer.create({
//   container: '#waveform',
//   waveColor: 'rgb(200, 0, 200)',
//   progressColor: 'rgb(100, 0, 100)',
//   url: window.final_filename,
//   plugins: [regions],
// })

// // Give regions a random color when they are created
// const random = (min, max) => Math.random() * (max - min) + min
// const randomColor = () => `rgba(${random(0, 255)}, ${random(0, 255)}, ${random(0, 255)}, 0.5)`

// // Create some regions at specific time ranges
// ws.on('decode', () => {
//   // Regions
//   regions.addRegion({
//     start: 0,
//     end: 8,
//     content: 'Resize me',
//     color: randomColor(),
//     drag: false,
//     resize: true,
//   })
//   regions.addRegion({
//     start: 9,
//     end: 10,
//     content: 'Cramped region',
//     color: randomColor(),
//     minLength: 1,
//     maxLength: 10,
//   })
//   regions.addRegion({
//     start: 12,
//     end: 17,
//     content: 'Drag me',
//     color: randomColor(),
//     resize: false,
//   })

//   // Markers (zero-length regions)
//   regions.addRegion({
//     start: 19,
//     content: 'Marker',
//     color: randomColor(),
//   })
//   regions.addRegion({
//     start: 20,
//     content: 'Second marker',
//     color: randomColor(),
//   })
// })

// regions.enableDragSelection({
//   color: 'rgba(255, 0, 0, 0.1)',
// })

// regions.on('region-updated', (region) => {
//   console.log('Updated region', region)
// })

// // Loop a region on click
// let loop = true
// // Toggle looping with a checkbox
// document.querySelector('input[type="checkbox"]').onclick = (e) => {
//   loop = e.target.checked
// }

// {
//   let activeRegion = null
//   regions.on('region-in', (region) => {
//     console.log('region-in', region)
//     activeRegion = region
//   })
//   regions.on('region-out', (region) => {
//     console.log('region-out', region)
//     if (activeRegion === region) {
//       if (loop) {
//         region.play()
//       } else {
//         activeRegion = null
//       }
//     }
//   })
//   regions.on('region-clicked', (region, e) => {
//     e.stopPropagation() // prevent triggering a click on the waveform
//     activeRegion = region
//     region.play(true)
//     region.setOptions({ color: randomColor() })
//   })
//   // Reset the active region when the user clicks anywhere in the waveform
//   ws.on('interaction', () => {
//     activeRegion = null
//   })
// }

// // Update the zoom level on slider change
// ws.once('decode', () => {
//   document.querySelector('input[type="range"]').oninput = (e) => {
//     const minPxPerSec = Number(e.target.value)
//     ws.zoom(minPxPerSec)
//   }
// })
// // }