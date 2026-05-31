(() => {
  if (window.__littleImpTaskReportLightbox) {
    return;
  }

  window.__littleImpTaskReportLightbox = true;

  const styleId = "task-report-lightbox-style";
  const minZoom = 0.1;
  const maxZoom = 4;
  const zoomStep = 0.25;

  let overlay = null;
  let image = null;
  let caption = null;
  let previousFocus = null;
  let zoom = 1;
  let offsetX = 0;
  let offsetY = 0;
  let dragState = null;

  function ensureStyles() {
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .report-lightbox-open {
        overflow: hidden;
      }

      .report-lightbox {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: grid;
        place-items: center;
        background: rgba(13, 15, 24, .82);
        color: #f8fafc;
      }

      .report-lightbox__stage {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        overflow: hidden;
        padding: 72px 24px 68px;
      }

      .report-lightbox__image {
        display: block;
        max-width: none;
        max-height: none;
        width: auto;
        height: auto;
        transform-origin: center center;
        cursor: grab;
        user-select: none;
        will-change: transform;
        box-shadow: 0 22px 70px rgba(0, 0, 0, .45);
      }

      .report-lightbox__image:active {
        cursor: grabbing;
      }

      .report-lightbox__toolbar {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 1;
        display: flex;
        gap: 8px;
      }

      .report-lightbox__button {
        display: inline-grid;
        place-items: center;
        width: 38px;
        height: 38px;
        border: 1px solid rgba(248, 250, 252, .28);
        border-radius: 8px;
        background: rgba(15, 23, 42, .78);
        color: #f8fafc;
        font: 700 18px/1 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        cursor: pointer;
      }

      .report-lightbox__button:hover,
      .report-lightbox__button:focus-visible {
        border-color: rgba(248, 250, 252, .72);
        background: rgba(30, 41, 59, .92);
        outline: none;
      }

      .report-lightbox__caption {
        position: fixed;
        left: 50%;
        bottom: 18px;
        z-index: 1;
        width: min(900px, calc(100vw - 40px));
        transform: translateX(-50%);
        color: rgba(248, 250, 252, .88);
        font: 500 14px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        text-align: center;
      }

      @media (max-width: 640px) {
        .report-lightbox__stage {
          padding: 70px 14px 70px;
        }

        .report-lightbox__toolbar {
          top: 12px;
          right: 12px;
        }

        .report-lightbox__button {
          width: 36px;
          height: 36px;
        }
      }
    `;
    document.head.append(style);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function updateTransform() {
    if (!image) {
      return;
    }

    image.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`;
  }

  function getNaturalImageSize() {
    if (!image) {
      return null;
    }

    const naturalWidth = image.naturalWidth || image.width;
    const naturalHeight = image.naturalHeight || image.height;
    if (!naturalWidth || !naturalHeight) {
      return null;
    }

    return {
      width: naturalWidth,
      height: naturalHeight,
    };
  }

  function getAvailablePreviewSize() {
    return {
      width: Math.max(1, window.innerWidth - 48),
      height: Math.max(1, window.innerHeight - 160),
    };
  }

  function calculateFitZoom(size) {
    const available = getAvailablePreviewSize();
    return clamp(Math.min(available.width / size.width, available.height / size.height, 1), minZoom, 1);
  }

  function setZoom(nextZoom) {
    zoom = clamp(nextZoom, minZoom, maxZoom);

    if (zoom === 1) {
      offsetX = 0;
      offsetY = 0;
    }

    updateTransform();
  }

  function fitViewToImage() {
    const size = getNaturalImageSize();
    zoom = size ? calculateFitZoom(size) : 1;
    offsetX = 0;
    offsetY = 0;
    updateTransform();
  }

  function resetView() {
    setZoom(1);
  }

  function applyNativeImageSize() {
    const size = getNaturalImageSize();
    if (!image || !size) {
      return;
    }

    image.style.width = `${size.width}px`;
    image.style.height = `${size.height}px`;
    fitViewToImage();
  }

  function closeLightbox() {
    if (!overlay) {
      return;
    }

    overlay.remove();
    overlay = null;
    image = null;
    caption = null;
    dragState = null;
    document.body.classList.remove("report-lightbox-open");

    if (previousFocus && typeof previousFocus.focus === "function") {
      previousFocus.focus();
    }
  }

  function onPointerDown(event) {
    if (!image || event.button !== 0) {
      return;
    }

    event.preventDefault();
    dragState = {
      startX: event.clientX,
      startY: event.clientY,
      originX: offsetX,
      originY: offsetY,
    };
    image.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (!dragState) {
      return;
    }

    offsetX = dragState.originX + event.clientX - dragState.startX;
    offsetY = dragState.originY + event.clientY - dragState.startY;
    updateTransform();
  }

  function onPointerUp() {
    dragState = null;
  }

  function onWheel(event) {
    if (!overlay) {
      return;
    }

    event.preventDefault();
    setZoom(zoom + (event.deltaY < 0 ? zoomStep : -zoomStep));
  }

  function createLightbox() {
    ensureStyles();

    const element = document.createElement("div");
    element.className = "report-lightbox";
    element.dataset.reportLightbox = "";
    element.setAttribute("role", "dialog");
    element.setAttribute("aria-modal", "true");
    element.setAttribute("aria-label", "Image preview");
    element.innerHTML = `
      <div class="report-lightbox__stage" data-report-lightbox-action="close">
        <img class="report-lightbox__image" data-report-lightbox-image alt="">
      </div>
      <div class="report-lightbox__toolbar" aria-label="Image controls">
        <button class="report-lightbox__button" type="button" data-report-lightbox-action="zoom-out" aria-label="Zoom out">-</button>
        <button class="report-lightbox__button" type="button" data-report-lightbox-action="zoom-in" aria-label="Zoom in">+</button>
        <button class="report-lightbox__button" type="button" data-report-lightbox-action="reset" aria-label="Actual size">1:1</button>
        <button class="report-lightbox__button" type="button" data-report-lightbox-action="close" aria-label="Close">×</button>
      </div>
      <div class="report-lightbox__caption" data-report-lightbox-caption></div>
    `;

    image = element.querySelector("[data-report-lightbox-image]");
    caption = element.querySelector("[data-report-lightbox-caption]");

    image.addEventListener("click", (event) => event.stopPropagation());
    image.addEventListener("load", applyNativeImageSize);
    image.addEventListener("pointerdown", onPointerDown);
    image.addEventListener("dblclick", () => {
      setZoom(zoom === 1 ? 2 : 1);
    });
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", onPointerUp);
    element.addEventListener("pointercancel", onPointerUp);
    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) {
        return;
      }

      const actionTarget = event.target.closest("[data-report-lightbox-action]");
      if (!actionTarget) {
        return;
      }

      const action = actionTarget.dataset.reportLightboxAction;
      if (action === "zoom-in") {
        setZoom(zoom + zoomStep);
      } else if (action === "zoom-out") {
        setZoom(zoom - zoomStep);
      } else if (action === "reset") {
        resetView();
      } else if (action === "close") {
        closeLightbox();
      }
    });

    return element;
  }

  function getCaptionText(sourceImage) {
    const figureCaption = sourceImage.closest("figure")?.querySelector("figcaption");
    return figureCaption?.textContent?.trim() || sourceImage.alt || "";
  }

  function openLightbox(sourceImage) {
    const source = sourceImage.currentSrc || sourceImage.getAttribute("src");
    if (!source) {
      return;
    }

    previousFocus = document.activeElement;
    overlay = overlay || createLightbox();
    image.style.width = "";
    image.style.height = "";
    image.src = source;
    image.alt = sourceImage.alt || "";
    caption.textContent = getCaptionText(sourceImage);
    fitViewToImage();

    document.body.append(overlay);
    document.body.classList.add("report-lightbox-open");
    if (image.complete) {
      applyNativeImageSize();
    }
    overlay.querySelector('[data-report-lightbox-action="close"]')?.focus();
  }

  document.addEventListener(
    "click",
    (event) => {
      if (!(event.target instanceof Element)) {
        return;
      }

      const sourceImage = event.target.closest("img");
      if (!sourceImage || sourceImage.closest("[data-report-lightbox]")) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      openLightbox(sourceImage);
    },
    true,
  );

  document.addEventListener("keydown", (event) => {
    if (!overlay) {
      return;
    }

    if (event.key === "Escape") {
      closeLightbox();
    } else if (event.key === "+" || event.key === "=") {
      setZoom(zoom + zoomStep);
    } else if (event.key === "-") {
      setZoom(zoom - zoomStep);
    } else if (event.key === "0") {
      resetView();
    }
  });
})();
