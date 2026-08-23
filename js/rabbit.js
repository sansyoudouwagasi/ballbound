/**
 * 3Dウサギキャラクターモジュール (Three.js)
 * 後ろ姿の愛らしさ（丸いしっぽ、背中、揺れる長い耳、ピョンピョン走る手足）と
 * ボール衝突時のペシャンコ潰れアニメーションを制御
 */
class RabbitCharacter {
    constructor() {
        this.mesh = new THREE.Group();
        this.model = new THREE.Group();
        this.mesh.add(this.model);

        // 状態
        this.animTime = 0;
        this.isDead = false;
        this.squishFactor = 0; // 0: 通常, 1: ペシャンコ
        this.feverHue = 0;
        this.baseScale = 0.60; // 0.7倍相当のコンパクトで視界良好なサイズ
        this.targetScale = 0.60;
        this.hopHeight = 0;

        // マテリアル
        this.furMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xffffff, 
            roughness: 0.5 
        });
        this.innerEarMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xff99bb, 
            roughness: 0.8 
        });
        this.tailMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xfff5f8, 
            roughness: 0.8 
        });
        this.flowerMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xffcc00, 
            roughness: 0.3 
        });
        this.eyeMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x1a1a24, 
            roughness: 0.2 
        });
        this.ribbonMaterial = new THREE.MeshLambertMaterial({
            color: 0xff4081,
            roughness: 0.4
        });

        this.buildModel();
    }

    buildModel() {
        // ウサギは画面奥（Z マイナス方向）を向いて走る。
        // プレイヤー（カメラ）は手前（Z プラス方向）からウサギの後ろ姿を見る。

        // --- 1. 胴体 (ふっくら丸みのある背中とお尻) ---
        const bodyGeo = new THREE.SphereGeometry(0.52, 20, 20);
        bodyGeo.scale(1.0, 1.15, 1.1);
        this.body = new THREE.Mesh(bodyGeo, this.furMaterial);
        this.body.position.y = 0.65;
        this.body.castShadow = true;
        this.body.receiveShadow = true;
        this.model.add(this.body);

        // --- 2. 丸いしっぽ (手前・Zプラス側：プレイヤーから一番目立つキュートなポイント) ---
        const tailGeo = new THREE.SphereGeometry(0.24, 16, 16);
        tailGeo.scale(1.1, 1.0, 1.1);
        this.tail = new THREE.Mesh(tailGeo, this.tailMaterial);
        this.tail.position.set(0, -0.05, 0.52); // 後ろ側（カメラ側）
        this.tail.castShadow = true;
        this.body.add(this.tail);

        // --- 3. 頭部 ---
        const headGeo = new THREE.SphereGeometry(0.44, 20, 20);
        headGeo.scale(1.05, 0.98, 1.0);
        this.head = new THREE.Mesh(headGeo, this.furMaterial);
        this.head.position.set(0, 0.52, -0.12); // 少し前寄り
        this.head.castShadow = true;
        this.body.add(this.head);

        // --- 4. 耳 (ピボット構造で走るリズムに合わせて優しく揺れる) ---
        this.leftEarPivot = new THREE.Group();
        this.leftEarPivot.position.set(-0.20, 0.38, -0.05);
        this.head.add(this.leftEarPivot);

        this.rightEarPivot = new THREE.Group();
        this.rightEarPivot.position.set(0.20, 0.38, -0.05);
        this.head.add(this.rightEarPivot);

        const earGeo = new THREE.CylinderGeometry(0.06, 0.12, 0.72, 14);
        earGeo.scale(0.9, 1.0, 0.45);
        
        // 左耳
        this.leftEar = new THREE.Mesh(earGeo, this.furMaterial);
        this.leftEar.position.y = 0.34;
        this.leftEar.rotation.z = 0.08;
        this.leftEar.castShadow = true;
        this.leftEarPivot.add(this.leftEar);

        // 右耳
        this.rightEar = new THREE.Mesh(earGeo, this.furMaterial);
        this.rightEar.position.y = 0.34;
        this.rightEar.rotation.z = -0.08;
        this.rightEar.castShadow = true;
        this.rightEarPivot.add(this.rightEar);

        // --- 5. お顔（奥側 Z マイナス） ---
        const eyeGeo = new THREE.SphereGeometry(0.05, 8, 8);
        this.leftEye = new THREE.Mesh(eyeGeo, this.eyeMaterial);
        this.leftEye.position.set(-0.18, 0.05, -0.40);
        this.head.add(this.leftEye);

        this.rightEye = new THREE.Mesh(eyeGeo, this.eyeMaterial);
        this.rightEye.position.set(0.18, 0.05, -0.40);
        this.head.add(this.rightEye);

        // --- 6. 後ろ足 (手前・Zプラス側：ピョンピョン跳ねる大きな足裏) ---
        const footGeo = new THREE.SphereGeometry(0.16, 12, 12);
        footGeo.scale(0.85, 0.65, 1.3);

        this.leftFootPivot = new THREE.Group();
        this.leftFootPivot.position.set(-0.30, -0.36, 0.15);
        this.leftFoot = new THREE.Mesh(footGeo, this.furMaterial);
        this.leftFoot.position.set(0, 0, 0);
        this.leftFoot.castShadow = true;
        this.leftFootPivot.add(this.leftFoot);
        this.body.add(this.leftFootPivot);

        // 足裏のピンク肉球アクセント
        const padGeo = new THREE.SphereGeometry(0.07, 8, 8);
        padGeo.scale(0.8, 0.3, 0.9);
        const leftPad = new THREE.Mesh(padGeo, this.innerEarMaterial);
        leftPad.position.set(0, -0.05, 0.1);
        this.leftFoot.add(leftPad);

        this.rightFootPivot = new THREE.Group();
        this.rightFootPivot.position.set(0.30, -0.36, 0.15);
        this.rightFoot = new THREE.Mesh(footGeo, this.furMaterial);
        this.rightFoot.position.set(0, 0, 0);
        this.rightFoot.castShadow = true;
        this.rightFootPivot.add(this.rightFoot);
        this.body.add(this.rightFootPivot);

        const rightPad = new THREE.Mesh(padGeo, this.innerEarMaterial);
        rightPad.position.set(0, -0.05, 0.1);
        this.rightFoot.add(rightPad);

        // --- 7. 前手 (奥・Zマイナス側：パタパタ走る) ---
        const handGeo = new THREE.SphereGeometry(0.12, 10, 10);
        handGeo.scale(0.8, 1.3, 0.8);

        this.leftHandPivot = new THREE.Group();
        this.leftHandPivot.position.set(-0.32, 0.1, -0.22);
        this.leftHand = new THREE.Mesh(handGeo, this.furMaterial);
        this.leftHand.position.set(0, -0.1, 0);
        this.leftHand.castShadow = true;
        this.leftHandPivot.add(this.leftHand);
        this.body.add(this.leftHandPivot);

        this.rightHandPivot = new THREE.Group();
        this.rightHandPivot.position.set(0.32, 0.1, -0.22);
        this.rightHand = new THREE.Mesh(handGeo, this.furMaterial);
        this.rightHand.position.set(0, -0.1, 0);
        this.rightHand.castShadow = true;
        this.rightHandPivot.add(this.rightHand);
        this.body.add(this.rightHandPivot);

        // 初期スケール
        this.mesh.scale.set(this.baseScale, this.baseScale, this.baseScale);
    }

    // 衝突時のペシャンコ潰れ開始
    squish() {
        this.isDead = true;
        this.squishFactor = 0;
    }

    // リセット
    reset() {
        this.isDead = false;
        this.squishFactor = 0;
        this.animTime = 0;
        this.baseScale = 0.60;
        this.targetScale = 0.60;
        this.model.scale.set(1, 1, 1);
        this.model.rotation.set(0, 0, 0);
        this.furMaterial.color.setHex(0xffffff);
        this.furMaterial.emissive.setHex(0x000000);
        this.mesh.position.set(0, 0, 0);
    }

    update(delta, runSpeed, lateralVelocity, isFever) {
        if (this.isDead) {
            // ペシャンコ潰れアニメーション
            if (this.squishFactor < 1) {
                this.squishFactor += delta * 8;
                if (this.squishFactor > 1) this.squishFactor = 1;
            }

            // Y軸を極限まで薄く、XZ軸を横に平たく広げる（コミカルな潰れ）
            const sy = THREE.MathUtils.lerp(1.0, 0.08, this.squishFactor);
            const sxz = THREE.MathUtils.lerp(1.0, 2.1, this.squishFactor);
            this.model.scale.set(sxz, sy, sxz);
            this.model.position.y = (1 - sy) * -0.45;
            
            // 耳もペタッと倒れる
            this.leftEarPivot.rotation.x = THREE.MathUtils.lerp(0, -1.4, this.squishFactor);
            this.rightEarPivot.rotation.x = THREE.MathUtils.lerp(0, -1.4, this.squishFactor);
            this.leftEarPivot.rotation.z = THREE.MathUtils.lerp(0.08, -1.3, this.squishFactor);
            this.rightEarPivot.rotation.z = THREE.MathUtils.lerp(-0.08, 1.3, this.squishFactor);
            return;
        }

        // --- 人が元気に走っているような二足歩行ランニングアニメーション ---
        const speedMult = isFever ? 1.35 : 1.0;
        this.animTime += delta * runSpeed * speedMult;
        
        // 走るステップ周期
        const runFreq = 11.0;
        const runCycle = this.animTime * runFreq;
        const sinR = Math.sin(runCycle);
        const cosR = Math.cos(runCycle);
        const bounce2x = Math.abs(sinR); // 1サイクルで2回弾む

        // 1. 上下動 (走るステップの軽やかな弾み)
        this.hopHeight = bounce2x * 0.14;
        this.body.position.y = 0.65 + this.hopHeight;

        // 2. 前傾姿勢 & ステップに伴う骨盤・上半身の左右ローリングとツイスト
        this.body.rotation.x = -0.15; // 進行方向（奥）への前傾姿勢
        this.body.rotation.y = sinR * 0.06; // 走る時の上半身のツイスト
        this.body.rotation.z = cosR * 0.05; // 左右のステップの体重移動

        // 3. 左右移動（スワイプ）による身体のバンク傾き
        const tiltAngle = -lateralVelocity * 0.20;
        this.model.rotation.z = THREE.MathUtils.lerp(this.model.rotation.z, tiltAngle, delta * 14);

        // 4. 足の動き（左右交互に前後にスイング＆キック）
        this.leftFootPivot.rotation.x = sinR * 0.80;
        this.leftFootPivot.position.y = -0.36 + Math.max(0, sinR) * 0.10;
        this.leftFootPivot.position.z = 0.15 - sinR * 0.08;

        this.rightFootPivot.rotation.x = -sinR * 0.80;
        this.rightFootPivot.position.y = -0.36 + Math.max(0, -sinR) * 0.10;
        this.rightFootPivot.position.z = 0.15 + sinR * 0.08;

        // 5. 腕（前手）の動き（足と対角に前後に振る）
        this.leftHandPivot.rotation.x = -sinR * 0.75;
        this.leftHandPivot.rotation.z = 0.08 + Math.abs(cosR) * 0.08;

        this.rightHandPivot.rotation.x = sinR * 0.75;
        this.rightHandPivot.rotation.z = -0.08 - Math.abs(cosR) * 0.08;

        // 6. 耳の自然でマイルドな揺れ（激しさを抑えて優しくピョコピョコ）
        const earBob = bounce2x * 0.08;
        this.leftEarPivot.rotation.x = 0.18 + earBob + (sinR * 0.03);
        this.rightEarPivot.rotation.x = 0.18 + earBob - (sinR * 0.03);

        this.leftEarPivot.rotation.z = 0.08 + (cosR * 0.04) + (tiltAngle * 0.3);
        this.rightEarPivot.rotation.z = -0.08 + (cosR * 0.04) + (tiltAngle * 0.3);

        // 7. 丸いしっぽのフリフリ
        this.tail.position.y = -0.05 + bounce2x * 0.04;
        this.tail.rotation.y = sinR * 0.25;

        // 足音トリガー
        if (Math.abs(sinR) > 0.92 && !this.wasDown) {
            this.wasDown = true;
            if (window.soundManager) window.soundManager.playHop();
        } else if (Math.abs(sinR) < 0.3) {
            this.wasDown = false;
        }

        // 8. フィーバー時の巨大化＆虹色エフェクト
        this.targetScale = isFever ? 0.95 : 0.60;
        this.baseScale = THREE.MathUtils.lerp(this.baseScale, this.targetScale, delta * 8);
        this.mesh.scale.set(this.baseScale, this.baseScale, this.baseScale);

        if (isFever) {
            this.feverHue = (this.feverHue + delta * 1.8) % 1.0;
            const feverColor = new THREE.Color().setHSL(this.feverHue, 0.95, 0.6);
            this.furMaterial.emissive.copy(feverColor);
            this.furMaterial.emissiveIntensity = 0.85;
        } else {
            this.furMaterial.emissive.setHex(0x000000);
            this.furMaterial.emissiveIntensity = 0;
        }
    }
}

window.RabbitCharacter = RabbitCharacter;
