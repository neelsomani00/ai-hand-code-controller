// --- 1. THREE.JS SCENE SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

// --- 2. THE PARTICLE SYSTEM ---
const particleCount = 6000;
const positions = new Float32Array(particleCount * 3);
const velocities = new Float32Array(particleCount * 3);

for (let i = 0; i < particleCount * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 10;
    velocities[i] = 0;
}

const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const mat = new THREE.PointsMaterial({ size: 0.04, transparent: true, blending: THREE.AdditiveBlending });
const particles = new THREE.Points(geo, mat);
scene.add(particles);
camera.position.z = 6;

let target = new THREE.Vector3(0, 0, 0);
let currentGesture = "VORTEX";

// --- 3. PHYSICS ENGINE ---
function animate() {
    requestAnimationFrame(animate);
    const posAttr = geo.attributes.position;
    
    for (let i = 0; i < particleCount; i++) {
        let ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;
        let dx = target.x - posAttr.array[ix];
        let dy = target.y - posAttr.array[iy];
        let dz = target.z - posAttr.array[iz];
        let d = Math.sqrt(dx*dx + dy*dy + dz*dz) + 0.1;

        if (currentGesture === "SHOCKWAVE") {
            velocities[ix] -= dx / (d * 5); velocities[iy] -= dy / (d * 5);
            mat.color.setHex(0xff0055); // Neon Pink
        } else if (currentGesture === "GRAVITY") {
            velocities[ix] += dx / (d * 10); velocities[iy] += dy / (d * 10);
            mat.color.setHex(0xffaa00); // Gold
        } else {
            velocities[ix] += dx / (d * 200); velocities[iy] += dy / (d * 200);
            mat.color.setHex(0x00f3ff); // Cyber Blue
        }

        velocities[ix] *= 0.96; velocities[iy] *= 0.96;
        posAttr.array[ix] += velocities[ix]; posAttr.array[iy] += velocities[iy];
    }
    posAttr.needsUpdate = true;
    renderer.render(scene, camera);
}
animate();

// --- 4. GESTURE LOGIC ---
function getDist(p1, p2) { return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2)); }

function onResults(results) {
    const canvas = document.querySelector('.output_canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks[0]) {
        const landmarks = results.multiHandLandmarks[0];
        
        // DRAW SKELETON (The "Flex" Dots)
        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {color: '#00f3ff', lineWidth: 2});
        drawLandmarks(ctx, landmarks, {color: '#ffffff', lineWidth: 1, radius: 2});

        // Map Position
        target.x = ((1 - landmarks[8].x) - 0.5) * 12;
        target.y = ((1 - landmarks[8].y) - 0.5) * 10;

        // Detect Gestures
        const pinch = getDist(landmarks[8], landmarks[4]);
        const fist = getDist(landmarks[8], landmarks[0]) < 0.15;

        if (pinch < 0.05) currentGesture = "SHOCKWAVE";
        else if (fist) currentGesture = "GRAVITY";
        else currentGesture = "VORTEX";

        document.getElementById('gesture-name').innerText = currentGesture;
        document.getElementById('sync-val').innerText = "100%";
    } else {
        document.getElementById('sync-val').innerText = "0%";
    }
}

// --- 5. INITIALIZE ---
const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 1, minDetectionConfidence: 0.7 });
hands.onResults(onResults);

const videoElement = document.querySelector('.input_video');
const cam = new Camera(videoElement, { onFrame: async () => { await hands.send({image: videoElement}); }, width: 640, height: 480 });
cam.start();