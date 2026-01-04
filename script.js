// --- 1. SETUP MONACO EDITOR ---
let editor;

require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.30.1/min/vs' }});

require(['vs/editor/editor.main'], function() {
    editor = monaco.editor.create(document.getElementById('monaco-editor-container'), {
        value: [
            'function helloWorld() {',
            '    console.log("Hello AI!");',
            '    // Pinch your fingers to scroll down!',
            '}',
            '',
            '// Adding more lines to demonstrate scrolling...',
            '// Line 1',
            '// Line 2',
            '// Line 3',
            '// Line 4',
            '// Line 5',
            '// Line 6',
            '// Line 7',
            '// Line 8',
            '// Line 9',
            '// Line 10',
            '// Line 11',
            '// Line 12',
            '// Line 13',
            '// Line 14',
            '// Line 15',
            '// Line 16',
            '// Line 17',
            '// Line 18',
            '// Line 19',
            '// Line 20'
        ].join('\n'),
        language: 'javascript',
        theme: 'vs-dark',
        automaticLayout: true
    });
});

// --- 2. THE GEOMETRY ENGINE (MATH) ---

// Helper: Calculate 3D Euclidean Distance
function calculateDistance(point1, point2) {
    const x = point1.x - point2.x;
    const y = point1.y - point2.y;
    // We prioritize X and Y for screen interaction, Z is depth
    return Math.sqrt(x * x + y * y);
}

const statusText = document.getElementById('status-text');
const gestureText = document.getElementById('gesture-text');

function onResults(results) {
    const canvasElement = document.getElementsByClassName('output_canvas')[0];
    const canvasCtx = canvasElement.getContext('2d');

    // Draw the overlay
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks) {
        for (const landmarks of results.multiHandLandmarks) {
            // Draw skeleton
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
            drawLandmarks(canvasCtx, landmarks, {color: '#FF0000', lineWidth: 1});

            // --- GESTURE LOGIC ---
            
            // Get coordinates for Index Tip (8) and Thumb Tip (4)
            const indexTip = landmarks[8];
            const thumbTip = landmarks[4];

            // Calculate distance
            const distance = calculateDistance(indexTip, thumbTip);

            // Threshold logic (0.05 is roughly "touching" in normalized coordinates)
            if (distance < 0.05) {
                gestureText.innerText = "PINCH DETECTED (Scrolling)";
                gestureText.style.color = "#00FF00"; // Green
                
                // ACTION: Scroll Editor
                if(editor) {
                    // Scroll down by 5px per frame when pinching
                    const currentScroll = editor.getScrollTop();
                    editor.setScrollTop(currentScroll + 5);
                }

            } else {
                gestureText.innerText = "None";
                gestureText.style.color = "#cccccc";
            }
        }
    }
    canvasCtx.restore();
}

// --- 3. INIT CAMERA & MEDIAPIPE ---
const videoElement = document.getElementsByClassName('input_video')[0];

const hands = new Hands({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({image: videoElement});
    },
    width: 640,
    height: 480
});

statusText.innerText = "Camera Active";
camera.start();