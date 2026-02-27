import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';

interface AudioWaveformProps {
  src: string;
  isMe?: boolean;
}

// Available playback speeds
const PLAYBACK_SPEEDS = [1, 1.2, 1.5, 2, 2.5, 3];

const AudioWaveform: React.FC<AudioWaveformProps> = ({ src, isMe = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Number of bars in the waveform
  const BAR_COUNT = 50;

  // Analyze audio and extract waveform data
  useEffect(() => {
    const analyzeAudio = async () => {
      try {
        const response = await fetch(src);
        const arrayBuffer = await response.arrayBuffer();

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Get audio data from the first channel
        const channelData = audioBuffer.getChannelData(0);
        const samples = channelData.length;
        const blockSize = Math.floor(samples / BAR_COUNT);

        const bars: number[] = [];
        for (let i = 0; i < BAR_COUNT; i++) {
          let sum = 0;
          const start = i * blockSize;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[start + j] || 0);
          }
          // Normalize and apply some scaling for visual effect
          const avg = sum / blockSize;
          bars.push(Math.min(1, avg * 3)); // Scale up quiet parts
        }

        // Normalize to 0-1 range based on max value
        const maxVal = Math.max(...bars, 0.01);
        const normalized = bars.map(v => Math.max(0.1, v / maxVal)); // Minimum 10% height

        setWaveformData(normalized);
        setIsLoading(false);

        audioContext.close();
      } catch (error) {
        console.error('Error analyzing audio:', error);
        // Generate placeholder waveform on error
        const placeholder = Array(BAR_COUNT).fill(0).map(() => 0.2 + Math.random() * 0.6);
        setWaveformData(placeholder);
        setIsLoading(false);
      }
    };

    analyzeAudio();
  }, [src]);

  // Update playback rate when speed changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Handle audio metadata loaded
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      audioRef.current.playbackRate = playbackSpeed;
    }
  };

  // Handle time update during playback
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  // Handle audio ended
  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  // Cycle through playback speeds
  const cycleSpeed = useCallback(() => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    setPlaybackSpeed(PLAYBACK_SPEEDS[nextIndex]);
  }, [playbackSpeed]);

  // Handle click on waveform to seek
  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (audioRef.current && duration > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      const newTime = percentage * duration;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // Format time as mm:ss
  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Format speed for display
  const formatSpeed = (speed: number): string => {
    return speed === 1 ? '1x' : `${speed}x`;
  };

  // Calculate progress percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Colors based on sender
  const playedColor = isMe ? '#34D399' : '#10B981'; // Green shades
  const unplayedColor = isMe ? 'rgba(255,255,255,0.4)' : 'rgba(100,116,139,0.5)';
  const bgColor = isMe ? 'bg-green-600/20' : 'bg-theme-base/60';
  const buttonBg = isMe ? 'bg-green-500' : 'bg-green-500';

  return (
    <div className={`flex items-center gap-3 p-3 ${bgColor} rounded-2xl min-w-[280px] max-w-[350px]`}>
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={src}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        preload="metadata"
      />

      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        className={`w-12 h-12 rounded-full ${buttonBg} flex items-center justify-center flex-shrink-0 text-white shadow-lg hover:scale-105 transition-transform`}
      >
        {isPlaying ? (
          <Pause className="w-5 h-5" fill="currentColor" />
        ) : (
          <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
        )}
      </button>

      {/* Waveform and time */}
      <div className="flex-1 min-w-0">
        {/* Waveform */}
        <div
          className="h-10 flex items-center gap-[2px] cursor-pointer"
          onClick={handleWaveformClick}
        >
          {isLoading ? (
            // Loading placeholder
            <div className="flex items-center gap-[2px] w-full">
              {Array(BAR_COUNT).fill(0).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 bg-slate-400/30 rounded-full animate-pulse"
                  style={{ height: '30%' }}
                />
              ))}
            </div>
          ) : (
            waveformData.map((height, i) => {
              const barProgress = (i / BAR_COUNT) * 100;
              const isPlayed = barProgress < progress;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-full transition-colors duration-100"
                  style={{
                    height: `${Math.max(15, height * 100)}%`,
                    backgroundColor: isPlayed ? playedColor : unplayedColor,
                    minWidth: '2px',
                    maxWidth: '4px',
                  }}
                />
              );
            })
          )}
        </div>

        {/* Time and Speed display */}
        <div className="flex justify-between items-center mt-1">
          <span className={`text-xs ${isMe ? 'text-green-100/70' : 'text-theme-muted'}`}>
            {formatTime(currentTime > 0 ? currentTime : duration)}
          </span>
          <div className="flex items-center gap-2">
            {duration > 0 && currentTime > 0 && (
              <span className={`text-xs ${isMe ? 'text-green-100/50' : 'text-theme-muted/50'}`}>
                {formatTime(duration)}
              </span>
            )}
            {/* Speed Button */}
            <button
              onClick={cycleSpeed}
              className={`
                px-2 py-0.5 rounded-full text-[10px] font-bold
                ${isMe
                  ? 'bg-green-500/30 text-green-100 hover:bg-green-500/50'
                  : 'bg-slate-600/50 text-slate-300 hover:bg-slate-600/70'
                }
                transition-colors
              `}
              title="Change playback speed"
            >
              {formatSpeed(playbackSpeed)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioWaveform;
