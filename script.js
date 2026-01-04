// --- 1. SETUP MONACO EDITOR ---
let editor;
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.30.1/min/vs' }});

require(['vs/editor/editor.main'], function() {
    editor = monaco.editor.create(document.getElementById('monaco-editor-container'), {
        value: "// 🖱️ CURSOR CONTROL MODE\n// Move your index finger to move the cursor.\n// Pinch to select text.\n\nfunction test() {\n  console.log('AI Controller Active');\n}",
        language: 'javascript',
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: 18
    });
});

// --- 2. SMOOTHING VARIABLES ---
let lastX = 0;
let lastY = 0;
const smoothing = 0.2; // Adjust between 0.1 (smooth) and 1.0 (instant)

// --- 3. THE GEOMETRY ENGINE ---
function getDist(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

const gestureText = document.getElementById('gesture-text');

function controlEditorWithHand(landmarks) {
    const indexTip = landmarks[8];
    const thumbTip = landmarks[4];
    
    // 1. SMOOTHING LOGIC (Lerp)
    // We map the 0-1 coordinates to the editor's line/column count
    const targetX = indexTip.x;
    const targetY = indexTip.y;
    
    const smoothX = lastX + (targetX - lastX) * smoothing;
    const smoothY = lastY + (targetY - lastY) * smoothing;
    
    lastX = smoothX;
    lastY = smoothY;

    // 2. MAPPING TO EDITOR POSITION
    if (editor) {
        const lineCount = editor.getModel().getLineCount();
        const targetLine = Math.floor(smoothY * lineCount) + 1;
        const targetCol = Math.floor(smoothX * 100); // Assume 100 chars wide

        // Move the cursor visually
        editor.setPosition({ lineNumber: targetLine, column: targetCol });
        editor.revealPositionInCenter({ lineNumber: targetLine, column: targetCol });

        // 3. PINCH TO CLICK/SELECT
        const pinchDist = getDist(indexTip, thumbTip);
        if (pinchDist < 0.04) {
            gestureText.innerText = "CLICK / SELECTING";
            gestureText.style.color = "#ff0000";
            // Optional: Trigger a command or focus
            editor.focus();
        } else {
            gestureText.innerText = "MOVING CURSOR";
            gestureText.style.color = "#007acc";
        }
    }
}

// --- 4. MEDIAPIPE & CAMERA ---
function onResults(results) {
    const canvasElement = document.getElementsByClassName('output_canvas')[0];
    const canvasCtx = canvasElement.getContext('2d');
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Mirror the video for natural movement
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks) {
        for (const landmarks of results.multiHandLandmarks) {
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#007acc', lineWidth: 2});
            drawLandmarks(canvasCtx, landmarks, {color: '#ffffff', lineWidth: 1, radius: 2});
            controlEditorWithHand(landmarks);
        }
    }
    canvasCtx.restore();
}

const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.8, minTrackingConfidence: 0.8 });
hands.onResults(onResults);

const videoElement = document.getElementsByClassName('input_video')[0];
const camera = new Camera(videoElement, {
    onFrame: async () => { await hands.send({image: videoElement}); },
    width: 640, height: 480
});
camera.start();