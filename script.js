/**
 * ============================================================
 * MEDIGUARD AI
 * COMPLETE FRONTEND CONTROLLER
 * ============================================================
 *
 * Works with:
 *
 * Demo Mode:
 *     LOW_RISK / HIGH_RISK presets
 *
 * Live Mode:
 *     POST /api/v1/analyze-image
 *     POST /api/v1/verify-medicine
 *
 * Backend:
 *     http://127.0.0.1:8000
 * ============================================================
 */


/* ============================================================
   1. BACKEND CONFIGURATION
   ============================================================ */

const API_BASE_URL = "http://127.0.0.1:8000";


/* ============================================================
   2. DEMO DATA
   ============================================================ */

const DEMO_PRESETS = {

    LOW_RISK: {

        success: true,

        status: "LOW_RISK",

        risk_score: 12,

        confidence: 94,

        medicine_name: "Paracetamol 500mg",

        manufacturer: "MediCare Pharma",

        batch_number: "PCM25001",

        expiry_date: "2027-01-10",

        barcode: "8901234567890",

        checks: {

            medicine: true,

            manufacturer: true,

            batch: true,

            expiry: true,

            barcode: true
        },

        reasons: [

            "All available medicine information is consistent with official records.",

            "Batch PCM25001 matches the registered manufacturing lot.",

            "Barcode successfully matched the registered medicine record."
        ],

        recommendation:

            "Information appears consistent. For high-risk medicines, verify through an authorized source."
    },


    HIGH_RISK: {

        success: true,

        status: "HIGH_RISK",

        risk_score: 78,

        confidence: 88,

        medicine_name: "Amoxicillin 500mg",

        manufacturer: "Unknown BioPharma",

        batch_number: "AMX-9980-X",

        expiry_date: "2025-11-30",

        barcode: "0000000000000",

        checks: {

            medicine: true,

            manufacturer: false,

            batch: false,

            expiry: false,

            barcode: false
        },

        reasons: [

            "Manufacturer could not be verified in the registered database.",

            "Batch number could not be verified in the official registry.",

            "Barcode did not match the registered manufacturer record."
        ],

        recommendation:

            "Do not rely on this assessment alone. Verify the medicine with the manufacturer, pharmacist, or authorized source."
    }
};


/* ============================================================
   3. GLOBAL APPLICATION STATE
   ============================================================ */

const state = {

    demoMode: true,

    currentPreset: "LOW_RISK",

    selectedFile: null,

    cameraStream: null,

    activeResult: null,

    history: []
};


/* ============================================================
   4. DOM ELEMENT CACHE
   ============================================================ */

const elements = {

    /* Navigation */

    header:
        document.getElementById("header"),

    hamburgerBtn:
        document.getElementById("hamburger-btn"),

    mobileDrawer:
        document.getElementById("mobile-drawer"),

    demoToggle:
        document.getElementById("demo-mode-toggle"),


    /* Scan */

    btnOpenCamera:
        document.getElementById("btn-open-camera"),

    btnTriggerUpload:
        document.getElementById("btn-trigger-upload"),

    btnTriggerBarcode:
        document.getElementById("btn-trigger-barcode"),

    fileInput:
        document.getElementById("file-input"),

    dropZone:
        document.getElementById("drop-zone"),

    previewWrapper:
        document.getElementById("preview-wrapper"),

    imagePreview:
        document.getElementById("image-preview"),

    btnRemovePreview:
        document.getElementById("btn-remove-preview"),

    btnChangeImage:
        document.getElementById("btn-change-image"),

    btnAnalyzeMed:
        document.getElementById("btn-analyze-med"),

    presetLow:
        document.getElementById("preset-low-risk"),

    presetHigh:
        document.getElementById("preset-high-risk"),


    /* Camera */

    cameraModal:
        document.getElementById("camera-modal"),

    cameraVideo:
        document.getElementById("camera-video"),

    cameraCanvas:
        document.getElementById("camera-canvas"),

    cameraErrorMsg:
        document.getElementById("camera-error-msg"),

    btnCaptureCamera:
        document.getElementById("btn-capture-camera"),

    btnCancelCamera:
        document.getElementById("btn-cancel-camera"),

    btnCloseCamera:
        document.getElementById("btn-close-camera"),


    /* Loading */

    loadingOverlay:
        document.getElementById("loading-overlay"),

    pipelineSteps:
        document.querySelectorAll(".pipeline-step"),


    /* Results */

    resultSection:
        document.getElementById("result-section"),

    resMedName:
        document.getElementById("res-med-name"),

    resMedMfg:
        document.getElementById("res-med-mfg"),

    resStatusContainer:
        document.getElementById("res-status-pill-container"),

    resBatch:
        document.getElementById("res-batch"),

    resExpiry:
        document.getElementById("res-expiry"),

    resConfidence:
        document.getElementById("res-confidence"),

    gaugeCircle:
        document.getElementById("gauge-fill-circle"),

    resScoreNum:
        document.getElementById("res-score-num"),

    resScoreDesc:
        document.getElementById("res-score-description"),

    resChecksList:
        document.getElementById("res-checks-list"),

    resReasonsList:
        document.getElementById("res-reasons-list"),

    resRecText:
        document.getElementById("res-recommendation-text"),

    btnShowPassport:
        document.getElementById("btn-show-passport"),

    btnScanAnother:
        document.getElementById("btn-scan-another"),


    /* Passport */

    passportModal:
        document.getElementById("passport-modal"),

    btnClosePassport:
        document.getElementById("btn-close-passport"),

    btnSharePassport:
        document.getElementById("btn-share-passport"),

    passId:
        document.getElementById("pass-id"),

    passMed:
        document.getElementById("pass-med"),

    passMfg:
        document.getElementById("pass-mfg"),

    passBatch:
        document.getElementById("pass-batch"),

    passExpiry:
        document.getElementById("pass-expiry"),

    passDate:
        document.getElementById("pass-date"),

    passStatusBox:
        document.getElementById("pass-status-box"),

    passChipsContainer:
        document.getElementById("pass-chips-container"),


    /* History */

    historyContainer:
        document.getElementById("history-container"),

    btnClearHistory:
        document.getElementById("btn-clear-history")
};


/* ============================================================
   5. INITIALIZATION
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    initApp
);


function initApp() {

    console.log("=================================");
    console.log("MediGuard AI starting...");
    console.log("Backend:", API_BASE_URL);
    console.log("=================================");


    setupNavigation();

    setupEventListeners();

    setupDragAndDrop();

    loadHistory();

    updateDemoUI();

    testBackendConnection();
}


/* ============================================================
   6. SAFE EVENT LISTENER
   ============================================================ */

function addListener(element, event, callback) {

    if (!element) {
        return;
    }

    element.addEventListener(
        event,
        callback
    );
}


/* ============================================================
   7. NAVIGATION
   ============================================================ */

function setupNavigation() {

    addListener(
        elements.hamburgerBtn,
        "click",
        () => {

            const isOpen =
                elements.mobileDrawer.classList.toggle(
                    "open"
                );

            elements.hamburgerBtn.setAttribute(
                "aria-expanded",
                isOpen
            );
        }
    );


    document
        .querySelectorAll(
            ".mobile-nav-link, .mobile-drawer-btn"
        )
        .forEach(link => {

            link.addEventListener(
                "click",
                () => {

                    if (elements.mobileDrawer) {

                        elements.mobileDrawer.classList.remove(
                            "open"
                        );
                    }

                    if (elements.hamburgerBtn) {

                        elements.hamburgerBtn.setAttribute(
                            "aria-expanded",
                            "false"
                        );
                    }
                }
            );
        });


    addListener(
        elements.demoToggle,
        "change",
        event => {

            state.demoMode =
                event.target.checked;

            console.log(
                "Demo Mode:",
                state.demoMode
            );

            updateDemoUI();
        }
    );
}


/* ============================================================
   8. DEMO MODE UI
   ============================================================ */

function updateDemoUI() {

    if (!elements.presetLow ||
        !elements.presetHigh) {

        return;
    }


    if (state.currentPreset === "LOW_RISK") {

        elements.presetLow.classList.add(
            "active"
        );

        elements.presetHigh.classList.remove(
            "active"
        );

    } else {

        elements.presetHigh.classList.add(
            "active"
        );

        elements.presetLow.classList.remove(
            "active"
        );
    }
}


/* ============================================================
   9. EVENT LISTENERS
   ============================================================ */

function setupEventListeners() {


    /* Upload */

    addListener(
        elements.btnTriggerUpload,
        "click",
        () => {

            if (elements.fileInput) {

                elements.fileInput.click();
            }
        }
    );


    /* Barcode button */

    addListener(
        elements.btnTriggerBarcode,
        "click",
        () => {

            if (elements.fileInput) {

                elements.fileInput.click();
            }
        }
    );


    /* File input */

    addListener(
        elements.fileInput,
        "change",
        handleFileSelect
    );


    /* Preview */

    addListener(
        elements.btnRemovePreview,
        "click",
        clearPreview
    );


    addListener(
        elements.btnChangeImage,
        "click",
        () => {

            if (elements.fileInput) {

                elements.fileInput.click();
            }
        }
    );


    /* Camera */

    addListener(
        elements.btnOpenCamera,
        "click",
        openCamera
    );


    addListener(
        elements.btnCloseCamera,
        "click",
        closeCamera
    );


    addListener(
        elements.btnCancelCamera,
        "click",
        closeCamera
    );


    addListener(
        elements.btnCaptureCamera,
        "click",
        captureImage
    );


    /* Demo presets */

    addListener(
        elements.presetLow,
        "click",
        () => {

            setDemoPreset(
                "LOW_RISK"
            );
        }
    );


    addListener(
        elements.presetHigh,
        "click",
        () => {

            setDemoPreset(
                "HIGH_RISK"
            );
        }
    );


    /* Analyze */

    addListener(
        elements.btnAnalyzeMed,
        "click",
        handleAnalyzeClick
    );


    /* Scan another */

    addListener(
        elements.btnScanAnother,
        "click",
        () => {

            clearPreview();

            if (elements.resultSection) {

                elements.resultSection.classList.add(
                    "hidden"
                );
            }

            window.location.hash = "#scan";
        }
    );


    /* Passport */

    addListener(
        elements.btnShowPassport,
        "click",
        showPassport
    );


    addListener(
        elements.btnClosePassport,
        "click",
        () => {

            if (elements.passportModal) {

                elements.passportModal.classList.add(
                    "hidden"
                );
            }
        }
    );


    addListener(
        elements.btnSharePassport,
        "click",
        sharePassport
    );


    /* History */

    addListener(
        elements.btnClearHistory,
        "click",
        clearHistory
    );
}


/* ============================================================
   10. DRAG AND DROP
   ============================================================ */

function setupDragAndDrop() {

    const dropZone =
        elements.dropZone;


    if (!dropZone) {
        return;
    }


    [
        "dragenter",
        "dragover",
        "dragleave",
        "drop"
    ].forEach(eventName => {

        dropZone.addEventListener(
            eventName,
            event => {

                event.preventDefault();

                event.stopPropagation();
            }
        );
    });


    [
        "dragenter",
        "dragover"
    ].forEach(eventName => {

        dropZone.addEventListener(
            eventName,
            () => {

                dropZone.classList.add(
                    "dragover"
                );
            }
        );
    });


    [
        "dragleave",
        "drop"
    ].forEach(eventName => {

        dropZone.addEventListener(
            eventName,
            () => {

                dropZone.classList.remove(
                    "dragover"
                );
            }
        );
    });


    dropZone.addEventListener(
        "drop",
        event => {

            const files =
                event.dataTransfer.files;


            if (files.length > 0) {

                handleFile(
                    files[0]
                );
            }
        }
    );


    dropZone.addEventListener(
        "click",
        () => {

            if (elements.fileInput) {

                elements.fileInput.click();
            }
        }
    );
}


/* ============================================================
   11. FILE SELECTION
   ============================================================ */

function handleFileSelect(event) {

    if (
        event.target.files &&
        event.target.files.length > 0
    ) {

        handleFile(
            event.target.files[0]
        );
    }
}


/* ============================================================
   12. FILE HANDLING
   ============================================================ */

function handleFile(file) {

    if (!file) {
        return;
    }


    if (!file.type.startsWith("image/")) {

        alert(
            "Please select a valid image file."
        );

        return;
    }


    state.selectedFile = file;


    console.log(
        "Selected image:",
        file.name,
        file.type,
        file.size
    );


    const reader =
        new FileReader();


    reader.onload = event => {

        if (elements.imagePreview) {

            elements.imagePreview.src =
                event.target.result;
        }


        if (elements.dropZone) {

            elements.dropZone.classList.add(
                "hidden"
            );
        }


        if (elements.previewWrapper) {

            elements.previewWrapper.classList.remove(
                "hidden"
            );
        }
    };


    reader.onerror = () => {

        alert(
            "Could not read the selected image."
        );
    };


    reader.readAsDataURL(file);
}


/* ============================================================
   13. CLEAR IMAGE
   ============================================================ */

function clearPreview() {

    state.selectedFile = null;


    if (elements.fileInput) {

        elements.fileInput.value = "";
    }


    if (elements.imagePreview) {

        elements.imagePreview.src = "";
    }


    if (elements.previewWrapper) {

        elements.previewWrapper.classList.add(
            "hidden"
        );
    }


    if (elements.dropZone) {

        elements.dropZone.classList.remove(
            "hidden"
        );
    }
}


/* ============================================================
   14. DEMO PRESET
   ============================================================ */

function setDemoPreset(presetKey) {

    if (
        !DEMO_PRESETS[presetKey]
    ) {

        console.error(
            "Invalid demo preset:",
            presetKey
        );

        return;
    }


    state.currentPreset =
        presetKey;


    updateDemoUI();


    console.log(
        "Demo preset:",
        presetKey
    );
}


/* ============================================================
   15. CAMERA
   ============================================================ */

async function openCamera() {

    if (!navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia) {

        alert(
            "Camera is not supported by this browser."
        );

        return;
    }


    if (elements.cameraErrorMsg) {

        elements.cameraErrorMsg.classList.add(
            "hidden"
        );
    }


    if (elements.cameraModal) {

        elements.cameraModal.classList.remove(
            "hidden"
        );
    }


    try {

        const constraints = {

            video: {

                facingMode: {
                    ideal: "environment"
                },

                width: {
                    ideal: 1280
                },

                height: {
                    ideal: 720
                }
            }
        };


        state.cameraStream =
            await navigator.mediaDevices.getUserMedia(
                constraints
            );


        if (elements.cameraVideo) {

            elements.cameraVideo.srcObject =
                state.cameraStream;

            await elements.cameraVideo.play();
        }

    } catch (error) {

        console.error(
            "Camera error:",
            error
        );


        if (elements.cameraErrorMsg) {

            elements.cameraErrorMsg.classList.remove(
                "hidden"
            );
        }
    }
}


/* ============================================================
   16. CLOSE CAMERA
   ============================================================ */

function closeCamera() {

    if (state.cameraStream) {

        state.cameraStream
            .getTracks()
            .forEach(track => {

                track.stop();
            });


        state.cameraStream = null;
    }


    if (elements.cameraVideo) {

        elements.cameraVideo.srcObject = null;
    }


    if (elements.cameraModal) {

        elements.cameraModal.classList.add(
            "hidden"
        );
    }
}


/* ============================================================
   17. CAPTURE CAMERA IMAGE
   ============================================================ */

function captureImage() {

    const video =
        elements.cameraVideo;

    const canvas =
        elements.cameraCanvas;


    if (!video ||
        !canvas ||
        !video.srcObject) {

        alert(
            "Camera is unavailable."
        );

        return;
    }


    canvas.width =
        video.videoWidth || 1280;

    canvas.height =
        video.videoHeight || 720;


    const context =
        canvas.getContext("2d");


    context.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
    );


    canvas.toBlob(
        blob => {

            if (!blob) {

                alert(
                    "Could not capture image."
                );

                return;
            }


            const capturedFile =
                new File(
                    [blob],
                    "camera_capture.jpg",
                    {
                        type: "image/jpeg"
                    }
                );


            handleFile(
                capturedFile
            );


            closeCamera();
        },
        "image/jpeg",
        0.9
    );
}


/* ============================================================
   18. MAIN ANALYSIS
   ============================================================ */

async function handleAnalyzeClick() {

    if (!state.selectedFile) {

        alert(
            "Please upload or capture a medicine image first."
        );

        return;
    }


    showLoadingState();


    try {

        let resultData;


        /* ====================================================
           DEMO MODE
           ==================================================== */

        if (state.demoMode) {

            console.log(
                "Running MediGuard in DEMO MODE"
            );


            await runSimulatedPipeline();


            resultData =
                cloneObject(
                    DEMO_PRESETS[
                        state.currentPreset
                    ]
                );
        }


        /* ====================================================
           LIVE MODE
           ==================================================== */

        else {

            console.log(
                "Running MediGuard in LIVE MODE"
            );


            /* -----------------------------------------------
               STEP 1
               IMAGE -> BACKEND ANALYSIS
            ------------------------------------------------ */

            const analysisResult =
                await analyzeMedicine(
                    state.selectedFile
                );


            console.log(
                "Analysis result:",
                analysisResult
            );


            /* -----------------------------------------------
               STEP 2
               BACKEND DATA -> DATABASE VERIFICATION
            ------------------------------------------------ */

            resultData =
                await verifyMedicine(
                    analysisResult
                );


            console.log(
                "Verification result:",
                resultData
            );
        }


        /* ====================================================
           SHOW RESULT
           ==================================================== */

        hideLoadingState();


        showResult(
            resultData
        );


        saveToHistory(
            resultData
        );


    } catch (error) {

        console.error(
            "MediGuard analysis error:",
            error
        );


        hideLoadingState();


        alert(
            error.message ||
            "Medicine analysis failed."
        );
    }
}


/* ============================================================
   19. DEMO PIPELINE ANIMATION
   ============================================================ */

function runSimulatedPipeline() {

    return new Promise(resolve => {

        const steps =
            elements.pipelineSteps;


        if (!steps ||
            steps.length === 0) {

            setTimeout(
                resolve,
                800
            );

            return;
        }


        let currentStep = 0;


        steps.forEach(step => {

            step.classList.remove(
                "active",
                "completed"
            );


            const icon =
                step.querySelector(
                    ".step-icon"
                );


            if (icon) {

                icon.textContent = "○";
            }
        });


        const interval =
            setInterval(() => {


                if (currentStep > 0) {

                    const previousStep =
                        steps[
                            currentStep - 1
                        ];


                    previousStep.classList.remove(
                        "active"
                    );


                    previousStep.classList.add(
                        "completed"
                    );


                    const icon =
                        previousStep.querySelector(
                            ".step-icon"
                        );


                    if (icon) {

                        icon.textContent = "✓";
                    }
                }


                if (
                    currentStep <
                    steps.length
                ) {

                    const current =
                        steps[currentStep];


                    current.classList.add(
                        "active"
                    );


                    const icon =
                        current.querySelector(
                            ".step-icon"
                        );


                    if (icon) {

                        icon.textContent = "●";
                    }


                    currentStep++;

                } else {

                    clearInterval(
                        interval
                    );


                    setTimeout(
                        resolve,
                        400
                    );
                }

            }, 350);
        });
    };



/* ============================================================
   20. LIVE IMAGE ANALYSIS API
   ============================================================ */

async function analyzeMedicine(imageFile) {

    if (!imageFile) {

        throw new Error(
            "No image file selected."
        );
    }


    const formData =
        new FormData();


    formData.append(
        "file",
        imageFile
    );


    console.log(
        "Sending image to:",
        `${API_BASE_URL}/api/v1/analyze-image`
    );


    const response =
        await fetch(
            `${API_BASE_URL}/api/v1/analyze-image`,
            {
                method: "POST",
                body: formData
            }
        );


    if (!response.ok) {

        throw new Error(
            `Image analysis failed. Server returned ${response.status}.`
        );
    }


    const data =
        await response.json();


    console.log(
        "Backend image analysis:",
        data
    );


    if (data.success === false) {

        throw new Error(
            data.message ||
            "Image analysis failed."
        );
    }


    if (!data.medicine_name) {

        throw new Error(
            "The backend did not return a medicine name."
        );
    }


    return data;
}


/* ============================================================
   21. LIVE MEDICINE VERIFICATION API
   ============================================================ */

async function verifyMedicine(data) {

    if (!data) {

        throw new Error(
            "No medicine information received."
        );
    }


    const payload = {

        medicine_name:
            data.medicine_name ||
            data.name ||
            "",

        manufacturer:
            data.manufacturer ||
            "",

        batch_number:
            data.batch_number ||
            "",

        expiry_date:
            data.expiry_date ||
            "",

        barcode:
            data.barcode ||
            ""
    };


    console.log(
        "Sending verification request:",
        payload
    );


    const response =
        await fetch(
            `${API_BASE_URL}/api/v1/verify-medicine`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify(
                        payload
                    )
            }
        );


    if (!response.ok) {

        throw new Error(
            `Medicine verification failed. Server returned ${response.status}.`
        );
    }


    const result =
        await response.json();


    console.log(
        "Database verification:",
        result
    );


    if (
        result.success === false &&
        result.status !== "HIGH_RISK"
    ) {

        throw new Error(
            result.message ||
            "Medicine verification failed."
        );
    }


    return result;
}


/* ============================================================
   22. BACKEND CONNECTION TEST
   ============================================================ */

async function testBackendConnection() {

    try {

        const response =
            await fetch(
                `${API_BASE_URL}/`,
                {
                    method: "GET"
                }
            );


        if (!response.ok) {

            throw new Error(
                `Backend returned ${response.status}`
            );
        }


        const data =
            await response.json();


        console.log(
            "✅ Backend connected:",
            data
        );


    } catch (error) {

        console.warn(
            "⚠️ Backend connection unavailable:",
            error.message
        );

        console.warn(
            "Demo Mode will still work."
        );
    }
}


/* ============================================================
   23. SHOW LOADING
   ============================================================ */

function showLoadingState() {

    if (elements.loadingOverlay) {

        elements.loadingOverlay.classList.remove(
            "hidden"
        );
    }
}


/* ============================================================
   24. HIDE LOADING
   ============================================================ */

function hideLoadingState() {

    if (elements.loadingOverlay) {

        elements.loadingOverlay.classList.add(
            "hidden"
        );
    }
}


/* ============================================================
   25. SHOW RESULT
   ============================================================ */

function showResult(data) {

    if (!data) {

        console.error(
            "No result data."
        );

        return;
    }


    state.activeResult =
        data;


    /* --------------------------------------------------------
       Medicine details
    -------------------------------------------------------- */

    setText(
        elements.resMedName,
        data.medicine_name || "Unknown"
    );


    setText(
        elements.resMedMfg,
        data.manufacturer || "Unknown"
    );


    setText(
        elements.resBatch,
        data.batch_number || "Unknown"
    );


    setText(
        elements.resExpiry,
        data.expiry_date || "Unknown"
    );


    setText(
        elements.resConfidence,
        `${data.confidence ?? 0}%`
    );


    /* --------------------------------------------------------
       Status
    -------------------------------------------------------- */

    if (elements.resStatusContainer) {

        elements.resStatusContainer.innerHTML =
            getStatusPillHTML(
                data.status
            );
    }


    /* --------------------------------------------------------
       Risk gauge
    -------------------------------------------------------- */

    showRiskScore(
        Number(data.risk_score) || 0,
        data.status
    );


    /* --------------------------------------------------------
       Verification checks
    -------------------------------------------------------- */

    showVerificationChecks(
        data.checks || {}
    );


    /* --------------------------------------------------------
       Reasons
    -------------------------------------------------------- */

    renderReasons(
        data.reasons || []
    );


    /* --------------------------------------------------------
       Recommendation
    -------------------------------------------------------- */

    setText(
        elements.resRecText,
        data.recommendation ||
        "Please verify this medicine with an authorized source."
    );


    /* --------------------------------------------------------
       Display result
    -------------------------------------------------------- */

    if (elements.resultSection) {

        elements.resultSection.classList.remove(
            "hidden"
        );


        setTimeout(() => {

            elements.resultSection.scrollIntoView(
                {
                    behavior: "smooth",
                    block: "start"
                }
            );

        }, 100);
    }
}


/* ============================================================
   26. STATUS PILL
   ============================================================ */

function getStatusPillHTML(status) {

    if (status === "LOW_RISK") {

        return `
            <span class="status-pill status-low">

                <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                >

                    <polyline
                        points="20 6 9 17 4 12"
                    />

                </svg>

                LOW RISK

            </span>
        `;
    }


    if (status === "SUSPICIOUS") {

        return `
            <span class="status-pill status-suspicious">

                <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                >

                    <path
                        d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"
                    />

                </svg>

                POTENTIALLY SUSPICIOUS

            </span>
        `;
    }


    return `
        <span class="status-pill status-high">

            <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
            >

                <line
                    x1="18"
                    y1="6"
                    x2="6"
                    y2="18"
                />

                <line
                    x1="6"
                    y1="6"
                    x2="18"
                    y2="18"
                />

            </svg>

            HIGH RISK

        </span>
    `;
}


/* ============================================================
   27. RISK GAUGE
   ============================================================ */

function showRiskScore(score, status) {

    score =
        Math.max(
            0,
            Math.min(
                100,
                Number(score) || 0
            )
        );


    setText(
        elements.resScoreNum,
        score
    );


    const circumference =
        314.15;


    const offset =
        circumference -
        (
            score / 100
        ) *
        circumference;


    if (elements.gaugeCircle) {

        elements.gaugeCircle.style.strokeDashoffset =
            offset;
    }


    if (status === "LOW_RISK") {

        if (elements.gaugeCircle) {

            elements.gaugeCircle.style.stroke =
                "var(--color-risk-low)";
        }


        setText(
            elements.resScoreDesc,
            "All parameters are consistent with the registered medicine record."
        );


    } else if (
        status === "SUSPICIOUS"
    ) {

        if (elements.gaugeCircle) {

            elements.gaugeCircle.style.stroke =
                "var(--color-risk-suspicious)";
        }


        setText(
            elements.resScoreDesc,
            "Some parameter mismatches were detected. Proceed with caution."
        );


    } else {

        if (elements.gaugeCircle) {

            elements.gaugeCircle.style.stroke =
                "var(--color-risk-high)";
        }


        setText(
            elements.resScoreDesc,
            "Critical inconsistencies were detected during verification."
        );
    }
}


/* ============================================================
   28. VERIFICATION CHECKS
   ============================================================ */

function showVerificationChecks(checks) {

    const items = [

        {
            label: "Medicine recognized",
            key: "medicine"
        },

        {
            label: "Manufacturer verified",
            key: "manufacturer"
        },

        {
            label: "Batch verified",
            key: "batch"
        },

        {
            label: "Expiry valid",
            key: "expiry"
        },

        {
            label: "Barcode matched",
            key: "barcode"
        }
    ];


    if (!elements.resChecksList) {
        return;
    }


    elements.resChecksList.innerHTML =
        items.map(item => {

            const passed =
                Boolean(
                    checks[item.key]
                );


            const icon =
                passed
                    ? "✓"
                    : "✗";


            const cssClass =
                passed
                    ? "pass"
                    : "fail";


            return `
                <div class="check-row ${cssClass}">

                    <span>
                        ${icon}
                    </span>

                    <span>
                        ${escapeHTML(item.label)}
                    </span>

                </div>
            `;

        }).join("");
}


/* ============================================================
   29. REASONS
   ============================================================ */

function renderReasons(reasons) {

    if (!elements.resReasonsList) {
        return;
    }


    if (!Array.isArray(reasons) ||
        reasons.length === 0) {

        elements.resReasonsList.innerHTML =
            "<li>No additional verification details.</li>";

        return;
    }


    elements.resReasonsList.innerHTML =
        reasons.map(reason => {

            return `
                <li>
                    ${escapeHTML(String(reason))}
                </li>
            `;

        }).join("");
}


/* ============================================================
   30. VERIFICATION PASSPORT
   ============================================================ */

function showPassport() {

    const data =
        state.activeResult;


    if (!data) {

        alert(
            "No verification result is available."
        );

        return;
    }


    const randomID =
        "VG-" +
        Math.floor(
            10000 +
            Math.random() *
            90000
        );


    setText(
        elements.passId,
        `ID: ${randomID}`
    );


    setText(
        elements.passMed,
        data.medicine_name || "Unknown"
    );


    setText(
        elements.passMfg,
        data.manufacturer || "Unknown"
    );


    setText(
        elements.passBatch,
        data.batch_number || "Unknown"
    );


    setText(
        elements.passExpiry,
        data.expiry_date || "Unknown"
    );


    setText(
        elements.passDate,
        new Date().toLocaleDateString(
            "en-GB",
            {
                day: "numeric",
                month: "long",
                year: "numeric"
            }
        )
    );


    if (elements.passStatusBox) {

        elements.passStatusBox.innerHTML =
            getStatusPillHTML(
                data.status
            );
    }


    const checkLabels = {

        medicine:
            "Medicine ID",

        manufacturer:
            "Manufacturer",

        batch:
            "Batch Registry",

        expiry:
            "Expiry Check",

        barcode:
            "Barcode Matched"
    };


    const checks =
        data.checks || {};


    if (elements.passChipsContainer) {

        elements.passChipsContainer.innerHTML =
            Object.keys(checks)
                .filter(key => checks[key])
                .map(key => {

                    return `
                        <span class="pass-chip">

                            ✓
                            ${escapeHTML(
                                checkLabels[key] || key
                            )}

                        </span>
                    `;

                })
                .join("");
    }


    if (elements.passportModal) {

        elements.passportModal.classList.remove(
            "hidden"
        );
    }
}


/* ============================================================
   31. SHARE PASSPORT
   ============================================================ */

async function sharePassport() {

    const data =
        state.activeResult;


    if (!data) {

        alert(
            "No verification result available."
        );

        return;
    }


    const text =
        `MediGuard Verification Report\n\n` +
        `Medicine: ${data.medicine_name || "Unknown"}\n` +
        `Manufacturer: ${data.manufacturer || "Unknown"}\n` +
        `Batch: ${data.batch_number || "Unknown"}\n` +
        `Status: ${formatStatus(data.status)}\n` +
        `Risk Score: ${data.risk_score ?? "N/A"}/100`;


    if (
        navigator.share
    ) {

        try {

            await navigator.share({

                title:
                    "MediGuard Verification Passport",

                text: text,

                url:
                    window.location.href
            });

        } catch (error) {

            console.log(
                "Share cancelled."
            );
        }

        return;
    }


    try {

        await navigator.clipboard.writeText(
            text
        );


        alert(
            "Verification report copied to clipboard."
        );

    } catch (error) {

        alert(
            text
        );
    }
}


/* ============================================================
   32. HISTORY
   ============================================================ */

function saveToHistory(resultData) {

    if (!resultData) {
        return;
    }


    const historyItem = {

        id:
            Date.now(),

        date:
            new Date().toLocaleDateString(
                "en-GB",
                {
                    day: "numeric",
                    month: "short",
                    year: "numeric"
                }
            ),

        medName:
            resultData.medicine_name ||
            "Unknown Medicine",

        status:
            resultData.status ||
            "HIGH_RISK",

        score:
            Number(
                resultData.risk_score
            ) || 0
    };


    state.history.unshift(
        historyItem
    );


    /* Keep history manageable */

    state.history =
        state.history.slice(
            0,
            50
        );


    try {

        localStorage.setItem(
            "mediguard_history",
            JSON.stringify(
                state.history
            )
        );

    } catch (error) {

        console.warn(
            "Could not save history:",
            error
        );
    }


    renderHistory();
}


/* ============================================================
   33. LOAD HISTORY
   ============================================================ */

function loadHistory() {

    try {

        const stored =
            localStorage.getItem(
                "mediguard_history"
            );


        if (stored) {

            const parsed =
                JSON.parse(
                    stored
                );


            if (Array.isArray(parsed)) {

                state.history =
                    parsed;

            } else {

                state.history =
                    getInitialSeedHistory();
            }

        } else {

            state.history =
                getInitialSeedHistory();
        }

    } catch (error) {

        console.warn(
            "History loading failed:",
            error
        );


        state.history =
            getInitialSeedHistory();
    }


    renderHistory();
}


/* ============================================================
   34. INITIAL HISTORY
   ============================================================ */

function getInitialSeedHistory() {

    return [

        {
            id: 1,
            date: "13 Aug 2026",
            medName: "Paracetamol 500mg",
            status: "LOW_RISK",
            score: 12
        },

        {
            id: 2,
            date: "13 Aug 2026",
            medName: "Amoxicillin 500mg",
            status: "HIGH_RISK",
            score: 78
        },

        {
            id: 3,
            date: "12 Aug 2026",
            medName: "Cetirizine 10mg",
            status: "LOW_RISK",
            score: 8
        }
    ];
}


/* ============================================================
   35. RENDER HISTORY
   ============================================================ */

function renderHistory() {

    const container =
        elements.historyContainer;


    if (!container) {
        return;
    }


    if (
        !state.history ||
        state.history.length === 0
    ) {

        container.innerHTML = `
            <p
                class="text-muted text-center"
                style="grid-column: 1/-1;"
            >
                No scan history found.
            </p>
        `;

        return;
    }


    container.innerHTML =
        state.history.map(item => {

            return `

                <div class="card history-card">

                    <div class="hist-top">

                        <div>

                            <h4 class="hist-title">

                                ${escapeHTML(
                                    item.medName ||
                                    "Unknown Medicine"
                                )}

                            </h4>

                            <span class="hist-date">

                                ${escapeHTML(
                                    item.date ||
                                    ""
                                )}

                            </span>

                        </div>

                        ${getStatusPillHTML(
                            item.status
                        )}

                    </div>


                    <div class="hist-bottom">

                        <span class="meta-lbl">

                            Risk Score:

                        </span>

                        <span class="hist-score">

                            ${Number(
                                item.score
                            ) || 0}

                            / 100

                        </span>

                    </div>

                </div>
            `;

        }).join("");
}


/* ============================================================
   36. CLEAR HISTORY
   ============================================================ */

function clearHistory() {

    state.history = [];


    try {

        localStorage.removeItem(
            "mediguard_history"
        );

    } catch (error) {

        console.warn(
            "Could not clear history:",
            error
        );
    }


    renderHistory();
}


/* ============================================================
   37. HELPERS
   ============================================================ */

function setText(element, value) {

    if (!element) {
        return;
    }


    element.textContent =
        value ?? "";
}


/* ============================================================
   38. HTML ESCAPING
   ============================================================ */

function escapeHTML(value) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


/* ============================================================
   39. FORMAT STATUS
   ============================================================ */

function formatStatus(status) {

    switch (status) {

        case "LOW_RISK":
            return "LOW RISK";

        case "SUSPICIOUS":
            return "POTENTIALLY SUSPICIOUS";

        case "HIGH_RISK":
            return "HIGH RISK";

        default:
            return status || "UNKNOWN";
    }
}


/* ============================================================
   40. CLONE OBJECT
   ============================================================ */

function cloneObject(object) {

    return JSON.parse(
        JSON.stringify(object)
    );
}


/* ============================================================
   41. CLEANUP WHEN PAGE CLOSES
   ============================================================ */

window.addEventListener(
    "beforeunload",
    () => {

        if (state.cameraStream) {

            state.cameraStream
                .getTracks()
                .forEach(track => {

                    track.stop();
                });
        }
    }
);


/* ============================================================
   MEDIGUARD READY
   ============================================================ */

console.log(
    "MediGuard AI JavaScript loaded successfully."
);