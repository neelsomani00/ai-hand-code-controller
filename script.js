const videoElement = document.querySelector('.input_video');
const inkCanvas = document.getElementById('ink_layer');
const uiCanvas = document.getElementById('ui_layer');
const inkCtx = inkCanvas.getContext('2d');
const uiCtx = uiCanvas.getContext('2d');

const colorInd = document.getElementById('color-indicator');
const sizeInd = document.getElementById('size-indicator');
const modeInd = document.getElementById('mode-indicator');

let brush = { color: '#00f3ff', size: 10, x: 0, y: 0, isDrawing: false };
const colors = ['#00f3ff', '#ff0055', '#00ff88', '#ffff00', '#ffffff'];
let colorIdx = 0;

function resize() {
    inkCanvas.width = uiCanvas.width = window.innerWidth;
    inkCanvas.height = uiCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// --- HELPER: Is finger folded? ---
function isFolded(lm, fingerIdx) {
    const tip = lm[fingerIdx * 4 + 4];
    const pip = lm[fingerIdx * 4 + 2];
    return tip.y > pip.y; 
}

function onResults(results) {
    uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        results.multiHandLandmarks.forEach((lm, i) => {
            const label = results.multiHandedness[i].label; // Left or Right
            const x = lm[8].x * uiCanvas.width;
            const y = lm[8].y * uiCanvas.height;

            if (label === "Right") {
                // --- RIGHT HAND: DRAWING LOGIC ---
                const indexFolded = isFolded(lm, 1);
                const middleFolded = isFolded(lm, 2);

                if (indexFolded && middleFolded) {
                    // FIST = DRAW
                    modeInd.innerText = "DRAWING";
                    modeInd.style.color = brush.color;
                    inkCtx.globalCompositeOperation = 'source-over';
                    drawInk(x, y);
                } else if (!indexFolded && !middleFolded) {
                    // OPEN PALM = ERASE
                    modeInd.innerText = "ERASING";
                    modeInd.style.color = "#ff4444";
                    inkCtx.globalCompositeOperation = 'destination-out';
                    drawInk(x, y);
                } else {
                    // POINTING = HOVER
                    modeInd.innerText = "HOVER";
                    modeInd.style.color = "#fff";
                    brush.isDrawing = false;
                }
                drawCursor(x, y, brush.color);
            } else {
                // --- LEFT HAND: CONTROL LOGIC ---
                // Vertical position changes size, Horizontal changes color
                const targetColorIdx = Math.floor(lm[8].x * colors.length);
                if (targetColorIdx !== colorIdx) {
                    colorIdx = targetColorIdx;
                    brush.color = colors[colorIdx];
                    colorInd.style.backgroundColor = brush.color;
                    colorInd.style.boxShadow = `0 0 15px ${brush.color}`;
                }
                brush.size = Math.max(5, Math.floor((1 - lm[8].y) * 50));
                sizeInd.innerText = `SIZE: ${brush.size}`;
                
                // Visual feedback for Left Hand
                drawCursor(x, y, "#ffffff");
            }
        });
    }
}

function drawInk(x, y) {
    inkCtx.lineWidth = brush.size;
    inkCtx.lineCap = 'round';
    inkCtx.lineJoin = 'round';
    inkCtx.strokeStyle = brush.color;

    if (!brush.isDrawing) {
        inkCtx.beginPath();
        inkCtx.moveTo(x, y);
        brush.isDrawing = true;
    } else {
        inkCtx.lineTo(x, y);
        inkCtx.stroke();
    }
    brush.x = x; brush.y = y;
}

function drawCursor(x, y, col) {
    uiCtx.beginPath();
    uiCtx.arc(x, y, brush.size/2 + 5, 0, Math.PI*2);
    uiCtx.strokeStyle = col;
    uiCtx.lineWidth = 2;
    uiCtx.stroke();
}

const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 2, modelComplexity: 0, minDetectionConfidence: 0.5 });
hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => { await hands.send({image: videoElement}); },
    width: 1280, height: 720
});
camera.start();