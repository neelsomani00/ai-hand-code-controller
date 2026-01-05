const videoElement = document.querySelector('.input_video');
const inkCanvas = document.getElementById('ink_layer');
const uiCanvas = document.getElementById('ui_layer');
const inkCtx = inkCanvas.getContext('2d');
const uiCtx = uiCanvas.getContext('2d');

const sizeText = document.getElementById('size_val');
const colorText = document.getElementById('color_name');
const modeText = document.getElementById('mode_status');

// Global Settings
let brush = { color: '#00f3ff', size: 10, isDrawing: false, lastX: 0, lastY: 0 };
const colors = [
    { name: 'CYAN', hex: '#00f3ff' }, { name: 'MAGENTA', hex: '#ff0055' }, 
    { name: 'LIME', hex: '#00ff88' }, { name: 'GOLD', hex: '#ffff00' }, { name: 'WHITE', hex: '#ffffff' }
];
let colorIdx = 0;

// Relative Control State
let leftHand = { isPinching: false, startY: 0, startX: 0, startSize: 10, startColorIdx: 0 };

function resize() {
    inkCanvas.width = uiCanvas.width = window.innerWidth;
    inkCanvas.height = uiCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function onResults(results) {
    uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);

    if (!results.multiHandLandmarks) return;

    results.multiHandLandmarks.forEach((lm, i) => {
        const x = lm[8].x * uiCanvas.width;
        const y = lm[8].y * uiCanvas.height;

        // --- BIOLOGICAL HAND IDENTIFICATION ---
        // MediaPipe label is used as a base, but we verify with Thumb (4) vs Pinky (20) position
        // On a mirrored screen, Right Hand Thumb is usually Left of Pinky
        const isActuallyRight = lm[4].x < lm[20].x; 

        if (!isActuallyRight) {
            // --- LEFT HAND: RELATIVE REMOTE ---
            const thumbTip = lm[4];
            const indexTip = lm[8];
            const dist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
            
            if (dist < 0.05) {
                if (!leftHand.isPinching) {
                    // Start of Pinch: Anchor the values
                    leftHand.isPinching = true;
                    leftHand.startY = lm[8].y;
                    leftHand.startX = lm[8].x;
                    leftHand.startSize = brush.size;
                    leftHand.startColorIdx = colorIdx;
                }
                
                // 1. SIZE CONTROL (Vertical Movement)
                let diffY = leftHand.startY - lm[8].y; // Up is positive
                brush.size = Math.max(2, Math.min(100, leftHand.startSize + (diffY * 200)));
                sizeText.innerText = Math.round(brush.size);

                // 2. COLOR CONTROL (Horizontal Movement)
                let diffX = lm[8].x - leftHand.startX;
                let colorShift = Math.floor(diffX * 10);
                let nextIdx = (leftHand.startColorIdx + colorShift) % colors.length;
                if (nextIdx < 0) nextIdx += colors.length;
                
                colorIdx = nextIdx;
                brush.color = colors[colorIdx].hex;
                colorText.innerText = colors[colorIdx].name;
                colorText.style.color = brush.color;

                drawMarker(x, y, brush.color, "ADJUSTING");
            } else {
                leftHand.isPinching = false;
                drawMarker(x, y, "rgba(255,255,255,0.3)", "REMOTE");
            }

        } else {
            // --- RIGHT HAND: PEN ---
            const indexFolded = lm[8].y > lm[6].y;
            const middleFolded = lm[12].y > lm[10].y;

            if (indexFolded && middleFolded) {
                modeText.innerText = "INKING";
                inkCtx.globalCompositeOperation = 'source-over';
                drawSmooth(x, y);
            } else if (!indexFolded && !middleFolded) {
                modeText.innerText = "ERASER";
                inkCtx.globalCompositeOperation = 'destination-out';
                drawSmooth(x, y);
            } else {
                modeText.innerText = "HOVER";
                brush.isDrawing = false;
            }
            drawMarker(x, y, brush.color, "PEN");
        }
    });
}

function drawSmooth(x, y) {
    inkCtx.lineWidth = brush.size;
    inkCtx.lineCap = 'round';
    inkCtx.strokeStyle = brush.color;

    if (!brush.isDrawing) {
        inkCtx.beginPath();
        inkCtx.moveTo(x, y);
        brush.isDrawing = true;
    } else {
        const midX = (brush.lastX + x) / 2;
        const midY = (brush.lastY + y) / 2;
        inkCtx.quadraticCurveTo(brush.lastX, brush.lastY, midX, midY);
        inkCtx.stroke();
    }
    brush.lastX = x; brush.lastY = y;
}

function drawMarker(x, y, col, label) {
    uiCtx.beginPath();
    uiCtx.arc(x, y, 15, 0, Math.PI*2);
    uiCtx.strokeStyle = col;
    uiCtx.lineWidth = 3;
    uiCtx.stroke();
    uiCtx.fillStyle = col;
    uiCtx.font = "12px Arial";
    uiCtx.fillText(label, x + 20, y);
}

const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7 });
hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => { await hands.send({image: videoElement}); },
    width: 1280, height: 720
});
camera.start();