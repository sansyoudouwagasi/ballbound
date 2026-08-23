/**
 * メインゲームコントローラー (Rabbit Ball Bound)
 * Three.js レンダリングループ、タッチ/キーボード操作、当たり判定、ステート管理
 */
class Game {
    constructor() {
        this.container = document.getElementById('game-canvas-container');
        this.state = 'TITLE'; // 'TITLE' | 'PLAYING' | 'PAUSED' | 'GAMEOVER'

        // ゲームステータス
        this.score = 0;
        this.distance = 0;
        this.carrots = 0;
        this.highScore = parseInt(localStorage.getItem('rabbit_ballbound_highscore') || '0', 10);
        
        // プレイヤーウサギの位置と操作
        this.rabbitLaneX = 0; // -2.2 〜 +2.2
        this.targetLaneX = 0;
        this.lateralVelocity = 0;
        this.runSpeed = 16.0; // 走行速度
        this.baseSpeed = 16.0;

        // フィーバー状態
        this.feverGauge = 0; // 0 〜 100
        this.isFever = false;
        this.feverTimer = 0;
        this.feverDuration = 7.0;

        // 入力管理
        this.isPointerDown = false;
        this.pointerStartX = 0;
        this.laneStartX = 0;
        this.keys = { left: false, right: false };

        // Three.js 初期化
        this.initThree();
        this.world = new WorldManager(this.scene);
        this.rabbit = new RabbitCharacter();
        this.scene.add(this.rabbit.mesh);

        // イベントリスナー設定
        this.bindEvents();
        this.updateUI();

        // アニメーションループ開始
        this.clock = new THREE.Clock();
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    initThree() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0xd6f0ff, 0.015);

        // カメラ（ウサギの後ろ姿を見下ろす三人称視点）
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 300);
        this.camera.position.set(0, 3.2, 5.0);

        // レンダラー
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.container.appendChild(this.renderer.domElement);

        // ライティング
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
        this.scene.add(ambientLight);

        this.dirLight = new THREE.DirectionalLight(0xfff5e6, 0.85);
        this.dirLight.position.set(15, 30, 20);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = 1024;
        this.dirLight.shadow.mapSize.height = 1024;
        this.dirLight.shadow.camera.near = 0.5;
        this.dirLight.shadow.camera.far = 80;
        const d = 12;
        this.dirLight.shadow.camera.left = -d;
        this.dirLight.shadow.camera.right = d;
        this.dirLight.shadow.camera.top = d;
        this.dirLight.shadow.camera.bottom = -d;
        this.scene.add(this.dirLight);

        // 半球ライト（空と地面の柔らかい反射光）
        const hemiLight = new THREE.HemisphereLight(0xbde8ff, 0x88cc66, 0.5);
        this.scene.add(hemiLight);
    }

    bindEvents() {
        // ウィンドウリサイズ
        window.addEventListener('resize', () => this.onResize());

        // タッチ & マウス操作
        const dom = this.container;
        
        const handleStart = (clientX) => {
            if (this.state !== 'PLAYING') return;
            this.isPointerDown = true;
            this.pointerStartX = clientX;
            this.laneStartX = this.targetLaneX;
        };

        const handleMove = (clientX) => {
            if (!this.isPointerDown || this.state !== 'PLAYING') return;
            const deltaX = clientX - this.pointerStartX;
            const sens = (this.world.trackWidth * 0.9) / (this.container.clientWidth * 0.6);
            this.targetLaneX = Math.max(-2.3, Math.min(2.3, this.laneStartX + deltaX * sens));
        };

        const handleEnd = () => {
            this.isPointerDown = false;
        };

        dom.addEventListener('mousedown', (e) => handleStart(e.clientX));
        window.addEventListener('mousemove', (e) => handleMove(e.clientX));
        window.addEventListener('mouseup', handleEnd);

        dom.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) handleStart(e.touches[0].clientX);
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) handleMove(e.touches[0].clientX);
        }, { passive: true });

        window.addEventListener('touchend', handleEnd);

        // キーボード操作 (単押しタップ & 長押し両対応)
        window.addEventListener('keydown', (e) => {
            if (this.state !== 'PLAYING') return;
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
                this.keys.left = true;
                this.targetLaneX = Math.max(-2.3, this.targetLaneX - 0.55);
            }
            if (e.code === 'ArrowRight' || e.code === 'KeyD') {
                this.keys.right = true;
                this.targetLaneX = Math.min(2.3, this.targetLaneX + 0.55);
            }
            if (e.code === 'Space') {
                this.togglePause();
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.keys.left = false;
            if (e.code === 'ArrowRight' || e.code === 'KeyD') this.keys.right = false;
        });

        // UI ボタンイベント
        document.getElementById('start-btn').addEventListener('click', () => {
            window.soundManager.playClick();
            this.startGame();
        });

        document.getElementById('retry-btn').addEventListener('click', () => {
            window.soundManager.playClick();
            this.startGame();
        });

        document.getElementById('title-btn').addEventListener('click', () => {
            window.soundManager.playClick();
            this.showTitle();
        });

        document.getElementById('how-to-btn').addEventListener('click', () => {
            window.soundManager.playClick();
            document.getElementById('how-to-modal').classList.remove('hidden');
        });

        document.getElementById('close-how-to-btn').addEventListener('click', () => {
            window.soundManager.playClick();
            document.getElementById('how-to-modal').classList.add('hidden');
        });

        document.getElementById('sound-toggle-btn').addEventListener('click', () => {
            const isMuted = window.soundManager.toggleMute();
            this.updateSoundIcons(isMuted);
        });

        document.getElementById('hud-sound-toggle-btn').addEventListener('click', () => {
            const isMuted = window.soundManager.toggleMute();
            this.updateSoundIcons(isMuted);
        });

        document.getElementById('pause-btn').addEventListener('click', () => {
            window.soundManager.playClick();
            this.togglePause();
        });

        document.getElementById('resume-btn').addEventListener('click', () => {
            window.soundManager.playClick();
            this.togglePause();
        });
    }

    updateSoundIcons(isMuted) {
        const text = isMuted ? '🔇' : '🔊';
        document.getElementById('sound-toggle-btn').innerText = text;
        document.getElementById('hud-sound-toggle-btn').innerText = text;
    }

    onResize() {
        if (!this.container) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    showTitle() {
        this.state = 'TITLE';
        window.soundManager.stopBGM();
        document.getElementById('title-screen').classList.remove('hidden');
        document.getElementById('hud-screen').classList.add('hidden');
        document.getElementById('gameover-screen').classList.add('hidden');
        document.getElementById('pause-modal').classList.add('hidden');
        document.getElementById('title-highscore').innerText = this.highScore;
        this.updateSoundIcons(window.soundManager.isMuted);
    }

    startGame() {
        this.state = 'PLAYING';
        this.score = 0;
        this.distance = 0;
        this.carrots = 0;
        this.feverGauge = 0;
        this.isFever = false;
        this.feverTimer = 0;
        this.runSpeed = this.baseSpeed;
        this.rabbitLaneX = 0;
        this.targetLaneX = 0;
        this.lateralVelocity = 0;

        this.rabbit.reset();
        this.world.reset();

        document.getElementById('title-screen').classList.add('hidden');
        document.getElementById('gameover-screen').classList.add('hidden');
        document.getElementById('pause-modal').classList.add('hidden');
        document.getElementById('hud-screen').classList.remove('hidden');

        window.soundManager.startBGM('normal');
        this.updateUI();
    }

    togglePause() {
        if (this.state === 'PLAYING') {
            this.state = 'PAUSED';
            document.getElementById('pause-modal').classList.remove('hidden');
            window.soundManager.stopBGM();
        } else if (this.state === 'PAUSED') {
            this.state = 'PLAYING';
            document.getElementById('pause-modal').classList.add('hidden');
            window.soundManager.startBGM(this.isFever ? 'fever' : 'normal');
        }
    }

    addFever(amount) {
        if (this.isFever) return;
        this.feverGauge = Math.min(100, this.feverGauge + amount);
        if (this.feverGauge >= 100) {
            this.startFever();
        }
        this.updateUI();
    }

    startFever() {
        this.isFever = true;
        this.feverTimer = this.feverDuration;
        window.soundManager.playFeverStart();
        window.soundManager.startBGM('fever');

        // 画面にフィーバー演出クラス付与
        document.getElementById('hud-screen').classList.add('fever-mode');
        
        // ド派手なフィーバーカットインバナー
        const banner = document.createElement('div');
        banner.className = 'fever-cutin-banner';
        banner.innerHTML = '✨ SUPER FEVER TIME! ✨<br><span style="font-size: 14px; font-weight: normal; color: #fff;">ボールをふきとばせ！無敵モード！</span>';
        document.getElementById('game-container').appendChild(banner);
        setTimeout(() => banner.remove(), 1600);

        this.showPopupText('🔥 SUPER FEVER!! 🔥', '#ff0077');
    }

    endFever() {
        this.isFever = false;
        this.feverGauge = 0;
        document.getElementById('hud-screen').classList.remove('fever-mode');
        window.soundManager.startBGM('normal');
        this.updateUI();
    }

    showPopupText(text, color = '#ffbb00') {
        const popup = document.createElement('div');
        popup.className = 'floating-score-popup';
        popup.innerText = text;
        popup.style.color = color;
        document.getElementById('game-container').appendChild(popup);
        setTimeout(() => popup.remove(), 1200);
    }

    triggerGameOver() {
        this.state = 'GAMEOVER';
        this.rabbit.squish();
        window.soundManager.playSquish();
        window.soundManager.playGameOver();

        // ウサギからペシャンコ星パーティクルを撒き散らす
        const rPos = this.rabbit.mesh.position;
        this.world.createExplosion(rPos.x, rPos.y + 0.5, rPos.z, 0xffea00, 25);
        this.world.createExplosion(rPos.x, rPos.y + 0.3, rPos.z, 0xff5500, 15);

        // 画面シェイク
        document.getElementById('game-container').classList.add('screen-shake');
        setTimeout(() => {
            document.getElementById('game-container').classList.remove('screen-shake');
        }, 400);

        // ハイスコア判定
        const isNewHigh = this.score > this.highScore;
        if (isNewHigh) {
            this.highScore = this.score;
            localStorage.setItem('rabbit_ballbound_highscore', this.highScore);
            setTimeout(() => window.soundManager.playHighScore(), 600);
        }

        // 1.4秒後にリザルト画面表示
        setTimeout(() => {
            document.getElementById('gameover-score').innerText = this.score;
            document.getElementById('gameover-dist').innerText = Math.floor(this.distance) + 'm';
            document.getElementById('gameover-carrots').innerText = this.carrots;
            document.getElementById('gameover-high').innerText = this.highScore;
            
            const newRecordBadge = document.getElementById('new-record-badge');
            if (isNewHigh && this.score > 0) {
                newRecordBadge.classList.remove('hidden');
            } else {
                newRecordBadge.classList.add('hidden');
            }

            document.getElementById('gameover-screen').classList.remove('hidden');
        }, 1300);
    }

    updateUI() {
        document.getElementById('hud-score').innerText = this.score;
        document.getElementById('hud-dist').innerText = Math.floor(this.distance) + 'm';
        document.getElementById('hud-carrots').innerText = this.carrots;
        
        const feverFill = document.getElementById('fever-bar-fill');
        if (this.isFever) {
            const pct = (this.feverTimer / this.feverDuration) * 100;
            feverFill.style.width = pct + '%';
            feverFill.style.background = 'linear-gradient(90deg, #ff0055, #ffdd00, #00ffcc)';
        } else {
            feverFill.style.width = this.feverGauge + '%';
            feverFill.style.background = 'linear-gradient(90deg, #ff9900, #ffdd00)';
        }
    }

    // --- メインループ ---
    animate() {
        requestAnimationFrame(this.animate);
        const delta = Math.min(this.clock.getDelta(), 0.1);

        if (this.state === 'PLAYING') {
            // キーボード移動
            if (this.keys.left) this.targetLaneX -= delta * 9.0;
            if (this.keys.right) this.targetLaneX += delta * 9.0;
            this.targetLaneX = Math.max(-2.3, Math.min(2.3, this.targetLaneX));

            // スムーズなレーン移動補間
            const prevLane = this.rabbitLaneX;
            this.rabbitLaneX = THREE.MathUtils.lerp(this.rabbitLaneX, this.targetLaneX, delta * 14);
            this.lateralVelocity = (this.rabbitLaneX - prevLane) / delta;

            // 速度の徐行加速（走行距離に応じてスリルUP）
            this.runSpeed = this.baseSpeed + (this.distance * 0.008);

            // 距離とスコア加算
            this.distance += delta * this.runSpeed;
            this.score += Math.floor(delta * this.runSpeed * (this.isFever ? 3 : 1) * 2);

            // フィーバータイマー処理
            if (this.isFever) {
                this.feverTimer -= delta;
                if (this.feverTimer <= 0) {
                    this.endFever();
                }
            }

            // ワールド更新
            this.world.update(delta, this.runSpeed, this.isFever);

            // ウサギの位置計算（道路の勾配・バンク角に完璧に接地させる）
            const curve = this.world.getTrackCurve(0);
            const nextCurve = this.world.getTrackCurve(-1.0);
            const dx = nextCurve.x - curve.x;
            const dy = nextCurve.y - curve.y;
            const bankAngle = -dx * 0.07;
            const pitchAngle = -Math.atan2(dy, 1.0);

            // 道路のバンク角（横傾き）を反映した、現在レーンでの正確な道路表面の高さ
            const roadSurfaceY = curve.y - (this.rabbitLaneX * Math.tan(bankAngle));

            // ウサギを道路表面の上にピッタリ配置（埋もれ防止）
            this.rabbit.mesh.position.set(curve.x + this.rabbitLaneX, roadSurfaceY, 0);
            this.rabbit.mesh.rotation.z = bankAngle;
            this.rabbit.mesh.rotation.x = pitchAngle;

            // ウサギのアニメーション更新
            this.rabbit.update(delta, this.runSpeed, this.lateralVelocity, this.isFever);

            // 走る足元から後方へ土煙を放出して推進力を演出
            this.particleTimer += delta;
            if (this.particleTimer > 0.08) {
                this.particleTimer = 0;
                this.world.createDust(curve.x + this.rabbitLaneX, roadSurfaceY + 0.08, 0.45);
            }

            // --- 当たり判定（にんじん） ---
            const rabbitBoxRadius = this.isFever ? 0.85 : 0.42;
            for (let i = this.world.carrots.length - 1; i >= 0; i--) {
                const carrot = this.world.carrots[i];
                if (!carrot.userData.active) continue;

                // 距離判定
                const distZ = Math.abs(carrot.position.z - this.rabbit.mesh.position.z);
                const distX = Math.abs(carrot.position.x - this.rabbit.mesh.position.x);

                if (distZ < 0.9 && distX < (rabbitBoxRadius + 0.4)) {
                    // ゲット！
                    carrot.userData.active = false;
                    this.world.carrotGroup.remove(carrot);
                    this.world.carrots.splice(i, 1);

                    this.carrots += 1;
                    const isGold = carrot.userData.isGolden;
                    const flavor = carrot.userData.flavor || { name: 'くずバー', color: 0xffaa00, cssColor: '#ffaa00' };
                    const addPts = isGold ? 500 : 100;
                    this.score += addPts;

                    window.soundManager.playCarrot();
                    this.world.createCarrotSparkle(carrot.position.x, carrot.position.y, carrot.position.z, isGold ? 0xffea00 : flavor.color);
                    this.addFever(isGold ? 50 : 10);
                    
                    const popupLabel = isGold ? `✨GOLD! +${addPts}` : `+${addPts} ${flavor.name}`;
                    const popupColor = isGold ? '#ffd700' : flavor.cssColor;
                    this.showPopupText(popupLabel, popupColor);
                }
            }

            // --- 当たり判定（障害物ボール） ---
            for (let i = this.world.balls.length - 1; i >= 0; i--) {
                const ball = this.world.balls[i];
                const u = ball.userData;
                if (!u.active || u.hit) continue;

                const distZ = Math.abs(ball.position.z - this.rabbit.mesh.position.z);
                const distX = Math.abs(ball.position.x - this.rabbit.mesh.position.x);
                const distY = Math.abs(ball.position.y - (this.rabbit.mesh.position.y + 0.6));

                // 衝突チェック
                const hitRadius = u.radius + rabbitBoxRadius;
                if (distZ < (u.radius + 0.4) && distX < (u.radius + rabbitBoxRadius * 0.8) && distY < hitRadius) {
                    if (this.isFever) {
                        // フィーバーモード：ボールを吹き飛ばす！
                        u.hit = true;
                        u.flyVelocity = new THREE.Vector3(
                            (ball.position.x - this.rabbit.mesh.position.x) * 8 + (Math.random() - 0.5) * 5,
                            Math.random() * 15 + 10,
                            -30 - Math.random() * 20
                        );
                        window.soundManager.playFeverHit();
                        this.world.createExplosion(ball.position.x, ball.position.y, ball.position.z, 0xff0055, 20);
                        this.score += 300;
                        this.showPopupText('CRASH! +300', '#ff00ff');
                    } else {
                        // 通常モード：ゲームオーバー！
                        this.triggerGameOver();
                        break;
                    }
                }
            }

            this.updateUI();

            // カメラの追従（ウサギの後ろ姿とコース前方が綺麗に見えるアングル）
            const camTargetX = curve.x + this.rabbitLaneX * 0.35;
            this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, camTargetX, delta * 8);
            this.camera.position.y = curve.y + 2.4 + this.rabbit.hopHeight * 0.25;
            this.camera.position.z = 3.8;
            this.camera.lookAt(curve.x + this.rabbitLaneX * 0.15, curve.y + 1.0, -12.0);

            // 光源の追従
            this.dirLight.position.x = curve.x + 15;
            this.dirLight.target.position.set(curve.x, curve.y, -10);
            this.dirLight.target.updateMatrixWorld();

        } else if (this.state === 'GAMEOVER') {
            // ゲームオーバー中のアニメーション（ウサギの潰れとパーティクルのみ更新）
            this.rabbit.update(delta, 0, 0, false);
            this.world.update(delta * 0.2, this.runSpeed * 0.1, false);
        } else if (this.state === 'TITLE') {
            // タイトル画面でのデモ展示アニメーション
            this.rabbit.update(delta, 10.0, 0, false);
            this.world.update(delta, 8.0, false);
            const curve = this.world.getTrackCurve(0);
            this.rabbit.mesh.position.set(curve.x, curve.y, 0);
            this.camera.position.set(curve.x, curve.y + 2.4, 3.8);
            this.camera.lookAt(curve.x, curve.y + 1.0, -12.0);
        }

        this.renderer.render(this.scene, this.camera);
    }
}

// ゲーム起動
window.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});
