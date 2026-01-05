// --- 1. SETUP & CONFIG ---
const videoElement = document.getElementsByClassName('input_video')[0];
const inkCanvas = document.getElementById('ink_canvas');
const cursorCanvas = document.getElementById('cursor_canvas');
const inkCtx = inkCanvas.getContext('2d');
const cursorCtx = cursorCanvas.getContext('2d');

// UI Elements
const colorPicker = document.getElementById('colorPicker');
const sizeSlider = document.getElementById('sizeSlider');
const sizeVal = document.getElementById('sizeVal');
const zoomSlider = document.getElementById('zoomSlider');
const zoomContainer = document.getElementById('zoom-container');
const statusText = document.getElementById('hand-status');

let brushColor = '#00ffcc';
let brushSize = 5;
let isEraser = false;

// Initialize Canvas Size
function resize() {
    inkCanvas.width = window.innerWidth;
    inkCanvas.height = window.innerHeight;
    cursorCanvas.width = window.innerWidth;
    cursorCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// --- 2. UI CONTROLS ---
colorPicker.addEventListener('input', (e) => {
    brushColor = e.target.value;
    isEraser = false;
});

sizeSlider.addEventListener('input', (e) => {
    brushSize = e.target.value;
    sizeVal.innerText = brushSize;
});

zoomSlider.addEventListener('input', (e) => {
    zoomContainer.style.transform = `scale(${e.target.value})`;
});

window.setEraser = () => { isEraser = true; };
window.clearAll = () => { inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height); };

// --- 3. DRAWING LOGIC ---
// We store the "previous" position of fingers to draw smooth lines
let lastPositions = {}; 

function onResults(results) {
    // Clear Cursor Layer ONLY (Keep the ink layer intact)
    cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);

    if (results.multiHandLandmarks) {
        statusText.innerText = "Hands Detected: " + results.multiHandLandmarks.length;

        for (const [index, landmarks] of results.multiHandLandmarks.entries()) {
            drawHand(landmarks, index);
        }
    } else {
        lastPositions = {}; // Reset if hands lost
    }
}

function drawHand(landmarks, handIndex) {
    // 1. Get Coordinates
    const x = landmarks[8].x * cursorCanvas.width;
    const y = landmarks[8].y * cursorCanvas.height;
    
    // Thumb for Pinch Detection
    const thumbX = landmarks[4].x * cursorCanvas.width;
    const thumbY = landmarks[4].y * cursorCanvas.height;

    // 2. Draw Cursor (Visual Feedback)
    cursorCtx.beginPath();
    cursorCtx.arc(x, y, brushSize / 2, 0, 2 * Math.PI);
    cursorCtx.strokeStyle = "white";
    cursorCtx.lineWidth = 2;
    cursorCtx.stroke();
    
    // Draw Skeleton helper (optional, keeps it "techy")
    drawConnectors(cursorCtx, landmarks, HAND_CONNECTIONS, {color: 'rgba(0, 255, 255, 0.3)', lineWidth: 1});

    // 3. Check PINCH (Drawing Trigger)
    const distance = Math.hypot(x - thumbX, y - thumbY);
    const isPinching = distance < 50; // Threshold

    if (isPinching) {
        // DRAWING MODE
        cursorCtx.fillStyle = isEraser ? 'red' : brushColor;
        cursorCtx.fill(); // Fill cursor to show active state

        if (lastPositions[handIndex]) {
            inkCtx.beginPath();
            inkCtx.moveTo(lastPositions[handIndex].x, lastPositions[handIndex].y);
            inkCtx.lineTo(x, y);
            
            inkCtx.lineWidth = brushSize;
            inkCtx.lineCap = 'round';
            inkCtx.lineJoin = 'round';

            if (isEraser) {
                inkCtx.globalCompositeOperation = 'destination-out'; // Erase alpha
            } else {
                inkCtx.globalCompositeOperation = 'source-over'; // Normal draw
                inkCtx.strokeStyle = brushColor;
            }
            
            inkCtx.stroke();
        }
        // Update last position
        lastPositions[handIndex] = { x, y };
    } else {
        // HOVER MODE (Lifted pen)
        lastPositions[handIndex] = null; // Stop the line
    }
}

// --- 4. START MEDIAPIPE (LITE MODE FOR SPEED) ---
const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});

// "modelComplexity: 0" is the secret to fixing the lag
hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 0, 
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => { await hands.send({image: videoElement}); },
    width: 1280, height: 720
});
camera.start();