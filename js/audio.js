/**
 * Web Audio API サウンドマネージャー
 * 外部音源ファイル不要で、軽快でキャッチーなBGM・効果音をリアルタイム合成
 */
class SoundManager {
    constructor() {
        this.ctx = null;
        this.isMuted = localStorage.getItem('rabbit_ballbound_muted') === 'true';
        this.bgmGain = null;
        this.seGain = null;
        this.masterGain = null;
        
        this.bgmTimer = null;
        this.bgmStep = 0;
        this.currentBgmType = null; // 'normal' | 'fever'
        this.bpm = 132;
    }

    init() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.isMuted ? 0 : 0.7;
        this.masterGain.connect(this.ctx.destination);

        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = 0.45;
        this.bgmGain.connect(this.masterGain);

        this.seGain = this.ctx.createGain();
        this.seGain.gain.value = 0.8;
        this.seGain.connect(this.masterGain);
    }

    resume() {
        if (!this.ctx) this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.resume();
        this.isMuted = !this.isMuted;
        localStorage.setItem('rabbit_ballbound_muted', this.isMuted);
        if (this.masterGain && this.ctx) {
            const now = this.ctx.currentTime;
            this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.7, now, 0.05);
        }
        return this.isMuted;
    }

    // 周波数変換 (MIDIノート番号 -> Hz)
    midiToFreq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    // --- BGM システム ---
    startBGM(type = 'normal') {
        this.resume();
        if (this.currentBgmType === type && this.bgmTimer) return;
        this.stopBGM();
        this.currentBgmType = type;
        this.bgmStep = 0;
        this.bpm = type === 'fever' ? 156 : 132;

        const interval = (60 / this.bpm / 4) * 1000; // 16分音符
        this.bgmTimer = setInterval(() => {
            this.playBGMStep();
            this.bgmStep = (this.bgmStep + 1) % 64;
        }, interval);
    }

    stopBGM() {
        if (this.bgmTimer) {
            clearInterval(this.bgmTimer);
            this.bgmTimer = null;
        }
        this.currentBgmType = null;
    }

    playBGMStep() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const step = this.bgmStep;

        if (this.currentBgmType === 'normal') {
            // Cメジャー / Aマイナーのポップなマリンバ調進行
            // コード: C (0-15) -> G (16-31) -> Am (32-47) -> F (48-63)
            const chords = [
                [60, 64, 67], // C
                [55, 59, 62], // G
                [57, 60, 64], // Am
                [53, 57, 60]  // F
            ];
            const chordIndex = Math.floor(step / 16);
            const currentChord = chords[chordIndex];

            // ベース (8分音符裏拍)
            if (step % 4 === 0 || step % 4 === 2) {
                const root = currentChord[0] - 24;
                this.playSynthNote(this.midiToFreq(root), now, 0.12, 'triangle', 0.25, this.bgmGain);
            }

            // マリンバ風アルペジオメロディ
            const melodyPattern = [
                60, 64, 67, 72, 67, 64, 60, 64,
                72, 74, 76, 74, 72, 67, 64, 62
            ];
            const pitchOffset = [0, -2, -3, -5][chordIndex];
            const noteMidi = melodyPattern[step % 16] + pitchOffset;

            if (step % 2 === 0) {
                this.playPluckNote(this.midiToFreq(noteMidi), now, 0.1, 0.18, this.bgmGain);
            }

            // 軽快なドラム (ハイハット & スネア)
            if (step % 2 === 0) {
                this.playNoisePercussion(now, 0.03, 0.04, this.bgmGain); // Hat
            }
            if (step % 8 === 4) {
                this.playSnare(now, 0.08, 0.08, this.bgmGain); // Snare
            }
        } else if (this.currentBgmType === 'fever') {
            // フィーバー用ハイテンポ・ダンスメロディ
            const bassNotes = [48, 48, 51, 53, 48, 48, 55, 53];
            if (step % 2 === 0) {
                const bMidi = bassNotes[(Math.floor(step / 2)) % bassNotes.length];
                this.playSynthNote(this.midiToFreq(bMidi), now, 0.1, 'sawtooth', 0.2, this.bgmGain);
            }
            // キラキラリード
            const feverLead = [72, 75, 79, 84, 82, 79, 75, 77];
            const leadMidi = feverLead[(step) % feverLead.length];
            this.playSynthNote(this.midiToFreq(leadMidi), now, 0.08, 'square', 0.15, this.bgmGain);

            // ビート
            if (step % 4 === 0) {
                this.playKick(now, 0.12, 0.25, this.bgmGain);
            }
            if (step % 4 === 2) {
                this.playSnare(now, 0.09, 0.12, this.bgmGain);
            }
        }
    }

    // --- 各種シンセ音源ヘルパー ---
    playSynthNote(freq, time, duration, type = 'sine', gainVal = 0.2, targetNode = this.seGain) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(gainVal, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc.connect(gain);
        gain.connect(targetNode);

        osc.start(time);
        osc.stop(time + duration);
    }

    playPluckNote(freq, time, duration, gainVal = 0.2, targetNode = this.seGain) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 3, time);
        filter.frequency.exponentialRampToValueAtTime(freq * 0.8, time + duration);

        gain.gain.setValueAtTime(gainVal, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(targetNode);

        osc.start(time);
        osc.stop(time + duration);
    }

    playKick(time, duration = 0.15, gainVal = 0.3, targetNode = this.seGain) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, time);
        osc.frequency.exponentialRampToValueAtTime(30, time + duration);

        gain.gain.setValueAtTime(gainVal, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc.connect(gain);
        gain.connect(targetNode);

        osc.start(time);
        osc.stop(time + duration);
    }

    playSnare(time, duration = 0.1, gainVal = 0.15, targetNode = this.seGain) {
        if (!this.ctx) return;
        this.playNoisePercussion(time, duration, gainVal, targetNode);
        this.playSynthNote(220, time, duration * 0.7, 'triangle', gainVal * 0.6, targetNode);
    }

    playNoisePercussion(time, duration, gainVal = 0.1, targetNode = this.seGain) {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1200, time);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(gainVal, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(targetNode);

        noise.start(time);
        noise.stop(time + duration);
    }

    // --- 効果音（SE）メソッド群 ---
    
    playClick() {
        this.resume();
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        this.playSynthNote(780, now, 0.05, 'sine', 0.25);
    }

    playHop() {
        this.resume();
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(420, now + 0.08);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(this.seGain);
        osc.start(now);
        osc.stop(now + 0.08);
    }

    playCarrot() {
        this.resume();
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        this.playSynthNote(880, now, 0.08, 'sine', 0.3);
        this.playSynthNote(1320, now + 0.06, 0.12, 'sine', 0.35);
        this.playSynthNote(1760, now + 0.12, 0.16, 'triangle', 0.3);
    }

    playBounce(pitch = 1) {
        this.resume();
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        const startFreq = 180 * pitch;
        const endFreq = 90 * pitch;
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.12);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(this.seGain);
        osc.start(now);
        osc.stop(now + 0.12);
    }

    playSquish() {
        this.resume();
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;

        this.playNoisePercussion(now, 0.18, 0.4);

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.25);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(this.seGain);
        osc.start(now);
        osc.stop(now + 0.25);
    }

    playFeverStart() {
        this.resume();
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C, E, G, High C
        notes.forEach((freq, idx) => {
            this.playSynthNote(freq, now + idx * 0.07, 0.2, 'square', 0.25);
        });
    }

    playFeverHit() {
        this.resume();
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        this.playKick(now, 0.25, 0.45);
        this.playNoisePercussion(now, 0.2, 0.35);
        this.playSynthNote(600, now, 0.15, 'sawtooth', 0.3);
    }

    playGameOver() {
        this.resume();
        this.stopBGM();
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const notes = [440, 415.3, 392, 349.2]; // A, Ab, G, F
        notes.forEach((freq, idx) => {
            this.playSynthNote(freq, now + idx * 0.16, 0.25, 'triangle', 0.3);
        });
    }

    playHighScore() {
        this.resume();
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
        notes.forEach((freq, idx) => {
            this.playSynthNote(freq, now + idx * 0.1, 0.3, 'triangle', 0.35);
        });
    }
}

window.soundManager = new SoundManager();
