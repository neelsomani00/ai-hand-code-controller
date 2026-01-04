// --- 1. CORE 3D SCENE ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

const light = new THREE.PointLight(0xffffff, 2, 100);
light.position.set(0, 5, 10);
scene.add(light);
scene.add(new THREE.AmbientLight(0x202020));
camera.position.z = 10;

// --- 2. BONE HAND GENERATOR ---
function createBoneHand(color) {
    const group = new THREE.Group();
    const joints = [];
    const bones = [];
    const jointMat = new THREE.MeshBasicMaterial({ color: color });
    const boneMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.4 });

    for(let i = 0; i < 21; i++) {
        const joint = new THREE.Mesh(new THREE.SphereGeometry(0.15), jointMat);
        group.add(joint);
        joints.push(joint);
    }
    // Create 20 bone segments
    for(let i = 0; i < 20; i++) {
        const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1), boneMat);
        group.add(bone);
        bones.push(bone);
    }
    scene.add(group);
    return { group, joints, bones };
}

const handR = createBoneHand(0x00f3ff); // Neon Blue
const handL = createBoneHand(0x00ff88); // Neon Green

// --- 3. PHYSICS OBJECTS ---
let shapes = [];
const geometries = [new THREE.IcosahedronGeometry(1, 0), new THREE.TorusKnotGeometry(0.6, 0.2)];
function spawn() {
    shapes.forEach(s => scene.remove(s));
    shapes = [];
    for(let i = 0; i < 2; i++) {
        const m = new THREE.Mesh(geometries[i], new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x333333 }));
        m.position.set(i === 0 ? -4 : 4, 0, 0);
        scene.add(m);
        shapes.push(m);
    }
}
spawn();

// --- 4. THE GESTURE BRAIN (Instant Detection) ---
function getHandState(landmarks) {
    // Calculate if fingers are extended relative to the palm
    const thumbIndexDist = Math.hypot(landmarks[4].x - landmarks[8].x, landmarks[4].y - landmarks[8].y);
    const isIndexExtended = landmarks[8].y < landmarks[6].y;
    const isMiddleExtended = landmarks[12].y < landmarks[10].y;
    
    if (thumbIndexDist < 0.06) return "PINCH";
    if (!isIndexExtended && !isMiddleExtended) return "FIST";
    if (isIndexExtended && isMiddleExtended) return "OPEN";
    return "NONE";
}

// --- 5. ULTRA-FAST CAMERA & AI ---
const video = document.querySelector('.input_video');
const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});

hands.setOptions({ 
    maxNumHands: 2, 
    modelComplexity: 0, // 0 is fastest for mobile/web
    minDetectionConfidence: 0.5, 
    minTrackingConfidence: 0.5 
});

async function setupCam() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, frameRate: 30 } });
    video.srcObject = stream;
    video.play();
    video.onloadedmetadata = () => predict();
}

function updateBones(handObj, landmarks) {
    handObj.group.visible = true;
    const pts = landmarks.map(lm => ({
        x: ((1 - lm.x) - 0.5) * 22,
        y: (-(lm.y - 0.5)) * 14,
        z: -lm.z * 10
    }));

    // Update Joints
    pts.forEach((p, i) => handObj.joints[i].position.set(p.x, p.y, p.z));

    // Update Bone Connections
    const connections = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
    connections.forEach((conn, i) => {
        const p1 = handObj.joints[conn[0]].position;
        const p2 = handObj.joints[conn[1]].position;
        const bone = handObj.bones[i];
        const dist = p1.distanceTo(p2);
        bone.position.copy(p1).lerp(p2, 0.5);
        bone.lookAt(p2);
        bone.rotateX(Math.PI/2);
        bone.scale.set(1, dist, 1);
    });

    return pts[8]; // Return index tip for interaction
}

let activeGrabs = [null, null];

hands.onResults(results => {
    handR.group.visible = false;
    handL.group.visible = false;

    if (results.multiHandLandmarks) {
        results.multiHandLandmarks.forEach((lm, i) => {
            const isRight = results.multiHandedness[i].label === "Right";
            const handObj = isRight ? handR : handL;
            const indexTip = updateBones(handObj, lm);
            const state = getHandState(lm);

            document.getElementById('gesture-name').innerText = state;

            if(state === "FIST") {
                shapes.forEach(s => {
                    if(s.position.distanceTo(indexTip) < 2 || activeGrabs[i] === s) {
                        activeGrabs[i] = s;
                        s.position.lerp(indexTip, 0.4);
                        s.material.emissive.setHex(isRight ? 0x00f3ff : 0x00ff88);
                    }
                });
            } else if (state === "PINCH") {
                // LIGHTNING BLAST
                handObj.joints.forEach(j => j.scale.set(1.5, 1.5, 1.5));
                shapes.forEach(s => {
                    if(s.position.distanceTo(indexTip) < 2) s.rotation.x += 0.5;
                });
            } else {
                activeGrabs[i] = null;
                handObj.joints.forEach(j => j.scale.set(1, 1, 1));
                shapes.forEach(s => s.material.emissive.setHex(0x000000));
            }
        });
    }
});

async function predict() {
    await hands.send({image: video});
    requestAnimationFrame(predict);
}

setupCam();
function animate() {
    requestAnimationFrame(animate);
    shapes.forEach(s => { if(!activeGrabs.includes(s)) s.rotation.y += 0.01; });
    renderer.render(scene, camera);
}
animate();