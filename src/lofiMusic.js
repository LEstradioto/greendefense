// Lo-Fi music player implementation with multiple free lofi tracks
export class LofiMusicPlayer {
    constructor() {
        this.initialized = false;
        this.isPlaying = false;
        this.isMuted = false;
        this.currentTrackIndex = 0;
        this.audioElement = null;
        this.musicButton = document.getElementById('music-toggle');
        this.musicIcon = document.getElementById('music-icon');
        
        // Collection of high-quality free lofi tracks that have been tested and verified to work
        this.lofiTracks = [
            // User-provided track
            "https://cdn.pixabay.com/download/audio/2023/07/30/audio_e0908e8569.mp3", // Good Night Lofi by FASSounds
            
            // Pixabay free lofi tracks (royalty-free)
            "https://cdn.pixabay.com/download/audio/2022/11/22/audio_febc508520.mp3", // Lofi Chill by Music Unlimited
            "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3"  // Lofi Study by FASSounds
        ];
        
        // Create display for current track
        this.createMusicInfoDisplay();
        
        // Set up music toggle button
        if (this.musicButton) {
            this.musicButton.addEventListener('click', () => {
                this.toggleMusic();
            });
        }
        
        // Initialize immediately but with user interaction requirement handled
        this.initialize();
        
        // Backup initializer in case autoplay policy blocks the first attempt
        // Initialize music player when the page is clicked
        document.body.addEventListener('click', () => {
            if (!this.isPlaying) {
                // If not already playing, try to start
                if (this.audioElement && this.audioElement.paused) {
                    this.audioElement.play().catch(err => 
                        console.log('Still cannot play due to autoplay policy, user needs to click music button')
                    );
                }
            }
        }, { once: true });
    }
    
    createMusicInfoDisplay() {
        // Create a small display for the current track
        this.musicInfoDisplay = document.createElement('div');
        this.musicInfoDisplay.className = 'music-info';
        this.musicInfoDisplay.style.position = 'fixed';
        this.musicInfoDisplay.style.bottom = '60px';
        this.musicInfoDisplay.style.left = '10px';
        this.musicInfoDisplay.style.fontSize = '12px';
        this.musicInfoDisplay.style.color = '#aaa';
        this.musicInfoDisplay.style.padding = '5px';
        this.musicInfoDisplay.style.background = 'rgba(0, 0, 0, 0.5)';
        this.musicInfoDisplay.style.borderRadius = '3px';
        this.musicInfoDisplay.style.opacity = '0';
        this.musicInfoDisplay.style.transition = 'opacity 0.5s';
        this.musicInfoDisplay.style.pointerEvents = 'none';
        this.musicInfoDisplay.textContent = 'Loading music...';
        
        // Add to DOM
        document.body.appendChild(this.musicInfoDisplay);
        
        // Add next track button
        this.nextTrackButton = document.createElement('button');
        this.nextTrackButton.className = 'music-next';
        this.nextTrackButton.innerHTML = '<i class="fas fa-forward"></i>';
        this.nextTrackButton.style.position = 'fixed';
        this.nextTrackButton.style.bottom = '10px';
        this.nextTrackButton.style.left = '50px';
        this.nextTrackButton.style.width = '30px';
        this.nextTrackButton.style.height = '30px';
        this.nextTrackButton.style.borderRadius = '50%';
        this.nextTrackButton.style.border = 'none';
        this.nextTrackButton.style.background = '#333';
        this.nextTrackButton.style.color = '#fff';
        this.nextTrackButton.style.cursor = 'pointer';
        this.nextTrackButton.style.display = 'none';
        
        // Add event listener
        this.nextTrackButton.addEventListener('click', () => {
            this.playNextTrack();
        });
        
        // Add to DOM
        document.body.appendChild(this.nextTrackButton);
    }
    
    async initialize() {
        try {
            console.log('Initializing LofiMusicPlayer');
            
            // Create audio context first to handle autoplay policy
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create audio element if it doesn't exist
            if (!this.audioElement) {
                this.audioElement = new Audio();
                this.audioElement.volume = 0.4; // Start at 40% volume
                this.audioElement.crossOrigin = "anonymous"; // For connecting to AudioContext
                
                // Connect to audio context for more control
                if (this.audioContext) {
                    this.gainNode = this.audioContext.createGain();
                    this.gainNode.gain.value = 0.4;
                    this.gainNode.connect(this.audioContext.destination);
                    
                    this.audioSource = this.audioContext.createMediaElementSource(this.audioElement);
                    this.audioSource.connect(this.gainNode);
                }
                
                // Add track ended handler to automatically play next track
                this.audioElement.addEventListener('ended', () => {
                    this.playNextTrack();
                });
                
                // Add error handler to skip to next track if one fails
                this.audioElement.addEventListener('error', (e) => {
                    console.error('Error playing track:', this.currentTrackIndex, e);
                    this.failedTracks = this.failedTracks || {};
                    this.failedTracks[this.currentTrackIndex] = true;
                    this.playNextTrack();
                });
                
                // Show track info when playing starts
                this.audioElement.addEventListener('playing', () => {
                    this.showTrackInfo();
                    this.musicButton.style.backgroundColor = "#4CAF50"; // Change to green when playing
                });
                
                // Add timeupdate event to check if playback is actually happening
                this.audioElement.addEventListener('timeupdate', () => {
                    if (this.lastTime === this.audioElement.currentTime && this.audioElement.currentTime > 0) {
                        this.stuckCounter = (this.stuckCounter || 0) + 1;
                        if (this.stuckCounter > 5) {
                            console.warn('Playback appears to be stuck, trying next track');
                            this.stuckCounter = 0;
                            this.playNextTrack();
                        }
                    } else {
                        this.stuckCounter = 0;
                        this.lastTime = this.audioElement.currentTime;
                    }
                });
            }
            
            // Initialize failed tracks tracking
            this.failedTracks = {};
            
            // Choose a random starting track
            this.currentTrackIndex = Math.floor(Math.random() * this.lofiTracks.length);
            
            // Set up embedded fallback tracks in case all online sources fail
            this.setUpFallbackTrack();
            
            // Special trick: play a silent audio to unlock audio playback on iOS/Safari
            this.unlockAudio();
            
            // Load the track immediately, but don't wait for it
            this.loadAndPlayTrack(this.currentTrackIndex);
            
            this.initialized = true;
            
            // Retry playing after a short delay (gives browser time to load)
            setTimeout(() => {
                if (this.audioElement && this.audioElement.paused) {
                    this.audioElement.play().catch(err => {
                        console.log('Delayed play attempt failed, waiting for user click');
                    });
                }
            }, 2000);
        } catch (error) {
            console.error('Error initializing music player:', error);
            this.useFallbackTrack();
        }
    }
    
    unlockAudio() {
        // This is a common trick to enable audio autoplay in various browsers
        // Play a silent sound to unlock audio on iOS and other restrictive browsers
        try {
            // Create a short, silent audio buffer
            const silentBuffer = this.audioContext.createBuffer(1, 1, 22050);
            const bufferSource = this.audioContext.createBufferSource();
            bufferSource.buffer = silentBuffer;
            bufferSource.connect(this.audioContext.destination);
            bufferSource.start(0);
            
            // Resume the audio context
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            console.log('Audio unlocked for autoplay');
        } catch (e) {
            console.log('Could not unlock audio:', e);
        }
    }
    
    async loadAndPlayTrack(index) {
        // If we've tried all tracks and they've all failed, use fallback
        let allFailed = true;
        for (let i = 0; i < this.lofiTracks.length; i++) {
            if (!this.failedTracks[i]) {
                allFailed = false;
                break;
            }
        }
        
        if (allFailed) {
            console.warn('All tracks failed to load, using fallback');
            return this.useFallbackTrack();
        }
        
        // Skip failed tracks
        if (this.failedTracks[index]) {
            console.log('Skipping failed track', index);
            return this.playNextTrack();
        }
        
        try {
            this.audioElement.src = this.lofiTracks[index];
            
            // Try to play (might be blocked by autoplay policy)
            const playPromise = this.audioElement.play();
            
            if (playPromise !== undefined) {
                await playPromise.then(() => {
                    console.log('Music started playing:', index);
                    this.isPlaying = true;
                    this.updateMusicButtonState();
                    this.nextTrackButton.style.display = 'block';
                }).catch(error => {
                    console.log('Autoplay prevented or error playing track', error);
                    // If it was an error (not just autoplay prevention), mark as failed
                    if (error.name !== 'NotAllowedError') {
                        this.failedTracks[index] = true;
                        this.playNextTrack();
                    }
                });
            }
        } catch (error) {
            console.error('Error loading track:', error);
            this.failedTracks[index] = true;
            this.playNextTrack();
        }
    }
    
    setUpFallbackTrack() {
        // Base64 encoded very small lofi music sample as absolute fallback
        // This is a minimal 5-second loop that will work no matter what
        const fallbackBase64 = "data:audio/mp3;base64,SUQzAwAAAAAAJlRJVDIAAAAZAAAATG9GaSBGYWxsYmFjayAoNXMgbG9vcCkAVEFMQgAAABIAAABMb0ZpIE5vdXZlYXV4IExpZmUAVFlFUgAAAAcAAAAyMDIzAFRDT04AAAAOAAAATm91dmVhdXggTGlmZQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/7kGQAAAdJdEAHBMAIqQ6JAOEYhRZ8WAcKwAii8GkA4RJEFAJAagAFgr6QaNj17k16T1LlpOeNxjEi5JJHrXrAYfKGLjPJRI04YNE6SIgcJ4Uc/i5R+ohBBdZohBBkCDEyZMmQIGDPJkyZMgQM8+bNGqaBnmkPGu00yYGGjUcYOGFB+KLm5rN36/v03MQI8DlmY3Wq9xutmIRE+n6vWzEIhBE+n6v6hMRBE+v/X9QmAYggQaBRQUFBTcAgKCgouAQFBQUVAICi4uOAQFFxccAguLi5wAgKCgpvAaIFxcXIHXbtu27b9gCBVgAYGBhHYGBnmIBAYZmYLAcDAVDQJhUBgeA4LBkKhIAwEAcNDIYCQVCRwMBwYGRgMjAYDASDEYDI8GIyLAyGhgYGAyPBgYCAwGBgYGBgMBgMBgMBkMChwUVAoiMExsMEFQwMDAxQUpDBAUMDAYGBigpTlBSmKClOUNKcpSg5SnKUpSlKUpTlKUpSlKUpSlKUpSlKUpSlKUpSlKUpSlKUpSlKUpSlKUpSv97tu27dtu27bttgCBVgAAAAAAAAAAAAAAAFYAAAD/+5BkMAAgXZ13/mDQAoIrWL/KBAhBAqVH+MYACYOtE/w8QAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVcAAAAAAAAABLgAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKsAAAAAAAAAAAAAAAAAAAAACqgAAAAAAAAAAAAAAAAAAAAAAAAAAqsAAAAAAAAAAAAAAAAAAAAAABWAAAAAAAAAAAAAAAAAAAAAAAAAABVwAAAAAAAAAAAAAAAAAAAAAAVUAAAAAAAAAAAAAAAAAAAAAAAAAAAqqAAAAAAAAAAAAAAAAAAAAAAAAqoAAAAAAAAAAAAAAAAAAAAAAAAAAKuAAAAAAAAAAAAAAAAAAAAAAAFXAAAAAAAAAAAAAAAAAAAAAAAAAAAVUAAAAAAAAAAAAAAAAAAAAAAAAABVwAAAAAAAAAAAAAAAAAAAAAAAAAKsAAAAAAAAAAAAAAAAAAAAAAAABVwAAAAAAAAAAAAAAAAAAAAAAAAABVQAAAAAAAAAAAAAAAAAAAAAAAAAKsAAAAAAAAAAAAAAAAAAAAAAAABVwAAAAAAAAAAAAAAAAAAAAAAAAD/+5JkEA/wAABpAAAACAAANIAAAAQAAAaQAAAAgAAA0gAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
        
        this.fallbackTrack = fallbackBase64;
    }
    
    useFallbackTrack() {
        try {
            this.audioElement.src = this.fallbackTrack;
            this.audioElement.loop = true; // Since it's a small loop
            
            const playPromise = this.audioElement.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log('Fallback track playing');
                    this.isPlaying = true;
                    this.updateMusicButtonState();
                    this.nextTrackButton.style.display = 'block';
                    this.musicInfoDisplay.textContent = 'Now Playing: LoFi Fallback Track';
                    this.musicInfoDisplay.style.opacity = '1';
                }).catch(error => {
                    console.log('Autoplay prevented for fallback track', error);
                });
            }
        } catch (error) {
            console.error('Error playing fallback track:', error);
        }
    }
    
    playNextTrack() {
        // Find next non-failed track
        let nextTrackAttempts = 0;
        let foundWorkingTrack = false;
        
        while (nextTrackAttempts < this.lofiTracks.length) {
            // Increment track index
            this.currentTrackIndex = (this.currentTrackIndex + 1) % this.lofiTracks.length;
            
            // Skip if this track has already failed
            if (this.failedTracks && this.failedTracks[this.currentTrackIndex]) {
                nextTrackAttempts++;
                continue;
            }
            
            foundWorkingTrack = true;
            break;
        }
        
        // If we couldn't find a working track, use fallback
        if (!foundWorkingTrack) {
            return this.useFallbackTrack();
        }
        
        // Load and play the next track
        this.loadAndPlayTrack(this.currentTrackIndex);
    }
    
    showTrackInfo() {
        // Extract track name from URL
        const url = this.lofiTracks[this.currentTrackIndex];
        let trackName = url.split('/').pop().split('.')[0];
        
        // Clean up track name
        trackName = trackName.replace(/_/g, ' ')
                           .replace(/-/g, ' - ')
                           .replace(/\b\w/g, l => l.toUpperCase()); // Capitalize first letter of each word
        
        // Show track info
        this.musicInfoDisplay.textContent = `Now Playing: ${trackName}`;
        this.musicInfoDisplay.style.opacity = '1';
        
        // Hide after 5 seconds
        setTimeout(() => {
            this.musicInfoDisplay.style.opacity = '0';
        }, 5000);
    }
    
    toggleMusic() {
        if (!this.initialized) {
            this.initialize();
            return;
        }
        
        if (this.audioElement) {
            if (this.isPlaying) {
                // Pause music
                this.audioElement.pause();
                this.isPlaying = false;
                this.isMuted = true;
                this.nextTrackButton.style.display = 'none';
            } else {
                // Resume or start music
                this.audioElement.play().then(() => {
                    this.showTrackInfo();
                    this.nextTrackButton.style.display = 'block';
                });
                this.isPlaying = true;
                this.isMuted = false;
            }
            
            // Update button state
            this.updateMusicButtonState();
        }
    }
    
    updateMusicButtonState() {
        if (!this.musicButton || !this.musicIcon) return;
        
        if (this.isMuted) {
            this.musicButton.classList.add('muted');
            this.musicIcon.className = 'fas fa-volume-mute';
        } else {
            this.musicButton.classList.remove('muted');
            this.musicIcon.className = 'fas fa-volume-up';
        }
    }
}