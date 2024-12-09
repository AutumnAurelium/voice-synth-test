import React, { useState, useRef, useEffect } from 'react';
import './App.css';

const App = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isSampleRecording, setIsSampleRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [chatGPTResponse, setChatGPTResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [audioSrc, setAudioSrc] = useState('');
  const [currentSample, setCurrentSample] = useState(null);
  const [history, setHistory] = useState([
    {"role": "system", "content": "You are Simulacra, an AI tool that creates realistic voices and simulates other people. You are generally concise and to-the-point. Users may refer to you by other names, and you should respond readily to them. In your first message, ask the user questions about the person you're simulating to better understand them."}
  ]);
  const mediaRecorderRef = useRef(null);
  const sampleMediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const sampleAudioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const sampleStreamRef = useRef(null);
  const recordingInProgress = useRef(false);
  const audioRef = useRef(null);

  const startRecording = () => {
    if (recordingInProgress.current) return;

    setIsRecording(true);
    recordingInProgress.current = true;
    audioChunksRef.current = [];

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        streamRef.current = stream;
        mediaRecorderRef.current = new MediaRecorder(stream);

        mediaRecorderRef.current.ondataavailable = event => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = handleStopRecording;
        mediaRecorderRef.current.start();
      })
      .catch(error => {
        console.error('Error accessing microphone:', error);
        setIsRecording(false);
        recordingInProgress.current = false;
      });
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    recordingInProgress.current = false;
  };

  const handleStopRecording = () => {
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    sendAudioToBackend(audioBlob);
  };

  const sendAudioToBackend = (audioBlob) => {
    setLoading(true);
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.webm');
    formData.append('history', JSON.stringify(history))

    fetch('/process_audio', {
      method: 'POST',
      body: formData,
    })
      .then(response => response.json())
      .then(data => {
        if (data.transcription && data.chatgpt_response && data.response) {
          setTranscription(data.transcription);
          setChatGPTResponse(data.chatgpt_response);
          history.push({"role": "user", "content": data.transcription});
          history.push({ "role": "assistant", "content": data.chatgpt_response });
          setHistory(history);
          const audioData = `data:audio/wav;base64,${data.response}`;
          setAudioSrc(audioData);
        } else {
          alert('Error processing audio: ' + data.error);
        }
        setLoading(false);
      })
      .catch(error => {
        console.error('Error sending audio to backend:', error);
        setLoading(false);
      });
  };

  const startSampleRecording = () => {
    if (isSampleRecording) return;

    setIsSampleRecording(true);
    sampleAudioChunksRef.current = [];

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        sampleStreamRef.current = stream;
        sampleMediaRecorderRef.current = new MediaRecorder(stream);

        sampleMediaRecorderRef.current.ondataavailable = event => {
          sampleAudioChunksRef.current.push(event.data);
        };

        sampleMediaRecorderRef.current.onstop = handleSampleStopRecording;
        sampleMediaRecorderRef.current.start();
      })
      .catch(error => {
        console.error('Error accessing microphone for sample:', error);
        setIsSampleRecording(false);
      });
  };

  const stopSampleRecording = () => {
    if (sampleMediaRecorderRef.current && sampleMediaRecorderRef.current.state !== "inactive") {
      sampleMediaRecorderRef.current.stop();
      sampleStreamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsSampleRecording(false);
  };

  const handleSampleStopRecording = () => {
    const audioBlob = new Blob(sampleAudioChunksRef.current, { type: 'audio/wav' });
    sendSampleToBackend(audioBlob);
  };

  const sendSampleToBackend = (audioBlob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'sample.wav');

    fetch('/change_sample', {
      method: 'POST',
      body: formData,
    })
      .then(response => response.json())
      .then(data => {
        if (data.message) {
          alert(data.message);
          fetchCurrentSample();
        } else {
          alert('Error changing sample file: ' + data.error);
        }
      })
      .catch(error => {
        console.error('Error sending sample to backend:', error);
      });
  };

  const changeSampleFile = (event) => {
    const file = event.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append('audio', file);

      fetch('/change_sample', {
        method: 'POST',
        body: formData,
      })
        .then(response => response.json())
        .then(data => {
          if (data.message) {
            alert(data.message);
            fetchCurrentSample();
          } else {
            alert('Error changing sample file: ' + data.error);
          }
        })
        .catch(error => {
          console.error('Error changing sample file:', error);
        });
    }
  };

  const fetchCurrentSample = () => {
    fetch('/get_current_sample')
      .then(response => response.blob())
      .then(blob => {
        setCurrentSample(URL.createObjectURL(blob));
      })
      .catch(error => {
        console.error('Error fetching current sample:', error);
      });
  };

  useEffect(() => {
    fetchCurrentSample();
  }, []);

  useEffect(() => {
    if (audioSrc && audioRef.current) {
      audioRef.current.play();
    }
  }, [audioSrc]);

  return (
    <div className="container">
      <h1 className='orbitron'>SIMULACRUM</h1>
      <div className="button-container">
        <button className={`record-button ${isRecording ? 'recording' : ''}`} onClick={isRecording ? stopRecording : startRecording}>
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
      </div>
      {loading && <div className="loading">Processing...</div>}
      <div className="transcription-container">
        <h2>Transcription:</h2>
        <p>{transcription || 'Speak something to get the transcription.'}</p>
      </div>
      <div className="chatgpt-response-container">
        <h2>GPT Response:</h2>
        <p>{chatGPTResponse || 'You will see the GPT response here.'}</p>
      </div>
      {audioSrc && (
        <div className="audio-response-container">
          <audio ref={audioRef} controls src={audioSrc} class="audio-hidden">
            Your browser does not support the audio element.
          </audio>
        </div>
      )}
      <div className="sample-file-container">
        <div className="sample-recording-controls">
          <button
            className={`record-button ${isSampleRecording ? 'recording' : ''}`}
            onClick={isSampleRecording ? stopSampleRecording : startSampleRecording}
          >
            {isSampleRecording ? 'Stop Recording Sample' : 'Record New Sample'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;