// --- 1. LIGHTWEIGHT 3D ENGINE ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(1);
document.getElementById('canvas-container').appendChild(renderer.domElement);

camera.position.z = 15; // Default Zoom

// --- 2. ARTISTIC GHOST HANDS ---
function createGhostHand(colorValue) {
    const group = new THREE.Group();
    const mat = new THREE.PointsMaterial({ color: colorValue, size: 0.35, blending: THREE.AdditiveBlending });
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(21 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(geo, mat);
    group.add(particles);
    scene.add(group);
    return { group, geo, positions };
}

const handR = createGhostHand(0x00f3ff); // Blue
const handL = createGhostHand(0x00ff88); // Green

// --- 3. THE CRYSTAL ---
const crystalGeo = new THREE.IcosahedronGeometry(1.5, 1);
const crystalMat = new THREE.MeshPhongMaterial({ 
    color: 0xffffff, wireframe: true, emissive: 0x00f3ff, emissiveIntensity: 0.5 
});
const crystal = new THREE.Mesh(crystalGeo, crystalMat);
scene.add(crystal);

const pLight = new THREE.PointLight(0x00f3ff, 2, 30);
scene.add(pLight);
scene.add(new THREE.AmbientLight(0x111111));

// --- 4. CAMERA & AI STABILITY FIX ---
const video = document.querySelector('.input_video');
const canvas = document.querySelector('.output_canvas');
const ctx = canvas.getContext('2d');

async function startSystem() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480, frameRate: 30 } 
        });
        video.srcObject = stream;
        await video.play();

        // Fix: Set canvas size to match video to avoid "white screen"
        canvas.width = 640;
        canvas.height = 480;

        const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
        hands.setOptions({ maxNumHands: 2, modelComplexity: 0, minDetectionConfidence: 0.5 });
        hands.onResults(onResults);

        const process = () => {
            if (video.readyState >= 2) { hands.send({image: video}); }
            requestAnimationFrame(process);
        };
        process();
    } catch (e) {
        document.getElementById('gesture-name').innerText = "CAMERA_ERROR";
    }
}

function onResults(results) {
    // FIX: Redraw the video feed to the corner canvas
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    handR.group.visible = false;
    handL.group.visible = false;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        let handPositions = [];

        results.multiHandLandmarks.forEach((lm, i) => {
            const label = results.multiHandedness[i].label;
            const h = label === "Left" ? handR : handL; 
            h.group.visible = true;

            const pos = h.positions;
            lm.forEach((p, j) => {
                pos[j * 3] = ((1 - p.x) - 0.5) * 30;
                pos[j * 3 + 1] = (-(p.y - 0.5)) * 20;
                pos[j * 3 + 2] = -p.z * 20;
            });
            h.geo.attributes.position.needsUpdate = true;

            const indexTip = new THREE.Vector3(pos[24], pos[25], pos[26]);
            const wrist = new THREE.Vector3(pos[0], pos[1], pos[2]);
            const thumbTip = new THREE.Vector3(pos[12], pos[13], pos[14]);
            const dist = indexTip.distanceTo(wrist);
            const pinch = indexTip.distanceTo(thumbTip);

            handPositions.push(indexTip);

            // ADVANCED GESTURE 1: PRISM SHIELD (Open Palm)
            if (dist > 6) {
                document.getElementById('gesture-name').innerText = "PRISM_SHIELD_ACTIVE";
                crystal.scale.lerp(new THREE.Vector3(2.5, 2.5, 2.5), 0.1);
                pLight.intensity = 5;
            } 
            // ADVANCED GESTURE 2: VOID GRIP (Fist)
            else if (dist < 4) {
                document.getElementById('gesture-name').innerText = "VOID_GRIP_LOCKED";
                crystal.position.lerp(indexTip, 0.1);
                crystal.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
                pLight.intensity = 2;
            }
            // ADVANCED GESTURE 3: WARP ZOOM (Pinch)
            if (pinch < 0.8) {
                document.getElementById('gesture-name').innerText = "WARP_ZOOMING";
                camera.position.z = 10 + (p.z * 50); // Moves camera based on hand depth
            }
        });

        // ADVANCED GESTURE 4: SUPERNOVA (Two Hands Touch)
        if (handPositions.length === 2) {
            if (handPositions[0].distanceTo(handPositions[1]) < 2) {
                document.getElementById('gesture-name').innerText = "SUPERNOVA_DETECTED";
                crystal.rotation.y += 0.5;
                pLight.color.setHex(0xffffff);
                pLight.intensity = 15;
            } else {
                pLight.color.setHex(0x00f3ff);
            }
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    crystal.rotation.y += 0.01;
    pLight.position.copy(crystal.position);
    renderer.render(scene, camera);
}

startSystem();
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});