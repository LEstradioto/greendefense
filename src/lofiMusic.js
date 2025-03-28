// Lo-Fi music generator using Magenta.js
export class LofiMusicPlayer {
    constructor() {
        this.initialized = false;
        this.isPlaying = false;
        this.isMuted = false;
        this.player = null;
        this.audioContext = null;
        this.gainNode = null;
        this.musicButton = document.getElementById('music-toggle');
        this.musicIcon = document.getElementById('music-icon');
        
        // Initialize music player when the page is clicked (for autoplay policy)
        document.body.addEventListener('click', () => {
            if (!this.initialized) {
                this.initialize();
            }
        }, { once: true });
        
        // Set up music toggle button
        if (this.musicButton) {
            this.musicButton.addEventListener('click', () => {
                this.toggleMusic();
            });
        }
    }
    
    async initialize() {
        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Ensure the audio context is running (needed for Chrome's autoplay policy)
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            // Create a gain node for volume control
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 0.5; // Set initial volume to 50%
            this.gainNode.connect(this.audioContext.destination);
            
            // Initialize MusicRNN model for continuous generation
            this.musicRNN = new window.music.MusicRNN('https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/chord_conditioned_2bar');
            await this.musicRNN.initialize();
            
            // Initialize Magenta player
            this.player = new window.music.Player(false, this.gainNode);
            
            this.initialized = true;
            
            // Start playing the lo-fi music only after a user interaction
            if (this.audioContext.state === 'running') {
                await this.generateAndPlayLofi();
            } else {
                // If context is still suspended, set up a one-time click handler
                const startAudio = async () => {
                    await this.audioContext.resume();
                    await this.generateAndPlayLofi();
                    document.body.removeEventListener('click', startAudio);
                };
                document.body.addEventListener('click', startAudio, { once: true });
            }
            
            console.log('Lo-fi music player initialized');
        } catch (error) {
            console.error('Error initializing lo-fi music player:', error);
            
            // Fallback to a simple audio loop if Magenta fails
            this.fallbackToSimpleAudio();
        }
    }
    
    async generateAndPlayLofi() {
        try {
            // Create a simple Lo-Fi chord progression
            const lofiChords = [
                {chord: 'Dm7', duration: 2},
                {chord: 'G7', duration: 2},
                {chord: 'Cmaj7', duration: 2},
                {chord: 'Fmaj7', duration: 2}
            ];
            
            // Create a sequence based on chord progression
            const seed = {
                notes: [
                    {pitch: 62, startTime: 0, endTime: 0.5},
                    {pitch: 64, startTime: 0.5, endTime: 1.0},
                    {pitch: 65, startTime: 1.0, endTime: 1.5},
                    {pitch: 67, startTime: 1.5, endTime: 2.0}
                ],
                totalTime: 2
            };
            
            // Generate a continuation based on our seed sequence
            const continuation = await this.musicRNN.continueSequence(
                seed,
                20, // Generate 20 steps
                1.0, // Temperature (randomness)
                lofiChords
            );
            
            // Ensure continuous playback
            this.player.callbackObject = {
                run: (note) => { return note; },
                stop: () => { 
                    // When sequence ends, start a new one
                    if (this.isPlaying) {
                        setTimeout(() => this.generateAndPlayLofi(), 500);
                    }
                }
            };
            
            // Add some lo-fi characteristics
            const sequence = this.addLofiCharacteristics(continuation);
            
            // Start playback
            this.player.start(sequence, 80); // 80 BPM for that chill lo-fi feel
            this.isPlaying = true;
            
            // Update UI
            this.updateMusicButtonState();
        } catch (error) {
            console.error('Error generating lo-fi music:', error);
            this.fallbackToSimpleAudio();
        }
    }
    
    addLofiCharacteristics(sequence) {
        // Add lo-fi characteristics to the sequence
        // 1. Lower velocity for that chill vibe
        // 2. Add slight timing variations
        const lofiSequence = {
            notes: sequence.notes.map(note => {
                return {
                    ...note,
                    velocity: 60 + Math.floor(Math.random() * 20), // Lower velocity with slight variation
                    startTime: note.startTime + (Math.random() * 0.03), // Slight timing variation
                    endTime: note.endTime + (Math.random() * 0.03) // Slight timing variation
                };
            }),
            totalTime: sequence.totalTime
        };
        
        return lofiSequence;
    }
    
    fallbackToSimpleAudio() {
        console.log('Using fallback audio player');
        
        // Create a simple audio element with a lo-fi track
        const audio = document.createElement('audio');
        audio.loop = true;
        audio.volume = 0.4;
        
        // Use a royalty-free lo-fi track URL
        audio.src = 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_59a93bd111.mp3';
        
        // Set as fallback player
        this.player = {
            isPlaying: () => !audio.paused,
            start: () => {
                // Handle autoplay restrictions by requiring a user interaction
                const playPromise = audio.play();
                
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        this.isPlaying = true;
                        this.updateMusicButtonState();
                    }).catch(error => {
                        console.error('Error playing audio:', error);
                        
                        // Set up a one-time click handler to start audio
                        const startAudio = () => {
                            audio.play()
                                .then(() => {
                                    this.isPlaying = true;
                                    this.updateMusicButtonState();
                                })
                                .catch(e => console.error('Still cannot play audio:', e));
                            document.body.removeEventListener('click', startAudio);
                        };
                        document.body.addEventListener('click', startAudio, { once: true });
                    });
                }
            },
            stop: () => {
                audio.pause();
                this.isPlaying = false;
                this.updateMusicButtonState();
            }
        };
        
        // Try to start playing, but may be prevented by autoplay policy
        this.player.start();
        this.initialized = true;
    }
    
    toggleMusic() {
        if (!this.initialized) {
            this.initialize();
            return;
        }
        
        if (this.player) {
            if (this.isPlaying) {
                // Stop music playback
                this.player.stop();
                this.isPlaying = false;
                this.isMuted = true;
            } else {
                // Resume music playback
                if (this.player.start) {
                    if (this.player.isPlaying && !this.player.isPlaying()) {
                        this.player.start();
                    } else {
                        this.generateAndPlayLofi();
                    }
                }
                this.isPlaying = true;
                this.isMuted = false;
            }
            
            // Update button appearance
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