## Список извлекаемых параметров:
0: 'zcr' - zero crossing rate

1: 'energy'

2: 'energy_entropy'

3: 'spectral_centroid'

4: 'spectral_spread'

5: 'spectral_entropy'

6: 'spectral_flux'

7: 'spectral_rolloff'

8 - 20: 'mfcc_1' -  'mfcc_13'

21 - 32: 'chroma_1' - 'chroma_12'

33 - 67: Все те же значения, но delta (delta zcr, delta energy...)

### В приведенных в данных директориях таблицах значения соответствуют:
0 - 67 – Описанные выше значения для первой половины записи
68 - 135 – Описанные выше значения для второй половины записи

## Описание каждого параметра (на английском языке)

### **Time-Domain Features**
1. **`zcr` (Zero Crossing Rate):**  
   Measures the rate at which the signal changes sign (positive to negative or vice versa). It is useful for distinguishing between voiced and unvoiced sounds.

2. **`energy`:**  
   The short-term signal energy, calculated as the sum of squared amplitudes in a window. Higher energy indicates louder audio.

3. **`energy_entropy`:**  
   Represents the energy's distribution within a frame across sub-frames. A higher value indicates more unpredictable or "noisy" energy distribution.

---

### **Frequency-Domain Features**
4. **`spectral_centroid`:**  
   The center of mass of the power spectrum, representing the "brightness" of a signal. Higher values correspond to higher frequencies dominating the sound.

5. **`spectral_spread`:**  
   Measures the spread of the spectrum around its centroid. It indicates how dispersed the frequencies are around the centroid.

6. **`spectral_entropy`:**  
   Quantifies the flatness of the spectrum. High entropy suggests a more uniform spectral energy distribution (e.g., noise).

7. **`spectral_flux`:**  
   Measures the rate of change of the power spectrum between consecutive frames. It helps detect sudden spectral changes.

8. **`spectral_rolloff`:**  
   The frequency below which a specified percentage (e.g., 85%) of the spectral energy is concentrated. It identifies the "tail" of the spectrum.

---

### **MFCC Features (Mel-Frequency Cepstral Coefficients)**
9. **`mfcc_1` to `mfcc_13`:**  
   These are coefficients derived from the Mel-frequency cepstrum, which approximates the human auditory system's response to sound. They are widely used in speech and music analysis.

---

### **Chroma Features**
10. **`chroma_1` to `chroma_12`:**  
    Chroma features represent the energy content of the 12 pitch classes (C, C#, D, ..., B) in the music scale. They are useful for melody, harmony, and chord detection.

11. **`chroma_std`:**  
    The standard deviation of the chroma vector, measuring its variability over the window.

---

### **Delta Features (Derivatives of Above Features)**
The **delta** versions of each feature represent the rate of change (derivative) of the corresponding feature over time. Delta features are commonly used in audio analysis to capture temporal dynamics and smooth transitions.

For example:
- **`delta zcr`:** Change in zero-crossing rate.
- **`delta mfcc_1`:** Change in the first MFCC coefficient.
- **`delta chroma_1`:** Change in the first chroma component.

---

### Summary of Feature Categories
1. **Time-Domain Features**: `zcr`, `energy`, `energy_entropy`.  
2. **Frequency-Domain Features**: `spectral_centroid`, `spectral_spread`, `spectral_entropy`, `spectral_flux`, `spectral_rolloff`.  
3. **MFCCs**: 13 coefficients representing spectral shape.  
4. **Chroma Features**: 12 pitch class energies + variability (`chroma_std`).  
5. **Delta Features**: First-order derivatives of all features to capture changes over time.
