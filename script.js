// --- CONFIGURATION ---
const PINCH_START = 40;  // Must get this close to START drawing
const PINCH_STOP = 80;   // Must get this far to STOP (Fixes the flickering!)
const SMOOTHING = 0.5;   // Higher = smoother lines, slightly more lag

const inkCanvas = document.getElementById('ink_layer');
const cursorCanvas = document.getElementById('cursor_layer');
const inkCtx = inkCanvas.getContext('2d');
const cursorCtx = cursorCanvas.getContext('2d');
const wrapper = document.getElementById('canvas-wrapper');
const modeText = document.getElementById('active-mode');
const colorPreview = document.getElementById('curColor');

// State Variables
let brush = { x: 0, y: 0, color: '#00f3ff', size: 6, isDrawing: false };
let pan = { x: 0, y: 0 };
let handState = { lastX: 0, lastY: 0, isPinching: false, lastColorSwap: 0 };

// Setup Canvases
function resize() {
    inkCanvas.width = window.innerWidth;
    inkCanvas.height = window.innerHeight;
    cursorCanvas.width = window.innerWidth;
    cursorCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// --- THE LOGIC BRAIN ---
function onResults(results) {
    cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
    
    // Default Mode
    let currentMode = "IDLE (HOVER)";
    modeText.style.color = "#888";

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const lm = results.multiHandLandmarks[0];
        
        // Coordinates (Mirrored)
        const W = cursorCanvas.width;
        const H = cursorCanvas.height;
        const indexTip = { x: lm[8].x * W, y: lm[8].y * H };
        const thumbTip = { x: lm[4].x * W, y: lm[4].y * H };
        const wrist = { x: lm[0].x * W, y: lm[0].y * H };
        const pinkyTip = { x: lm[20].x * W, y: lm[20].y * H };

        // 1. GESTURE: FIST (PANNING)
        // Logic: Index tip is close to Wrist
        const fistDist = Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y);
        if (fistDist < 100) {
            currentMode = "GRAB: PANNING";
            modeText.style.color = "#ffaa00";
            
            // Move the entire canvas wrapper
            const dx = indexTip.x - handState.lastX;
            const dy = indexTip.y - handState.lastY;
            
            // Only move if not first frame of grab
            if (handState.isPinching === false) { 
                pan.x += dx; 
                pan.y += dy;
                wrapper.style.transform = `translate(${pan.x}px, ${pan.y}px)`;
            }
        } 
        
        // 2. GESTURE: COLOR SWAP (Index touching Pinky)
        const colorDist = Math.hypot(indexTip.x - pinkyTip.x, indexTip.y - pinkyTip.y);
        const now = Date.now();
        if (colorDist < 40 && now - handState.lastColorSwap > 1000) {
            // Random Neon Color
            const colors = ['#00f3ff', '#00ff88', '#ff0055', '#ffff00', '#aa00ff'];
            brush.color = colors[Math.floor(Math.random() * colors.length)];
            colorPreview.style.backgroundColor = brush.color;
            colorPreview.style.boxShadow = `0 0 15px ${brush.color}`;
            handState.lastColorSwap = now;
        }

        // 3. GESTURE: DRAWING (Sticky Pinch)
        const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
        
        // Hysteresis Logic (The Fix for broken lines)
        if (pinchDist < PINCH_START) handState.isPinching = true;
        else if (pinchDist > PINCH_STOP) handState.isPinching = false;

        if (handState.isPinching && fistDist > 100) {
            currentMode = "ACTIVE: DRAWING";
            modeText.style.color = brush.color;

            // Smooth Drawing (Quadratic Curve)
            inkCtx.lineWidth = brush.size;
            inkCtx.lineCap = 'round';
            inkCtx.strokeStyle = brush.color;
            inkCtx.shadowBlur = 10;
            inkCtx.shadowColor = brush.color;

            if (brush.isDrawing) {
                inkCtx.beginPath();
                inkCtx.moveTo(brush.x, brush.y);
                // Draw smooth line to new point
                inkCtx.quadraticCurveTo(brush.x, brush.y, indexTip.x, indexTip.y);
                inkCtx.stroke();
            }
            
            brush.isDrawing = true;
            brush.x = indexTip.x;
            brush.y = indexTip.y;
        } else {
            brush.isDrawing = false;
        }

        // Update visual cursor
        drawCursor(indexTip.x, indexTip.y, handState.isPinching);
        
        // Save history for panning delta
        handState.lastX = indexTip.x;
        handState.lastY = indexTip.y;

        // Draw Skeleton overlay
        drawConnectors(cursorCtx, lm, HAND_CONNECTIONS, {color: 'rgba(255,255,255,0.1)', lineWidth: 1});
    }

    modeText.innerText = currentMode;
}

function drawCursor(x, y, active) {
    cursorCtx.beginPath();
    cursorCtx.arc(x, y, active ? 5 : 10, 0, Math.PI * 2);
    cursorCtx.strokeStyle = "white";
    cursorCtx.lineWidth = 2;
    cursorCtx.stroke();
    if(active) {
        cursorCtx.fillStyle = brush.color;
        cursorCtx.fill();
    }
}

window.clearCanvas = () => {
    inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
};

// --- INITIALIZE ---
const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
hands.onResults(onResults);

const vid = document.querySelector('.input_video');
const camera = new Camera(vid, {
    onFrame: async () => { await hands.send({image: vid}); },
    width: 1280, height: 720
});
camera.start();