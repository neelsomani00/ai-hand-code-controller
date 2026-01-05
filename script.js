const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementById('output_canvas');
const ctx = canvasElement.getContext('2d');
const gestureText = document.getElementById('gesture-text');

// Resize canvas to full screen
function resize() {
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// --- PARTICLES ENGINE (The Flashy Part) ---
let particles = [];
function createParticle(x, y, color) {
    particles.push({ x, y, size: Math.random() * 10 + 5, life: 1.0, color });
}

function updateParticles() {
    for (let i = 0; i < particles.length; i++) {
        let p = particles[i];
        p.life -= 0.05; // Fade out
        p.size *= 0.95; // Shrink
        if (p.life <= 0) { particles.splice(i, 1); i--; }
    }
}

function drawParticles() {
    for (let p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;
}

// --- GESTURE LOGIC ---
let points = []; // Stores drawing path

function onResults(results) {
    // 1. Draw Video Feed (Darkened for Cyberpunk look)
    ctx.save();
    ctx.filter = "brightness(50%) contrast(120%)"; // Make it look cinematic
    ctx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    ctx.filter = "none";
    
    // 2. Process Hand
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        // Coordinates
        const indexX = landmarks[8].x * canvasElement.width;
        const indexY = landmarks[8].y * canvasElement.height;
        const thumbX = landmarks[4].x * canvasElement.width;
        const thumbY = landmarks[4].y * canvasElement.height;

        // Draw Skeleton (Neon Lines)
        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {color: '#00ffcc', lineWidth: 2});
        drawLandmarks(ctx, landmarks, {color: '#ffffff', lineWidth: 2, radius: 3});

        // Calculate Pinch (Distance between Index & Thumb)
        const dist = Math.hypot(indexX - thumbX, indexY - thumbY);

        if (dist < 40) {
            // PINCH DETECTED -> DRAWING MODE
            gestureText.innerText = "MODE: ACTIVE DRAWING";
            gestureText.style.color = "#00ffcc";
            
            // Add point to line
            points.push({x: indexX, y: indexY});
            
            // Spawn sparks
            createParticle(indexX, indexY, '#00ffcc');
            createParticle(indexX, indexY, '#ffffff');

        } else {
            // OPEN HAND -> HOVER MODE
            gestureText.innerText = "MODE: HOVER / IDLE";
            gestureText.style.color = "#ff0055";
            
            // Clear line if hand opens (Optional: remove this line to keep drawing)
             points = []; 
        }

        // Draw the neon line path
        if (points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.strokeStyle = '#00ffcc';
            ctx.lineWidth = 10;
            ctx.lineCap = 'round';
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#00ffcc';
            ctx.stroke();
            ctx.shadowBlur = 0; // Reset
        }
    } else {
        gestureText.innerText = "SEARCHING FOR TARGET...";
        points = []; // Reset if hand lost
    }

    updateParticles();
    drawParticles();
    ctx.restore();
}

// --- SETUP CAMERA ---
const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => { await hands.send({image: videoElement}); },
    width: 1280, height: 720
});
camera.start();

// --- FAKE STATS ANIMATION ---
setInterval(() => {
    document.getElementById('cpu-stat').innerText = Math.floor(Math.random() * 100) + "%";
    document.getElementById('mem-stat').innerText = Math.floor(Math.random() * 500 + 200) + "MB";
}, 2000);