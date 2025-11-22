// Compatible configuration
const CONFIG = {
    PBKDF2_ITERATIONS: 310000,
    SALT_LENGTH: 32,
    IV_LENGTH: 16,
    AES_KEY_LENGTH: 256,
    HMAC_KEY_LENGTH: 256,
    HMAC_LENGTH: 32,
    QR_SIZE: 220,
    MIN_PASSPHRASE_LENGTH: 12,
    QR_ERROR_CORRECTION: 'H',
    METADATA_VERSION: 1,
    METADATA_LENGTH: 128,
    MAX_MODIFICATION_COUNT: 255,
    MAX_FAILED_ATTEMPTS: 255,
    // Nuevas configuraciones para el escáner mejorado
    SCAN_INTERVAL: 100, // Reducido para más FPS
    SCAN_REGION_SIZE: 400,
    SCAN_QUALITY: 0.7,
    MAX_SCAN_SIZE: 800
};

// DOM references
const dom = {
    startBtn: document.getElementById('start-btn'),
    scanBtn: document.getElementById('scan-btn'),
    seedModal: document.getElementById('seed-modal'),
    scannerModal: document.getElementById('scanner-modal'),
    closeModal: document.querySelector('.close-modal'),
    cancelBtn: document.getElementById('cancel-btn'),
    seedPhrase: document.getElementById('seed-phrase'),
    wordCounter: document.getElementById('word-counter'),
    toggleVisibility: document.getElementById('toggle-visibility'),
    encryptBtn: document.getElementById('encrypt-btn'),
    password: document.getElementById('password'),
    passwordToggle: document.getElementById('password-toggle'),
    passwordStrengthBar: document.getElementById('password-strength-bar'),
    passwordStrengthText: document.getElementById('password-strength-text'),
    generatePassword: document.getElementById('generate-password'),
    qrContainer: document.getElementById('qr-container'),
    qrCanvas: document.getElementById('qr-canvas'),
    pdfBtn: document.getElementById('pdf-btn'),
    shareBtn: document.getElementById('share-btn'),
    downloadBtn: document.getElementById('download-btn'),
    toastContainer: document.getElementById('toast-container'),
    suggestionsContainer: document.getElementById('bip39-suggestions'),
    dropArea: document.getElementById('drop-area'),
    qrFile: document.getElementById('qr-file'),
    decryptBtn: document.getElementById('decrypt-btn'),
    decryptedModal: document.getElementById('decrypted-modal'),
    decryptedSeed: document.getElementById('decrypted-seed'),
    seedWordsContainer: document.getElementById('seed-words-container'),
    copySeed: document.getElementById('copy-seed'),
    closeDecrypted: document.getElementById('close-decrypted'),
    closeDecryptedBtn: document.getElementById('close-decrypted-btn'),
    wordCount: document.getElementById('word-count'),
    welcomeModal: document.getElementById('welcome-modal'),
    closeWelcome: document.getElementById('close-welcome'),
    acceptWelcome: document.getElementById('accept-welcome'),
    spinnerOverlay: document.getElementById('spinner-overlay'),
    passwordModal: document.getElementById('password-modal'),
    decryptPassword: document.getElementById('decrypt-password'),
    decryptPasswordToggle: document.getElementById('decrypt-password-toggle'),
    decryptSeedBtn: document.getElementById('decrypt-seed-btn'),
    cancelDecryptBtn: document.getElementById('cancel-decrypt-btn'),
    closePasswordModal: document.getElementById('close-password-modal'),
    qrModal: document.getElementById('qr-modal'),
    closeQRModal: document.getElementById('close-qr-modal'),
    cameraStream: document.getElementById('camera-stream'),
    closeScanner: document.getElementById('close-scanner'),
    stopScanBtn: document.getElementById('stop-scan-btn'),
    userMessage: document.getElementById('user-message'),
    messageChars: document.getElementById('message-chars'),
    metadataVersion: document.getElementById('metadata-version'),
    metadataCreated: document.getElementById('metadata-created'),
    metadataModifications: document.getElementById('metadata-modifications'),
    metadataFailedAttempts: document.getElementById('metadata-failed-attempts'),
    metadataLastAttempt: document.getElementById('metadata-last-attempt'),
    userMessageContainer: document.getElementById('user-message-container'),
    metadataUserMessage: document.getElementById('metadata-user-message'),
    updateQrBtn: document.getElementById('update-qr-btn'),
    metadataSection: document.querySelector('.metadata-section'),
    scannerContainer: document.querySelector('.scanner-container'),
    fpsCounter: document.getElementById('fps-counter'),
    frameCounter: document.getElementById('frame-counter')
};

// App state
const appState = {
    wordsVisible: false,
    passwordVisible: false,
    seedPhrase: '',
    password: '',
    encryptedData: '',
    qrImageData: null,
    bip39Wordlist: null,
    currentWordIndex: -1,
    currentWordPartial: '',
    scannerActive: false,
    videoTrack: null,
    scanInterval: null,
    currentMetadata: null,
    failedAttempts: 0,
    lastFailedAttempt: null,
    // Nuevo estado para el escáner mejorado
    scanCanvas: null,
    scanContext: null,
    lastScanTime: 0,
    scanFrameCount: 0,
    adaptiveScanQuality: CONFIG.SCAN_QUALITY,
    isProcessingFrame: false,
    fps: 0,
    lastFpsUpdate: 0,
    scanAttempts: 0
};

// Scanner Manager - Clase mejorada para manejo de escaneo
class ScannerManager {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.lastProcessedTime = 0;
        this.consecutiveFailures = 0;
        this.adaptiveInterval = CONFIG.SCAN_INTERVAL;
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        this.lastScanResult = null;
        this.consecutiveScans = 0;
    }

    async initializeScanner() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera not supported in this browser');
            }

            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    frameRate: { ideal: 30 }
                } 
            });

            appState.videoTrack = stream.getVideoTracks()[0];
            dom.cameraStream.srcObject = stream;
            appState.scannerActive = true;
            
            // Configurar canvas para escaneo
            this.setupScanCanvas();
            
            // Iniciar escaneo mejorado
            this.startEnhancedScanning();
            
            showToast('Camera activated - Point at QR code', 'success');
            return true;
        } catch (error) {
            console.error('Camera initialization error:', error);
            throw error;
        }
    }

    setupScanCanvas() {
        this.canvas.width = CONFIG.SCAN_REGION_SIZE;
        this.canvas.height = CONFIG.SCAN_REGION_SIZE;
    }

    startEnhancedScanning() {
        if (appState.scanInterval) {
            clearInterval(appState.scanInterval);
        }

        // Usar requestAnimationFrame para mejor rendimiento
        const scanLoop = () => {
            if (!appState.scannerActive) return;
            
            this.processVideoFrame();
            appState.scanInterval = requestAnimationFrame(scanLoop);
        };

        appState.scanInterval = requestAnimationFrame(scanLoop);
    }

    async processVideoFrame() {
        if (!appState.scannerActive || appState.isProcessingFrame) {
            return;
        }

        const now = Date.now();
        const video = dom.cameraStream;
        
        if (video.readyState !== video.HAVE_ENOUGH_DATA || video.videoWidth === 0) {
            return;
        }

        appState.isProcessingFrame = true;
        appState.scanFrameCount++;
        this.frameCount++;

        // Actualizar FPS cada segundo
        if (now - this.lastFpsUpdate >= 1000) {
            appState.fps = Math.round(this.frameCount * 1000 / (now - this.lastFpsUpdate));
            this.frameCount = 0;
            this.lastFpsUpdate = now;
            
            if (dom.fpsCounter) {
                dom.fpsCounter.textContent = appState.fps;
            }
            if (dom.frameCounter) {
                dom.frameCounter.textContent = appState.scanFrameCount;
            }
        }

        try {
            // Calcular región de interés optimizada
            const scanRegion = this.calculateOptimizedScanRegion(video);
            
            // Dibujar solo la región de interés
            this.ctx.drawImage(
                video, 
                scanRegion.x, scanRegion.y, scanRegion.width, scanRegion.height,
                0, 0, this.canvas.width, this.canvas.height
            );

            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            
            // Procesamiento optimizado con múltiples estrategias
            const code = await this.enhancedQRDetection(imageData);
            
            if (code) {
                this.handleSuccessfulScan(code.data);
            } else {
                this.handleFailedScan();
            }

        } catch (error) {
            console.error('Frame processing error:', error);
        } finally {
            appState.isProcessingFrame = false;
        }
    }

    calculateOptimizedScanRegion(video) {
        const videoAspect = video.videoWidth / video.videoHeight;
        const targetAspect = 1;
        
        let regionWidth, regionHeight;
        
        // Ajustar región basada en el aspect ratio
        if (videoAspect > targetAspect) {
            regionHeight = Math.min(video.videoHeight * 0.8, 600);
            regionWidth = regionHeight * targetAspect;
        } else {
            regionWidth = Math.min(video.videoWidth * 0.8, 600);
            regionHeight = regionWidth / targetAspect;
        }
        
        return {
            x: (video.videoWidth - regionWidth) / 2,
            y: (video.videoHeight - regionHeight) / 2,
            width: regionWidth,
            height: regionHeight
        };
    }

    async enhancedQRDetection(imageData) {
        let code = null;
        
        // Estrategia 1: Detección normal (más rápida)
        code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
        });

        // Estrategia 2: Con inversión si falla la primera
        if (!code && appState.scanAttempts > 5) {
            code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'onlyInvert',
            });
        }

        // Estrategia 3: Ambas estrategias como último recurso
        if (!code && appState.scanAttempts > 10) {
            code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'attemptBoth',
            });
        }

        // Estrategia 4: Reducir tamaño de imagen si sigue fallando
        if (!code && appState.scanAttempts > 15) {
            const smallerImageData = this.downscaleImage(imageData, 0.5);
            code = jsQR(smallerImageData.data, smallerImageData.width, smallerImageData.height, {
                inversionAttempts: 'attemptBoth',
            });
        }

        return code;
    }

    downscaleImage(imageData, scale) {
        const newWidth = Math.floor(imageData.width * scale);
        const newHeight = Math.floor(imageData.height * scale);
        
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = newWidth;
        tempCanvas.height = newHeight;
        
        // Crear ImageData redimensionado
        const resizedImageData = new ImageData(newWidth, newHeight);
        this.bilinearInterpolation(imageData, resizedImageData);
        
        return resizedImageData;
    }

    bilinearInterpolation(source, target) {
        const xRatio = source.width / target.width;
        const yRatio = source.height / target.height;
        
        for (let y = 0; y < target.height; y++) {
            for (let x = 0; x < target.width; x++) {
                const srcX = x * xRatio;
                const srcY = y * yRatio;
                
                const x1 = Math.floor(srcX);
                const y1 = Math.floor(srcY);
                const x2 = Math.min(x1 + 1, source.width - 1);
                const y2 = Math.min(y1 + 1, source.height - 1);
                
                // Interpolación bilineal
                const idx1 = (y1 * source.width + x1) * 4;
                const idx2 = (y1 * source.width + x2) * 4;
                const idx3 = (y2 * source.width + x1) * 4;
                const idx4 = (y2 * source.width + x2) * 4;
                
                const xFrac = srcX - x1;
                const yFrac = srcY - y1;
                
                const targetIdx = (y * target.width + x) * 4;
                
                for (let i = 0; i < 4; i++) {
                    const top = source.data[idx1 + i] * (1 - xFrac) + source.data[idx2 + i] * xFrac;
                    const bottom = source.data[idx3 + i] * (1 - xFrac) + source.data[idx4 + i] * xFrac;
                    target.data[targetIdx + i] = Math.round(top * (1 - yFrac) + bottom * yFrac);
                }
            }
        }
    }

    handleSuccessfulScan(data) {
        appState.scanAttempts++;
        
        // Verificar si es el mismo código escaneado consecutivamente
        if (this.lastScanResult === data) {
            this.consecutiveScans++;
        } else {
            this.consecutiveScans = 1;
            this.lastScanResult = data;
        }
        
        // Solo procesar si hemos escaneado el mismo código varias veces (evitar falsos positivos)
        if (this.consecutiveScans >= 2) {
            this.consecutiveFailures = 0;
            
            // Verificar que los datos sean válidos
            if (this.isValidEncryptedData(data)) {
                this.stopScanner();
                handleScannedData(data);
            }
        }
    }

    handleFailedScan() {
        appState.scanAttempts++;
        this.consecutiveFailures++;
        this.consecutiveScans = 0;
    }

    isValidEncryptedData(data) {
        try {
            if (!data || typeof data !== 'string') return false;
            
            // Verificar longitud mínima para datos cifrados
            if (data.length < 100) return false;
            
            // Verificar formato base64
            if (!/^[A-Za-z0-9+/]*={0,2}$/.test(data)) return false;
            
            // Intentar decodificar base64
            const binary = atob(data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            
            // Verificar que tenga la estructura básica esperada
            return bytes.length > CONFIG.METADATA_LENGTH + CONFIG.SALT_LENGTH + CONFIG.IV_LENGTH;
        } catch (error) {
            return false;
        }
    }

    stopScanner() {
        if (appState.scanInterval) {
            cancelAnimationFrame(appState.scanInterval);
            appState.scanInterval = null;
        }
        this.consecutiveFailures = 0;
        this.consecutiveScans = 0;
        this.lastScanResult = null;
        appState.scanAttempts = 0;
    }
}

// Instancia global del scanner manager
const scannerManager = new ScannerManager();

// Event Listeners
function initEventListeners() {
    dom.startBtn.addEventListener('click', showSeedModal);
    dom.scanBtn.addEventListener('click', openScannerModal);
    dom.closeModal.addEventListener('click', closeModal);
    dom.cancelBtn.addEventListener('click', closeModal);
    dom.seedPhrase.addEventListener('input', handleSeedInput);
    dom.toggleVisibility.addEventListener('click', toggleVisibility);
    dom.passwordToggle.addEventListener('click', togglePasswordVisibility);
    dom.password.addEventListener('input', updatePasswordStrength);
    dom.generatePassword.addEventListener('click', generateSecurePassword);
    dom.encryptBtn.addEventListener('click', startEncryption);
    dom.pdfBtn.addEventListener('click', generatePDF);
    dom.shareBtn.addEventListener('click', shareQR);
    dom.downloadBtn.addEventListener('click', downloadQRAsPNG);
    dom.dropArea.addEventListener('click', triggerFileSelect);
    dom.qrFile.addEventListener('change', handleFileSelect);
    dom.decryptBtn.addEventListener('click', showPasswordModal);
    dom.copySeed.addEventListener('click', copySeedToClipboard);
    dom.closeDecrypted.addEventListener('click', closeDecryptedModal);
    dom.closeDecryptedBtn.addEventListener('click', closeDecryptedModal);
    dom.closeWelcome.addEventListener('click', closeWelcomeModal);
    dom.acceptWelcome.addEventListener('click', closeWelcomeModal);
    dom.decryptSeedBtn.addEventListener('click', decryptQR);
    dom.cancelDecryptBtn.addEventListener('click', closePasswordModal);
    dom.closePasswordModal.addEventListener('click', closePasswordModal);
    dom.decryptPasswordToggle.addEventListener('click', toggleDecryptPasswordVisibility);
    dom.closeQRModal.addEventListener('click', closeQRModal);
    
    // Scanner events
    dom.closeScanner.addEventListener('click', closeScannerModal);
    dom.stopScanBtn.addEventListener('click', closeScannerModal);
    
    // Drag and drop
    dom.dropArea.addEventListener('dragover', handleDragOver);
    dom.dropArea.addEventListener('dragleave', handleDragLeave);
    dom.dropArea.addEventListener('drop', handleDrop);
    
    // Suggestions
    document.addEventListener('click', closeSuggestionsOutside);
    
    // Online/offline
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // User message
    if (dom.userMessage) {
        dom.userMessage.addEventListener('input', updateMessageCounter);
    }
    if (dom.updateQrBtn) {
        dom.updateQrBtn.addEventListener('click', showUpdateModal);
    }

    // Camera ready event
    if (dom.cameraStream) {
        dom.cameraStream.addEventListener('loadedmetadata', handleCameraReady);
    }
}

function handleCameraReady() {
    console.log('Camera ready, video dimensions:', 
        dom.cameraStream.videoWidth, 'x', dom.cameraStream.videoHeight);
}

// Scanner functions mejoradas
async function openScannerModal() {
    try {
        dom.scannerModal.style.display = 'flex';
        
        // Resetear estadísticas
        appState.scanFrameCount = 0;
        appState.scanAttempts = 0;
        
        // Pequeño delay para asegurar que el modal esté visible
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await scannerManager.initializeScanner();
        
    } catch (err) {
        console.error('Scanner initialization error:', err);
        showToast('Could not access camera: ' + err.message, 'error');
        closeScannerModal();
    }
}

function closeScannerModal() {
    scannerManager.stopScanner();
    
    if (appState.videoTrack) {
        appState.videoTrack.stop();
        appState.videoTrack = null;
    }
    
    appState.scannerActive = false;
    dom.scannerModal.style.display = 'none';
    
    // Clear video stream
    if (dom.cameraStream.srcObject) {
        dom.cameraStream.srcObject = null;
    }
    
    // Resetear estado del escáner
    appState.isProcessingFrame = false;
    appState.scanFrameCount = 0;
    appState.fps = 0;
}

// Modal functions
function showSeedModal() {
    dom.seedModal.style.display = 'flex';
    dom.seedPhrase.focus();
}

function closeModal() {
    dom.seedModal.style.display = 'none';
    resetModalState();
}

function resetModalState() {
    dom.seedPhrase.value = '';
    dom.password.value = '';
    if (dom.userMessage) dom.userMessage.value = '';
    if (dom.messageChars) dom.messageChars.textContent = '0';
    dom.wordCounter.textContent = '0 words';
    appState.wordsVisible = false;
    appState.passwordVisible = false;
    dom.seedPhrase.type = 'password';
    dom.password.type = 'password';
    dom.toggleVisibility.innerHTML = '<i class="fas fa-eye"></i>';
    dom.passwordToggle.innerHTML = '<i class="fas fa-eye"></i>';
    dom.passwordStrengthBar.style.width = '0%';
    dom.passwordStrengthText.textContent = 'Security: Very weak';
    dom.encryptBtn.disabled = true;
    hideSuggestions();
}

// Seed input handling
function handleSeedInput() {
    const words = dom.seedPhrase.value.trim().split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;
    
    dom.wordCounter.textContent = `${wordCount} words`;
    dom.encryptBtn.disabled = ![12, 18, 24].includes(wordCount);
    appState.seedPhrase = dom.seedPhrase.value;
    
    // Find current word
    const cursorPosition = dom.seedPhrase.selectionStart;
    const text = dom.seedPhrase.value;
    let charCount = 0;
    
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const wordStart = text.indexOf(word, charCount);
        const wordEnd = wordStart + word.length;
        
        if (cursorPosition >= wordStart && cursorPosition <= wordEnd) {
            appState.currentWordIndex = i;
            appState.currentWordPartial = word;
            
            if (word.length > 1) {
                showBIP39Suggestions(word);
            } else {
                hideSuggestions();
            }
            break;
        }
        charCount += word.length + 1;
    }
}

function toggleVisibility() {
    appState.wordsVisible = !appState.wordsVisible;
    dom.seedPhrase.type = appState.wordsVisible ? 'text' : 'password';
    dom.toggleVisibility.innerHTML = appState.wordsVisible ? 
        '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
}

function togglePasswordVisibility() {
    appState.passwordVisible = !appState.passwordVisible;
    dom.password.type = appState.passwordVisible ? 'text' : 'password';
    dom.passwordToggle.innerHTML = appState.passwordVisible ? 
        '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
}

function toggleDecryptPasswordVisibility() {
    const isVisible = dom.decryptPassword.type === 'text';
    dom.decryptPassword.type = isVisible ? 'password' : 'text';
    dom.decryptPasswordToggle.innerHTML = isVisible ? 
        '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
}

// Password strength
function updatePasswordStrength() {
    const strength = calculatePasswordStrength(dom.password.value);
    dom.passwordStrengthBar.style.width = `${strength}%`;
    updatePasswordStrengthText(strength);
}

function calculatePasswordStrength(password) {
    if (!password) return 0;
    
    let strength = 0;
    strength += Math.min(password.length * 4, 40);
    if (/[A-Z]/.test(password)) strength += 10;
    if (/[a-z]/.test(password)) strength += 10;
    if (/[0-9]/.test(password)) strength += 10;
    if (/[^A-Za-z0-9]/.test(password)) strength += 15;
    
    return Math.max(0, Math.min(100, strength));
}

function updatePasswordStrengthText(strength) {
    const levels = [
        {min: 0, text: 'Very weak'},
        {min: 20, text: 'Weak'},
        {min: 40, text: 'Moderate'},
        {min: 60, text: 'Strong'},
        {min: 80, text: 'Very strong'}
    ];
    
    const level = levels.reverse().find(l => strength >= l.min)?.text || 'Very weak';
    dom.passwordStrengthText.textContent = `Security: ${level}`;
}

function generateSecurePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=';
    let password = '';
    
    for (let i = 0; i < 16; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Ensure complexity
    if (!/[A-Z]/.test(password)) password = 'A' + password.slice(1);
    if (!/[a-z]/.test(password)) password = password.slice(0, -1) + 'a';
    if (!/[0-9]/.test(password)) password = password.slice(0, -1) + '1';
    if (!/[^A-Za-z0-9]/.test(password)) password = password.slice(0, -1) + '!';
    
    dom.password.value = password;
    updatePasswordStrength();
    showToast('Secure password generated', 'success');
}

// BIP39 suggestions
function showBIP39Suggestions(partialWord) {
    if (!appState.bip39Wordlist || partialWord.length < 2) {
        hideSuggestions();
        return;
    }
    
    const lowerPartial = partialWord.toLowerCase();
    const suggestions = appState.bip39Wordlist
        .filter(word => word.toLowerCase().startsWith(lowerPartial))
        .slice(0, 5);
    
    if (suggestions.length === 0) {
        hideSuggestions();
        return;
    }
    
    dom.suggestionsContainer.innerHTML = '';
    suggestions.forEach(word => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.innerHTML = `<i class="fas fa-lightbulb"></i> ${word}`;
        item.addEventListener('click', () => selectSuggestion(word));
        dom.suggestionsContainer.appendChild(item);
    });
    
    dom.suggestionsContainer.style.display = 'block';
}

function hideSuggestions() {
    dom.suggestionsContainer.style.display = 'none';
}

function selectSuggestion(word) {
    const words = dom.seedPhrase.value.trim().split(/\s+/);
    if (appState.currentWordIndex >= 0 && appState.currentWordIndex < words.length) {
        words[appState.currentWordIndex] = word;
        dom.seedPhrase.value = words.join(' ');
        const event = new Event('input', { bubbles: true });
        dom.seedPhrase.dispatchEvent(event);
    }
    hideSuggestions();
}

function closeSuggestionsOutside(e) {
    if (!dom.seedPhrase.contains(e.target) && !dom.suggestionsContainer.contains(e.target)) {
        hideSuggestions();
    }
}

// Message counter for metadata
function updateMessageCounter() {
    const length = dom.userMessage.value.length;
    dom.messageChars.textContent = length;
    
    if (length > 200) {
        dom.messageChars.style.color = 'var(--warning-color)';
    } else if (length > 100) {
        dom.messageChars.style.color = 'var(--accent-color)';
    } else {
        dom.messageChars.style.color = '#666';
    }
}

// Encryption with metadata
async function startEncryption() {
    if (!validateInputs()) return;
    
    try {
        showSpinner(true);
        
        // Mostrar progreso de HMAC
        showToast('Generating derived keys...', 'info');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        showToast('Calculating HMAC for integrity...', 'info');
        
        const words = appState.seedPhrase.trim().split(/\s+/);
        if (![12, 18, 24].includes(words.length)) {
            throw new Error('Seed phrase must contain 12, 18 or 24 words');
        }
        
        const seedData = words.join(' ');
        const userMessage = dom.userMessage ? dom.userMessage.value : '';
        const encrypted = await cryptoUtils.encryptMessage(seedData, appState.password, userMessage);
        appState.encryptedData = encrypted;
        
        // Mostrar confirmación de HMAC
        showToast('✓ HMAC generated - Integrity verified', 'success');
        await new Promise(resolve => setTimeout(resolve, 800));
        
        await generateQR(encrypted);
        
        closeModal();
        dom.qrModal.style.display = 'flex';
        showToast('Seed encrypted with HMAC verification', 'success');
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        showSpinner(false);
    }
}

function validateInputs() {
    const words = appState.seedPhrase.trim().split(/\s+/);
    
    if (![12, 18, 24].includes(words.length)) {
        showToast('Seed phrase must contain 12, 18 or 24 words', 'error');
        return false;
    }
    
    if (appState.bip39Wordlist) {
        const invalidWords = words.filter(word => !appState.bip39Wordlist.includes(word));
        if (invalidWords.length > 0) {
            showToast(`Invalid words: ${invalidWords.slice(0, 5).join(', ')}${invalidWords.length > 5 ? '...' : ''}`, 'error');
            return false;
        }
    }
    
    if (dom.password.value.length < CONFIG.MIN_PASSPHRASE_LENGTH) {
        showToast(`Password must be at least ${CONFIG.MIN_PASSPHRASE_LENGTH} characters`, 'error');
        return false;
    }
    
    const strength = calculatePasswordStrength(dom.password.value);
    if (strength < 40) {
        showToast('Password is too weak. Please use a stronger one.', 'warning');
        return false;
    }
    
    appState.password = dom.password.value;
    return true;
}

async function generateQR(data) {
    return new Promise((resolve) => {
        const qrSize = CONFIG.QR_SIZE;
        dom.qrCanvas.width = qrSize;
        dom.qrCanvas.height = qrSize;
        
        QRCode.toCanvas(
            dom.qrCanvas,
            data,
            {
                width: qrSize,
                margin: 2,
                color: { dark: '#000000', light: '#ffffff' },
                errorCorrectionLevel: CONFIG.QR_ERROR_CORRECTION
            },
            (error) => {
                if (error) console.error('QR generation error:', error);
                resolve();
            }
        );
    });
}

// QR export functions
function generatePDF() {
    if (!appState.encryptedData) {
        showToast('First generate a QR code', 'error');
        return;
    }
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a5'
        });
        
        const pageWidth = doc.internal.pageSize.getWidth();
        const centerX = pageWidth / 2;
        
        // Background
        doc.setFillColor(245, 245, 245);
        doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), 'F');
        
        // Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(40, 40, 40);
        doc.text('Secure Seed Backup', centerX, 25, null, null, 'center');
        
        // Subtitle
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(100, 100, 100);
        doc.text('Encrypted with AES-256-GCM + HMAC-SHA256', centerX, 32, null, null, 'center');
        
        // QR code with border
        const qrSize = 80;
        const qrDataUrl = dom.qrCanvas.toDataURL('image/png');
        const qrX = centerX - (qrSize / 2);
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(qrX - 10, 40, qrSize + 20, qrSize + 30, 3, 3, 'S');
        doc.addImage(qrDataUrl, 'PNG', qrX, 50, qrSize, qrSize);
        
        // Security note
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text('Store this securely. Password required for decryption.', 
                centerX, 50 + qrSize + 20, null, null, 'center');
        
        // Footer
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Generated by MnemoniQR • ${new Date().toLocaleDateString()}`, 
                centerX, doc.internal.pageSize.getHeight() - 10, null, null, 'center');
        
        doc.save(`mnemoniqr-backup-${Date.now()}.pdf`);
        showToast('PDF generated successfully', 'success');
    } catch (error) {
        console.error('PDF generation error:', error);
        showToast('Error generating PDF', 'error');
    }
}

async function shareQR() {
    if (!appState.encryptedData) {
        showToast('First generate a QR code', 'error');
        return;
    }
    
    try {
        // Convert canvas to blob
        dom.qrCanvas.toBlob(async blob => {
            if (isTelegram()) {
                // In Telegram: use downloadFile method
                const file = new File([blob], `mnemoniqr-${Date.now()}.png`, {
                    type: 'image/png'
                });
                Telegram.WebApp.downloadFile(file);
                showToast('QR saved. You can now share it.', 'success');
            } else {
                // In browsers: use Web Share API or clipboard
                if (navigator.share) {
                    try {
                        await navigator.share({
                            title: 'Secure Seed Backup',
                            files: [new File([blob], 'seed-backup.png', { type: 'image/png' })]
                        });
                    } catch (err) {
                        if (err.name !== 'AbortError') {
                            throw err;
                        }
                    }
                } else {
                    // Fallback: copy to clipboard
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    showToast('QR copied to clipboard', 'success');
                }
            }
        });
    } catch (error) {
        console.error('Sharing error:', error);
        showToast('Error sharing QR: ' + error.message, 'error');
    }
}

function downloadQRAsPNG() {
    if (!appState.encryptedData) {
        showToast('First generate a QR code', 'error');
        return;
    }
    
    try {
        const link = document.createElement('a');
        link.download = `mnemoniqr-${Date.now()}.png`;
        link.href = dom.qrCanvas.toDataURL('image/png');
        link.click();
        showToast('QR downloaded successfully', 'success');
    } catch (error) {
        console.error('Download error:', error);
        showToast('Error downloading QR', 'error');
    }
}

// Decryption functions
function triggerFileSelect() {
    dom.qrFile.click();
}

async function handleFileSelect(e) {
    if (e.target.files.length) {
        await handleFile(e.target.files[0]);
    }
}

function handleDragOver(e) {
    e.preventDefault();
    dom.dropArea.classList.add('drag-over');
}

function handleDragLeave() {
    dom.dropArea.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    dom.dropArea.classList.remove('drag-over');
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
}

async function handleFile(file) {
    if (!file.type.match('image.*')) {
        showToast('Please select an image file', 'error');
        return;
    }
    
    try {
        showSpinner(true);
        showToast('Processing image...', 'info');
        
        const result = await readQRFromImageFile(file);
        
        if (result) {
            appState.qrImageData = result.dataUrl;
            appState.encryptedData = result.qrData;
            
            showToast('QR code loaded successfully', 'success');
            showPasswordModal();
        } else {
            showToast('No QR code found in the image', 'error');
        }
    } catch (error) {
        console.error('File processing error:', error);
        showToast('Error processing image: ' + error.message, 'error');
    } finally {
        showSpinner(false);
    }
}

// Función mejorada para leer QR desde archivo de imagen
async function readQRFromImageFile(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();
        
        reader.onload = function(e) {
            img.onload = function() {
                try {
                    // Crear canvas para procesamiento
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Calcular tamaño óptimo para detección
                    const maxSize = CONFIG.MAX_SCAN_SIZE;
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > maxSize || height > maxSize) {
                        const ratio = Math.min(maxSize / width, maxSize / height);
                        width = Math.floor(width * ratio);
                        height = Math.floor(height * ratio);
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    // Dibujar imagen redimensionada
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Procesar con diferentes estrategias
                    const imageData = ctx.getImageData(0, 0, width, height);
                    let code = null;
                    
                    // Estrategia 1: Detección normal
                    code = jsQR(imageData.data, width, height, {
                        inversionAttempts: 'dontInvert'
                    });
                    
                    // Estrategia 2: Con inversión
                    if (!code) {
                        code = jsQR(imageData.data, width, height, {
                            inversionAttempts: 'onlyInvert'
                        });
                    }
                    
                    // Estrategia 3: Ambas estrategias
                    if (!code) {
                        code = jsQR(imageData.data, width, height, {
                            inversionAttempts: 'attemptBoth'
                        });
                    }
                    
                    // Estrategia 4: Reducir tamaño
                    if (!code) {
                        const smallerWidth = Math.floor(width * 0.5);
                        const smallerHeight = Math.floor(height * 0.5);
                        const tempCanvas = document.createElement('canvas');
                        const tempCtx = tempCanvas.getContext('2d');
                        tempCanvas.width = smallerWidth;
                        tempCanvas.height = smallerHeight;
                        tempCtx.drawImage(img, 0, 0, smallerWidth, smallerHeight);
                        const smallerImageData = tempCtx.getImageData(0, 0, smallerWidth, smallerHeight);
                        code = jsQR(smallerImageData.data, smallerWidth, smallerHeight, {
                            inversionAttempts: 'attemptBoth'
                        });
                    }
                    
                    if (code) {
                        resolve({
                            qrData: code.data,
                            dataUrl: e.target.result
                        });
                    } else {
                        resolve(null);
                    }
                } catch (error) {
                    reject(error);
                }
            };
            
            img.onerror = function() {
                reject(new Error('Failed to load image'));
            };
            
            img.src = e.target.result;
        };
        
        reader.onerror = function() {
            reject(new Error('Failed to read file'));
        };
        
        reader.readAsDataURL(file);
    });
}

function showPasswordModal() {
    if (!appState.encryptedData && !appState.qrImageData) {
        showToast('First load a QR code', 'error');
        return;
    }
    dom.passwordModal.style.display = 'flex';
    dom.decryptPassword.focus();
}

function closePasswordModal() {
    dom.passwordModal.style.display = 'none';
    dom.decryptPassword.value = '';
}

function closeDecryptedModal() {
    dom.decryptedModal.style.display = 'none';
    dom.decryptedSeed.value = '';
    appState.seedPhrase = '';
    appState.currentMetadata = null;
}

function closeWelcomeModal() {
    dom.welcomeModal.style.display = 'none';
}

function closeQRModal() {
    dom.qrModal.style.display = 'none';
    clearQRData();
}

function clearQRData() {
    // Clear canvas
    const ctx = dom.qrCanvas.getContext('2d');
    ctx.clearRect(0, 0, dom.qrCanvas.width, dom.qrCanvas.height);
    
    // Clear sensitive data
    appState.encryptedData = '';
    appState.password = '';
    appState.currentMetadata = null;
}

async function handleScannedData(encryptedBase64) {
    closeScannerModal();
    
    // Validar datos escaneados
    if (!scannerManager.isValidEncryptedData(encryptedBase64)) {
        showToast('Invalid QR code format', 'error');
        return;
    }
    
    appState.qrImageData = null;
    appState.encryptedData = encryptedBase64;
    showToast('QR code scanned successfully', 'success');
    
    // Pequeño delay antes de mostrar el modal de contraseña
    await new Promise(resolve => setTimeout(resolve, 300));
    showPasswordModal();
}

// Mejora en la función de decryptQR para mejor manejo de errores
async function decryptQR() {
    try {
        if (!appState.encryptedData && !appState.qrImageData) {
            throw new Error('First load a QR code');
        }

        let encryptedData = appState.encryptedData;
        
        // Si tenemos imagen pero no datos cifrados, escanear la imagen
        if (appState.qrImageData && !encryptedData) {
            showToast('Processing QR image...', 'info');
            const result = await readQRFromImageDataURL(appState.qrImageData);
            
            if (!result) {
                throw new Error('Could not read QR code from image');
            }
            encryptedData = result;
        }
        
        const password = dom.decryptPassword.value;
        if (!password) {
            throw new Error('Password is required');
        }
        
        showSpinner(true);
        showToast('Verifying HMAC integrity...', 'info');
        
        const decryptedResult = await cryptoUtils.decryptMessage(encryptedData, password);
        
        showToast('✓ HMAC verified - Data integrity confirmed', 'success');
        
        if (appState.failedAttempts > 0) {
            showToast(`Updating QR after ${appState.failedAttempts} failed attempts`, 'warning');
            await updateQRAfterFailedAttempts(decryptedResult.seed, decryptedResult.metadata);
        } else {
            showDecryptedSeed(decryptedResult.seed, decryptedResult.metadata);
        }
        
        closePasswordModal();
        
    } catch (error) {
        if (error.message.includes('HMAC')) {
            appState.failedAttempts++;
            appState.lastFailedAttempt = new Date();
            showToast(`❌ HMAC Error: Wrong password (Attempt ${appState.failedAttempts})`, 'error');
        } else {
            showToast(`Error: ${error.message}`, 'error');
        }
    } finally {
        showSpinner(false);
    }
}

// Función auxiliar para leer QR desde Data URL
async function readQRFromImageDataURL(dataUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Redimensionar para mejor detección
            const maxSize = CONFIG.MAX_SCAN_SIZE;
            let width = img.width;
            let height = img.height;
            
            if (width > maxSize || height > maxSize) {
                const ratio = Math.min(maxSize / width, maxSize / height);
                width = Math.floor(width * ratio);
                height = Math.floor(height * ratio);
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            const imageData = ctx.getImageData(0, 0, width, height);
            const code = jsQR(imageData.data, width, height, {
                inversionAttempts: 'attemptBoth'
            });
            
            resolve(code ? code.data : null);
        };
        img.src = dataUrl;
    });
}

async function updateQRAfterFailedAttempts(seedPhrase, originalMetadata) {
    try {
        showSpinner(true);
        showToast('Updating QR with new attempt counter...', 'info');
        
        // Crear nuevos metadatos con el contador de intentos fallidos
        const newMetadata = {
            ...originalMetadata,
            modificationCount: originalMetadata.modificationCount + 1,
            failedAttempts: appState.failedAttempts,
            lastFailedAttempt: appState.lastFailedAttempt,
            userMessage: originalMetadata.userMessage
        };
        
        // Recifrar con nuevos metadatos
        const encrypted = await cryptoUtils.encryptMessageWithMetadata(
            seedPhrase, 
            appState.password, 
            newMetadata
        );
        
        appState.encryptedData = encrypted;
        appState.failedAttempts = 0;
        
        // Regenerar QR
        await generateQR(encrypted);
        
        showDecryptedSeed(seedPhrase, newMetadata);
        showToast(`QR updated successfully (Modification #${newMetadata.modificationCount})`, 'success');
        
    } catch (error) {
        console.error('Error updating QR:', error);
        showToast('Error updating QR, showing original data', 'warning');
        showDecryptedSeed(seedPhrase, originalMetadata);
    } finally {
        showSpinner(false);
    }
}

function showDecryptedSeed(seedPhrase, metadata) {
    const words = seedPhrase.split(' ');
    const wordCount = words.length;
    
    dom.decryptedSeed.value = seedPhrase;
    dom.wordCount.textContent = `${wordCount} words`;
    
    dom.seedWordsContainer.innerHTML = '';
    words.forEach((word, index) => {
        const wordEl = document.createElement('div');
        wordEl.className = 'seed-word';
        wordEl.textContent = word;
        wordEl.setAttribute('data-index', index + 1);
        dom.seedWordsContainer.appendChild(wordEl);
    });
    
    // Mostrar metadatos
    if (metadata) {
        showMetadataInDecrypted(metadata);
        appState.currentMetadata = metadata;
    }
    
    // Mostrar botón de actualización si hay intentos fallidos
    if (appState.failedAttempts > 0) {
        dom.updateQrBtn.style.display = 'inline-flex';
        dom.updateQrBtn.innerHTML = `<i class="fas fa-sync-alt"></i> Update QR (${appState.failedAttempts} failed attempts)`;
    } else {
        dom.updateQrBtn.style.display = 'none';
    }
    
    dom.decryptedModal.style.display = 'flex';
}

function showMetadataInDecrypted(metadata) {
    if (!dom.metadataVersion) return;
    
    dom.metadataVersion.textContent = metadata.version;
    dom.metadataCreated.textContent = metadata.timestamp.toLocaleString();
    dom.metadataModifications.textContent = metadata.modificationCount;
    
    // Mostrar intentos fallidos si existen
    if (metadata.failedAttempts > 0) {
        dom.metadataFailedAttempts.textContent = metadata.failedAttempts;
        dom.metadataFailedAttempts.parentElement.style.display = 'flex';
        
        if (metadata.lastFailedAttempt) {
            const lastAttempt = new Date(metadata.lastFailedAttempt);
            dom.metadataLastAttempt.textContent = lastAttempt.toLocaleString();
            dom.metadataLastAttempt.parentElement.style.display = 'flex';
        }
    } else {
        dom.metadataFailedAttempts.parentElement.style.display = 'none';
        dom.metadataLastAttempt.parentElement.style.display = 'none';
    }
    
    // Mostrar mensaje de usuario si existe
    if (metadata.userMessage && metadata.userMessage.length > 0) {
        dom.userMessageContainer.style.display = 'flex';
        dom.metadataUserMessage.textContent = metadata.userMessage;
    } else {
        dom.userMessageContainer.style.display = 'none';
    }
    
    // Mostrar advertencia si hay muchas modificaciones
    const existingWarning = dom.metadataSection.querySelector('.high-modification-warning');
    if (existingWarning) {
        existingWarning.remove();
    }
    
    if (metadata.modificationCount > 10) {
        const warning = document.createElement('div');
        warning.className = 'high-modification-warning';
        warning.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <strong>High modification count:</strong> This QR has been updated 
            ${metadata.modificationCount} times. Consider creating a new one for maximum security.
        `;
        dom.metadataSection.appendChild(warning);
    }
    
    // Mostrar advertencia si hay muchos intentos fallidos
    if (metadata.failedAttempts > 5) {
        const warning = document.createElement('div');
        warning.className = 'high-modification-warning';
        warning.style.background = 'rgba(231, 76, 60, 0.1)';
        warning.style.borderLeftColor = 'var(--error-color)';
        warning.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <strong>Security Alert:</strong> ${metadata.failedAttempts} failed decryption attempts detected. 
            Ensure you are in a secure environment.
        `;
        dom.metadataSection.appendChild(warning);
    }
}

function copySeedToClipboard() {
    dom.decryptedSeed.select();
    document.execCommand('copy');
    showToast('Seed copied to clipboard', 'success');
}

// Update QR function
async function updateEncryptedQR(newSeedPhrase, newUserMessage = "") {
    if (!appState.encryptedData) {
        throw new Error('No encrypted data available');
    }
    
    try {
        showSpinner(true);
        
        // Descifrar datos existentes
        const decryptedResult = await cryptoUtils.decryptMessage(
            appState.encryptedData, 
            appState.password
        );
        
        // Crear nuevos metadatos incrementando el contador
        const currentMetadata = decryptedResult.metadata;
        const newMetadata = {
            ...currentMetadata,
            modificationCount: Math.min(
                currentMetadata.modificationCount + 1, 
                CONFIG.MAX_MODIFICATION_COUNT
            ),
            userMessage: newUserMessage,
            userMessageLength: Math.min(newUserMessage.length, 255),
            failedAttempts: 0,
            lastFailedAttempt: null
        };
        
        // Recifrar con nuevos metadatos
        const encrypted = await cryptoUtils.encryptMessageWithMetadata(
            newSeedPhrase, 
            appState.password, 
            newMetadata
        );
        
        appState.encryptedData = encrypted;
        
        // Regenerar QR
        await generateQR(encrypted);
        
        showToast(`QR updated successfully (Modification #${newMetadata.modificationCount})`, 'success');
        return true;
        
    } catch (error) {
        showToast(`Update failed: ${error.message}`, 'error');
        throw error;
    } finally {
        showSpinner(false);
    }
}

function showUpdateModal() {
    showToast('Update functionality coming soon', 'info');
}

// Crypto utilities with enhanced metadata support
const cryptoUtils = {
    async encryptMessage(message, passphrase, userMessage = "") {
        if (!message || !passphrase) {
            throw new Error('Message and password are required');
        }
        
        if (passphrase.length < CONFIG.MIN_PASSPHRASE_LENGTH) {
            throw new Error(`Password must be at least ${CONFIG.MIN_PASSPHRASE_LENGTH} characters`);
        }
        
        // Crear metadatos
        const metadata = this.createMetadata(userMessage);
        
        const dataToEncrypt = new TextEncoder().encode(message);
        const salt = crypto.getRandomValues(new Uint8Array(CONFIG.SALT_LENGTH));
        const iv = crypto.getRandomValues(new Uint8Array(CONFIG.IV_LENGTH));
        
        const baseKey = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(passphrase),
            { name: 'PBKDF2' },
            false,
            ['deriveBits']
        );
        
        const derivedBits = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt,
                iterations: CONFIG.PBKDF2_ITERATIONS,
                hash: 'SHA-256'
            },
            baseKey,
            CONFIG.AES_KEY_LENGTH + CONFIG.HMAC_KEY_LENGTH
        );
        
        const derivedBitsArray = new Uint8Array(derivedBits);
        const aesKeyBytes = derivedBitsArray.slice(0, CONFIG.AES_KEY_LENGTH / 8);
        const hmacKeyBytes = derivedBitsArray.slice(CONFIG.AES_KEY_LENGTH / 8);
        
        const aesKey = await crypto.subtle.importKey(
            'raw',
            aesKeyBytes,
            { name: 'AES-GCM' },
            false,
            ['encrypt']
        );
        
        const hmacKey = await crypto.subtle.importKey(
            'raw',
            hmacKeyBytes,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv, tagLength: 128 },
            aesKey,
            dataToEncrypt
        );
        
        const ciphertext = new Uint8Array(encrypted);
        
        // Generar HMAC
        const hmac = await crypto.subtle.sign('HMAC', hmacKey, ciphertext);
        const hmacArray = new Uint8Array(hmac);
        
        console.log('HMAC generated:', {
            length: hmacArray.length,
            firstBytes: Array.from(hmacArray.slice(0, 4)),
            purpose: 'Data integrity and authentication'
        });
        
        // Combinar: metadatos + salt + iv + ciphertext + hmac
        const combined = new Uint8Array([
            ...this.serializeMetadata(metadata),
            ...salt,
            ...iv,
            ...ciphertext,
            ...hmacArray
        ]);
        
        return btoa(String.fromCharCode(...combined));
    },
    
    async encryptMessageWithMetadata(message, passphrase, metadata) {
        const dataToEncrypt = new TextEncoder().encode(message);
        const salt = crypto.getRandomValues(new Uint8Array(CONFIG.SALT_LENGTH));
        const iv = crypto.getRandomValues(new Uint8Array(CONFIG.IV_LENGTH));
        
        const baseKey = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(passphrase),
            { name: 'PBKDF2' },
            false,
            ['deriveBits']
        );
        
        const derivedBits = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt,
                iterations: CONFIG.PBKDF2_ITERATIONS,
                hash: 'SHA-256'
            },
            baseKey,
            CONFIG.AES_KEY_LENGTH + CONFIG.HMAC_KEY_LENGTH
        );
        
        const derivedBitsArray = new Uint8Array(derivedBits);
        const aesKeyBytes = derivedBitsArray.slice(0, CONFIG.AES_KEY_LENGTH / 8);
        const hmacKeyBytes = derivedBitsArray.slice(CONFIG.AES_KEY_LENGTH / 8);
        
        const aesKey = await crypto.subtle.importKey(
            'raw',
            aesKeyBytes,
            { name: 'AES-GCM' },
            false,
            ['encrypt']
        );
        
        const hmacKey = await crypto.subtle.importKey(
            'raw',
            hmacKeyBytes,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv, tagLength: 128 },
            aesKey,
            dataToEncrypt
        );
        
        const ciphertext = new Uint8Array(encrypted);
        const hmac = await crypto.subtle.sign('HMAC', hmacKey, ciphertext);
        
        const combined = new Uint8Array([
            ...this.serializeMetadata(metadata),
            ...salt,
            ...iv,
            ...ciphertext,
            ...new Uint8Array(hmac)
        ]);
        
        return btoa(String.fromCharCode(...combined));
    },
    
    async decryptMessage(encryptedBase64, passphrase) {
        const encryptedData = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
        
        // Extraer metadatos
        const metadataBytes = encryptedData.slice(0, CONFIG.METADATA_LENGTH);
        const metadata = this.deserializeMetadata(metadataBytes);
        
        if (!metadata.isValid) {
            throw new Error('Invalid metadata format - possibly corrupted file');
        }
        
        // Extraer resto de componentes
        const dataOffset = CONFIG.METADATA_LENGTH;
        const salt = encryptedData.slice(dataOffset, dataOffset + CONFIG.SALT_LENGTH);
        const iv = encryptedData.slice(
            dataOffset + CONFIG.SALT_LENGTH, 
            dataOffset + CONFIG.SALT_LENGTH + CONFIG.IV_LENGTH
        );
        const ciphertext = encryptedData.slice(
            dataOffset + CONFIG.SALT_LENGTH + CONFIG.IV_LENGTH, 
            encryptedData.length - CONFIG.HMAC_LENGTH
        );
        const hmac = encryptedData.slice(encryptedData.length - CONFIG.HMAC_LENGTH);
        
        const baseKey = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(passphrase),
            { name: 'PBKDF2' },
            false,
            ['deriveBits']
        );
        
        const derivedBits = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt,
                iterations: CONFIG.PBKDF2_ITERATIONS,
                hash: 'SHA-256'
            },
            baseKey,
            CONFIG.AES_KEY_LENGTH + CONFIG.HMAC_KEY_LENGTH
        );
        
        const derivedBitsArray = new Uint8Array(derivedBits);
        const aesKeyBytes = derivedBitsArray.slice(0, CONFIG.AES_KEY_LENGTH / 8);
        const hmacKeyBytes = derivedBitsArray.slice(CONFIG.AES_KEY_LENGTH / 8);
        
        const aesKey = await crypto.subtle.importKey(
            'raw',
            aesKeyBytes,
            { name: 'AES-GCM' },
            false,
            ['decrypt']
        );
        
        const hmacKey = await crypto.subtle.importKey(
            'raw',
            hmacKeyBytes,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );
        
        // VERIFICACIÓN HMAC
        const hmacValid = await crypto.subtle.verify(
            'HMAC',
            hmacKey,
            hmac,
            ciphertext
        );
        
        if (!hmacValid) {
            console.error('HMAC verification failed:', {
                expected: Array.from(hmac.slice(0, 4)),
                dataLength: ciphertext.length,
                possibleCauses: ['Wrong password', 'Data corruption', 'Malicious tampering']
            });
            throw new Error('HMAC mismatch. Wrong password or corrupted file.');
        }
        
        console.log('HMAC verification successful - Data integrity confirmed');
        
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv, tagLength: 128 },
            aesKey,
            ciphertext
        );
        
        return {
            seed: new TextDecoder().decode(decrypted),
            metadata: metadata
        };
    },

    // Métodos para manejar metadatos
    createMetadata(userMessage = "") {
        const now = new Date();
        
        return {
            version: CONFIG.METADATA_VERSION,
            modificationCount: 0,
            timestamp: now,
            userMessageLength: Math.min(userMessage.length, 255),
            userMessage: userMessage.slice(0, 255),
            failedAttempts: 0,
            lastFailedAttempt: null,
            isValid: true
        };
    },

    serializeMetadata(metadata) {
        const buffer = new ArrayBuffer(CONFIG.METADATA_LENGTH);
        const view = new DataView(buffer);
        
        let offset = 0;
        view.setUint8(offset++, metadata.version);
        view.setUint8(offset++, metadata.modificationCount);
        view.setUint32(offset, Math.floor(metadata.timestamp.getTime() / 1000), false);
        offset += 4;
        view.setUint8(offset++, metadata.userMessageLength);
        
        // Escribir userMessage si existe
        if (metadata.userMessageLength > 0) {
            const encoder = new TextEncoder();
            const messageBytes = encoder.encode(metadata.userMessage);
            for (let i = 0; i < metadata.userMessageLength; i++) {
                view.setUint8(offset++, messageBytes[i]);
            }
        }
        
        // Escribir intentos fallidos
        view.setUint8(offset++, metadata.failedAttempts || 0);
        
        // Escribir último intento fallido si existe
        if (metadata.lastFailedAttempt) {
            view.setUint32(offset, Math.floor(metadata.lastFailedAttempt.getTime() / 1000), false);
        } else {
            view.setUint32(offset, 0, false);
        }
        offset += 4;
        
        // Rellenar con zeros
        while (offset < CONFIG.METADATA_LENGTH) {
            view.setUint8(offset++, 0);
        }
        
        return new Uint8Array(buffer);
    },

    deserializeMetadata(data) {
        const view = new DataView(data.buffer);
        
        let offset = 0;
        const version = view.getUint8(offset++);
        const modificationCount = view.getUint8(offset++);
        const timestamp = new Date(view.getUint32(offset, false) * 1000);
        offset += 4;
        const userMessageLength = view.getUint8(offset++);
        
        // Leer userMessage
        let userMessage = "";
        if (userMessageLength > 0) {
            const messageBytes = new Uint8Array(data.buffer, offset, userMessageLength);
            const decoder = new TextDecoder();
            userMessage = decoder.decode(messageBytes);
            offset += userMessageLength;
        }
        
        // Leer intentos fallidos
        const failedAttempts = view.getUint8(offset++);
        
        // Leer último intento fallido
        const lastFailedAttemptTimestamp = view.getUint32(offset, false);
        offset += 4;
        const lastFailedAttempt = lastFailedAttemptTimestamp > 0 ? 
            new Date(lastFailedAttemptTimestamp * 1000) : null;
        
        return {
            version,
            modificationCount,
            timestamp,
            userMessageLength,
            userMessage,
            failedAttempts,
            lastFailedAttempt,
            isValid: version <= CONFIG.METADATA_VERSION
        };
    }
};

// UI utilities
function showToast(message, type = 'info') {
    const icons = {
        error: 'fa-exclamation-circle',
        success: 'fa-check-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span>`;
    
    dom.toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function showSpinner(show) {
    dom.spinnerOverlay.style.display = show ? 'flex' : 'none';
}

// Offline mode indicator
function updateOnlineStatus() {
    if (!navigator.onLine) {
        if (!document.getElementById('offline-badge')) {
            const badge = document.createElement('div');
            badge.id = 'offline-badge';
            badge.innerHTML = '<i class="fas fa-wifi-slash"></i> Offline Mode';
            badge.style.position = 'fixed';
            badge.style.bottom = '15px';
            badge.style.left = '15px';
            badge.style.background = 'var(--accent-color)';
            badge.style.color = 'white';
            badge.style.padding = '6px 12px';
            badge.style.borderRadius = '20px';
            badge.style.zIndex = '10000';
            badge.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            badge.style.fontWeight = '600';
            badge.style.display = 'flex';
            badge.style.alignItems = 'center';
            badge.style.gap = '6px';
            badge.style.fontSize = '0.9rem';
            document.body.appendChild(badge);
        }
        showToast('Offline mode activated - Maximum security', 'success');
    } else {
        const badge = document.getElementById('offline-badge');
        if (badge) badge.remove();
    }
}

// Check if running in Telegram
function isTelegram() {
    return window.Telegram && Telegram.WebApp && Telegram.WebApp.initData;
}

// Load BIP39 wordlist
async function loadBIP39Wordlist() {
    const STORAGE_KEY = 'bip39-wordlist';
    try {
        const cachedWordlist = localStorage.getItem(STORAGE_KEY);
        if (cachedWordlist) {
            appState.bip39Wordlist = JSON.parse(cachedWordlist);
            return;
        }

        const response = await fetch('https://raw.githubusercontent.com/bitcoin/bips/master/bip-0039/english.txt');
        if (!response.ok) throw new Error('Failed to fetch wordlist');
        const text = await response.text();
        const wordlist = text.split('\n').map(word => word.trim()).filter(word => word);
        appState.bip39Wordlist = wordlist;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(wordlist));
    } catch (error) {
        console.error('Error loading BIP39 wordlist:', error);
        showToast('Warning: BIP39 validation not available', 'warning');
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    loadBIP39Wordlist();
    updateOnlineStatus();
    dom.welcomeModal.style.display = 'flex';
});
