/**
 * Image EXIF Info Card - Runtime Handler
 * 
 * Handles responsive layout detection for image-exif containers:
 * 1. Side-by-Side: Tries to put info next to image if space permits (Priority 1)
 * 2. Float: Detects if float overlay card would exceed image height (Priority 2)
 * 3. Fallback: Adds fallback classes when needed
 */

(function() {
  'use strict';

  // Developer Constant: Force Layout Mode
  // Options: 'None' (default), 'Side', 'Float', 'Block'
  const DEV_FORCE_LAYOUT_MODE = 'Float';

  /**
   * Check if Side-by-Side layout is possible
   * @returns {boolean} true if side layout applied
   */
  function checkSideLayout(container) {
    const imageWrapper = container.querySelector('.image-exif-image-wrapper');
    const infoCard = container.querySelector('.image-exif-info-card');
    if (!imageWrapper || !infoCard) return false;

    // Check dev override
    if (DEV_FORCE_LAYOUT_MODE !== 'None') {
        if (DEV_FORCE_LAYOUT_MODE === 'Side') {
             // Force Apply Side Mode
            if (!container.classList.contains('image-exif-side')) {
                container.classList.add('image-exif-side');
                container.classList.remove('image-exif-overflow-fallback');
                infoCard.style.display = '';
                infoCard.style.visibility = '';
                infoCard.style.opacity = '';
                // In forced mode, we still need a width, default to 300px if calculation skipped
                // But better to let it be or set max-width: 400px (CSS default)
                // We'll leave inline maxWidth empty to let CSS handle it, or set a reasonable default
                infoCard.style.maxWidth = '400px'; 
            }
            // Continue execution to check if it WOULD fallback, but still return true at end
        } else {
            return false; // Force fail side check if mode is Float or Block
        }
    } else {
        // Normal mode execution, proceed
    }

    const img = imageWrapper.querySelector('img.image-exif-img');
    const preloader = imageWrapper.querySelector('.img-preloader');
    
    // Get image dimensions
    let imgHeight = 0;
    let imgWidth = 0;
    
    if (img && img.complete && img.naturalHeight > 0) {
      imgHeight = img.offsetHeight || img.clientHeight;
      imgWidth = img.offsetWidth || img.clientWidth;
    } else if (preloader) {
      imgHeight = preloader.offsetHeight || preloader.clientHeight;
      imgWidth = preloader.offsetWidth || preloader.clientWidth;
    }

    if (imgHeight === 0 || imgWidth === 0) return false;

    // Use getBoundingClientRect for precise measurement
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    
    // Get gap from CSS if possible, fallback to 24
    let gap = 24; // 1.5rem
    
    // Safety buffer
    const buffer = 10;
    
    // Check if we have enough space
    // Since we are moving card into flex row with image, the total width requirement is:
    // imgWidth + gap + minCardWidth <= containerWidth
    
    const minCardWidth = 130;
    const availableSpace = containerWidth - imgWidth - gap - buffer;

    // Condition 1: Horizontal space >= 130px
    if (availableSpace >= minCardWidth) {
      // Measure Card Height at this width
      const clone = infoCard.cloneNode(true);
      clone.classList.remove('expanded');
      
      // Calculate strict width limit
      const targetWidth = Math.min(availableSpace, 400);
      
      Object.assign(clone.style, {
          display: 'block',
          visibility: 'hidden',
          position: 'absolute',
          top: '0',
          left: '0',
          width: targetWidth + 'px', // Enforce strict width
          height: 'auto',
          maxHeight: 'none',
          padding: '0.65rem',
          boxSizing: 'border-box',
          zIndex: '-9999'
      });
      
      // Force data visible
      const cloneData = clone.querySelector('.image-exif-data');
      if (cloneData) {
        Object.assign(cloneData.style, {
            display: 'grid',
            height: 'auto',
            marginTop: '0.6rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '0.6rem'
        });
      }
      
      // Hide toggle button in clone
      const cloneBtn = clone.querySelector('.image-exif-toggle-btn');
      if (cloneBtn) cloneBtn.style.display = 'none';
      
      // Append clone to container for measurement
      container.appendChild(clone);
      const cardHeight = clone.offsetHeight;
      container.removeChild(clone);
      
      // Condition 2: Height <= Image Height * 1.1
      if (cardHeight <= imgHeight * 1.1) {
        // Apply Side Mode
        if (!container.classList.contains('image-exif-side')) {
            container.classList.add('image-exif-side');
            // Clean up other mode artifacts
            container.classList.remove('image-exif-overflow-fallback');
            infoCard.style.display = '';
            infoCard.style.visibility = '';
            infoCard.style.opacity = '';
        }
        
        // Always set max-width to ensure flex item doesn't grow beyond available space
        // This is CRITICAL to prevent wrapping
        infoCard.style.maxWidth = targetWidth + 'px';
        
        return true;
      } else {
        if (DEV_FORCE_LAYOUT_MODE !== 'None') {
             console.warn('[ImageEXIF] Forced Side Mode Warning: Height Mismatch', {
                imgHeight,
                cardHeight,
                limit: imgHeight * 1.1,
                reason: 'Card taller than image (Forced Mode Active)'
            });
            // In forced mode, we still return true
            if (DEV_FORCE_LAYOUT_MODE === 'Side') return true;
        } else {
            // Normal None mode warning
            // console.warn('[ImageEXIF] Side Layout Fallback: Height Mismatch', ...); 
            // User requested NO output in None mode
        }
      }
    } else {
        if (DEV_FORCE_LAYOUT_MODE !== 'None') {
             console.warn('[ImageEXIF] Forced Side Mode Warning: Width Mismatch', {
                availableSpace,
                minCardWidth,
                containerWidth,
                imgWidth,
                reason: 'Not enough horizontal space (Forced Mode Active)'
            });
            // In forced mode, we still return true if mode is Side
            if (DEV_FORCE_LAYOUT_MODE === 'Side') return true;
        } else {
             // Normal None mode warning
             // console.warn('[ImageEXIF] Side Layout Fallback: Width Mismatch', ...);
             // User requested NO output in None mode
        }
    }
    
    // If we are here, it means check failed
    // If Forced Side Mode, we ALREADY returned true above (inside warning blocks) if we reached them.
    // However, if availableSpace < minCardWidth, we are in the 'else' block of Condition 1.
    // If cardHeight > imgHeight * 1.1, we are in 'else' block of Condition 2.
    
    // One edge case: if we are forcing Side, but we didn't enter calculation blocks?
    // We handle that by returning true if forced side.
    if (DEV_FORCE_LAYOUT_MODE === 'Side') return true;

    return false;
  }

  /**
   * Check if float mode card would overflow the image
   */
  function checkFloatLayout(container) {
    // If side mode is active, don't do float check
    if (container.classList.contains('image-exif-side')) return;
    
    // Check dev override
    if (DEV_FORCE_LAYOUT_MODE !== 'None') {
        if (DEV_FORCE_LAYOUT_MODE === 'Float') {
            // Force Float Mode (ensure no fallback class)
            if (container.classList.contains('image-exif-overflow-fallback')) {
                infoCard.style.transition = 'none';
                container.classList.remove('image-exif-overflow-fallback');
                infoCard.offsetHeight;
                infoCard.style.transition = '';
            }
            // Continue to check if it WOULD fallback
        } else if (DEV_FORCE_LAYOUT_MODE === 'Block') {
             // Force Block Mode (add fallback class if this is how block is simulated from float)
             if (!container.classList.contains('image-exif-overflow-fallback')) {
                container.classList.add('image-exif-overflow-fallback');
                infoCard.style.display = '';
                infoCard.style.visibility = '';
                infoCard.style.opacity = '';
             }
             return; // Block mode is fallback, so no need to check overflow further
        }
    }

    const imageWrapper = container.querySelector('.image-exif-image-wrapper');
    const infoCard = container.querySelector('.image-exif-info-card');
    
    if (!imageWrapper || !infoCard) return;

    // Get image element (could be img or img-preloader)
    const img = imageWrapper.querySelector('img.image-exif-img');
    const preloader = imageWrapper.querySelector('.img-preloader');
    
    let imageHeight = 0;
    
    if (img && img.complete && img.naturalHeight > 0) {
      imageHeight = img.offsetHeight || img.clientHeight;
    } else if (preloader) {
      imageHeight = preloader.offsetHeight || preloader.clientHeight;
    }

    if (imageHeight === 0) return;

    // Use clone to measure dimensions
    const clone = infoCard.cloneNode(true);
    clone.classList.remove('expanded');
    
    Object.assign(clone.style, {
        display: 'block',
        visibility: 'hidden',
        position: 'absolute',
        top: '0',
        left: '0',
        width: 'max-content',
        maxWidth: '60%',
        height: 'auto',
        maxHeight: 'none',
        overflow: 'visible',
        boxSizing: 'border-box',
        padding: '0.65rem',
        background: 'transparent',
        zIndex: '-9999'
    });
    
    const cloneData = clone.querySelector('.image-exif-data');
    if (cloneData) {
      Object.assign(cloneData.style, {
          display: 'grid',
          height: 'auto',
          opacity: '1',
          marginTop: '0.6rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.6rem'
      });
    }
    
    const cloneBtn = clone.querySelector('.image-exif-toggle-btn');
    if (cloneBtn) cloneBtn.style.display = 'none';

    imageWrapper.appendChild(clone);
    const cardHeight = clone.offsetHeight;
    const scrollHeight = clone.scrollHeight;
    const finalCardHeight = Math.max(cardHeight, scrollHeight);
    imageWrapper.removeChild(clone);

    const availableHeight = imageHeight - 24;

    if (finalCardHeight > availableHeight - 2) {
      if (!container.classList.contains('image-exif-overflow-fallback')) {
        if (DEV_FORCE_LAYOUT_MODE !== 'None') {
            console.warn('[ImageEXIF] Forced Float Mode Warning: Height Overflow', {
                finalCardHeight,
                availableHeight,
                diff: finalCardHeight - availableHeight,
                reason: 'Card height exceeds available image height (Forced Mode Active)'
            });
            // If forced Float, we DO NOT add fallback class, effectively ignoring the overflow
            if (DEV_FORCE_LAYOUT_MODE === 'Float') return;
        }
        
        container.classList.add('image-exif-overflow-fallback');
        infoCard.style.display = '';
        infoCard.style.visibility = '';
        infoCard.style.opacity = '';
      }
    } else {
      if (container.classList.contains('image-exif-overflow-fallback')) {
        infoCard.style.transition = 'none';
        container.classList.remove('image-exif-overflow-fallback');
        infoCard.offsetHeight;
        infoCard.style.transition = '';
      }
    }
  }

  /**
   * Main Layout Controller
   */
  function checkLayout(container) {
    // 1. Store original layout
    if (!container.dataset.originalLayout) {
      if (container.classList.contains('image-exif-float')) container.dataset.originalLayout = 'float';
      else if (container.classList.contains('image-exif-block')) container.dataset.originalLayout = 'block';
      else container.dataset.originalLayout = 'block';
    }

    const infoCard = container.querySelector('.image-exif-info-card');

    // 2. Try Side-by-Side (Highest Priority)
    const isSide = checkSideLayout(container);
    
    if (isSide) {
        return;
    } else {
        // Fallback cleanup
        if (container.classList.contains('image-exif-side')) {
            container.classList.remove('image-exif-side');
        }
        
        // CRITICAL: Clean up side-mode inline styles
        if (infoCard) {
            infoCard.style.maxWidth = ''; // Remove fixed width
        }
    }

    // 3. Fallback to configured layout
    if (container.dataset.originalLayout === 'float') {
        checkFloatLayout(container);
    } else {
        // Block mode
        if (container.classList.contains('image-exif-overflow-fallback')) {
            container.classList.remove('image-exif-overflow-fallback');
        }
        
        // Clean up any potential inline styles from other modes
        if (infoCard) {
            infoCard.style.display = '';
            infoCard.style.visibility = '';
            infoCard.style.opacity = '';
        }
    }
  }

  /**
   * Handle toggle button click
   */
  function handleToggle(btn) {
    const card = btn.closest('.image-exif-info-card');
    if (!card) return;
    
    const dataContainer = card.querySelector('.image-exif-data');
    if (!dataContainer) return;
    
    const isExpanded = card.classList.contains('expanded');
    
    if (isExpanded) {
      dataContainer.style.height = dataContainer.scrollHeight + 'px';
      dataContainer.offsetHeight;
      card.classList.remove('expanded');
      dataContainer.style.height = '0';
    } else {
      dataContainer.style.height = '0px';
      dataContainer.offsetHeight;
      card.classList.add('expanded');
      dataContainer.style.height = dataContainer.scrollHeight + 'px';
      dataContainer.addEventListener('transitionend', function() {
        if (card.classList.contains('expanded')) {
          dataContainer.style.height = 'auto';
        }
      }, { once: true });
    }
  }

  /**
   * Initialize all image-exif containers
   */
  function initImageExif() {
    const containers = document.querySelectorAll('.image-exif-container');
    
    containers.forEach(container => {
      const toggleBtns = container.querySelectorAll('.image-exif-toggle-btn');
      toggleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleToggle(btn);
        });
      });

      // Initial check
      checkLayout(container);

      // Listen for image load
      const images = container.querySelectorAll('img.image-exif-img');
      images.forEach(img => {
        if (!img.complete) {
          img.addEventListener('load', () => {
            checkLayout(container);
          });
        }
      });

      // Listen for lazyload completion
      const imageWrapper = container.querySelector('.image-exif-image-wrapper');
      if (imageWrapper && imageWrapper.querySelector('.img-preloader')) {
        const observer = new MutationObserver((mutations) => {
          mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
              if (node.tagName === 'IMG') {
                if (node.complete) {
                  checkLayout(container);
                } else {
                  node.addEventListener('load', () => {
                    checkLayout(container);
                  });
                }
              }
            });
          });
        });
        
        observer.observe(imageWrapper, { childList: true });
      }
    });
  }

  /**
   * Re-check on resize
   */
  function handleResize() {
    const containers = document.querySelectorAll('.image-exif-container');
    containers.forEach(container => {
      checkLayout(container);
    });
  }

  // Debounce resize handler
  let resizeTimeout;
  let isChecking = false;
  
  function debouncedResize() {
    if (isChecking) return;
    
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (isChecking) return;
      isChecking = true;
      requestAnimationFrame(() => {
        handleResize();
        isChecking = false;
      });
    }, 150);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initImageExif);
  } else {
    initImageExif();
  }

  document.addEventListener('swup:contentReplaced', initImageExif);
  document.addEventListener('pjax:complete', initImageExif);

  window.addEventListener('resize', debouncedResize);
  
  const toggleBar = document.querySelector(".page-aside-toggle");
  if (toggleBar) {
    toggleBar.addEventListener("click", () => {
      setTimeout(handleResize, 300);
    });
  }

  window.addEventListener('redefine:force-exif-check', debouncedResize);
})();
