import * as THREE from "three";
import { OrbitControls } from 'jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'jsm/loaders/GLTFLoader.js';

import getStarfield from "./src/getStarfield.js";
import { getFresnelMat } from "./src/getFresnelMat.js";

const w = window.innerWidth;
const h = window.innerHeight;
const scene = new THREE.Scene();

// Initial Camera Setup (Earth centered)
const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
camera.position.set(0, 0, 3); // Start zoomed out and centered on Earth

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(w, h);
document.body.appendChild(renderer.domElement);

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.rotateSpeed = 0.1;
controls.enableZoom = false;  // Disable zoom scrolling

// Earth Group (Initially centered)
const earthGroup = new THREE.Group();
earthGroup.rotation.z = -23.4 * Math.PI / 180;  // Earth Tilt
scene.add(earthGroup);

const radius = 1;
const widthSegments = 64;
const heightSegments = 64;
const geometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments);

// Earth Surface Material
const loader = new THREE.TextureLoader();
const earthMaterial = new THREE.MeshPhongMaterial({
  map: loader.load("./textures/Earth_Diffuse_6K.jpg"),
  specularMap: loader.load("./textures/Earth_Glossiness_6K.jpg"),
  bumpMap: loader.load("./textures/Earth_Bump_6K.jpg"),
  bumpScale: 0.04,
});
const earthMesh = new THREE.Mesh(geometry, earthMaterial);
earthGroup.add(earthMesh);

// Lights and Clouds on Earth
const lightsMat = new THREE.MeshBasicMaterial({
  map: loader.load("./textures/Earth_Lights_6K.jpg"),
  blending: THREE.AdditiveBlending,
});
const lightsMesh = new THREE.Mesh(geometry, lightsMat);
earthGroup.add(lightsMesh);

const cloudsMat = new THREE.MeshStandardMaterial({
  map: loader.load("./textures/Earth_Clouds_6K.jpg"),
  transparent: true,
  opacity: 0.8,
  blending: THREE.AdditiveBlending,
  alphaMap: loader.load('./textures/Earth_Clouds_6K.jpg'),
});
const cloudsMesh = new THREE.Mesh(geometry, cloudsMat);
cloudsMesh.scale.setScalar(1.003); 
earthGroup.add(cloudsMesh);

// Halo and Glow Effects
const haloGeometry = new THREE.SphereGeometry(radius * 1.1, widthSegments, heightSegments);
const haloMaterial = new THREE.ShaderMaterial({
  uniforms: {
    viewVector: { type: "v3", value: camera.position },
    c: { type: "f", value: 0.8 }, 
    p: { type: "f", value: 2.0 }
  },
  vertexShader: `
    varying vec3 vNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 viewVector;
    uniform float c;
    uniform float p;
    varying vec3 vNormal;
    void main() {
      float intensity = pow(c - dot(vNormal, viewVector), p);
      gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0) * intensity;
    }
  `,
  side: THREE.BackSide,
  blending: THREE.AdditiveBlending,
  transparent: true
});
// const haloMesh = new THREE.Mesh(haloGeometry, haloMaterial);
// haloMesh.scale.setScalar(1.03);
// earthGroup.add(haloMesh);

const fresnelMat = getFresnelMat();
const glowMesh = new THREE.Mesh(geometry, fresnelMat);
glowMesh.scale.setScalar(1.01);
earthGroup.add(glowMesh);

// Starfield
const stars = getStarfield({ numStars: 2000 });
scene.add(stars);

// Sunlight - Day-Night Cycle Rotation
const sunLight = new THREE.DirectionalLight(0xffffff, 5.0);
sunLight.position.set(-2, 0.5, 1.5);
scene.add(sunLight);

let sunAngle = 0;
function updateSunPosition() {
  sunAngle += 0.001; // Control day-night cycle speed
  const x = Math.cos(sunAngle) * 5;
  const z = Math.sin(sunAngle) * 5;
  sunLight.position.set(x, 1, z);
}

// Initial Search Box Hidden
const searchBox = document.getElementById('searchBox');
searchBox.style.transition = 'left 0.5s';
searchBox.style.left = '-700px';  // Off-screen initially

function showSearchBox() {
  searchBox.style.left = '20px'; // Slide in after animation
}

// Satellite group (as before)
const satelliteLoader = new GLTFLoader();
const satelliteGroup = new THREE.Group();
earthGroup.add(satelliteGroup);

satelliteLoader.load('./simple_satellite_low_poly_free/scene.gltf', (gltf) => {
  const satelliteModel = gltf.scene;
  satelliteModel.scale.set(0.02, 0.02, 0.02);

  const numSatellites = 5;
  for (let i = 0; i < numSatellites; i++) {
    const satelliteClone = satelliteModel.clone();
    satelliteClone.position.set(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1
    ).normalize().multiplyScalar(radius * 1.5);
    
    satelliteClone.lookAt(earthMesh.position);
    satelliteGroup.add(satelliteClone);
  }
}, undefined, (error) => {
  console.error('An error occurred:', error);
});

// Asteroid group (as before)
const asteroidGeometry = new THREE.DodecahedronGeometry(0.02); 
const asteroidMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
const asteroidGroup = new THREE.Group();
earthGroup.add(asteroidGroup);

for (let i = 0; i < 15; i++) {
  const asteroidMesh = new THREE.Mesh(asteroidGeometry, asteroidMaterial);
  asteroidMesh.position.set(
    Math.random() * 2 - 1,
    Math.random() * 2 - 1,
    Math.random() * 2 - 1
  ).normalize().multiplyScalar(radius * 1.7);
  
  asteroidMesh.lookAt(earthMesh.position);
  asteroidGroup.add(asteroidMesh);
}

// Detect user interaction
let userIsInteracting = false;
controls.addEventListener('start', () => {
  userIsInteracting = true;
});
controls.addEventListener('end', () => {
  userIsInteracting = false;
});

// Camera 360° Turn and Zoom-in Animation After Clicking "Explore Now"
function animateCameraAroundEarth(callback) {
  const rotationDuration = 3000; // 3 seconds
  const initialPos = { x: 0, z: 3 };
  const finalPos = { x: -2, z: 1.5 }; // End up on the right side, zoomed in
  let startTime = null;

  function rotateAndZoom(time) {
    if (!startTime) startTime = time;
    const elapsed = time - startTime;
    const progress = Math.min(elapsed / rotationDuration, 1);  // Normalize progress

    // Camera rotates and zooms in around the Earth
    const angle = progress * Math.PI * 2; // 360° rotation
    const dist = THREE.MathUtils.lerp(initialPos.z, finalPos.z, progress);
    camera.position.x = Math.cos(angle) * dist;
    camera.position.z = Math.sin(angle) * dist;

    camera.fov = THREE.MathUtils.lerp(75, 75, progress);  // Zoom effect
    camera.lookAt(new THREE.Vector3(0, 0, 0)); // Look at the shifted Earth on the right
    camera.updateProjectionMatrix();

    if (progress < 1) {
      requestAnimationFrame(rotateAndZoom);
    } else {
      callback(); // Call after the camera animation is complete
    }
  }

  requestAnimationFrame(rotateAndZoom);
}

// Halo Fade-Out Effect
function fadeOutHalo() {
  const fadeDuration = 2000;
  const startTime = Date.now();

  function fade() {
    const elapsed = Date.now() - startTime;
    const fraction = elapsed / fadeDuration;
    haloMesh.material.opacity = 1.0 - fraction;

    if (fraction < 1.0) {
      requestAnimationFrame(fade);
    }
  }
  fade();
}

// Main Animation Loop
function animate() {
  requestAnimationFrame(animate);

  // Rotate Earth and simulate day-night cycle
  if (!userIsInteracting) {
    earthGroup.rotation.y += 0.001;
  }
  updateSunPosition();

  controls.update();
  renderer.render(scene, camera);
}

animate();

// Handle window resize
function handleWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', handleWindowResize, false);

// "Explore Now" Button Event - Handles All Animations
window.addEventListener('exploreClicked', () => {
  const introText = document.getElementById('introText');
  introText.style.transition = 'opacity 2s';
  introText.style.opacity = 0;

  setTimeout(() => {
    // Start Camera 360 turn and zoom-in after text fades out
    animateCameraAroundEarth(() => {
      showSearchBox(); // Show the search bar after camera finishes moving
    });

    // Fade out halo during the camera animation
    fadeOutHalo();
  }, 2000); // Delay for intro text fade out
});

// Search Feature
const searchInput = document.querySelector("#searchInput");
const autocomBox = document.querySelector(".autocom-box");
const searchIcon = document.querySelector(".icon");
const infoBoxes = document.getElementById("infoBoxes");

let cometSatellites = [];
let manmadeSatellites = [];

// Function to read XLSX file
function readXlsxFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        resolve(jsonData);
      } catch (error) {
        console.error('Error processing XLSX file:', error);
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

// Function to load satellite data
async function loadSatelliteData() {
  try {
    // Load comet.xlsx
    const cometResponse = await fetch('comet.xlsx');
    const cometBlob = await cometResponse.blob();
    cometSatellites = await readXlsxFile(cometBlob);
    console.log('Comet satellite data loaded:', cometSatellites.slice(0, 5));
    console.log('Total comet satellites loaded:', cometSatellites.length);

    // Load manmade.xlsx
    const manmadeResponse = await fetch('manmade.xlsx');
    const manmadeBlob = await manmadeResponse.blob();
    manmadeSatellites = await readXlsxFile(manmadeBlob);
    console.log('Manmade satellite data loaded:', manmadeSatellites.slice(0, 5));
    console.log('Total manmade satellites loaded:', manmadeSatellites.length);
  } catch (error) {
    console.error('Error loading satellite data:', error);
  }
}

// Call this function when the page loads
document.addEventListener('DOMContentLoaded', loadSatelliteData);

function handleSearch() {
  const inputValue = searchInput.value.trim();

  console.log("Search input value:", inputValue);

  const matchedCometSatellite = cometSatellites.find(sat => 
    sat['Satellite Name'].toLowerCase() === inputValue.toLowerCase()
  );

  const matchedManmadeSatellite = manmadeSatellites.find(sat => 
    sat['Satellite Name'].toLowerCase() === inputValue.toLowerCase()
  );

  console.log("Matched comet satellite:", matchedCometSatellite);
  console.log("Matched manmade satellite:", matchedManmadeSatellite);

  if (matchedCometSatellite) {
    displaySatelliteInfo(matchedCometSatellite, 'comet');
  } else if (matchedManmadeSatellite) {
    displaySatelliteInfo(matchedManmadeSatellite, 'manmade');
  } else {
    // Handle case when no satellite is found
    infoBoxes.style.display = 'none';
    alert('No satellite found with that name.');
  }
}

function displaySatelliteInfo(satellite, type) {
  // Always keep search box at top
  document.querySelector(".search-container").classList.add('top');

  // Show and update info boxes
  infoBoxes.style.display = 'flex';

  const leftBox = document.querySelector('.left-box');
  const rightBox = document.querySelector('.right-box');

  if (type === 'comet') {
    leftBox.innerHTML = `
      <h2>Comet Satellite Data</h2>
      <p><strong>Name:</strong> ${satellite['Satellite Name'] || 'N/A'}</p>
      <p><strong>Discovered:</strong> ${satellite.Discovered || 'N/A'}</p>
      <p><strong>Diameter:</strong> ${satellite.Diameter || 'N/A'}</p>
      <p><strong>Mass:</strong> ${satellite.Mass || 'N/A'}</p>
      <p><strong>Close Approach:</strong> ${satellite['Close Approach'] || 'N/A'}</p>
      <p><strong>Impact Risk:</strong> ${satellite['Impact Risk'] || 'N/A'}</p>
      <p><strong>Mission:</strong> ${satellite.Mission || 'N/A'}</p>
      <p><strong>Facts:</strong> ${satellite.Facts || 'N/A'}</p>
      <p><strong>Composition:</strong> ${satellite.Composition || 'N/A'}</p>
    `;
  } else if (type === 'manmade') {
    leftBox.innerHTML = `
      <h2>Manmade Satellite Data</h2>
      <p><strong>Satellite Name:</strong> ${satellite['Satellite Name'] || 'N/A'}</p>
      <p><strong>Launched:</strong> ${satellite.Launched || 'N/A'}</p>
      <p><strong>Diameter:</strong> ${satellite.Diameter || 'N/A'}</p>
      <p><strong>Mass:</strong> ${satellite.Mass || 'N/A'}</p>
      <p><strong>Activity:</strong> ${satellite.Activity || 'N/A'}</p>
      <p><strong>Crew:</strong> ${satellite.Crew || 'N/A'}</p>
      <p><strong>Facts:</strong> ${satellite.Facts || 'N/A'}</p>
      <p><strong>Why was it launched?:</strong> ${satellite['Why was it launched?'] || 'N/A'}</p>
    `;
  }

  // Update the right box with the image
  let imageName = satellite['Satellite Name'].replace(/\s+/g, '_');
  rightBox.innerHTML = `
    <img 
      src="./images/${imageName}.jpg" 
      alt="${satellite['Satellite Name']}" 
      class="satellite-image" 
      onerror="this.onerror=null; this.src='./images/default-satellite.jpg'; console.log('Failed to load image: ' + this.src);"
    >
  `;

  // Log image path for debugging
  console.log(`Attempting to load image: ./images/${imageName}.jpg`);
}

if (searchInput && autocomBox) {
  searchInput.addEventListener('input', function() {
    const query = this.value.toLowerCase();
    autocomBox.innerHTML = ''; // Clear previous results

    console.log("Input query:", query);
    console.log("Number of comet satellites:", cometSatellites.length);
    console.log("Number of manmade satellites:", manmadeSatellites.length);

    if (query && (cometSatellites.length > 0 || manmadeSatellites.length > 0)) {
      const filteredCometSatellites = cometSatellites.filter(satellite => 
        satellite['Satellite Name'] && satellite['Satellite Name'].toLowerCase().includes(query)
      );

      const filteredManmadeSatellites = manmadeSatellites.filter(satellite => 
        satellite['Satellite Name'] && satellite['Satellite Name'].toLowerCase().includes(query)
      );

      console.log("Filtered comet satellites:", filteredCometSatellites);
      console.log("Filtered manmade satellites:", filteredManmadeSatellites);

      const filteredSatellites = [...filteredCometSatellites, ...filteredManmadeSatellites];

      if (filteredSatellites.length > 0) {
        autocomBox.style.display = 'block';
        filteredSatellites.forEach(satellite => {
          const li = document.createElement('li');
          li.textContent = satellite['Satellite Name'];
          li.addEventListener('click', function() {
            searchInput.value = satellite['Satellite Name'];
            autocomBox.style.display = 'none';
            handleSearch(); // Trigger the search function to show details
          });
          autocomBox.appendChild(li);
        });
      } else {
        autocomBox.style.display = 'none';
      }
    } else {
      autocomBox.style.display = 'none';
    }
  });
}

// Add click event listener to the search icon
searchIcon.addEventListener('click', handleSearch);

// Add keypress event listener to the search input for Enter key
searchInput.addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    handleSearch();
  }
});

// Close autocomplete box when clicking outside
document.addEventListener('click', (e) => {
  if (!searchInput.contains(e.target) && !autocomBox.contains(e.target)) {
    autocomBox.style.display = 'none';
  }
});