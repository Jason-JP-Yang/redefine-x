/**
 * Redefine-X Image Preloader - Rewritten from scratch
 * 
 * Clean and efficient lazy loading:
 * - IntersectionObserver for viewport detection
 * - Direct Image() loading without XHR/blob/CORS complications
 * - Single request per image, instant display
 * - Graceful error handling
 */

const loadedPreloaders = new WeakSet();
let intersectionObserver = null;

/**
 * Check if URL is same-origin
 */
function isSameOrigin(url) {
  try {
    const urlObj = new URL(url, window.location.href);
    return urlObj.origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Load image - simple and direct
 */
function loadImage(src, alt) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.alt = alt;
    
    // Only set crossOrigin for same-origin images to avoid CORS issues
    if (isSameOrigin(src)) {
      img.crossOrigin = "anonymous";
    }
    
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    
    img.src = src;
  });
}

/**
 * Replace preloader with loaded image
 */
function replacePreloader(preloader, img) {
  // Transfer classes
  const classes = Array.from(preloader.classList).filter(c => !c.startsWith("img-preloader"));
  classes.forEach(c => img.classList.add(c));
  
  // Set dimensions
  const width = preloader.dataset.width;
  const height = preloader.dataset.height;
  if (width) img.width = parseInt(width, 10);
  if (height) img.height = parseInt(height, 10);
  
  // Mark and animate
  img.classList.add("img-preloader-loaded");
  img.dataset.originalSrc = preloader.dataset.src;
  preloader.classList.add("img-preloader-fade-out");
  
  // Replace DOM node
  setTimeout(() => {
    preloader.parentNode?.replaceChild(img, preloader);
  }, 200);
}

/**
 * Show error state
 */
function showError(preloader, src) {
  preloader.classList.add("img-preloader-error");
  const skeleton = preloader.querySelector(".img-preloader-skeleton");
  if (skeleton) {
    skeleton.innerHTML = `
      <i class="fa-solid fa-circle-xmark img-preloader-error-icon"></i>
      <div class="img-preloader-error-text">
        <div class="error-message">Failed to load image</div>
        <div class="error-url">${src}</div>
      </div>
    `;
  }
}

/**
 * Load a single preloader
 */
async function processPreloader(preloader) {
  // Skip if already processed
  if (loadedPreloaders.has(preloader)) return;
  loadedPreloaders.add(preloader);
  
  const src = preloader.dataset.src;
  const alt = preloader.dataset.alt || "";
  
  try {
    const img = await loadImage(src, alt);
    replacePreloader(preloader, img);
  } catch (error) {
    console.error("[lazyload]", error);
    showError(preloader, src);
  }
}

/**
 * Create intersection observer
 */
function getObserver() {
  if (!intersectionObserver) {
    intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            intersectionObserver.unobserve(entry.target);
            processPreloader(entry.target);
          }
        });
      },
      {
        rootMargin: "100px",
        threshold: 0.01,
      }
    );
  }
  return intersectionObserver;
}

/**
 * Initialize lazy loading
 */
export default function initLazyLoad() {
  const preloaders = document.querySelectorAll(".img-preloader:not([data-observed])");
  if (preloaders.length === 0) return;
  
  const observer = getObserver();
  preloaders.forEach((preloader) => {
    preloader.dataset.observed = "true";
    observer.observe(preloader);
  });
}

/**
 * Force load all preloaders (for encrypted content)
 */
export function forceLoadAllPreloaders() {
  document.querySelectorAll(".img-preloader").forEach(processPreloader);
}
