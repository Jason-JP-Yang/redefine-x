export default function imageViewer() {
  // Idempotent: utils.refresh() may call this multiple times (swup/page transitions)
  if (window.__REDEFINE_X_IMAGE_VIEWER_INITIALIZED__) {
    return;
  }
  window.__REDEFINE_X_IMAGE_VIEWER_INITIALIZED__ = true;

  const maskDom = document.querySelector(".image-viewer-container");
  if (!maskDom) {
    console.warn("Image viewer container not found.");
    return;
  }

  // Prevent <img src=""> from requesting the current document in some browsers
  const legacyImg = maskDom.querySelector("img");
  if (legacyImg) {
    legacyImg.src = "data:,";
    legacyImg.alt = "";
    legacyImg.style.display = "none";
  }

  const stage = (() => {
    const existing = maskDom.querySelector(".image-viewer-stage");
    if (existing) return existing;
    const el = document.createElement("div");
    el.className = "image-viewer-stage";
    maskDom.appendChild(el);
    return el;
  })();

  const state = {
    isOpen: false,
    currentIndex: -1,
    items: /** @type {HTMLImageElement[]} */ ([]),
    activeImg: /** @type {HTMLImageElement|null} */ (null),
    placeholder: /** @type {HTMLElement|null} */ (null),
    scale: 1,
    translateX: 0,
    translateY: 0,
    isMouseDown: false,
    dragged: false,
    lastMouseX: 0,
    lastMouseY: 0,
  };

  const VIEWABLE_IMG_SELECTOR =
    ".markdown-body img, .masonry-item img, #shuoshuo-content img";

  function isViewableImg(img) {
    if (!img) return false;
    if (img.closest(".image-viewer-container")) return false;
    // Only allow clicking after the image is fully loaded
    if (!img.complete || !img.naturalWidth) return false;
    // Optional opt-out
    if (img.hasAttribute("data-no-viewer")) return false;
    return true;
  }

  function collectLoadedImages() {
    return Array.from(document.querySelectorAll(VIEWABLE_IMG_SELECTOR)).filter(
      (node) => node instanceof HTMLImageElement && isViewableImg(node),
    );
  }

  function show(isShow) {
    state.isOpen = isShow;
    document.body.style.overflow = isShow ? "hidden" : "auto";
    if (isShow) maskDom.classList.add("active");
    else maskDom.classList.remove("active");
  }

  function resetTransform() {
    state.scale = 1;
    state.translateX = 0;
    state.translateY = 0;
    if (state.activeImg) {
      state.activeImg.style.transform = "translate(0, 0) scale(1)";
      state.activeImg.style.cursor = "grab";
    }
  }

  function applyTransform() {
    if (!state.activeImg) return;
    state.activeImg.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
  }

  function restoreActiveImage() {
    if (state.activeImg && state.placeholder) {
      state.placeholder.replaceWith(state.activeImg);
    }
    state.activeImg = null;
    state.placeholder = null;
    stage.innerHTML = "";
  }

  function mountImage(img) {
    restoreActiveImage();
    resetTransform();

    const placeholder = document.createElement("span");
    placeholder.className = "image-viewer-placeholder";
    // Preserve layout while the image node is moved into the overlay
    placeholder.style.display = "inline-block";
    placeholder.style.width = `${img.width || img.clientWidth || 0}px`;
    placeholder.style.height = `${img.height || img.clientHeight || 0}px`;

    img.before(placeholder);
    stage.appendChild(img);

    img.style.cursor = "grab";

    state.activeImg = img;
    state.placeholder = placeholder;
    state.dragged = false;
  }

  function openAt(img) {
    state.items = collectLoadedImages();
    state.currentIndex = state.items.indexOf(img);
    if (state.currentIndex < 0) {
      // Fallback: still open the clicked image only
      state.items = [img];
      state.currentIndex = 0;
    }

    mountImage(img);
    show(true);
    document.addEventListener("keydown", onKeydown);
  }

  function close() {
    if (!state.isOpen) return;
    document.removeEventListener("keydown", onKeydown);
    show(false);
    resetTransform();
    restoreActiveImage();
  }

  function navigate(delta) {
    if (!state.isOpen) return;
    if (state.items.length <= 1) return;

    const nextIndex =
      (state.currentIndex + delta + state.items.length) % state.items.length;
    const nextImg = state.items[nextIndex];
    if (!nextImg || !isViewableImg(nextImg)) return;

    state.currentIndex = nextIndex;
    mountImage(nextImg);
  }

  function onKeydown(event) {
    if (!state.isOpen) return;

    if (event.key === "Escape") {
      close();
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      navigate(-1);
      return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      navigate(1);
      return;
    }
  }

  // Close when clicking outside the image (but not when finishing a drag)
  maskDom.addEventListener("click", (event) => {
    if (!state.isOpen) return;
    if (state.dragged) {
      state.dragged = false;
      return;
    }
    if (event.target === maskDom || event.target === stage) {
      close();
    }
  });

  // Event delegation: avoid attaching listeners to each image and support swup
  document.addEventListener(
    "click",
    (event) => {
      if (state.isOpen) return;
      const target = event.target;
      if (!(target instanceof HTMLImageElement)) return;
      if (!target.matches(VIEWABLE_IMG_SELECTOR)) return;
      if (!isViewableImg(target)) return;
      openAt(target);
    },
    true,
  );

  // Zoom & drag on the active image (no re-request: we move the same node)
  stage.addEventListener(
    "wheel",
    (event) => {
      if (!state.isOpen || !state.activeImg) return;
      event.preventDefault();

      const rect = state.activeImg.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      const dx = offsetX - rect.width / 2;
      const dy = offsetY - rect.height / 2;

      const oldScale = state.scale;
      state.scale += event.deltaY * -0.001;
      state.scale = Math.min(Math.max(0.8, state.scale), 4);

      if (oldScale < state.scale) {
        state.translateX -= dx * (state.scale - oldScale);
        state.translateY -= dy * (state.scale - oldScale);
      } else {
        state.translateX = 0;
        state.translateY = 0;
      }

      applyTransform();
    },
    { passive: false },
  );

  stage.addEventListener(
    "mousedown",
    (event) => {
      if (!state.isOpen || !state.activeImg) return;
      event.preventDefault();
      state.isMouseDown = true;
      state.lastMouseX = event.clientX;
      state.lastMouseY = event.clientY;
      state.activeImg.style.cursor = "grabbing";
    },
    { passive: false },
  );

  stage.addEventListener(
    "mousemove",
    (event) => {
      if (!state.isOpen || !state.activeImg) return;
      if (!state.isMouseDown) return;
      const deltaX = event.clientX - state.lastMouseX;
      const deltaY = event.clientY - state.lastMouseY;
      state.translateX += deltaX;
      state.translateY += deltaY;
      state.lastMouseX = event.clientX;
      state.lastMouseY = event.clientY;
      state.dragged = true;
      applyTransform();
    },
    { passive: false },
  );

  function endDrag(event) {
    if (!state.isOpen || !state.activeImg) return;
    if (state.isMouseDown) {
      event.stopPropagation();
    }
    state.isMouseDown = false;
    state.activeImg.style.cursor = "grab";
  }

  stage.addEventListener("mouseup", endDrag, { passive: false });
  stage.addEventListener("mouseleave", endDrag, { passive: false });
}
