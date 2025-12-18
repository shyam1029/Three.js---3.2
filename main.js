// IMPORTS
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import GUI from 'https://cdn.jsdelivr.net/npm/lil-gui@0.20/+esm';
import Stats from 'three/addons/libs/stats.module.js';

// ============ GLOBAL VARIABLES ============
let scene, camera, renderer, controls, composer;
let model, envMap, spotLight, ambientLight;
let canvas, sizes, aspect;
let stats, gui;
let clock = new THREE.Clock();
let isAutoRotate = true;

// DOM Elements
const loadingScreen = document.getElementById('loadingScreen');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const loadingText = document.getElementById('loadingText');

// ============ INITIALIZATION ============
const init = () => {
    setupCanvas();
    setupScene();
    setupCamera();
    setupRenderer();
    setupLights();
    setupControls();
    setupPostProcessing();
    setupStats();
    setupGUI();
    setupEventListeners();
    loadAssets();
    animate();
};

// ============ SETUP FUNCTIONS ============
const setupCanvas = () => {
    canvas = document.getElementById('canvas');
    sizes = {
        width: window.innerWidth,
        height: window.innerHeight
    };
    aspect = sizes.width / sizes.height;
};

const setupScene = () => {
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0d0d0d, 10, 50);
    
    // Add ground plane
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshPhongMaterial({
        color: 0x1a1a1a,
        transparent: true,
        opacity: 0.8
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Add grid helper
    const gridHelper = new THREE.GridHelper(100, 50, 0x333333, 0x222222);
    gridHelper.position.y = -0.49;
    scene.add(gridHelper);
};

const setupCamera = () => {
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(5, 3, 8);
    scene.add(camera);
};

const setupRenderer = () => {
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance'
    });
    
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
};

const setupLights = () => {
    // Ambient light
    ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    scene.add(ambientLight);
    
    // Main spotlight
    spotLight = new THREE.SpotLight(0xffffff, 15);
    spotLight.position.set(0, 8, 0);
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 2048;
    spotLight.shadow.mapSize.height = 2048;
    spotLight.shadow.camera.near = 0.1;
    spotLight.shadow.camera.far = 50;
    spotLight.penumbra = 0.8;
    spotLight.angle = Math.PI / 4;
    spotLight.distance = 30;
    spotLight.decay = 2;
    scene.add(spotLight);
    scene.add(spotLight.target);
    
    // Rim lighting
    const rimLight = new THREE.DirectionalLight(0x00d4ff, 2);
    rimLight.position.set(-10, 5, -10);
    scene.add(rimLight);
    
    const rimLight2 = new THREE.DirectionalLight(0xff0066, 1.5);
    rimLight2.position.set(10, 5, 10);
    scene.add(rimLight2);
    
    // Light helper (initially hidden)
    const lightHelper = new THREE.SpotLightHelper(spotLight);
    lightHelper.visible = false;
    scene.add(lightHelper);
};

const setupControls = () => {
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.1;
    controls.minDistance = 3;
    controls.maxDistance = 20;
    controls.autoRotate = isAutoRotate;
    controls.autoRotateSpeed = 0.5;
    controls.enablePan = false;
};

const setupPostProcessing = () => {
    composer = new EffectComposer(renderer);
    
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(sizes.width, sizes.height),
        0.4, // strength
        0.6, // radius
        0.1  // threshold
    );
    composer.addPass(bloomPass);
    
    const outputPass = new OutputPass();
    composer.addPass(outputPass);
};

const setupStats = () => {
    stats = new Stats();
    stats.dom.className = 'stats-panel';
    document.body.appendChild(stats.dom);
};

// ============ LOADING MANAGER ============
const manager = new THREE.LoadingManager();
let loadingStages = [
    'Initializing experience...',
    'Loading environment...',
    'Processing car model...',
    'Optimizing materials...',
    'Almost ready...'
];
let currentStage = 0;

manager.onStart = () => {
    gsap.to(loadingText, {
        duration: 0.5,
        opacity: 0,
        onComplete: () => {
            updateLoadingStage();
        }
    });
};

manager.onProgress = (url, itemsLoaded, itemsTotal) => {
    const progress = (itemsLoaded / itemsTotal) * 100;
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `${Math.round(progress)}%`;
    
    // Update stage based on progress
    const newStage = Math.floor((progress / 100) * loadingStages.length);
    if (newStage !== currentStage && newStage < loadingStages.length) {
        currentStage = newStage;
        updateLoadingStage();
    }
};

manager.onLoad = () => {
    setTimeout(() => {
        gsap.to(loadingScreen, {
            duration: 1,
            opacity: 0,
            ease: "power2.out",
            onComplete: () => {
                loadingScreen.classList.add('hidden');
                showNotification('Car configurator loaded successfully!', 'success');
            }
        });
    }, 500);
};

manager.onError = (url) => {
    console.error('Error loading:', url);
    showNotification('Error loading assets. Please refresh the page.', 'error');
};

const updateLoadingStage = () => {
    if (currentStage < loadingStages.length) {
        loadingText.textContent = loadingStages[currentStage];
        gsap.fromTo(loadingText, 
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.5 }
        );
    }
};

// ============ ASSET LOADING ============
const gltfLoader = new GLTFLoader(manager);
const rgbeLoader = new RGBELoader(manager);
const dracoLoader = new DRACOLoader();

dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
dracoLoader.setDecoderConfig({ type: 'js' });
gltfLoader.setDRACOLoader(dracoLoader);

const loadAssets = async () => {
    try {
        // Load assets with fallback
        const [hdr, gltf] = await Promise.all([
            loadHDREnvironment(),
            loadCarModel()
        ]);
        
        onAssetsLoaded(hdr, gltf);
    } catch (error) {
        console.error('Error loading assets:', error);
        createFallbackEnvironment();
    }
};

const loadHDREnvironment = async () => {
    try {
        return await rgbeLoader.loadAsync('autumn_field_puresky_1k.hdr');
    } catch (error) {
        console.warn('HDR environment not found, using fallback');
        return null;
    }
};

const loadCarModel = async () => {
    try {
        return await gltfLoader.loadAsync('compressed_car.glb');
    } catch (error) {
        console.warn('Car model not found, creating fallback');
        return createFallbackCar();
    }
};

const createFallbackEnvironment = () => {
    // Create a simple gradient background
    const gradientTexture = createGradientTexture();
    scene.background = gradientTexture;
    scene.environment = gradientTexture;
};

const createGradientTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.5, '#16213e');
    gradient.addColorStop(1, '#0f1419');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    return new THREE.CanvasTexture(canvas);
};

const createFallbackCar = () => {
    // Create a simple car-like shape as fallback
    const group = new THREE.Group();
    
    // Car body
    const bodyGeometry = new THREE.BoxGeometry(4, 1, 2);
    const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x0066ff });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.5;
    body.castShadow = true;
    group.add(body);
    
    // Car wheels
    const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.2);
    const wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x222222 });
    
    const wheelPositions = [
        [-1.5, 0, 1.2],
        [1.5, 0, 1.2],
        [-1.5, 0, -1.2],
        [1.5, 0, -1.2]
    ];
    
    wheelPositions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.position.set(...pos);
        wheel.rotation.z = Math.PI / 2;
        wheel.castShadow = true;
        group.add(wheel);
    });
    
    return { scene: group };
};

const onAssetsLoaded = (hdr, gltf) => {
    // Setup environment
    if (hdr) {
        hdr.mapping = THREE.EquirectangularReflectionMapping;
        envMap = hdr;
        scene.background = envMap;
        scene.environment = envMap;
        scene.backgroundIntensity = 0.3;
        scene.backgroundBlurriness = 0.1;
    } else {
        createFallbackEnvironment();
    }
    
    // Setup car model
    model = gltf.scene;
    model.scale.setScalar(1);
    model.position.y = 0;
    
    // Process materials
    model.traverse(child => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            
            if (child.material) {
                child.material.envMapIntensity = carConfig.envMapIntensity;
                
                // Enhance materials
                if (child.material instanceof THREE.MeshStandardMaterial) {
                    child.material.roughness = Math.min(child.material.roughness, 0.8);
                    child.material.metalness = Math.max(child.material.metalness, 0.1);
                }
            }
        }
    });
    
    spotLight.target = model;
    scene.add(model);
    updateCarMaterials();
    
    // Animate car entrance
    animateCarEntrance();
};

const animateCarEntrance = () => {
    if (!model) return;
    
    model.position.y = -5;
    model.rotation.y = Math.PI;
    
    gsap.to(model.position, {
        duration: 2,
        y: 0,
        ease: "back.out(1.7)"
    });
    
    gsap.to(model.rotation, {
        duration: 2,
        y: 0,
        ease: "power2.out"
    });
};

// ============ CAR CONFIGURATION ============
const carConfig = {
    // Material properties
    carColor: '#0066ff',
    caliper: '#ff0000',
    carMetalness: 0.8,
    carRoughness: 0.2,
    carClearCoat: 0.5,
    carClearCoatRoughness: 0.1,
    
    // Environment
    envMapIntensity: 1.0,
    backgroundIntensity: 0.3,
    backgroundBlurriness: 0.1,
    
    // Lighting
    spotLightIntensity: 15,
    ambientLightIntensity: 0.4,
    rimLightIntensity: 2,
    
    // Animation
    rotationSpeed: 0.5,
    autoRotate: true,
    
    // Post-processing
    bloomStrength: 0.1,
    bloomRadius: 0.6,
    bloomThreshold: 0.1,
    
    // Actions
    downloadScreenshot: () => downloadScreenshot(),
    resetCamera: () => resetCameraPosition(),
    toggleAutoRotate: () => toggleAutoRotate(),
    
    // Presets
    applyPreset: (preset) => applyCarPreset(preset)
};

// Car presets
const carPresets = {
    sporty: {
        carColor: '#ff3333',
        caliper: '#ffff00',
        carMetalness: 0.9,
        carRoughness: 0.1,
        carClearCoat: 0.8
    },
    luxury: {
        carColor: '#1a1a1a',
        caliper: '#ff6600',
        carMetalness: 0.7,
        carRoughness: 0.3,
        carClearCoat: 0.6
    },
    electric: {
        carColor: '#00d4ff',
        caliper: '#ffffff',
        carMetalness: 0.8,
        carRoughness: 0.2,
        carClearCoat: 0.7
    },
    classic: {
        carColor: '#8B4513',
        caliper: '#FFD700',
        carMetalness: 0.5,
        carRoughness: 0.4,
        carClearCoat: 0.3
    }
};

const updateCarMaterials = () => {
    if (!model) return;
    
    model.traverse(child => {
        if (child.isMesh && child.material) {
            // Update paint materials
            if (child.userData.name && child.userData.name.includes('paint')) {
                child.material.color = new THREE.Color(carConfig.carColor);
                child.material.metalness = carConfig.carMetalness;
                child.material.roughness = carConfig.carRoughness;
                
                if (child.material instanceof THREE.MeshStandardMaterial) {
                    child.material.clearcoat = carConfig.carClearCoat;
                    child.material.clearcoatRoughness = carConfig.carClearCoatRoughness;
                }
            }
            
            // Update caliper materials
            if (child.userData.name && child.userData.name.includes('caliper')) {
                child.material.color = new THREE.Color(carConfig.caliper);
            }
            
            // Update environment map intensity
            child.material.envMapIntensity = carConfig.envMapIntensity;
        }
    });
};

const applyCarPreset = (presetName) => {
    const preset = carPresets[presetName];
    if (!preset) return;
    
    // Animate color transition
    const currentColor = new THREE.Color(carConfig.carColor);
    const targetColor = new THREE.Color(preset.carColor);
    
    gsap.to(currentColor, {
        duration: 1,
        r: targetColor.r,
        g: targetColor.g,
        b: targetColor.b,
        onUpdate: () => {
            carConfig.carColor = '#' + currentColor.getHexString();
            updateCarMaterials();
            // gui.updateDisplay();
        }
    });
    
    // Update other properties
    Object.assign(carConfig, preset);
    updateCarMaterials();
    gui.updateDisplay();
    
    showNotification(`Applied ${presetName} preset`, 'success');
};

// ============ GUI SETUP ============
const setupGUI = () => {
    gui = new GUI({ title: 'Car Configurator', closeFolders: true });
    
    // Presets folder
    const presetsFolder = gui.addFolder('🎨 Style Presets');
    presetsFolder.add({ sporty: () => applyCarPreset('sporty') }, 'sporty').name('🏎️ Sporty Red');
    presetsFolder.add({ luxury: () => applyCarPreset('luxury') }, 'luxury').name('🖤 Luxury Black');
    presetsFolder.add({ electric: () => applyCarPreset('electric') }, 'electric').name('⚡ Electric Blue');
    presetsFolder.add({ classic: () => applyCarPreset('classic') }, 'classic').name('🏛️ Classic Brown');
    
    // Materials folder
    const materialsFolder = gui.addFolder('🎨 Paint & Materials');
    materialsFolder.addColor(carConfig, 'carColor').name('🎨 Body Color').onChange(updateCarMaterials);
    materialsFolder.addColor(carConfig, 'caliper').name('🔧 Brake Caliper').onChange(updateCarMaterials);
    materialsFolder.add(carConfig, 'carMetalness', 0, 1, 0.01).name('✨ Metalness').onChange(updateCarMaterials);
    materialsFolder.add(carConfig, 'carRoughness', 0, 1, 0.01).name('🪞 Roughness').onChange(updateCarMaterials);
    materialsFolder.add(carConfig, 'carClearCoat', 0, 1, 0.01).name('💎 Clear Coat').onChange(updateCarMaterials);
    materialsFolder.add(carConfig, 'carClearCoatRoughness', 0, 1, 0.01).name('🌊 Coat Roughness').onChange(updateCarMaterials);
    
    // Environment folder
    const environmentFolder = gui.addFolder('🌍 Environment');
    environmentFolder.add(carConfig, 'envMapIntensity', 0, 2, 0.01).name('🌟 Reflection').onChange(updateCarMaterials);
    environmentFolder.add(carConfig, 'backgroundIntensity', 0, 1, 0.01).name('🖼️ Background').onChange(updateBackground);
    environmentFolder.add(carConfig, 'backgroundBlurriness', 0, 1, 0.01).name('🌫️ Blur').onChange(updateBackground);
    
    // Lighting folder
    const lightingFolder = gui.addFolder('💡 Lighting');
    lightingFolder.add(carConfig, 'spotLightIntensity', 0, 30, 0.1).name('💡 Main Light').onChange(updateLighting);
    lightingFolder.add(carConfig, 'ambientLightIntensity', 0, 2, 0.01).name('🌙 Ambient').onChange(updateLighting);
    lightingFolder.add(carConfig, 'rimLightIntensity', 0, 5, 0.1).name('✨ Rim Light').onChange(updateLighting);
    
    // Animation folder
    const animationFolder = gui.addFolder('🎬 Animation');
    animationFolder.add(carConfig, 'autoRotate').name('🔄 Auto Rotate').onChange(toggleAutoRotate);
    animationFolder.add(carConfig, 'rotationSpeed', 0, 3, 0.1).name('⚡ Speed').onChange(updateRotationSpeed);
    
    // Effects folder
    const effectsFolder = gui.addFolder('✨ Effects');
    effectsFolder.add(carConfig, 'bloomStrength', 0, 2, 0.01).name('🌟 Bloom').onChange(updatePostProcessing);
    effectsFolder.add(carConfig, 'bloomRadius', 0, 2, 0.01).name('📐 Radius').onChange(updatePostProcessing);
    effectsFolder.add(carConfig, 'bloomThreshold', 0, 1, 0.01).name('🎯 Threshold').onChange(updatePostProcessing);
    
    // Actions folder
    const actionsFolder = gui.addFolder('🎯 Actions');
    actionsFolder.add(carConfig, 'downloadScreenshot').name('📸 Screenshot');
    actionsFolder.add(carConfig, 'resetCamera').name('🎯 Reset View');
    
    // Close folders by default except presets
    materialsFolder.close();
    environmentFolder.close();
    lightingFolder.close();
    animationFolder.close();
    effectsFolder.close();
    actionsFolder.close();
};

// ============ UPDATE FUNCTIONS ============
const updateBackground = () => {
    if (scene.background) {
        scene.backgroundIntensity = carConfig.backgroundIntensity;
        scene.backgroundBlurriness = carConfig.backgroundBlurriness;
    }
};

const updateLighting = () => {
    if (spotLight) spotLight.intensity = carConfig.spotLightIntensity;
    if (ambientLight) ambientLight.intensity = carConfig.ambientLightIntensity;
    
    // Update rim lights if they exist
    scene.traverse(child => {
        if (child instanceof THREE.DirectionalLight && child !== ambientLight) {
            child.intensity = carConfig.rimLightIntensity;
        }
    });
};

const updateRotationSpeed = () => {
    if (controls) {
        controls.autoRotateSpeed = carConfig.rotationSpeed;
    }
};

const updatePostProcessing = () => {
    if (composer) {
        const bloomPass = composer.passes.find(pass => pass instanceof UnrealBloomPass);
        if (bloomPass) {
            bloomPass.strength = carConfig.bloomStrength;
            bloomPass.radius = carConfig.bloomRadius;
            bloomPass.threshold = carConfig.bloomThreshold;
        }
    }
};

// ============ CAMERA FUNCTIONS ============
const resetCameraPosition = () => {
    gsap.to(camera.position, {
        duration: 1.5,
        x: 5,
        y: 3,
        z: 8,
        ease: "power2.out"
    });
    
    gsap.to(controls.target, {
        duration: 1.5,
        x: 0,
        y: 1,
        z: 0,
        ease: "power2.out"
    });
    
    showNotification('Camera reset', 'info');
};

const setCameraView = (viewName) => {
    let targetPosition, targetLookAt;
    
    switch (viewName) {
        case 'front':
            targetPosition = { x: 0, y: 2, z: 8 };
            targetLookAt = { x: 0, y: 1, z: 0 };
            break;
        case 'side':
            targetPosition = { x: 8, y: 2, z: 0 };
            targetLookAt = { x: 0, y: 1, z: 0 };
            break;
        case 'rear':
            targetPosition = { x: 0, y: 2, z: -8 };
            targetLookAt = { x: 0, y: 1, z: 0 };
            break;
        case 'top':
            targetPosition = { x: 0, y: 12, z: 0 };
            targetLookAt = { x: 0, y: 0, z: 0 };
            break;
        default:
            return;
    }
    
    gsap.to(camera.position, {
        duration: 1.5,
        ...targetPosition,
        ease: "power2.out"
    });
    
    gsap.to(controls.target, {
        duration: 1.5,
        ...targetLookAt,
        ease: "power2.out"
    });
    
    showNotification(`${viewName.charAt(0).toUpperCase() + viewName.slice(1)} view`, 'info');
};

// ============ UTILITY FUNCTIONS ============
const toggleAutoRotate = () => {
    isAutoRotate = carConfig.autoRotate;
    if (controls) {
        controls.autoRotate = isAutoRotate;
    }
    
    const rotateBtn = document.getElementById('rotateBtn');
    if (rotateBtn) {
        rotateBtn.classList.toggle('active', isAutoRotate);
    }
};

const downloadScreenshot = () => {
    // Temporarily disable post-processing for cleaner screenshot
    const useComposer = composer !== undefined;
    
    if (useComposer) {
        renderer.render(scene, camera);
    }
    
    const image = canvas.toDataURL('image/png', 1.0);
    const link = document.createElement('a');
    link.download = `car-configurator-${Date.now()}.png`;
    link.href = image;
    link.click();
    
    showNotification('Screenshot saved!', 'success');
};

const showNotification = (message, type = 'info') => {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    
    // Style based on type
    const colors = {
        success: '#00d4ff',
        error: '#ff3333',
        info: '#0066ff'
    };
    
    notification.style.borderLeft = `4px solid ${colors[type] || colors.info}`;
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Animate out and remove
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
};

// ============ EVENT LISTENERS ============
const setupEventListeners = () => {
    // Window resize
    window.addEventListener('resize', onWindowResize);
    
    // Control buttons
    const rotateBtn = document.getElementById('rotateBtn');
    const resetBtn = document.getElementById('resetBtn');
    const screenshotBtn = document.getElementById('screenshotBtn');
    
    rotateBtn?.addEventListener('click', () => {
        carConfig.autoRotate = !carConfig.autoRotate;
        toggleAutoRotate();
        gui.updateDisplay();
    });
    
    resetBtn?.addEventListener('click', resetCameraPosition);
    screenshotBtn?.addEventListener('click', downloadScreenshot);
    
    // Camera view buttons
    const frontView = document.getElementById('frontView');
    const sideView = document.getElementById('sideView');
    const rearView = document.getElementById('rearView');
    const topView = document.getElementById('topView');
    
    frontView?.addEventListener('click', () => setCameraView('front'));
    sideView?.addEventListener('click', () => setCameraView('side'));
    rearView?.addEventListener('click', () => setCameraView('rear'));
    topView?.addEventListener('click', () => setCameraView('top'));
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (event) => {
        switch (event.code) {
            case 'Space':
                event.preventDefault();
                carConfig.autoRotate = !carConfig.autoRotate;
                toggleAutoRotate();
                gui.updateDisplay();
                break;
            case 'KeyR':
                event.preventDefault();
                resetCameraPosition();
                break;
            case 'KeyS':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    downloadScreenshot();
                }
                break;
            case 'Digit1':
                setCameraView('front');
                break;
            case 'Digit2':
                setCameraView('side');
                break;
            case 'Digit3':
                setCameraView('rear');
                break;
            case 'Digit4':
                setCameraView('top');
                break;
        }
    });
    
    // Touch gestures for mobile
    let touchStartY = 0;
    canvas.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    });
    
    canvas.addEventListener('touchend', (e) => {
        const touchEndY = e.changedTouches[0].clientY;
        const diff = touchStartY - touchEndY;
        
        if (Math.abs(diff) > 50) {
            if (diff > 0) {
                // Swipe up - show GUI
                gui.open();
            } else {
                // Swipe down - hide GUI
                gui.close();
            }
        }
    });
};

const onWindowResize = () => {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;
    
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();
    
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    if (composer) {
        composer.setSize(sizes.width, sizes.height);
    }
};

// ============ ANIMATION LOOP ============
const animate = () => {
    const elapsedTime = clock.getElapsedTime();
    
    // Animate spotlight
    if (spotLight) {
        spotLight.position.x = Math.sin(elapsedTime * 0.5) * 3;
        spotLight.position.z = Math.cos(elapsedTime * 0.5) * 3;
    }
    
    // Update controls
    if (controls) {
        controls.update();
    }
    
    // Update stats
    if (stats) {
        stats.update();
    }
    
    // Render
    if (composer) {
        composer.render();
    } else {
        renderer.render(scene, camera);
    }
    
    requestAnimationFrame(animate);
};

// ============ PERFORMANCE MONITORING ============
const monitorPerformance = () => {
    let frameCount = 0;
    let lastTime = performance.now();
    
    const checkPerformance = () => {
        frameCount++;
        const currentTime = performance.now();
        
        if (currentTime - lastTime >= 5000) { // Check every 5 seconds
            const fps = (frameCount * 1000) / (currentTime - lastTime);
            
            if (fps < 30) {
                // Reduce quality for better performance
                renderer.setPixelRatio(1);
                if (composer) {
                    const bloomPass = composer.passes.find(pass => pass instanceof UnrealBloomPass);
                    if (bloomPass) {
                        bloomPass.strength *= 0.8;
                    }
                }
                console.warn('Performance degraded, reducing quality');
            }
            
            frameCount = 0;
            lastTime = currentTime;
        }
        
        requestAnimationFrame(checkPerformance);
    };
    
    checkPerformance();
};

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', () => {
    init();
    monitorPerformance();
    
    // Add loading screen interactions
    document.addEventListener('click', () => {
        if (!loadingScreen.classList.contains('hidden')) {
            // Skip loading animation on click
            manager.onLoad();
        }
    });
    
    console.log('🚗 Premium Car Configurator loaded');
    console.log('📋 Keyboard shortcuts:');
    console.log('  Space - Toggle auto rotation');
    console.log('  R - Reset camera');
    console.log('  Ctrl+S - Download screenshot');
    console.log('  1-4 - Camera views');
});

// Export for debugging
window.carConfigurator = {
    scene,
    camera,
    renderer,
    controls,
    model,
    carConfig,
    applyCarPreset,
    setCameraView,
    resetCameraPosition,
    downloadScreenshot

};
