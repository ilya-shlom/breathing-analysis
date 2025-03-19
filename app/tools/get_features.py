import pandas as pd
from pyAudioAnalysis import ShortTermFeatures as aF
from pyAudioAnalysis import audioBasicIO as aIO 

def get_short_term_features(wav_loc, win = 0.050, step = 0.050):
    """ 
    Extract short-term features using default 50msec non-overlapping windows
    """

    # get sampling frequency and signal.
    fs, s = aIO.read_audio_file(wav_loc)
    # convert to mono so all features work!
    # s = aIO.stereo_to_mono(s) 

    # print duration of wav in seconds:
    duration = len(s) / float(fs)
    print(f'{wav_loc} duration = {duration} seconds')
    
    # features, feature names.
    # feature names look like ['zcr', 'energy', 'energy_entropy', 'spectral_centroid', 'spectral_spread', 'spectral_entropy', 'spectral_flux', 'spectral_rolloff', 'mfcc_1', 'mfcc_2', 'mfcc_3', 'mfcc_4', 'mfcc_5', 'mfcc_6', 'mfcc_7', 'mfcc_8', 'mfcc_9', 'mfcc_10', 'mfcc_11', 'mfcc_12', 'mfcc_13', 'chroma_1', 'chroma_2', 'chroma_3', 'chroma_4', 'chroma_5', 'chroma_6', 'chroma_7', 'chroma_8', 'chroma_9', 'chroma_10', 'chroma_11', 'chroma_12', 'chroma_std', 'delta zcr', 'delta energy', 'delta energy_entropy', 'delta spectral_centroid', 'delta spectral_spread', 'delta spectral_entropy', 'delta spectral_flux', 'delta spectral_rolloff', 'delta mfcc_1', 'delta mfcc_2', 'delta mfcc_3', 'delta mfcc_4', 'delta mfcc_5', 'delta mfcc_6', 'delta mfcc_7', 'delta mfcc_8', 'delta mfcc_9', 'delta mfcc_10', 'delta mfcc_11', 'delta mfcc_12', 'delta mfcc_13', 'delta chroma_1', 'delta chroma_2', 'delta chroma_3', 'delta chroma_4', 'delta chroma_5', 'delta chroma_6', 'delta chroma_7', 'delta chroma_8', 'delta chroma_9', 'delta chroma_10', 'delta chroma_11', 'delta chroma_12', 'delta chroma_std']
    # features f look like numpy matrices
    try:
        [f, fn] = aF.feature_extraction(s, fs, int(fs * win), int(fs * step))
        print(f'{f.shape[1]} frames, {f.shape[0]} short-term features')

        return [f, fn]
    # sometimes the feature extraction yields a ValueError because the sample is too short.
    except ValueError:
        print("ValueError")
        return None
    

def flatten_n_frames(f,n):
    m = f[:,:n]
    # use Fortran order so that [[1,2],[3,4],[5,6]] becomes [1,3,5,2,4,6] (i.e., adjacent frames first, then onto the next feature.)
    return m.flatten('F')

def get_features_frame(wav_locs, first_n_frames, include_file_name=False, include_parent_dir=False):
    """
    Iterates over the list of paths to each wav file of interest. Extracts feature matrix. Subsets the feature matrix to the first_n_frames.  

    include_parent_dir should be set to True if the parent directory of the sample contains meaningful information (like the drum machine, for instance).
    If this is the case, the new drum name will be like 'kicks/kd01.wav'.  I call this a 'dir_wav'.

    """
    feature_dict = {}
    for w in wav_locs:
        wav_basename = w.split('/')[-1]
        if include_parent_dir: # For plotting, make the name of the wav a 'dir_wav', e.g., 'dir_name/sample_name.wav'
            wav_dirname = w.split('/')[-2]
            wav_basename = wav_dirname + '/' + wav_basename
        try:
            f, fn = get_short_term_features(w, 0.05, 0.05)
            feature_dict[wav_basename] = flatten_n_frames(f, first_n_frames)
        except TypeError:
            print(f'{w} appears to be too short to extract features')
    features_wavs_df = pd.DataFrame.from_dict(feature_dict, orient='index').transpose()
    return features_wavs_df 