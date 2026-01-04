// --- 1. CORE 3D SCENE & ENGINE ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

const light = new THREE.PointLight(0xffffff, 1.5, 100);
light.position.set(0, 10, 10);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040));
camera.position.z = 10;

// --- 2. THE OBJECTS (Pick-up & Explode) ---
let shapes = [];
const geometries = [new THREE.BoxGeometry(1.2, 1.2, 1.2), new THREE.SphereGeometry(0.8, 32, 32), new THREE.TorusGeometry(0.6, 0.3, 16, 100)];
const colors = [0xff0055, 0x00f3ff, 0xffaa00];

function spawnShapes() {
    shapes.forEach(s => scene.remove(s));
    shapes = [];
    for(let i = 0; i < 3; i++) {
        const mesh = new THREE.Mesh(geometries[i], new THREE.MeshStandardMaterial({ color: colors[i], wireframe: false }));
        mesh.position.set((i - 1) * 4, 0, 0);
        scene.add(mesh);
        shapes.push(mesh);
    }
}
spawnShapes();

// --- 3. DIGITAL SKELETON HANDS ---
function createSkeleton() {
    const group = new THREE.Group();
    const dots = [];
    const mat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
    for(let i = 0; i < 21; i++) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.12), mat);
        group.add(dot);
        dots.push(dot);
    }
    scene.add(group);
    return { group, dots };
}

const leftHand = createSkeleton();
const rightHand = createSkeleton();
let grabbed = [null, null];

// --- 4. THE POWERFUL NATIVE CAMERA FIX ---
const videoElement = document.querySelector('.input_video');
const canvasElement = document.querySelector('.output_canvas');
const canvasCtx = canvasElement.getContext('2d');

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        videoElement.srcObject = stream;
        videoElement.play();
        
        videoElement.onloadedmetadata = () => {
            sendToMediaPipe();
        };
    } catch (err) {
        console.error("Camera Access Denied:", err);
        document.getElementById('gesture-name').innerText = "CAMERA_ERROR: ALLOW PERMISSION";
    }
}

// --- 5. MEDIAPIPE LOGIC ---
const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6 });

hands.onResults((results) => {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    leftHand.group.visible = false;
    rightHand.group.visible = false;

    if (results.multiHandLandmarks) {
        results.multiHandLandmarks.forEach((landmarks, index) => {
            const h = index === 0 ? rightHand : leftHand; // Correct mapping
            h.group.visible = true;

            landmarks.forEach((lm, i) => {
                const x = ((1 - lm.x) - 0.5) * 22; // Wider map for desktop/mobile
                const y = (-(lm.y - 0.5)) * 14;
                h.dots[i].position.set(x, y, -lm.z * 15);
            });

            // HAND LOGIC
            const indexTip = h.dots[8].position;
            const thumbTip = h.dots[4].position;
            const wrist = h.dots[0].position;

            const pinchDist = indexTip.distanceTo(thumbTip);
            const isFist = indexTip.distanceTo(wrist) < 2.0;

            if (pinchDist < 0.6) {
                // FIRE BLAST EFFECT
                h.dots.forEach(d => d.material.color.setHex(0xff4400));
                document.getElementById('gesture-name').innerText = "POWER: FIRE_BLAST";
                
                // Explode logic: If pinching near object, reset it
                shapes.forEach(s => {
                    if(s.position.distanceTo(indexTip) < 1.5) {
                        s.scale.set(0,0,0); // "Destroy" it
                        setTimeout(() => { s.scale.set(1,1,1); spawnShapes(); }, 1000); // Respawn
                    }
                });
            } else if (isFist) {
                // GRAB LOGIC
                h.dots.forEach(d => d.material.color.setHex(0x00ff88));
                document.getElementById('gesture-name').innerText = "ACTION: GRABBING";
                shapes.forEach(s => {
                    if(s.position.distanceTo(indexTip) < 2 || grabbed[index] === s) {
                        grabbed[index] = s;
                        s.position.lerp(indexTip, 0.3);
                    }
                });
            } else {
                h.dots.forEach(d => d.material.color.setHex(0x00f3ff));
                grabbed[index] = null;
                document.getElementById('gesture-name').innerText = "SCANNING...";
            }
        });
    }
});

async function sendToMediaPipe() {
    if(!videoElement.paused) {
        await hands.send({image: videoElement});
    }
    requestAnimationFrame(sendToMediaPipe);
}

// Start everything
startCamera();

function animate() {
    requestAnimationFrame(animate);
    shapes.forEach(s => { if(!grabbed.includes(s)) s.rotation.y += 0.02; });
    renderer.render(scene, camera);
}
animate();

// Handle Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});