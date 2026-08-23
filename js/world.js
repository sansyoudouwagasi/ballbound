/**
 * ワールド & コース & オブジェクト管理モジュール
 * 滑らかにうねる3Dコース、跳ねる大小のボール、にんじんアイテム、パーティクル
 */
class WorldManager {
    constructor(scene) {
        this.scene = scene;
        this.totalDistance = 0;
        this.trackWidth = 6.0;

        // コースセグメント管理
        this.segmentCount = 50;
        this.segmentLength = 3.2; // オーバーラップさせて隙間をゼロに
        this.segments = [];
        this.trackGroup = new THREE.Group();
        this.scene.add(this.trackGroup);

        // 広大な大地のベースグラウンド（隙間や背景の黒を防止）
        const groundGeo = new THREE.PlaneGeometry(350, 350);
        groundGeo.rotateX(-Math.PI / 2);
        const groundMat = new THREE.MeshLambertMaterial({ color: 0x68c848, roughness: 0.95 });
        this.ground = new THREE.Mesh(groundGeo, groundMat);
        this.ground.position.set(0, -0.05, -50);
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        // 装飾物グループ (草花、柵、木)
        this.sceneryGroup = new THREE.Group();
        this.scene.add(this.sceneryGroup);
        this.sceneryPool = [];

        // 障害物ボール
        this.balls = [];

        this.ballGroup = new THREE.Group();
        this.scene.add(this.ballGroup);

        this.carrotGroup = new THREE.Group();
        this.scene.add(this.carrotGroup);

        this.particleGroup = new THREE.Group();
        this.scene.add(this.particleGroup);

        // コース基本設定
        this.trackWidth = 5.2;
        this.segmentLength = 3.0;
        this.segmentCount = 70; // 210m先まで見渡せる長距離トラック
        this.segments = [];
        this.sceneryPool = [];
        this.balls = [];
        this.carrots = [];
        this.particles = [];
        this.totalDistance = 0;
        this.ballSpawnTimer = 0;
        this.carrotSpawnTimer = 0;

        // 背景スカイボックス / パノラマ
        this.skyMesh = null;

        // マテリアル初期化
        this.initMaterials();
        this.initGround();
        this.initTrack();
        this.initScenery();
        this.initSky();
    }

    initMaterials() {
        // メインのコース（白いウサギがくっきり映える温かみのあるレンガ・キャラメル調の道）
        this.roadMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xc87d4a, // 温かいレンガオレンジ・キャラメルウッド
            roughness: 0.75 
        });

        // 道路中央の白ライン
        this.roadCenterMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xffffff, 
            roughness: 0.3 
        });

        // コース脇の芝生エッジ
        this.edgeGrassMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x6bbd3a, 
            roughness: 0.9 
        });

        // 広大な大地の芝生
        this.groundMaterial = new THREE.MeshLambertMaterial({
            color: 0x8fd64f,
            roughness: 1.0
        });

        // 木製フェンス
        this.fenceMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x9b7042, 
            roughness: 0.7 
        });

        // にんじんマテリアル
        this.carrotOrangeMat = new THREE.MeshLambertMaterial({ color: 0xff7700 });
        this.carrotGreenMat = new THREE.MeshLambertMaterial({ color: 0x33cc33 });
        this.goldenCarrotMat = new THREE.MeshPhongMaterial({ 
            color: 0xffd700, 
            emissive: 0xffaa00, 
            emissiveIntensity: 0.6,
            shininess: 90 
        });

        // 多彩なポップカラーのバウンドボール用マテリアル
        this.ballMaterials = [
            new THREE.MeshPhongMaterial({ color: 0xff2a6d, shininess: 70 }), // ネオンピンク
            new THREE.MeshPhongMaterial({ color: 0x05d9e8, shininess: 70 }), // シアンブルー
            new THREE.MeshPhongMaterial({ color: 0xffc800, shininess: 70 }), // ビビッドイエロー
            new THREE.MeshPhongMaterial({ color: 0x9d4edd, shininess: 70 }), // パープル
            this.createDotsMaterial('#00e676', '#ffffff'),   // エメラルド白
            this.createStripeMaterial('#e91e63', '#ffffff')  // ピンク白
        ];
    }

    // 広大な大地（どこまでも続く緑のフィールド）
    initGround() {
        const groundGeo = new THREE.PlaneGeometry(300, 300);
        groundGeo.rotateX(-Math.PI / 2);
        this.groundMesh = new THREE.Mesh(groundGeo, this.groundMaterial);
        this.groundMesh.position.set(0, -0.05, -80);
        this.groundMesh.receiveShadow = true;
        this.scene.add(this.groundMesh);
    }

    // ストライプ模様の動的テクスチャマテリアル
    createStripeMaterial(color1, color2) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color1;
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = color2;
        for (let i = 0; i < 4; i++) {
            ctx.fillRect(0, i * 32, 128, 16);
        }
        const texture = new THREE.CanvasTexture(canvas);
        return new THREE.MeshPhongMaterial({ map: texture, shininess: 50 });
    }

    // ドット模様の動的テクスチャマテリアル
    createDotsMaterial(bgColor, dotColor) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = dotColor;
        for (let x = 32; x <= 96; x += 64) {
            for (let y = 32; y <= 96; y += 64) {
                ctx.beginPath();
                ctx.arc(x, y, 16, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        const texture = new THREE.CanvasTexture(canvas);
        return new THREE.MeshPhongMaterial({ map: texture, shininess: 50 });
    }

    // コースのカーブ計算関数（滑らかで自然な緩やかカーブ＆丘陵）
    getTrackCurve(z, distance = this.totalDistance) {
        const worldZ = distance - z;
        const curveX = Math.sin(worldZ * 0.012) * 3.6 + Math.sin(worldZ * 0.005) * 2.0;
        const curveY = Math.sin(worldZ * 0.008) * 0.35;
        return { x: curveX, y: curveY };
    }

    // コース初期化 (70セグメントで210m先まで隙間なくカバー)
    initTrack() {
        const segGeo = new THREE.PlaneGeometry(this.trackWidth, this.segmentLength, 2, 1);
        segGeo.rotateX(-Math.PI / 2);

        const edgeGeo = new THREE.PlaneGeometry(4.0, this.segmentLength);
        edgeGeo.rotateX(-Math.PI / 2);

        const totalTrackLength = this.segmentCount * this.segmentLength;

        for (let i = 0; i < this.segmentCount; i++) {
            // ウサギの後ろ z=+6 から奥 z=-204 まで配置
            const initialZ = 6.0 - (i * this.segmentLength);
            const segment = new THREE.Group();

            // メインロード（明るい小道）
            const road = new THREE.Mesh(segGeo, this.roadMaterial);
            road.receiveShadow = true;
            segment.add(road);

            // 中央の点線ライン
            const centerGeo = new THREE.PlaneGeometry(0.4, this.segmentLength * 0.55);
            centerGeo.rotateX(-Math.PI / 2);
            const center = new THREE.Mesh(centerGeo, this.roadCenterMaterial);
            center.position.y = 0.01;
            center.receiveShadow = true;
            segment.add(center);

            // 左右の鮮やかな芝生エッジ
            const leftEdge = new THREE.Mesh(edgeGeo, this.edgeGrassMaterial);
            leftEdge.position.set(-this.trackWidth / 2 - 2.0, 0.005, 0);
            leftEdge.receiveShadow = true;
            segment.add(leftEdge);

            const rightEdge = new THREE.Mesh(edgeGeo, this.edgeGrassMaterial);
            rightEdge.position.set(this.trackWidth / 2 + 2.0, 0.005, 0);
            rightEdge.receiveShadow = true;
            segment.add(rightEdge);

            segment.position.z = initialZ;
            this.trackGroup.add(segment);
            this.segments.push({
                mesh: segment,
                initialZ: initialZ
            });
        }
    }

    // 背景（生成したスカイ画像）のセットアップ
    initSky() {
        const loader = new THREE.TextureLoader();
        loader.load('assets/game_sky.jpg', (texture) => {
            const skyGeo = new THREE.CylinderGeometry(200, 200, 140, 32, 1, true);
            const skyMat = new THREE.MeshBasicMaterial({ 
                map: texture, 
                side: THREE.BackSide,
                fog: false
            });
            this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
            this.skyMesh.position.set(0, 40, -60);
            this.scene.add(this.skyMesh);
        });
    }

    // 周辺の風景装飾（花、草、木、柵）
    initScenery() {
        const flowerGeo = new THREE.DodecahedronGeometry(0.25, 0);
        const flowerColors = [0xff2d55, 0xffcc00, 0x5856d6, 0xff9500, 0x00c7be, 0xff2d85];

        // 木モデル
        const treeTrunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.6, 6);
        const treeLeavesGeo = new THREE.ConeGeometry(1.1, 2.2, 6);
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
        const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e7d32 });

        // 木製フェンスモデル
        const fencePostGeo = new THREE.BoxGeometry(0.12, 0.9, 0.12);
        const fenceRailGeo = new THREE.BoxGeometry(0.08, 0.1, 2.8);

        const totalTrackLength = this.segmentCount * this.segmentLength;

        for (let i = 0; i < 60; i++) {
            const side = (i % 2 === 0) ? 1 : -1;
            const dist = (this.trackWidth / 2 + 1.2 + (i % 3) * 1.8) * side;
            const z = -(i * (totalTrackLength / 60));

            const obj = new THREE.Group();

            if (i % 4 === 0) {
                // 木製フェンス
                const p1 = new THREE.Mesh(fencePostGeo, this.fenceMaterial);
                p1.position.set(0, 0.45, -1.2);
                p1.castShadow = true;
                obj.add(p1);

                const p2 = new THREE.Mesh(fencePostGeo, this.fenceMaterial);
                p2.position.set(0, 0.45, 1.2);
                p2.castShadow = true;
                obj.add(p2);

                const rail1 = new THREE.Mesh(fenceRailGeo, this.fenceMaterial);
                rail1.position.set(0, 0.65, 0);
                rail1.castShadow = true;
                obj.add(rail1);

                const rail2 = new THREE.Mesh(fenceRailGeo, this.fenceMaterial);
                rail2.position.set(0, 0.35, 0);
                rail2.castShadow = true;
                obj.add(rail2);
            } else if (i % 3 === 0) {
                // 木
                const trunk = new THREE.Mesh(treeTrunkGeo, trunkMat);
                trunk.position.y = 0.8;
                trunk.castShadow = true;
                obj.add(trunk);

                const leaves = new THREE.Mesh(treeLeavesGeo, leafMat);
                leaves.position.y = 2.2;
                leaves.castShadow = true;
                obj.add(leaves);
            } else {
                // カラフルなお花畑
                for (let f = 0; f < 4; f++) {
                    const col = flowerColors[(i + f) % flowerColors.length];
                    const mat = new THREE.MeshLambertMaterial({ color: col });
                    const fl = new THREE.Mesh(flowerGeo, mat);
                    fl.position.set((Math.random() - 0.5) * 0.8, 0.25, (Math.random() - 0.5) * 0.8);
                    fl.castShadow = true;
                    obj.add(fl);
                }
            }

            obj.userData = { initialDist: dist, initialZ: z };
            this.sceneryGroup.add(obj);
            this.sceneryPool.push(obj);
        }
    }

    // --- にんじん生成 ---
    spawnCarrot(isGolden = false) {
        const carrot = new THREE.Group();
        
        // にんじんの体（円錐）
        const bodyGeo = new THREE.ConeGeometry(0.22, 0.8, 8);
        bodyGeo.rotateX(Math.PI); // 尖った方を下に
        const mat = isGolden ? this.goldenCarrotMat : this.carrotOrangeMat;
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.y = 0.4;
        body.castShadow = true;
        carrot.add(body);

        // にんじんの葉っぱ（緑の冠）
        const leafGeo = new THREE.ConeGeometry(0.12, 0.35, 6);
        const leafMat = this.carrotGreenMat;
        for (let l = 0; l < 3; l++) {
            const leaf = new THREE.Mesh(leafGeo, leafMat);
            leaf.position.set((Math.random() - 0.5) * 0.08, 0.85, (Math.random() - 0.5) * 0.08);
            leaf.rotation.z = (l - 1) * 0.3;
            leaf.castShadow = true;
            carrot.add(leaf);
        }

        const laneOffset = (Math.random() * 2 - 1) * (this.trackWidth * 0.35);
        const spawnZ = -(this.segmentCount * this.segmentLength * 0.9);

        carrot.userData = {
            isGolden: isGolden,
            laneOffset: laneOffset,
            z: spawnZ,
            active: true,
            rotSpeed: Math.random() * 2 + 2
        };

        this.carrotGroup.add(carrot);
        this.carrots.push(carrot);
    }

    // --- ボール障害物生成 ---
    spawnBall(difficulty) {
        // タイプ決定 (0: Normal, 1: Super Bounce, 2: Mega Heavy, 3: Zigzag)
        // ボールサイズは0.5倍、バウンドもゆったりして小学生でもよけやすく調整
        const rand = Math.random();
        let type = 'normal';
        let radius = 0.28; // 従来の0.5倍
        let bounceHeight = 2.2;
        let bounceFreq = 1.8; // ゆったりバウンド
        let speedMult = 0.85;
        let lateralMove = false;

        if (rand < 0.35) {
            type = 'normal';
        } else if (rand < 0.65) {
            type = 'super'; // ふわっと高くバウンド
            radius = 0.22;
            bounceHeight = 3.2;
            bounceFreq = 2.4;
            speedMult = 1.0;
        } else if (rand < 0.85) {
            type = 'mega'; // 少し大きめだが従来の半分
            radius = 0.52;
            bounceHeight = 1.5;
            bounceFreq = 1.2;
            speedMult = 0.75;
        } else {
            type = 'zigzag'; // 左右にスライド
            radius = 0.28;
            bounceHeight = 1.8;
            bounceFreq = 1.6;
            lateralMove = true;
        }

        const mat = this.ballMaterials[Math.floor(Math.random() * this.ballMaterials.length)];
        const geo = new THREE.SphereGeometry(radius, 16, 16);
        const ball = new THREE.Mesh(geo, mat);
        ball.castShadow = true;
        ball.receiveShadow = true;

        const laneOffset = (Math.random() * 2 - 1) * (this.trackWidth * 0.38);
        const spawnZ = -(this.segmentCount * this.segmentLength * 0.95);

        ball.userData = {
            type: type,
            radius: radius,
            bounceHeight: bounceHeight,
            bounceFreq: bounceFreq,
            speedMult: speedMult,
            lateralMove: lateralMove,
            laneOffset: laneOffset,
            baseLane: laneOffset,
            z: spawnZ,
            bouncePhase: Math.random() * Math.PI,
            active: true,
            hit: false,
            flyVelocity: null
        };

        this.ballGroup.add(ball);
        this.balls.push(ball);
    }

    // パーティクル生成（土煙・砂煙）
    createDust(x, y, z) {
        const pGeo = new THREE.DodecahedronGeometry(0.12, 0);
        const pMat = new THREE.MeshBasicMaterial({ 
            color: 0xeedcb3, 
            transparent: true, 
            opacity: 0.7 
        });
        const p = new THREE.Mesh(pGeo, pMat);
        p.position.set(x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() * 0.2));
        
        p.userData = {
            vel: new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 1.5 + 0.8, Math.random() * 2.5 + 2.0),
            life: 1.0,
            decay: Math.random() * 2 + 2.5
        };

        this.particleGroup.add(p);
        this.particles.push(p);
    }

    // 衝突・収集エフェクト
    createExplosion(x, y, z, color = 0xffffff, count = 12) {
        const geo = new THREE.DodecahedronGeometry(0.18, 0);
        const mat = new THREE.MeshBasicMaterial({ color: color });

        for (let i = 0; i < count; i++) {
            const p = new THREE.Mesh(geo, mat);
            p.position.set(x, y, z);
            
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const speed = Math.random() * 8 + 4;
            
            p.userData = {
                vel: new THREE.Vector3(
                    Math.sin(phi) * Math.cos(theta) * speed,
                    Math.cos(phi) * speed + 3,
                    Math.sin(phi) * Math.sin(theta) * speed
                ),
                life: 1.0,
                decay: Math.random() * 2 + 2
            };

            this.particleGroup.add(p);
            this.particles.push(p);
        }
    }

    // にんじん取得時のキラキラエフェクト
    createCarrotSparkle(x, y, z) {
        this.createExplosion(x, y, z, 0xffaa00, 10);
        this.createExplosion(x, y + 0.3, z, 0xffff44, 8);
    }

    // リセット
    reset() {
        this.totalDistance = 0;
        this.ballSpawnTimer = 0;
        this.carrotSpawnTimer = 0;

        // ボール全削除
        for (const ball of this.balls) {
            this.ballGroup.remove(ball);
        }
        this.balls = [];

        // にんじん全削除
        for (const carrot of this.carrots) {
            this.carrotGroup.remove(carrot);
        }
        this.carrots = [];

        // パーティクル全削除
        for (const p of this.particles) {
            this.particleGroup.remove(p);
        }
        this.particles = [];
    }

    // --- 毎フレーム更新 ---
    update(delta, runSpeed, isFever) {
        const effectiveSpeed = runSpeed * (isFever ? 1.4 : 1.0);
        this.totalDistance += delta * effectiveSpeed;

        // 1. コースセグメントの更新 (奥から手前へ完全無限ループスクロール！)
        const totalTrackLength = this.segmentCount * this.segmentLength; // 70 * 3.0 = 210m

        for (let i = 0; i < this.segments.length; i++) {
            const seg = this.segments[i];
            // 手前に流れるように totalDistance を加算し、210m でループ
            let rawZ = seg.initialZ + this.totalDistance;
            let z = (rawZ % totalTrackLength);
            if (z > 6.0) {
                z -= totalTrackLength;
            }
            if (z < 6.0 - totalTrackLength) {
                z += totalTrackLength;
            }

            const curve = this.getTrackCurve(z);
            seg.mesh.position.set(curve.x, curve.y, z);

            // 前後の勾配（ピッチ）とカーブ（ロール・ヨー）に合わせた回転
            const nextCurve = this.getTrackCurve(z - 1.0);
            const dx = nextCurve.x - curve.x;
            const dy = nextCurve.y - curve.y;
            
            seg.mesh.rotation.x = -Math.atan2(dy, 1.0); // 坂道の勾配に沿わせる
            seg.mesh.rotation.z = -dx * 0.07;           // バンク角
            seg.mesh.rotation.y = dx * 0.10;
        }

        // 2. 背景スカイ & 大地の追従
        const centerCurve = this.getTrackCurve(0);
        if (this.skyMesh) {
            this.skyMesh.rotation.y += delta * 0.02;
            this.skyMesh.position.x = centerCurve.x;
        }
        if (this.groundMesh) {
            this.groundMesh.position.x = centerCurve.x;
            this.groundMesh.position.y = centerCurve.y - 0.05;
        }

        // 3. 周辺装飾物（木・花・柵）の更新 (奥から手前へ完全無限ループスクロール！)
        for (let i = 0; i < this.sceneryPool.length; i++) {
            const sc = this.sceneryPool[i];
            let rawZ = sc.userData.initialZ + this.totalDistance;
            let z = (rawZ % totalTrackLength);
            if (z > 6.0) {
                z -= totalTrackLength;
            }
            if (z < 6.0 - totalTrackLength) {
                z += totalTrackLength;
            }

            const curve = this.getTrackCurve(z);
            const nextCurve = this.getTrackCurve(z - 1.0);
            const dx = nextCurve.x - curve.x;
            const bankAngle = -dx * 0.07;
            
            // バンク角に合わせた装飾物の正確な高さ
            const groundY = curve.y - (sc.userData.initialDist * Math.tan(bankAngle));
            sc.position.set(curve.x + sc.userData.initialDist, groundY, z);
            sc.rotation.z = bankAngle;
        }

        // 4. ボール生成 & 更新
        this.ballSpawnTimer += delta;
        const spawnInterval = Math.max(0.65, 1.8 - (this.totalDistance * 0.0015));
        if (this.ballSpawnTimer > spawnInterval) {
            this.ballSpawnTimer = 0;
            this.spawnBall();
        }

        for (let i = this.balls.length - 1; i >= 0; i--) {
            const ball = this.balls[i];
            const u = ball.userData;

            if (u.hit) {
                // フィーバーで吹き飛ばされたボールの物理演出
                ball.position.addScaledVector(u.flyVelocity, delta);
                ball.rotation.x += delta * 15;
                ball.rotation.y += delta * 12;
                if (ball.position.y < -10 || ball.position.z < -120 || ball.position.z > 20) {
                    this.ballGroup.remove(ball);
                    this.balls.splice(i, 1);
                }
                continue;
            }

            // 奥から手前に進む (ウサギの移動速度 + ボール自身の前進速度を少しマイルドに)
            const approachSpeed = effectiveSpeed + (8 * u.speedMult);
            u.z += delta * approachSpeed;

            // ジグザグボールの左右移動
            if (u.lateralMove) {
                u.laneOffset = u.baseLane + Math.sin(this.totalDistance * 0.12 + u.z * 0.08) * 1.2;
            }

            // バウンド計算 (ゆったりとした放物線)
            u.bouncePhase += delta * u.bounceFreq * 2.2;
            const bounceY = Math.abs(Math.sin(u.bouncePhase)) * u.bounceHeight + u.radius;

            // バウンド時のサウンド & 着地エフェクト
            if (Math.abs(Math.sin(u.bouncePhase)) < 0.12 && u.z > -35 && u.z < 5) {
                if (!u.wasGrounded) {
                    u.wasGrounded = true;
                    if (window.soundManager) {
                        window.soundManager.playBounce(u.type === 'mega' ? 0.6 : (u.type === 'super' ? 1.4 : 1.0));
                    }
                    this.createExplosion(curve.x + u.laneOffset, curve.y + 0.2, u.z, 0xffffff, 3);
                }
            } else {
                u.wasGrounded = false;
            }

            const curve = this.getTrackCurve(u.z);
            ball.position.set(curve.x + u.laneOffset, curve.y + bounceY, u.z);

            // 手前に向かって転がる回転
            ball.rotation.x += delta * 8 * u.speedMult;
            ball.rotation.z += delta * 2;

            // 画面手前を通り過ぎたら削除
            if (u.z > 8) {
                this.ballGroup.remove(ball);
                this.balls.splice(i, 1);
            }
        }

        // 5. にんじん生成 & 更新
        this.carrotSpawnTimer += delta;
        if (this.carrotSpawnTimer > 0.85) {
            this.carrotSpawnTimer = 0;
            const isGolden = Math.random() < 0.12; // 12%でゴールド
            this.spawnCarrot(isGolden);
        }

        for (let i = this.carrots.length - 1; i >= 0; i--) {
            const carrot = this.carrots[i];
            const u = carrot.userData;

            // 奥から手前に向かって流れてくる
            u.z += delta * effectiveSpeed;
            const curve = this.getTrackCurve(u.z);

            // ふわふわ浮遊＆回転
            const hoverY = 0.5 + Math.sin(this.totalDistance * 0.2 + u.z) * 0.15;
            carrot.position.set(curve.x + u.laneOffset, curve.y + hoverY, u.z);
            carrot.rotation.y += delta * u.rotSpeed * 3;

            if (u.z > 6) {
                this.carrotGroup.remove(carrot);
                this.carrots.splice(i, 1);
            }
        }

        // 6. パーティクル更新
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.userData.life -= delta * p.userData.decay;
            if (p.userData.life <= 0) {
                this.particleGroup.remove(p);
                this.particles.splice(i, 1);
            } else {
                p.position.addScaledVector(p.userData.vel, delta);
                p.userData.vel.y -= delta * 18; // 重力
                const s = p.userData.life;
                p.scale.set(s, s, s);
            }
        }
    }
}

window.WorldManager = WorldManager;
