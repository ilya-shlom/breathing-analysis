class AudioProcessor extends globalThis.AudioWorkletProcessor {
    process(inputs) {
      const input = inputs[0]; // Get input channels
      if (input && input[0]) {
        this.port.postMessage(input[0]); // Send audio data to the main thread
      }
      return true; // Keep processor running
    }
}

// Register the processor so it can be used in AudioWorkletNode
registerProcessor("audio-processor", AudioProcessor);