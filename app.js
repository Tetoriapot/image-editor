(() => {
  "use strict";

  const SUPPORTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
  const FORMAT_MIME = {
    png: "image/png",
    jpeg: "image/jpeg",
    webp: "image/webp",
  };
  const MAX_EXPORT_DIMENSION = 32767;
  const MAX_EXPORT_PIXELS = 120_000_000;
  const MIN_CROP_SIZE = 2;
  const GRID_COLUMNS_MIN = 1;
  const GRID_COLUMNS_MAX = 20;
  const DEFAULT_GRID_COLUMNS = 2;
  const SPLIT_AXIS_MIN = 1;
  const SPLIT_AXIS_MAX = 20;
  const DEFAULT_SPLIT_COLUMNS = 2;
  const DEFAULT_SPLIT_ROWS = 1;
  const PROCESSING_PRESET_STORAGE_KEY = "image-tool.processing-presets.v1";
  const PROCESSING_PRESET_STORAGE_VERSION = 1;
  const PROCESSING_PRESET_LIMIT = 50;
  const PROCESSING_PRESET_NAME_MAX_LENGTH = 60;
  const PROCESSING_PRESET_MODES = new Set(["combine", "split", "edit", "canvas", "filter"]);
  const PROCESSING_PRESET_MODE_LABELS = Object.freeze({
    combine: "画像結合",
    split: "画像分割",
    edit: "画像編集",
    canvas: "画像合成",
    filter: "画像加工",
  });
  const FINISH_BLEND_MODES = new Set(["normal", "multiply", "screen", "overlay"]);
  const FINISH_FIT_MODES = new Set(["stretch", "center", "cover", "contain"]);
  const FINISH_PLACEMENTS = new Set(["front", "behind"]);
  const FINISH_COMPOSITE_OPERATIONS = Object.freeze({
    normal: "source-over",
    multiply: "multiply",
    screen: "screen",
    overlay: "overlay",
  });

  const state = {
    mode: "combine",
    images: [],
    selectedId: null,
    markedImageIds: new Set(),
    processingPresets: [],
    imageHistory: { past: [], future: [], current: null, restoring: false, group: null },
    imageSourceUrls: new Set(),
    batchTargetIds: null,
    pendingProject: null,
    draggedId: null,
    cropGesture: null,
    previewFrame: 0,
    loadGeneration: 0,
    loadQueue: Promise.resolve(),
    queuedLoadCount: 0,
    pendingLoads: new Map(),
    exporting: false,
    downloadCleanup: null,
    filter: {
      comparingOriginal: false,
      previewToken: 0,
      selectedFinishLayerId: null,
      draggedFinishLayerId: null,
      finishGesture: null,
      finishSourceUrls: new Set(),
      activeFinishSourceUrls: new Set(),
      finishLoadGeneration: 0,
      finishLoadQueue: Promise.resolve(),
      queuedFinishLoadCount: 0,
      pendingFinishLoads: new Map(),
    },
    canvas: {
      width: 1200,
      height: 800,
      backgroundMode: "transparent",
      backgroundColor: "#f3f4f6",
      layers: [],
      selectedId: null,
      draggedLayerId: null,
      gesture: null,
      zoom: 1,
      displayScale: 1,
      snap: true,
      gridVisible: false,
      gridSize: 20,
      guideX: null,
      guideY: null,
      history: [],
      redo: [],
      clipboard: null,
      sourceUrls: new Set(),
      loadGeneration: 0,
      loadQueue: Promise.resolve(),
      queuedLoadCount: 0,
      pendingLoads: new Map(),
      addAsBackground: false,
    },
  };

  const el = {};
  const ids = [
    "fileInput",
    "addImagesBtn",
    "dropZone",
    "imageList",
    "imageCount",
    "imageBulkActions",
    "imageSelectAll",
    "imageSelectionCount",
    "deleteSelectedImagesBtn",
    "applyMarkedCropBtn", "applyMarkedResizeBtn", "applyMarkedFilterBtn", "exportMarkedBtn",
    "batchSourceHint", "undoImagesBtn", "redoImagesBtn", "undoRemovalBtn",
    "saveProjectBtn", "openProjectBtn", "projectFileInput", "projectImportSummary",
    "confirmProjectOpenBtn", "cancelProjectOpenBtn", "projectStatus",
    "mobilePreview", "mobilePreviewCanvas", "mobilePreviewLabel", "mobilePreviewToggle",
    "readableUiBtn", "modePurpose", "importReport", "importReportList", "filterFinishPlacementHelp",
    "modeCombineBtn",
    "modeEditBtn",
    "modeCanvasBtn",
    "modeFilterBtn",
    "modeSplitBtn",
    "updatesMenuButton",
    "helpMenuButton",
    "settingsMenuButton",
    "updatesDialog",
    "updatesDialogClose",
    "updatesDialogFooterClose",
    "helpDialog",
    "helpDialogClose",
    "helpDialogFooterClose",
    "helpUsageTab",
    "helpShortcutsTab",
    "helpUsagePanel",
    "helpShortcutsPanel",
    "processingPresetDialog",
    "processingPresetDialogClose",
    "processingPresetDialogFooterClose",
    "standardAssetPanel",
    "canvasLayerPanel",
    "canvasFileInput",
    "canvasAddBtn",
    "canvasLayerList",
    "canvasLayerCount",
    "combineSettings",
    "editSettings",
    "canvasSettings",
    "filterSettings",
    "splitSettings",
    "previewPlaceholder",
    "combinePreviewCanvas",
    "editViewport",
    "editCanvas",
    "cropOverlay",
    "canvasViewport",
    "canvasWorkspace",
    "canvasDisplayCanvas",
    "filterPreviewCanvas",
    "splitPreviewCanvas",
    "canvasGridOverlay",
    "canvasSelectionBox",
    "canvasGuideX",
    "canvasGuideY",
    "canvasDropHint",
    "canvasZoomOutBtn",
    "canvasZoomInBtn",
    "canvasZoomResetBtn",
    "canvasZoomValue",
    "canvasWidth",
    "canvasHeight",
    "canvasPreset800Btn",
    "canvasPreset1200Btn",
    "canvasPreset1920Btn",
    "canvasPresetSquareBtn",
    "canvasPresetPortraitBtn",
    "canvasBackgroundMode",
    "canvasBackgroundColor",
    "canvasBackgroundInput",
    "canvasBackgroundBtn",
    "canvasLayerName",
    "canvasLayerX",
    "canvasLayerY",
    "canvasLayerWidth",
    "canvasLayerHeight",
    "canvasLayerKeepAspect",
    "canvasLayerRotation",
    "canvasRotateMinusBtn",
    "canvasRotatePlusBtn",
    "canvasRotateLeftBtn",
    "canvasRotateRightBtn",
    "canvasLayerOpacity",
    "canvasOpacityValue",
    "canvasBringFrontBtn",
    "canvasBringForwardBtn",
    "canvasSendBackwardBtn",
    "canvasSendBackBtn",
    "canvasVisibilityBtn",
    "canvasLockBtn",
    "canvasDuplicateBtn",
    "canvasDeleteBtn",
    "canvasFlipXBtn",
    "canvasFlipYBtn",
    "canvasAlignHorizontalBtn",
    "canvasAlignVerticalBtn",
    "canvasAlignCenterBtn",
    "canvasFitWidthBtn",
    "canvasFitHeightBtn",
    "canvasFitCanvasBtn",
    "canvasSnap",
    "canvasGridVisible",
    "canvasGridSize",
    "canvasUndoBtn",
    "canvasRedoBtn",
    "filterTimeNoneBtn",
    "filterTimeMorningBtn",
    "filterTimeNoonBtn",
    "filterTimeEveningBtn",
    "filterTimeNightBtn",
    "filterEffectNoneBtn",
    "filterEffectOilBtn",
    "filterEffectPosterBtn",
    "filterEffectMonochromeBtn",
    "filterEffectSepiaBtn",
    "filterIntensity",
    "filterIntensityValue",
    "filterAdvancedSettings",
    "filterBrightness",
    "filterBrightnessValue",
    "filterContrast",
    "filterContrastValue",
    "filterSaturation",
    "filterSaturationValue",
    "filterTemperature",
    "filterTemperatureValue",
    "filterTint",
    "filterTintValue",
    "filterHighlights",
    "filterHighlightsValue",
    "filterShadows",
    "filterShadowsValue",
    "filterOilSettings",
    "filterOilColor",
    "filterOilColorValue",
    "filterOilBrush",
    "filterOilBrushValue",
    "filterOilEdge",
    "filterOilEdgeValue",
    "filterPosterSettings",
    "filterPosterLevels",
    "filterPosterLevelsValue",
    "filterPosterEdge",
    "filterPosterEdgeValue",
    "filterCompareBtn",
    "filterApplyAllBtn",
    "filterExportVariantsBtn",
    "filterFinishInput",
    "filterFinishAddBtn",
    "filterFinishLayerList",
    "filterFinishLayerCount",
    "filterFinishEmpty",
    "filterFinishName",
    "filterFinishX",
    "filterFinishY",
    "filterFinishWidth",
    "filterFinishHeight",
    "filterFinishKeepAspect",
    "filterFinishRotation",
    "filterFinishOpacity",
    "filterFinishOpacityValue",
    "filterFinishBlendMode",
    "filterFinishPlacement",
    "filterFinishFrameBtn",
    "filterFinishFitMode",
    "filterFinishVisibilityBtn",
    "filterFinishDeleteBtn",
    "filterFinishBringFrontBtn",
    "filterFinishForwardBtn",
    "filterFinishBackwardBtn",
    "filterFinishSendBackBtn",
    "filterFinishFitCanvasBtn",
    "filterFinishFitWidthBtn",
    "filterFinishFitHeightBtn",
    "filterFinishPlaceCenterBtn",
    "filterFinishPlaceTopLeftBtn",
    "filterFinishPlaceTopRightBtn",
    "filterFinishPlaceBottomLeftBtn",
    "filterFinishPlaceBottomRightBtn",
    "filterApplyFinishAllBtn",
    "filterApplyFilterFinishAllBtn",
    "filterFinishSelectionBox",
    "combineDirection",
    "gridColumns",
    "splitColumns",
    "splitRows",
    "splitSummary",
    "combineSizing",
    "targetWidth",
    "targetHeight",
    "gapSize",
    "outerPadding",
    "backgroundMode",
    "customBackground",
    "outputFormat",
    "outputQuality",
    "qualityValue",
    "transparencyFormatHint",
    "processingPresetSection",
    "processingPresetMode",
    "processingPresetCount",
    "processingPresetName",
    "processingPresetSearch",
    "processingPresetSelect",
    "processingPresetList",
    "processingPresetEmpty",
    "processingPresetDialogStatus",
    "saveProcessingPresetBtn",
    "applyProcessingPresetBtn",
    "deleteProcessingPresetBtn",
    "cropRatio",
    "cropX",
    "cropY",
    "cropWidth",
    "cropHeight",
    "resizeWidth",
    "resizeHeight",
    "keepAspect",
    "resetSizeBtn",
    "preset512Btn",
    "preset1024Btn",
    "preset1920Btn",
    "rotateLeftBtn",
    "rotateRightBtn",
    "flipXBtn",
    "flipYBtn",
    "applyCropAllBtn",
    "applyResizeAllBtn",
    "presetSquareAllBtn",
    "preset169AllBtn",
    "preset512AllBtn",
    "preset1920WidthAllBtn",
    "resetCurrentBtn",
    "resetAllBtn",
    "clearAllBtn",
    "exportBtn",
    "statusMessage",
    "privacyNote",
  ];

  function boot() {
    for (const id of ids) el[id] = document.getElementById(id);

    const required = [
      "fileInput",
      "addImagesBtn",
      "dropZone",
      "imageList",
      "imageSelectAll",
      "deleteSelectedImagesBtn",
      "modeCombineBtn",
      "modeEditBtn",
      "modeCanvasBtn",
      "modeFilterBtn",
      "modeSplitBtn",
      "updatesMenuButton",
      "helpMenuButton",
      "settingsMenuButton",
      "updatesDialog",
      "helpDialog",
      "processingPresetDialog",
      "combineSettings",
      "editSettings",
      "combinePreviewCanvas",
      "editViewport",
      "editCanvas",
      "cropOverlay",
      "canvasLayerPanel",
      "canvasLayerList",
      "canvasSettings",
      "canvasViewport",
      "canvasWorkspace",
      "canvasDisplayCanvas",
      "canvasSelectionBox",
      "filterSettings",
      "filterPreviewCanvas",
      "splitSettings",
      "splitPreviewCanvas",
      "processingPresetSection",
      "processingPresetSelect",
      "saveProcessingPresetBtn",
      "applyProcessingPresetBtn",
      "deleteProcessingPresetBtn",
      "exportBtn",
    ];
    const missing = required.filter((id) => !el[id]);
    if (missing.length) {
      console.error(`初期化できません。要素が見つかりません: ${missing.join(", ")}`);
      return;
    }

    state.processingPresets = loadProcessingPresets();
    bindEvents();
    setMode("combine");
    refreshAll();
    state.imageHistory.current = snapshotImageWorkspace();
    bindWorkspaceImprovements();
  }

  function dialogIsOpen(dialog) {
    return Boolean(dialog?.open || dialog?.hasAttribute?.("open"));
  }

  function finishDialogClose(dialog) {
    if (!dialog) return;
    (dialog.__dialogOpeners || []).forEach((button) => button?.setAttribute("aria-expanded", "false"));
    const returnTarget = dialog.__dialogReturnFocus;
    dialog.__dialogReturnFocus = null;
    returnTarget?.focus?.();
  }

  function closeAppDialog(dialog) {
    if (!dialog || !dialogIsOpen(dialog)) return false;
    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute?.("open");
      dialog.open = false;
      finishDialogClose(dialog);
    }
    return true;
  }

  function openAppDialog(dialog, opener) {
    if (!dialog) return false;
    document.querySelectorAll?.("dialog.app-dialog[open]")?.forEach((candidate) => {
      if (candidate !== dialog) closeAppDialog(candidate);
    });
    if (dialogIsOpen(dialog)) return true;
    dialog.__dialogReturnFocus = opener || document.activeElement || null;
    (dialog.__dialogOpeners || []).forEach((button) => button?.setAttribute("aria-expanded", String(button === opener)));
    try {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else {
        dialog.setAttribute("open", "");
        dialog.open = true;
      }
    } catch {
      dialog.setAttribute("open", "");
      dialog.open = true;
    }
    requestAnimationFrame(() => dialog.querySelector?.(".app-dialog__close")?.focus?.());
    return true;
  }

  function bindAppDialog(openers, dialog, closeButtons) {
    if (!dialog) return;
    const availableOpeners = openers.filter(Boolean);
    const availableClosers = closeButtons.filter(Boolean);
    dialog.__dialogOpeners = availableOpeners;
    availableOpeners.forEach((button) => {
      button.setAttribute("aria-expanded", "false");
      button.addEventListener("click", () => openAppDialog(dialog, button));
    });
    availableClosers.forEach((button) => button.addEventListener("click", () => closeAppDialog(dialog)));
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeAppDialog(dialog);
    });
    dialog.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || typeof dialog.close === "function") return;
      event.preventDefault();
      closeAppDialog(dialog);
    });
    dialog.addEventListener("close", () => finishDialogClose(dialog));
  }

  function setHelpTab(name, focus = false) {
    const showShortcuts = name === "shortcuts";
    const tabs = [el.helpUsageTab, el.helpShortcutsTab];
    const activeTab = showShortcuts ? el.helpShortcutsTab : el.helpUsageTab;
    tabs.forEach((tab) => {
      if (!tab) return;
      const selected = tab === activeTab;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      tab.classList.toggle("is-active", selected);
    });
    if (el.helpUsagePanel) el.helpUsagePanel.hidden = showShortcuts;
    if (el.helpShortcutsPanel) el.helpShortcutsPanel.hidden = !showShortcuts;
    if (focus) activeTab?.focus?.();
  }

  function handleHelpTabKeydown(event) {
    const tabs = [el.helpUsageTab, el.helpShortcutsTab].filter(Boolean);
    const currentIndex = tabs.indexOf(event.currentTarget);
    if (currentIndex < 0) return;
    let nextIndex = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    setHelpTab(tabs[nextIndex] === el.helpShortcutsTab ? "shortcuts" : "usage", true);
  }

  function bindEvents() {
    el.addImagesBtn.addEventListener("click", () => el.fileInput.click());
    el.dropZone.addEventListener("click", (event) => {
      if (!event.target.closest("button")) el.fileInput.click();
    });
    el.dropZone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        el.fileInput.click();
      }
    });
    el.fileInput.addEventListener("change", async () => {
      await addFiles(el.fileInput.files);
      el.fileInput.value = "";
    });
    el.imageSelectAll?.addEventListener("change", () => {
      setAllImagesMarked(el.imageSelectAll.checked);
    });
    el.deleteSelectedImagesBtn?.addEventListener("click", deleteMarkedImages);

    el.canvasAddBtn?.addEventListener("click", () => el.canvasFileInput.click());
    el.canvasFileInput?.addEventListener("change", async () => {
      await addCanvasFiles(el.canvasFileInput.files, canvasCenterPoint());
      el.canvasFileInput.value = "";
    });
    el.canvasBackgroundBtn?.addEventListener("click", () => el.canvasBackgroundInput.click());
    el.canvasBackgroundInput?.addEventListener("change", async () => {
      await addCanvasFiles(el.canvasBackgroundInput.files, canvasCenterPoint(), { asBackground: true });
      el.canvasBackgroundInput.value = "";
    });

    document.addEventListener("dragover", (event) => {
      if (hasFileTransfer(event.dataTransfer)) event.preventDefault();
    });
    document.addEventListener("drop", async (event) => {
      if (!hasFileTransfer(event.dataTransfer)) return;
      event.preventDefault();
      setDropActive(false);
      if (state.mode === "canvas") await addCanvasFiles(event.dataTransfer.files, canvasCenterPoint());
      else await addFiles(event.dataTransfer.files);
    });
    ["dragenter", "dragover"].forEach((type) => {
      el.dropZone.addEventListener(type, (event) => {
        if (!hasFileTransfer(event.dataTransfer)) return;
        event.preventDefault();
        setDropActive(true);
      });
    });
    ["dragleave", "drop"].forEach((type) => {
      el.dropZone.addEventListener(type, () => setDropActive(false));
    });

    el.modeCombineBtn.addEventListener("click", () => setMode("combine"));
    el.modeEditBtn.addEventListener("click", () => setMode("edit"));
    el.modeCanvasBtn?.addEventListener("click", () => setMode("canvas"));
    el.modeFilterBtn?.addEventListener("click", () => setMode("filter"));
    el.modeSplitBtn?.addEventListener("click", () => setMode("split"));

    bindAppDialog(
      [el.updatesMenuButton],
      el.updatesDialog,
      [el.updatesDialogClose, el.updatesDialogFooterClose],
    );
    bindAppDialog(
      [el.helpMenuButton],
      el.helpDialog,
      [el.helpDialogClose, el.helpDialogFooterClose],
    );
    bindAppDialog(
      [el.settingsMenuButton],
      el.processingPresetDialog,
      [el.processingPresetDialogClose, el.processingPresetDialogFooterClose],
    );
    el.helpUsageTab?.addEventListener("click", () => setHelpTab("usage"));
    el.helpShortcutsTab?.addEventListener("click", () => setHelpTab("shortcuts"));
    [el.helpUsageTab, el.helpShortcutsTab].filter(Boolean)
      .forEach((tab) => tab.addEventListener("keydown", handleHelpTabKeydown));
    setHelpTab("usage");

    el.saveProcessingPresetBtn?.addEventListener("click", saveCurrentProcessingPreset);
    el.applyProcessingPresetBtn?.addEventListener("click", applySelectedProcessingPreset);
    el.deleteProcessingPresetBtn?.addEventListener("click", deleteSelectedProcessingPreset);
    el.processingPresetSelect?.addEventListener("change", updateActionAvailability);
    el.processingPresetSearch?.addEventListener("input", () => renderProcessingPresetControls());
    el.processingPresetList?.addEventListener("click", (event) => {
      const action = event.target?.closest?.("[data-preset-action]");
      const presetId = action?.dataset?.presetId;
      if (!action || !presetId || !el.processingPresetSelect) return;
      el.processingPresetSelect.value = presetId;
      renderProcessingPresetControls(presetId);
      updateActionAvailability();
      if (action.dataset.presetAction === "apply") applySelectedProcessingPreset();
    });
    el.processingPresetName?.addEventListener("input", updateActionAvailability);
    el.processingPresetName?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      saveCurrentProcessingPreset();
    });

    const combineControls = [
      el.combineDirection,
      el.gridColumns,
      el.combineSizing,
      el.targetWidth,
      el.targetHeight,
      el.gapSize,
      el.outerPadding,
      el.backgroundMode,
      el.customBackground,
      el.outputFormat,
      el.outputQuality,
    ].filter(Boolean);
    combineControls.forEach((control) => {
      control.addEventListener("input", () => {
        normalizeCombineControls();
        updateConditionalControls();
        schedulePreview();
      });
      control.addEventListener("change", () => {
        normalizeCombineControls({ commitGridColumns: control === el.gridColumns });
        updateConditionalControls();
        schedulePreview();
      });
    });

    [el.splitColumns, el.splitRows].filter(Boolean).forEach((control) => {
      control.addEventListener("input", () => {
        normalizeSplitControls();
        updateSplitSummary();
        schedulePreview();
        updateActionAvailability();
      });
      control.addEventListener("change", () => {
        normalizeSplitControls({ commit: true });
        updateSplitSummary();
        schedulePreview();
        updateActionAvailability();
      });
    });

    el.cropRatio?.addEventListener("change", () => {
      const record = getSelected();
      if (!record) return;
      record.cropRatio = el.cropRatio.value;
      if (record.cropRatio !== "free") {
        record.crop = fitCropToRatio(record.crop, getOrientedDimensions(record), ratioNumber(record.cropRatio));
      }
      reconcileResize(record);
      syncEditControls();
      renderEditPreview();
    });

    [el.cropX, el.cropY, el.cropWidth, el.cropHeight].filter(Boolean).forEach((control) => {
      control.addEventListener("change", () => updateCropFromNumbers(control.id));
      control.addEventListener("input", () => updateCropFromNumbers(control.id, true));
    });

    el.resizeWidth?.addEventListener("input", () => updateResizeFromNumbers("width", true));
    el.resizeWidth?.addEventListener("change", () => updateResizeFromNumbers("width"));
    el.resizeHeight?.addEventListener("input", () => updateResizeFromNumbers("height", true));
    el.resizeHeight?.addEventListener("change", () => updateResizeFromNumbers("height"));
    el.keepAspect?.addEventListener("change", () => {
      const record = getSelected();
      if (!record) return;
      record.resize.keepAspect = el.keepAspect.checked;
      if (record.resize.keepAspect) reconcileResize(record, record.resizeAnchor || "width");
      syncEditControls();
      schedulePreview();
    });

    el.resetSizeBtn?.addEventListener("click", () => setSelectedResize(null, null, true));
    el.preset512Btn?.addEventListener("click", () => setSelectedResize(512, 512, false));
    el.preset1024Btn?.addEventListener("click", () => setSelectedResize(1024, 1024, false));
    el.preset1920Btn?.addEventListener("click", () => setSelectedResize(1920, 1080, false));

    el.rotateLeftBtn?.addEventListener("click", () => rotateSelected(-90));
    el.rotateRightBtn?.addEventListener("click", () => rotateSelected(90));
    el.flipXBtn?.addEventListener("click", () => toggleSelectedFlip("flipX"));
    el.flipYBtn?.addEventListener("click", () => toggleSelectedFlip("flipY"));

    el.applyCropAllBtn?.addEventListener("click", applySelectedCropToAll);
    el.applyResizeAllBtn?.addEventListener("click", applySelectedResizeToAll);
    el.presetSquareAllBtn?.addEventListener("click", () => applyCenteredRatioToAll("1:1"));
    el.preset169AllBtn?.addEventListener("click", () => applyCenteredRatioToAll("16:9"));
    el.preset512AllBtn?.addEventListener("click", () => applyResizePresetToAll(512, 512));
    el.preset1920WidthAllBtn?.addEventListener("click", apply1920WidthToAll);

    el.resetCurrentBtn?.addEventListener("click", resetCurrent);
    el.resetAllBtn?.addEventListener("click", resetAllEdits);
    el.clearAllBtn?.addEventListener("click", clearAll);
    el.exportBtn.addEventListener("click", exportCurrentMode);

    el.cropOverlay.addEventListener("pointerdown", beginCropGesture);
    el.cropOverlay.addEventListener("pointermove", moveCropGesture);
    el.cropOverlay.addEventListener("pointerup", endCropGesture);
    el.cropOverlay.addEventListener("pointercancel", endCropGesture);
    el.cropOverlay.addEventListener("keydown", moveCropWithKeyboard);

    bindCanvasEvents();
    bindFilterEvents();

    window.addEventListener("resize", debounce(() => {
      schedulePreview();
      if (state.mode === "canvas") renderCanvasComposition();
    }, 100));
    const releaseSourceUrls = () => {
      cancelPendingLoads();
      cancelCanvasLoads();
      cancelFinishLoads();
      state.downloadCleanup?.();
      new Set([...collectWorkspaceUrls(), ...state.imageSourceUrls, ...state.canvas.sourceUrls, ...state.filter.finishSourceUrls])
        .forEach(releaseWorkspaceUrl);
      state.filter.activeFinishSourceUrls.clear();
    };
    window.addEventListener("pagehide", (event) => {
      if (!event.persisted) releaseSourceUrls();
    });
  }

  function bindCanvasEvents() {
    const canvas = el.canvasDisplayCanvas;
    const selection = el.canvasSelectionBox;

    ["dragenter", "dragover"].forEach((type) => {
      el.canvasViewport?.addEventListener(type, (event) => {
        if (!hasFileTransfer(event.dataTransfer)) return;
        event.preventDefault();
        event.stopPropagation();
        el.canvasDropHint?.classList.add("is-visible");
      });
    });
    el.canvasViewport?.addEventListener("dragleave", (event) => {
      if (event.currentTarget.contains(event.relatedTarget)) return;
      el.canvasDropHint?.classList.remove("is-visible");
    });
    el.canvasViewport?.addEventListener("drop", async (event) => {
      if (!hasFileTransfer(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      el.canvasDropHint?.classList.remove("is-visible");
      await addCanvasFiles(event.dataTransfer.files, canvasPointFromClient(event.clientX, event.clientY));
    });

    canvas?.addEventListener("pointerdown", beginCanvasPointerGesture);
    canvas?.addEventListener("pointermove", moveCanvasPointerGesture);
    canvas?.addEventListener("pointerup", endCanvasPointerGesture);
    canvas?.addEventListener("pointercancel", cancelCanvasGesture);
    selection?.addEventListener("pointerdown", beginCanvasSelectionGesture);
    selection?.addEventListener("pointermove", moveCanvasPointerGesture);
    selection?.addEventListener("pointerup", endCanvasPointerGesture);
    selection?.addEventListener("pointercancel", cancelCanvasGesture);

    const canvasSizeChanged = () => {
      const width = Math.round(clamp(numberValue(el.canvasWidth, state.canvas.width), 1, MAX_EXPORT_DIMENSION));
      const height = Math.round(clamp(numberValue(el.canvasHeight, state.canvas.height), 1, MAX_EXPORT_DIMENSION));
      setCanvasSize(width, height);
    };
    el.canvasWidth?.addEventListener("change", canvasSizeChanged);
    el.canvasHeight?.addEventListener("change", canvasSizeChanged);
    el.canvasPreset800Btn?.addEventListener("click", () => setCanvasSize(800, 600));
    el.canvasPreset1200Btn?.addEventListener("click", () => setCanvasSize(1200, 800));
    el.canvasPreset1920Btn?.addEventListener("click", () => setCanvasSize(1920, 1080));
    el.canvasPresetSquareBtn?.addEventListener("click", () => setCanvasSize(1080, 1080));
    el.canvasPresetPortraitBtn?.addEventListener("click", () => setCanvasSize(1080, 1920));

    el.canvasBackgroundMode?.addEventListener("change", () => {
      commitCanvasMutation(() => {
        state.canvas.backgroundMode = el.canvasBackgroundMode.value;
      });
      syncCanvasControls();
      renderCanvasComposition();
    });
    let backgroundColorStart = null;
    el.canvasBackgroundColor?.addEventListener("pointerdown", () => {
      backgroundColorStart = snapshotCanvasState();
    });
    el.canvasBackgroundColor?.addEventListener("focus", () => {
      backgroundColorStart = snapshotCanvasState();
    });
    el.canvasBackgroundColor?.addEventListener("blur", () => {
      backgroundColorStart = null;
    });
    el.canvasBackgroundColor?.addEventListener("input", () => {
      state.canvas.backgroundColor = el.canvasBackgroundColor.value;
      renderCanvasComposition();
    });
    el.canvasBackgroundColor?.addEventListener("change", () => {
      state.canvas.backgroundColor = el.canvasBackgroundColor.value;
      if (backgroundColorStart) pushCanvasHistory(backgroundColorStart);
      backgroundColorStart = null;
      renderCanvasComposition();
      updateActionAvailability();
    });

    const canvasLayerFields = [
      [el.canvasLayerName, "name"],
      [el.canvasLayerX, "x"],
      [el.canvasLayerY, "y"],
      [el.canvasLayerWidth, "width"],
      [el.canvasLayerHeight, "height"],
      [el.canvasLayerRotation, "rotation"],
    ];
    canvasLayerFields.forEach(([control, key]) => {
      control?.addEventListener("change", () => updateCanvasLayerFromControl(key));
    });
    el.canvasLayerKeepAspect?.addEventListener("change", () => {
      mutateSelectedCanvasLayer((layer) => {
        layer.keepAspect = el.canvasLayerKeepAspect.checked;
      });
    });

    let opacityStart = null;
    el.canvasLayerOpacity?.addEventListener("pointerdown", () => {
      opacityStart = snapshotCanvasState();
    });
    el.canvasLayerOpacity?.addEventListener("focus", () => {
      opacityStart = snapshotCanvasState();
    });
    el.canvasLayerOpacity?.addEventListener("blur", () => {
      opacityStart = null;
    });
    el.canvasLayerOpacity?.addEventListener("input", () => {
      const layer = getSelectedCanvasLayer();
      if (!layer) return;
      layer.opacity = clamp(numberValue(el.canvasLayerOpacity, 100) / 100, 0, 1);
      if (el.canvasOpacityValue) el.canvasOpacityValue.textContent = `${Math.round(layer.opacity * 100)}%`;
      renderCanvasComposition();
    });
    el.canvasLayerOpacity?.addEventListener("change", () => {
      if (opacityStart) pushCanvasHistory(opacityStart);
      opacityStart = snapshotCanvasState();
      renderCanvasLayerList();
    });

    el.canvasRotateMinusBtn?.addEventListener("click", () => rotateCanvasLayer(-1));
    el.canvasRotatePlusBtn?.addEventListener("click", () => rotateCanvasLayer(1));
    el.canvasRotateLeftBtn?.addEventListener("click", () => rotateCanvasLayer(-90));
    el.canvasRotateRightBtn?.addEventListener("click", () => rotateCanvasLayer(90));
    el.canvasBringFrontBtn?.addEventListener("click", () => moveCanvasLayerOrder("front"));
    el.canvasBringForwardBtn?.addEventListener("click", () => moveCanvasLayerOrder("forward"));
    el.canvasSendBackwardBtn?.addEventListener("click", () => moveCanvasLayerOrder("backward"));
    el.canvasSendBackBtn?.addEventListener("click", () => moveCanvasLayerOrder("back"));
    el.canvasVisibilityBtn?.addEventListener("click", toggleCanvasLayerVisibility);
    el.canvasLockBtn?.addEventListener("click", toggleCanvasLayerLock);
    el.canvasDuplicateBtn?.addEventListener("click", () => duplicateCanvasLayer());
    el.canvasDeleteBtn?.addEventListener("click", deleteSelectedCanvasLayer);
    el.canvasFlipXBtn?.addEventListener("click", () => flipCanvasLayer("flipX"));
    el.canvasFlipYBtn?.addEventListener("click", () => flipCanvasLayer("flipY"));
    el.canvasAlignHorizontalBtn?.addEventListener("click", () => alignCanvasLayer("horizontal"));
    el.canvasAlignVerticalBtn?.addEventListener("click", () => alignCanvasLayer("vertical"));
    el.canvasAlignCenterBtn?.addEventListener("click", () => alignCanvasLayer("center"));
    el.canvasFitWidthBtn?.addEventListener("click", () => fitSelectedCanvasLayer("width"));
    el.canvasFitHeightBtn?.addEventListener("click", () => fitSelectedCanvasLayer("height"));
    el.canvasFitCanvasBtn?.addEventListener("click", () => fitSelectedCanvasLayer("contain"));

    el.canvasSnap?.addEventListener("change", () => {
      state.canvas.snap = el.canvasSnap.checked;
      renderCanvasComposition();
    });
    el.canvasGridVisible?.addEventListener("change", () => {
      state.canvas.gridVisible = el.canvasGridVisible.checked;
      renderCanvasComposition();
    });
    el.canvasGridSize?.addEventListener("change", () => {
      state.canvas.gridSize = Math.round(clamp(numberValue(el.canvasGridSize, 20), 2, 500));
      syncCanvasControls();
      renderCanvasComposition();
    });

    el.canvasZoomOutBtn?.addEventListener("click", () => setCanvasZoom(state.canvas.zoom - 0.25));
    el.canvasZoomInBtn?.addEventListener("click", () => setCanvasZoom(state.canvas.zoom + 0.25));
    el.canvasZoomResetBtn?.addEventListener("click", () => setCanvasZoom(1));
    el.canvasUndoBtn?.addEventListener("click", undoCanvas);
    el.canvasRedoBtn?.addEventListener("click", redoCanvas);
    document.addEventListener("keydown", handleCanvasKeyboard);
  }

  function bindFilterEvents() {
    const timeButtons = [
      [el.filterTimeNoneBtn, "none"],
      [el.filterTimeMorningBtn, "morning"],
      [el.filterTimeNoonBtn, "day"],
      [el.filterTimeEveningBtn, "evening"],
      [el.filterTimeNightBtn, "night"],
    ];
    const effectButtons = [
      [el.filterEffectNoneBtn, "none"],
      [el.filterEffectOilBtn, "oil"],
      [el.filterEffectPosterBtn, "poster"],
      [el.filterEffectMonochromeBtn, "monochrome"],
      [el.filterEffectSepiaBtn, "sepia"],
    ];
    timeButtons.forEach(([button, preset]) => {
      button?.addEventListener("click", () => updateSelectedFilter((filter) => {
        filter.timePreset = preset;
      }));
    });
    effectButtons.forEach(([button, preset]) => {
      button?.addEventListener("click", () => updateSelectedFilter((filter) => {
        filter.effectPreset = preset;
      }));
    });

    const ranges = [
      el.filterIntensity,
      el.filterBrightness,
      el.filterContrast,
      el.filterSaturation,
      el.filterTemperature,
      el.filterTint,
      el.filterHighlights,
      el.filterShadows,
      el.filterOilColor,
      el.filterOilBrush,
      el.filterOilEdge,
      el.filterPosterLevels,
      el.filterPosterEdge,
    ].filter(Boolean);
    ranges.forEach((control) => {
      control.addEventListener("input", updateFilterFromControls);
      control.addEventListener("change", updateFilterFromControls);
    });

    const compare = el.filterCompareBtn;
    compare?.addEventListener("pointerdown", (event) => {
      if (compare.disabled) return;
      event.preventDefault();
      try {
        compare.setPointerCapture?.(event.pointerId);
      } catch {
        // The comparison still works even when pointer capture is unavailable.
      }
      setFilterComparison(true);
    });
    const stopComparison = (event) => {
      try {
        if (compare?.hasPointerCapture?.(event.pointerId)) compare.releasePointerCapture(event.pointerId);
      } catch {
        // Capture may already have been released by the browser.
      }
      setFilterComparison(false);
    };
    compare?.addEventListener("pointerup", stopComparison);
    compare?.addEventListener("pointercancel", stopComparison);
    compare?.addEventListener("pointerleave", (event) => {
      if (!compare.hasPointerCapture?.(event.pointerId)) stopComparison(event);
    });
    compare?.addEventListener("lostpointercapture", () => setFilterComparison(false));
    compare?.addEventListener("keydown", (event) => {
      if ((event.key === " " || event.key === "Enter") && !event.repeat) {
        event.preventDefault();
        setFilterComparison(true);
      }
    });
    compare?.addEventListener("keyup", (event) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setFilterComparison(false);
      }
    });
    compare?.addEventListener("blur", () => setFilterComparison(false));
    window.addEventListener("blur", () => setFilterComparison(false));
    el.filterApplyAllBtn?.addEventListener("click", applySelectedFilterToAll);
    el.filterExportVariantsBtn?.addEventListener("click", exportFilterVariantsWorkflow);
    bindFinishEvents();
  }

  function bindFinishEvents() {
    el.filterFinishAddBtn?.addEventListener("click", () => el.filterFinishInput?.click());
    el.filterFinishInput?.addEventListener("change", async () => {
      await addFinishFiles(el.filterFinishInput.files);
      el.filterFinishInput.value = "";
    });

    [
      [el.filterFinishName, "name"],
      [el.filterFinishX, "xRatio"],
      [el.filterFinishY, "yRatio"],
      [el.filterFinishWidth, "widthRatio"],
      [el.filterFinishHeight, "heightRatio"],
      [el.filterFinishRotation, "rotation"],
    ].forEach(([control, key]) => {
      control?.addEventListener("change", () => updateFinishLayerFromControl(key));
    });
    el.filterFinishKeepAspect?.addEventListener("change", () => {
      mutateSelectedFinishLayer((layer) => {
        layer.keepAspect = el.filterFinishKeepAspect.checked;
      });
    });
    el.filterFinishOpacity?.addEventListener("input", () => {
      const layer = getSelectedFinishLayer();
      if (!layer) return;
      layer.opacity = clamp(numberValue(el.filterFinishOpacity, 100) / 100, 0, 1);
      if (el.filterFinishOpacityValue) {
        el.filterFinishOpacityValue.textContent = `${Math.round(layer.opacity * 100)}%`;
      }
      schedulePreview();
    });
    el.filterFinishOpacity?.addEventListener("change", () => {
      renderFinishLayerList();
      syncFinishControls();
    });
    el.filterFinishBlendMode?.addEventListener("change", () => {
      mutateSelectedFinishLayer((layer) => {
        layer.blendMode = sanitizeFinishBlendMode(el.filterFinishBlendMode.value);
      });
    });
    el.filterFinishPlacement?.addEventListener("change", () => {
      setSelectedFinishLayerPlacement(el.filterFinishPlacement.value);
    });
    el.filterFinishFitMode?.addEventListener("change", () => {
      mutateSelectedFinishLayer((layer) => {
        layer.fitMode = sanitizeFinishFitMode(el.filterFinishFitMode.value);
      });
    });
    el.filterFinishFrameBtn?.addEventListener("click", toggleFinishLayerFrame);
    el.filterFinishVisibilityBtn?.addEventListener("click", toggleFinishLayerVisibility);
    el.filterFinishDeleteBtn?.addEventListener("click", deleteSelectedFinishLayer);
    el.filterFinishBringFrontBtn?.addEventListener("click", () => moveFinishLayerOrder("front"));
    el.filterFinishForwardBtn?.addEventListener("click", () => moveFinishLayerOrder("forward"));
    el.filterFinishBackwardBtn?.addEventListener("click", () => moveFinishLayerOrder("backward"));
    el.filterFinishSendBackBtn?.addEventListener("click", () => moveFinishLayerOrder("back"));
    el.filterFinishFitCanvasBtn?.addEventListener("click", () => placeFinishLayer("stretch"));
    el.filterFinishFitWidthBtn?.addEventListener("click", () => placeFinishLayer("width"));
    el.filterFinishFitHeightBtn?.addEventListener("click", () => placeFinishLayer("height"));
    el.filterFinishPlaceCenterBtn?.addEventListener("click", () => placeFinishLayer("center"));
    el.filterFinishPlaceTopLeftBtn?.addEventListener("click", () => placeFinishLayer("top-left"));
    el.filterFinishPlaceTopRightBtn?.addEventListener("click", () => placeFinishLayer("top-right"));
    el.filterFinishPlaceBottomLeftBtn?.addEventListener("click", () => placeFinishLayer("bottom-left"));
    el.filterFinishPlaceBottomRightBtn?.addEventListener("click", () => placeFinishLayer("bottom-right"));
    el.filterApplyFinishAllBtn?.addEventListener("click", applySelectedFinishToAll);
    el.filterApplyFilterFinishAllBtn?.addEventListener("click", applySelectedFilterAndFinishToAll);

    el.filterPreviewCanvas?.addEventListener("pointerdown", beginFinishCanvasGesture);
    el.filterPreviewCanvas?.addEventListener("pointermove", moveFinishGesture);
    el.filterPreviewCanvas?.addEventListener("pointerup", endFinishGesture);
    el.filterPreviewCanvas?.addEventListener("pointercancel", cancelFinishGesture);
    el.filterFinishSelectionBox?.addEventListener("pointerdown", beginFinishSelectionGesture);
    el.filterFinishSelectionBox?.addEventListener("pointermove", moveFinishGesture);
    el.filterFinishSelectionBox?.addEventListener("pointerup", endFinishGesture);
    el.filterFinishSelectionBox?.addEventListener("pointercancel", cancelFinishGesture);
  }

  function hasFileTransfer(dataTransfer) {
    return Boolean(dataTransfer && Array.from(dataTransfer.types || []).includes("Files"));
  }

  function setDropActive(active) {
    el.dropZone.classList.toggle("is-dragover", active);
  }

  function addFiles(fileList) {
    if (state.exporting) return Promise.resolve();
    const allFiles = Array.from(fileList || []);
    const generation = state.loadGeneration;
    state.queuedLoadCount += 1;
    updateActionAvailability();
    const queued = state.loadQueue.then(
      () => processFiles(allFiles, generation),
      () => processFiles(allFiles, generation),
    );
    const tracked = queued.finally(() => {
      state.queuedLoadCount = Math.max(0, state.queuedLoadCount - 1);
      updateActionAvailability();
    });
    state.loadQueue = tracked.catch(() => {});
    return tracked;
  }

  async function processFiles(allFiles, generation) {
    if (generation !== state.loadGeneration) return;
    const validFiles = allFiles.filter(isSupportedImageFile);
    const rejectedCount = allFiles.length - validFiles.length;
    if (!validFiles.length) {
      if (allFiles.length) setStatus("PNG・JPEG・WebP画像を選択してください。", "error");
      showImportProblems(allFiles);
      return;
    }

    setStatus(`${validFiles.length}枚の画像を読み込んでいます…`, "busy");
    const loaded = await Promise.all(validFiles.map((file) => loadImageRecord(file, generation)));
    const records = loaded.filter(Boolean);
    if (generation !== state.loadGeneration) {
      records.forEach((record) => URL.revokeObjectURL(record.objectUrl));
      return;
    }
    state.images.push(...records);
    if (!state.selectedId && records[0]) state.selectedId = records[0].id;
    refreshAll();

    const failedCount = validFiles.length - records.length;
    showImportProblems(allFiles, validFiles.filter((file, index) => !loaded[index]));
    const notes = [];
    if (records.length) notes.push(`${records.length}枚を追加しました`);
    if (rejectedCount) notes.push(`${rejectedCount}件は未対応形式です`);
    if (failedCount) notes.push(`${failedCount}件を読み込めませんでした`);
    setStatus(`${notes.join("。")}。`, failedCount || rejectedCount ? "warning" : "success");
  }

  function isSupportedImageFile(file) {
    const type = String(file?.type || "").toLowerCase();
    if (SUPPORTED_TYPES.has(type) || type === "image/jpg") return true;
    return !type || type === "application/octet-stream"
      ? /\.(?:png|jpe?g|webp)$/i.test(String(file?.name || ""))
      : false;
  }

  function showImportProblems(files, failed = []) {
    if (!el.importReportList) return;
    clearElementChildren(el.importReportList);
    const issues = files.filter((file) => !isSupportedImageFile(file)).map((file) => ({ file, failed: false }))
      .concat(failed.map((file) => ({ file, failed: true })));
    issues.forEach(({ file, failed }) => {
      const row = document.createElement("li");
      row.textContent = `${file.name}：${failed ? "画像を読み取れませんでした。元ファイルを確認し、PNG・JPEG・WebPで書き出し直してください。" : "未対応の形式です。写真アプリなどでPNG・JPEG・WebPへ変換してから追加してください。"}`;
      el.importReportList.append(row);
    });
    setElementHidden(el.importReport, issues.length === 0);
    el.importReport.open = issues.length > 0;
  }

  function loadImageRecord(file, generation) {
    return new Promise((resolve) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.decoding = "async";
      let settled = false;
      const finish = (value, revoke = false) => {
        if (settled) return;
        settled = true;
        state.pendingLoads.delete(objectUrl);
        image.onload = null;
        image.onerror = null;
        if (revoke) URL.revokeObjectURL(objectUrl);
        resolve(value);
      };
      const cancel = () => {
        image.src = "";
        finish(null, true);
      };
      state.pendingLoads.set(objectUrl, { cancel });
      image.onload = () => {
        if (generation !== state.loadGeneration) {
          finish(null, true);
          return;
        }
        const width = image.naturalWidth;
        const height = image.naturalHeight;
        finish({
          id: createId(),
          file,
          objectUrl,
          fileName: file.name,
          originalWidth: width,
          originalHeight: height,
          image,
          crop: { x: 0, y: 0, width, height },
          cropRatio: "free",
      resize: { width: null, height: null, keepAspect: true },
          resizeAnchor: "width",
          rotation: 0,
          flipX: false,
          flipY: false,
          filter: createDefaultFilterState(),
          finishLayers: [],
        });
      };
      image.onerror = () => {
        finish(null, true);
      };
      image.src = objectUrl;
    });
  }

  function cancelPendingLoads() {
    state.loadGeneration += 1;
    for (const pending of Array.from(state.pendingLoads.values())) pending.cancel();
    state.pendingLoads.clear();
    updateActionAvailability();
  }

  function addCanvasFiles(fileList, dropPoint = canvasCenterPoint(), options = {}) {
    if (state.exporting) return Promise.resolve();
    const allFiles = Array.from(fileList || []);
    const generation = state.canvas.loadGeneration;
    state.canvas.queuedLoadCount += 1;
    updateActionAvailability();
    const queued = state.canvas.loadQueue.then(
      () => processCanvasFiles(allFiles, dropPoint, options, generation),
      () => processCanvasFiles(allFiles, dropPoint, options, generation),
    );
    const tracked = queued.finally(() => {
      state.canvas.queuedLoadCount = Math.max(0, state.canvas.queuedLoadCount - 1);
      updateActionAvailability();
    });
    state.canvas.loadQueue = tracked.catch(() => {});
    return tracked;
  }

  async function processCanvasFiles(allFiles, dropPoint, options, generation) {
    if (generation !== state.canvas.loadGeneration) return;
    const validFiles = allFiles.filter(isSupportedImageFile);
    const rejectedCount = allFiles.length - validFiles.length;
    if (!validFiles.length) {
      if (allFiles.length) setStatus("PNG・JPEG・WebP素材を選択してください。", "error");
      showImportProblems(allFiles);
      return;
    }

    setStatus(`${validFiles.length}個の素材を読み込んでいます…`, "busy");
    const filesToLoad = options.asBackground ? validFiles.slice(0, 1) : validFiles;
    const loaded = await Promise.all(filesToLoad.map((file) => loadCanvasLayer(file, generation)));
    const records = loaded.filter(Boolean);
    if (generation !== state.canvas.loadGeneration) {
      records.forEach((record) => URL.revokeObjectURL(record.objectUrl));
      return;
    }
    if (!records.length) {
      setStatus("素材を読み込めませんでした。", "error");
      showImportProblems(allFiles, filesToLoad);
      return;
    }

    const before = snapshotCanvasState();
    const basePoint = normalizeCanvasPoint(dropPoint);
    if (options.asBackground) {
      state.canvas.layers = state.canvas.layers.filter((layer) => !layer.isBackground);
    }
    records.forEach((record, index) => {
      state.canvas.sourceUrls.add(record.objectUrl);
      const layer = createCanvasLayerState(record, {
        centerX: basePoint.x + index * 24,
        centerY: basePoint.y + index * 24,
      });
      if (options.asBackground && index === 0) {
        const fitted = calculateCanvasLayerFit(layer, state.canvas, "cover");
        Object.assign(layer, fitted, {
          name: `背景：${record.fileName}`,
          locked: true,
          isBackground: true,
        });
        state.canvas.layers.unshift(layer);
        state.canvas.backgroundMode = "image";
      } else {
        state.canvas.layers.push(layer);
      }
      state.canvas.selectedId = layer.id;
    });
    syncCanvasZIndexes();
    pushCanvasHistory(before);
    refreshAll();

    const failedCount = filesToLoad.length - records.length;
    showImportProblems(allFiles, filesToLoad.filter((file, index) => !loaded[index]));
    const notes = [`${records.length}個の素材を追加しました`];
    if (rejectedCount) notes.push(`${rejectedCount}件は未対応形式です`);
    if (failedCount) notes.push(`${failedCount}件を読み込めませんでした`);
    setStatus(`${notes.join("。")}。`, rejectedCount || failedCount ? "warning" : "success");
  }

  function loadCanvasLayer(file, generation) {
    return new Promise((resolve) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.decoding = "async";
      let settled = false;
      const finish = (value, revoke = false) => {
        if (settled) return;
        settled = true;
        state.canvas.pendingLoads.delete(objectUrl);
        image.onload = null;
        image.onerror = null;
        if (revoke) URL.revokeObjectURL(objectUrl);
        resolve(value);
      };
      const cancel = () => {
        image.src = "";
        finish(null, true);
      };
      state.canvas.pendingLoads.set(objectUrl, { cancel });
      image.onload = () => {
        if (generation !== state.canvas.loadGeneration) {
          finish(null, true);
          return;
        }
        finish({
          file,
          objectUrl,
          fileName: file.name,
          image,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
        });
      };
      image.onerror = () => finish(null, true);
      image.src = objectUrl;
    });
  }

  function cancelCanvasLoads() {
    state.canvas.loadGeneration += 1;
    for (const pending of Array.from(state.canvas.pendingLoads.values())) pending.cancel();
    state.canvas.pendingLoads.clear();
    updateActionAvailability();
  }

  function sanitizeFinishBlendMode(value) {
    return FINISH_BLEND_MODES.has(value) ? value : "normal";
  }

  function sanitizeFinishFitMode(value) {
    return FINISH_FIT_MODES.has(value) ? value : "stretch";
  }

  function sanitizeFinishPlacement(value) {
    return FINISH_PLACEMENTS.has(value) ? value : "front";
  }

  function ensureFinishLayers(record) {
    if (!record) return [];
    if (!Array.isArray(record.finishLayers)) record.finishLayers = [];
    return record.finishLayers;
  }

  function sanitizeFinishLayerState(layer = {}) {
    const naturalWidth = Math.max(1, numberValue(layer.naturalWidth, layer.image?.naturalWidth || 1));
    const naturalHeight = Math.max(1, numberValue(layer.naturalHeight, layer.image?.naturalHeight || 1));
    const fallbackName = String(layer.file?.name || "仕上げ素材").trim() || "仕上げ素材";
    const manual = layer.manualGeometry && typeof layer.manualGeometry === "object"
      ? {
        xRatio: clamp(numberValue(layer.manualGeometry.xRatio, 0), -5, 5),
        yRatio: clamp(numberValue(layer.manualGeometry.yRatio, 0), -5, 5),
        widthRatio: clamp(numberValue(layer.manualGeometry.widthRatio, 1), 0.0001, 10),
        heightRatio: clamp(numberValue(layer.manualGeometry.heightRatio, 1), 0.0001, 10),
        keepAspect: layer.manualGeometry.keepAspect !== false,
        rotation: normalizeCanvasRotation(layer.manualGeometry.rotation),
      }
      : null;
    const isFrame = Boolean(layer.isFrame);
    return {
      ...layer,
      id: String(layer.id || createId()),
      name: String(layer.name || fallbackName).trim().slice(0, 120) || fallbackName,
      naturalWidth,
      naturalHeight,
      visible: layer.visible !== false,
      xRatio: clamp(numberValue(layer.xRatio, 0), -5, 5),
      yRatio: clamp(numberValue(layer.yRatio, 0), -5, 5),
      widthRatio: clamp(numberValue(layer.widthRatio, 1), 0.0001, 10),
      heightRatio: clamp(numberValue(layer.heightRatio, 1), 0.0001, 10),
      keepAspect: layer.keepAspect !== false,
      rotation: isFrame ? 0 : normalizeCanvasRotation(layer.rotation),
      opacity: clamp(numberValue(layer.opacity, 1), 0, 1),
      blendMode: sanitizeFinishBlendMode(layer.blendMode),
      placement: sanitizeFinishPlacement(layer.placement),
      fitMode: sanitizeFinishFitMode(layer.fitMode),
      isFrame,
      manualGeometry: manual,
    };
  }

  function cloneFinishLayerState(layer, options = {}) {
    const clone = sanitizeFinishLayerState({
      ...layer,
      id: options.newId ? createId() : layer.id,
      manualGeometry: layer.manualGeometry ? { ...layer.manualGeometry } : null,
    });
    return clone;
  }

  function snapshotFinishLayers(layers) {
    return Array.from(layers || []).map((layer) => cloneFinishLayerState(layer));
  }

  function createFinishLayerState(source, outputSize, offset = 0) {
    const width = Math.max(1, numberValue(outputSize?.width, 1));
    const height = Math.max(1, numberValue(outputSize?.height, 1));
    const naturalWidth = Math.max(1, numberValue(source?.naturalWidth, 1));
    const naturalHeight = Math.max(1, numberValue(source?.naturalHeight, 1));
    const scale = Math.min(1, width / naturalWidth, height / naturalHeight);
    const layerWidth = naturalWidth * scale;
    const layerHeight = naturalHeight * scale;
    return sanitizeFinishLayerState({
      id: createId(),
      name: source?.fileName || source?.file?.name || "仕上げ素材",
      file: source?.file,
      objectUrl: source?.objectUrl,
      image: source?.image,
      naturalWidth,
      naturalHeight,
      visible: true,
      xRatio: (width - layerWidth) / 2 / width + offset / width,
      yRatio: (height - layerHeight) / 2 / height + offset / height,
      widthRatio: layerWidth / width,
      heightRatio: layerHeight / height,
      keepAspect: true,
      rotation: 0,
      opacity: 1,
      blendMode: "normal",
      placement: "front",
      fitMode: "stretch",
      isFrame: false,
    });
  }

  function addFinishFiles(fileList, targetRecordId = state.selectedId) {
    const allFiles = Array.from(fileList || []);
    if (state.exporting || !targetRecordId || !state.images.some((record) => record.id === targetRecordId)) {
      return Promise.resolve([]);
    }
    const generation = state.filter.finishLoadGeneration;
    state.filter.queuedFinishLoadCount += 1;
    updateActionAvailability();
    const queued = state.filter.finishLoadQueue.then(
      () => processFinishFiles(allFiles, targetRecordId, generation),
      () => processFinishFiles(allFiles, targetRecordId, generation),
    );
    const tracked = queued.finally(() => {
      state.filter.queuedFinishLoadCount = Math.max(0, state.filter.queuedFinishLoadCount - 1);
      updateActionAvailability();
    });
    state.filter.finishLoadQueue = tracked.catch(() => {});
    return tracked;
  }

  async function processFinishFiles(allFiles, targetRecordId, generation) {
    const target = state.images.find((record) => record.id === targetRecordId);
    if (!target || generation !== state.filter.finishLoadGeneration) return [];
    const validFiles = allFiles.filter(isSupportedImageFile);
    const rejectedCount = allFiles.length - validFiles.length;
    if (!validFiles.length) {
      if (allFiles.length) setStatus("仕上げ素材にはPNG・JPEG・WebPを選択してください。", "error");
      showImportProblems(allFiles);
      return [];
    }
    setStatus(`${validFiles.length}個の仕上げ素材を読み込んでいます…`, "busy");
    const loaded = await Promise.all(validFiles.map((file) => loadFinishSource(file, targetRecordId, generation)));
    const sources = loaded.filter(Boolean);
    const liveTarget = state.images.find((record) => record.id === targetRecordId);
    if (!liveTarget || generation !== state.filter.finishLoadGeneration) {
      sources.forEach((source) => URL.revokeObjectURL(source.objectUrl));
      return [];
    }
    const outputSize = getProcessedDimensions(liveTarget);
    const layers = ensureFinishLayers(liveTarget);
    sources.forEach((source, index) => {
      state.filter.finishSourceUrls.add(source.objectUrl);
      layers.push(createFinishLayerState(source, outputSize, index * 16));
    });
    if (sources.length) {
      if (state.selectedId === liveTarget.id) {
        state.filter.selectedFinishLayerId = layers.at(-1)?.id || null;
      }
      refreshAll();
    }
    const failedCount = validFiles.length - sources.length;
    showImportProblems(allFiles, validFiles.filter((file, index) => !loaded[index]));
    const notes = [];
    if (sources.length) notes.push(`${sources.length}個を追加しました`);
    if (rejectedCount) notes.push(`${rejectedCount}件は未対応形式です`);
    if (failedCount) notes.push(`${failedCount}件を読み込めませんでした`);
    setStatus(`${notes.join("。")}。`, rejectedCount || failedCount ? "warning" : "success");
    return sources.length ? layers.slice(-sources.length) : [];
  }

  function loadFinishSource(file, targetRecordId, generation) {
    return new Promise((resolve) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.decoding = "async";
      let settled = false;
      const finish = (value, revoke = false) => {
        if (settled) return;
        settled = true;
        state.filter.pendingFinishLoads.delete(objectUrl);
        image.onload = null;
        image.onerror = null;
        if (revoke) URL.revokeObjectURL(objectUrl);
        resolve(value);
      };
      const cancel = () => {
        image.src = "";
        finish(null, true);
      };
      state.filter.pendingFinishLoads.set(objectUrl, { cancel, targetRecordId });
      image.onload = () => {
        if (
          generation !== state.filter.finishLoadGeneration
          || !state.images.some((record) => record.id === targetRecordId)
          || image.naturalWidth <= 0
          || image.naturalHeight <= 0
        ) {
          finish(null, true);
          return;
        }
        finish({
          id: createId(),
          file,
          objectUrl,
          fileName: file.name,
          image,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
        });
      };
      image.onerror = () => finish(null, true);
      image.src = objectUrl;
    });
  }

  function cancelFinishLoads(targetRecordId = null) {
    if (targetRecordId == null) state.filter.finishLoadGeneration += 1;
    for (const pending of Array.from(state.filter.pendingFinishLoads.values())) {
      if (targetRecordId == null || pending.targetRecordId === targetRecordId) pending.cancel();
    }
    updateActionAvailability();
  }

  function sweepFinishSourceUrls() {
    const referenced = collectWorkspaceUrls();
    state.filter.finishSourceUrls.forEach((url) => {
      if (referenced.has(url)) return;
      releaseWorkspaceUrl(url);
    });
  }

  function collectFinishSourceUrls(records) {
    const urls = new Set();
    Array.from(records || []).forEach((record) => {
      ensureFinishLayers(record).forEach((layer) => {
        if (layer.objectUrl) urls.add(layer.objectUrl);
      });
    });
    return urls;
  }

  function retainFinishSources(records) {
    const urls = collectFinishSourceUrls(records);
    urls.forEach((url) => state.filter.activeFinishSourceUrls.add(url));
    return () => {
      urls.forEach((url) => state.filter.activeFinishSourceUrls.delete(url));
      sweepFinishSourceUrls();
    };
  }

  function createCanvasLayerState(record, point = canvasCenterPoint()) {
    const naturalWidth = Math.max(1, numberValue(record.naturalWidth, 1));
    const naturalHeight = Math.max(1, numberValue(record.naturalHeight, 1));
    const fitScale = Math.min(
      1,
      (state.canvas.width * 0.55) / naturalWidth,
      (state.canvas.height * 0.55) / naturalHeight,
    );
    const width = Math.max(1, naturalWidth * fitScale);
    const height = Math.max(1, naturalHeight * fitScale);
    const center = normalizeCanvasPoint({ x: point.centerX ?? point.x, y: point.centerY ?? point.y });
    return {
      id: createId(),
      name: record.fileName,
      file: record.file,
      objectUrl: record.objectUrl,
      image: record.image,
      naturalWidth,
      naturalHeight,
      x: center.x - width / 2,
      y: center.y - height / 2,
      width,
      height,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      flipX: false,
      flipY: false,
      keepAspect: true,
      isBackground: false,
      zIndex: state.canvas.layers.length,
    };
  }

  function canvasCenterPoint() {
    return { x: state.canvas.width / 2, y: state.canvas.height / 2 };
  }

  function normalizeCanvasPoint(point) {
    return {
      x: clamp(numberValue(point?.x, state.canvas.width / 2), 0, state.canvas.width),
      y: clamp(numberValue(point?.y, state.canvas.height / 2), 0, state.canvas.height),
    };
  }

  function syncCanvasZIndexes() {
    const backgrounds = state.canvas.layers.filter((layer) => layer.isBackground);
    const normalLayers = state.canvas.layers.filter((layer) => !layer.isBackground);
    state.canvas.layers = [...backgrounds, ...normalLayers];
    state.canvas.layers.forEach((layer, index) => {
      layer.zIndex = index;
    });
  }

  function sweepCanvasSourceUrls() {
    const referenced = collectWorkspaceUrls();
    const collect = (layers) => {
      (layers || []).forEach((layer) => {
        if (layer.objectUrl) referenced.add(layer.objectUrl);
      });
    };
    collect(state.canvas.layers);
    state.canvas.history.forEach((snapshot) => collect(snapshot.layers));
    state.canvas.redo.forEach((snapshot) => collect(snapshot.layers));
    if (state.canvas.clipboard?.objectUrl) referenced.add(state.canvas.clipboard.objectUrl);
    state.canvas.sourceUrls.forEach((url) => {
      if (referenced.has(url)) return;
      releaseWorkspaceUrl(url);
    });
  }

  function createId() {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
    return `image-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function setMode(mode) {
    if (state.mode === "canvas" && mode !== "canvas") cancelCanvasGesture();
    if (state.mode === "filter" && mode !== "filter") {
      cancelFinishGesture();
      state.filter.comparingOriginal = false;
    }
    state.mode = ["edit", "canvas", "filter", "split"].includes(mode) ? mode : "combine";
    const isCombine = state.mode === "combine";
    const isEdit = state.mode === "edit";
    const isCanvas = state.mode === "canvas";
    const isFilter = state.mode === "filter";
    const isSplit = state.mode === "split";
    el.modeCombineBtn.classList.toggle("is-active", isCombine);
    el.modeEditBtn.classList.toggle("is-active", isEdit);
    el.modeCanvasBtn?.classList.toggle("is-active", isCanvas);
    el.modeFilterBtn?.classList.toggle("is-active", isFilter);
    el.modeSplitBtn?.classList.toggle("is-active", isSplit);
    el.modeCombineBtn.setAttribute("aria-pressed", String(isCombine));
    el.modeEditBtn.setAttribute("aria-pressed", String(isEdit));
    el.modeCanvasBtn?.setAttribute("aria-pressed", String(isCanvas));
    el.modeFilterBtn?.setAttribute("aria-pressed", String(isFilter));
    el.modeSplitBtn?.setAttribute("aria-pressed", String(isSplit));
    setElementHidden(el.combineSettings, !isCombine);
    setElementHidden(el.editSettings, !isEdit);
    setElementHidden(el.canvasSettings, !isCanvas);
    setElementHidden(el.filterSettings, !isFilter);
    setElementHidden(el.splitSettings, !isSplit);
    setElementHidden(el.standardAssetPanel, isCanvas);
    setElementHidden(el.canvasLayerPanel, !isCanvas);
    setElementHidden(el.canvasUndoBtn, !isCanvas);
    setElementHidden(el.canvasRedoBtn, !isCanvas);
    el.exportBtn.textContent = isCombine
      ? "結合画像を保存"
      : isEdit
        ? "すべて保存"
        : isCanvas
          ? "一枚の画像として書き出す"
          : isFilter
            ? "完成画像を保存"
            : "分割画像を保存";
    if (el.resetCurrentBtn) {
      el.resetCurrentBtn.textContent = isCanvas
        ? "選択素材をリセット"
        : isFilter
          ? "フィルターと仕上げをリセット"
          : isSplit ? "分割設定をリセット" : "この画像を元に戻す";
    }
    if (el.resetAllBtn) el.resetAllBtn.textContent = isCanvas ? "配置をリセット" : "すべてリセット";
    refreshAll();
  }

  function setElementHidden(element, hidden) {
    if (!element) return;
    element.hidden = hidden;
    element.classList.toggle("is-hidden", hidden);
  }

  function normalizeProcessingPresetName(value) {
    return String(value ?? "")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, PROCESSING_PRESET_NAME_MAX_LENGTH);
  }

  function sanitizeHexColor(value, fallback = "#ffffff") {
    const candidate = String(value ?? "").trim().toLowerCase();
    return /^#[0-9a-f]{6}$/.test(candidate) ? candidate : fallback;
  }

  function sanitizeOutputPresetSettings(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      format: FORMAT_MIME[source.format] ? source.format : "png",
      quality: Math.round(clamp(numberValue(source.quality, 90), 10, 100)),
    };
  }

  function nullablePresetDimension(value) {
    if (value == null || String(value).trim() === "") return null;
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Math.round(clamp(number, 1, MAX_EXPORT_DIMENSION));
  }

  function sanitizeProcessingPresetSettings(mode, value) {
    if (!PROCESSING_PRESET_MODES.has(mode)) return null;
    const source = value && typeof value === "object" ? value : {};
    const output = sanitizeOutputPresetSettings(source.output);
    if (mode === "combine") {
      const directions = new Set(["horizontal", "vertical", "grid"]);
      const sizingModes = new Set(["original", "width", "height", "custom"]);
      const backgrounds = new Set(["transparent", "white", "black", "custom"]);
      return {
        direction: directions.has(source.direction) ? source.direction : "horizontal",
        columns: normalizeGridColumns(source.columns, DEFAULT_GRID_COLUMNS),
        sizing: sizingModes.has(source.sizing) ? source.sizing : "height",
        targetWidth: Math.round(clamp(numberValue(source.targetWidth, 1200), 1, MAX_EXPORT_DIMENSION)),
        targetHeight: Math.round(clamp(numberValue(source.targetHeight, 1200), 1, MAX_EXPORT_DIMENSION)),
        gap: Math.round(clamp(numberValue(source.gap, 0), 0, 5000)),
        padding: Math.round(clamp(numberValue(source.padding, 0), 0, 5000)),
        background: backgrounds.has(source.background) ? source.background : "transparent",
        customBackground: sanitizeHexColor(source.customBackground, "#f3f4f6"),
        output,
      };
    }
    if (mode === "edit") {
      const cropSource = source.crop && typeof source.crop === "object" ? source.crop : {};
      const resizeSource = source.resize && typeof source.resize === "object" ? source.resize : {};
      const cropRatios = new Set(["free", "1:1", "4:3", "3:4", "16:9", "9:16"]);
      const width = nullablePresetDimension(resizeSource.width);
      const height = nullablePresetDimension(resizeSource.height);
      return {
        rotation: normalizeRotation(numberValue(source.rotation, 0)),
        flipX: source.flipX === true,
        flipY: source.flipY === true,
        cropRatio: cropRatios.has(source.cropRatio) ? source.cropRatio : "free",
        crop: {
          centerXRatio: clamp(numberValue(cropSource.centerXRatio, 0.5), 0, 1),
          centerYRatio: clamp(numberValue(cropSource.centerYRatio, 0.5), 0, 1),
          widthRatio: clamp(numberValue(cropSource.widthRatio, 1), 0.000001, 1),
          heightRatio: clamp(numberValue(cropSource.heightRatio, 1), 0.000001, 1),
        },
        resize: {
          width: width != null && height != null ? width : null,
          height: width != null && height != null ? height : null,
          keepAspect: resizeSource.keepAspect !== false,
          anchor: resizeSource.anchor === "height" ? "height" : "width",
        },
        output,
      };
    }
    if (mode === "canvas") {
      const size = constrainCanvasSize(source.width, source.height);
      const backgroundModes = new Set(["transparent", "white", "black", "custom"]);
      return {
        width: size.width,
        height: size.height,
        backgroundMode: backgroundModes.has(source.backgroundMode) ? source.backgroundMode : "transparent",
        backgroundColor: sanitizeHexColor(source.backgroundColor, "#f3f4f6"),
        snap: source.snap !== false,
        gridVisible: source.gridVisible === true,
        gridSize: Math.round(clamp(numberValue(source.gridSize, 20), 2, 500)),
        output,
      };
    }
    if (mode === "filter") {
      return {
        filter: sanitizeFilterState(source.filter),
        output,
      };
    }
    return {
      columns: normalizeSplitAxisCount(source.columns, DEFAULT_SPLIT_COLUMNS),
      rows: normalizeSplitAxisCount(source.rows, DEFAULT_SPLIT_ROWS),
      output,
    };
  }

  function sanitizeProcessingPreset(value) {
    if (!value || typeof value !== "object" || !PROCESSING_PRESET_MODES.has(value.mode)) return null;
    const id = String(value.id ?? "").trim().slice(0, 120);
    const name = normalizeProcessingPresetName(value.name);
    if (!id || !name) return null;
    const settings = sanitizeProcessingPresetSettings(value.mode, value.settings);
    if (!settings) return null;
    const createdAt = Math.max(0, Math.floor(numberValue(value.createdAt, 0)));
    const updatedAt = Math.max(createdAt, Math.floor(numberValue(value.updatedAt, createdAt)));
    return { id, name, mode: value.mode, createdAt, updatedAt, settings };
  }

  function sanitizeProcessingPresets(values) {
    if (!Array.isArray(values)) return [];
    const seenIds = new Set();
    return values
      .map(sanitizeProcessingPreset)
      .filter((preset) => {
        if (!preset || seenIds.has(preset.id)) return false;
        seenIds.add(preset.id);
        return true;
      })
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, PROCESSING_PRESET_LIMIT);
  }

  function resolveProcessingPresetStorage(storage) {
    if (storage !== undefined) return storage;
    try {
      return globalThis.localStorage || null;
    } catch {
      return null;
    }
  }

  function loadProcessingPresets(storage = undefined) {
    try {
      const target = resolveProcessingPresetStorage(storage);
      if (!target || typeof target.getItem !== "function") return [];
      const raw = target.getItem(PROCESSING_PRESET_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== PROCESSING_PRESET_STORAGE_VERSION || !Array.isArray(parsed.presets)) {
        return [];
      }
      return sanitizeProcessingPresets(parsed.presets);
    } catch {
      return [];
    }
  }

  function writeProcessingPresets(presets, storage = undefined) {
    try {
      const target = resolveProcessingPresetStorage(storage);
      if (!target || typeof target.setItem !== "function") return false;
      const safePresets = sanitizeProcessingPresets(presets);
      target.setItem(PROCESSING_PRESET_STORAGE_KEY, JSON.stringify({
        version: PROCESSING_PRESET_STORAGE_VERSION,
        presets: safePresets,
      }));
      return true;
    } catch {
      return false;
    }
  }

  function captureOutputPresetSettings() {
    return sanitizeOutputPresetSettings({
      format: el.outputFormat?.value,
      quality: el.outputQuality?.value,
    });
  }

  function captureCurrentProcessingSettings(mode = state.mode) {
    const output = captureOutputPresetSettings();
    if (mode === "combine") {
      const options = getCombineOptions();
      return sanitizeProcessingPresetSettings(mode, {
        direction: options.direction,
        columns: options.columns,
        sizing: options.sizing,
        targetWidth: options.targetWidth,
        targetHeight: options.targetHeight,
        gap: options.gap,
        padding: options.padding,
        background: options.background,
        customBackground: options.customBackground,
        output,
      });
    }
    if (mode === "edit") {
      const record = getSelected();
      if (!record) return null;
      const bounds = getOrientedDimensions(record);
      const crop = normalizedCrop(record);
      return sanitizeProcessingPresetSettings(mode, {
        rotation: record.rotation,
        flipX: record.flipX,
        flipY: record.flipY,
        cropRatio: record.cropRatio,
        crop: {
          centerXRatio: (crop.x + crop.width / 2) / bounds.width,
          centerYRatio: (crop.y + crop.height / 2) / bounds.height,
          widthRatio: crop.width / bounds.width,
          heightRatio: crop.height / bounds.height,
        },
        resize: {
          width: record.resize?.width,
          height: record.resize?.height,
          keepAspect: record.resize?.keepAspect,
          anchor: record.resizeAnchor,
        },
        output,
      });
    }
    if (mode === "canvas") {
      return sanitizeProcessingPresetSettings(mode, {
        width: state.canvas.width,
        height: state.canvas.height,
        backgroundMode: state.canvas.backgroundMode === "image" ? "transparent" : state.canvas.backgroundMode,
        backgroundColor: state.canvas.backgroundColor,
        snap: state.canvas.snap,
        gridVisible: state.canvas.gridVisible,
        gridSize: state.canvas.gridSize,
        output,
      });
    }
    if (mode === "filter") {
      const record = getSelected();
      if (!record) return null;
      return sanitizeProcessingPresetSettings(mode, {
        filter: ensureFilterState(record),
        output,
      });
    }
    if (mode === "split") {
      const split = normalizeSplitControls();
      return sanitizeProcessingPresetSettings(mode, { ...split, output });
    }
    return null;
  }

  function applyOutputPresetSettings(output) {
    const safe = sanitizeOutputPresetSettings(output);
    if (el.outputFormat) el.outputFormat.value = safe.format;
    if (el.outputQuality) el.outputQuality.value = String(safe.quality);
  }

  function applyProcessingPresetSettings(mode, value) {
    if (mode !== state.mode || !PROCESSING_PRESET_MODES.has(mode)) return false;
    const settings = sanitizeProcessingPresetSettings(mode, value);
    if (!settings) return false;
    if (mode === "combine") {
      if (el.combineDirection) el.combineDirection.value = settings.direction;
      if (el.gridColumns) el.gridColumns.value = String(settings.columns);
      if (el.combineSizing) el.combineSizing.value = settings.sizing;
      if (el.targetWidth) el.targetWidth.value = String(settings.targetWidth);
      if (el.targetHeight) el.targetHeight.value = String(settings.targetHeight);
      if (el.gapSize) el.gapSize.value = String(settings.gap);
      if (el.outerPadding) el.outerPadding.value = String(settings.padding);
      if (el.backgroundMode) el.backgroundMode.value = settings.background;
      if (el.customBackground) el.customBackground.value = settings.customBackground;
    } else if (mode === "edit") {
      const record = getSelected();
      if (!record) return false;
      record.rotation = settings.rotation;
      record.flipX = settings.flipX;
      record.flipY = settings.flipY;
      record.cropRatio = settings.cropRatio;
      const bounds = getOrientedDimensions(record);
      const width = clamp(settings.crop.widthRatio * bounds.width, MIN_CROP_SIZE, bounds.width);
      const height = clamp(settings.crop.heightRatio * bounds.height, MIN_CROP_SIZE, bounds.height);
      const crop = {
        x: settings.crop.centerXRatio * bounds.width - width / 2,
        y: settings.crop.centerYRatio * bounds.height - height / 2,
        width,
        height,
      };
      const ratio = ratioNumber(record.cropRatio);
      record.crop = ratio ? fitCropToRatio(crop, bounds, ratio) : clampCrop(crop, bounds);
      record.resize = {
        width: settings.resize.width,
        height: settings.resize.height,
        keepAspect: settings.resize.keepAspect,
      };
      record.resizeAnchor = settings.resize.anchor;
      reconcileResize(record, record.resizeAnchor);
    } else if (mode === "canvas") {
      const before = snapshotCanvasState();
      state.canvas.width = settings.width;
      state.canvas.height = settings.height;
      state.canvas.backgroundMode = settings.backgroundMode;
      state.canvas.backgroundColor = settings.backgroundColor;
      state.canvas.snap = settings.snap;
      state.canvas.gridVisible = settings.gridVisible;
      state.canvas.gridSize = settings.gridSize;
      state.canvas.guideX = null;
      state.canvas.guideY = null;
      pushCanvasHistory(before);
    } else if (mode === "filter") {
      const record = getSelected();
      if (!record) return false;
      record.filter = cloneFilterState(settings.filter);
      state.filter.comparingOriginal = false;
    } else {
      if (el.splitColumns) el.splitColumns.value = String(settings.columns);
      if (el.splitRows) el.splitRows.value = String(settings.rows);
    }
    applyOutputPresetSettings(settings.output);
    refreshAll();
    return true;
  }

  function processingPresetNeedsImage(mode = state.mode) {
    return mode === "edit" || mode === "filter";
  }

  function currentModeProcessingPresets() {
    return state.processingPresets
      .filter((preset) => preset.mode === state.mode)
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }

  function clearElementChildren(element) {
    if (!element) return;
    if (typeof element.replaceChildren === "function") element.replaceChildren();
    else element.textContent = "";
  }

  function formatProcessingPresetDate(value) {
    const date = new Date(numberValue(value, 0));
    if (!Number.isFinite(date.getTime())) return "更新日時不明";
    const pad = (part) => String(part).padStart(2, "0");
    return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function createProcessingPresetCard(preset, selected) {
    const card = document.createElement("article");
    card.className = `processing-preset-card${selected ? " is-selected" : ""}`;
    card.setAttribute("role", "listitem");

    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.className = "processing-preset-card__select";
    selectButton.dataset.presetAction = "select";
    selectButton.dataset.presetId = preset.id;
    selectButton.setAttribute("aria-pressed", String(selected));
    selectButton.setAttribute("aria-label", `保存設定「${preset.name}」を選択`);

    const icon = document.createElement("span");
    icon.className = "processing-preset-card__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "↶";

    const copy = document.createElement("span");
    copy.className = "processing-preset-card__copy";
    const name = document.createElement("span");
    name.className = "processing-preset-card__name";
    name.textContent = preset.name;
    const meta = document.createElement("span");
    meta.className = "processing-preset-card__meta";
    meta.textContent = `${PROCESSING_PRESET_MODE_LABELS[preset.mode]}・${formatProcessingPresetDate(preset.updatedAt)}`;
    copy.append(name, meta);
    selectButton.append(icon, copy);

    const applyButton = document.createElement("button");
    applyButton.type = "button";
    applyButton.className = "processing-preset-card__apply";
    applyButton.dataset.presetAction = "apply";
    applyButton.dataset.presetId = preset.id;
    applyButton.textContent = "適用";
    applyButton.setAttribute("aria-label", `保存設定「${preset.name}」を適用`);
    applyButton.disabled = state.exporting || (processingPresetNeedsImage() && !getSelected());
    card.append(selectButton, applyButton);
    return card;
  }

  function renderProcessingPresetControls(preferredId = null) {
    if (el.processingPresetMode) {
      el.processingPresetMode.textContent = PROCESSING_PRESET_MODE_LABELS[state.mode] || "加工設定";
    }
    if (!el.processingPresetSelect) return;
    const previousId = preferredId || el.processingPresetSelect.value;
    const presets = currentModeProcessingPresets();
    clearElementChildren(el.processingPresetSelect);
    if (presets.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "保存済み設定はありません";
      el.processingPresetSelect.append(option);
      el.processingPresetSelect.value = "";
    } else {
      presets.forEach((preset) => {
        const option = document.createElement("option");
        option.value = preset.id;
        option.textContent = preset.name;
        el.processingPresetSelect.append(option);
      });
      el.processingPresetSelect.value = presets.some((preset) => preset.id === previousId)
        ? previousId
        : presets[0].id;
    }

    if (el.processingPresetCount) el.processingPresetCount.textContent = `${presets.length}件`;
    if (!el.processingPresetList) return;
    const query = String(el.processingPresetSearch?.value || "").trim().toLocaleLowerCase();
    const visiblePresets = query
      ? presets.filter((preset) => preset.name.toLocaleLowerCase().includes(query))
      : presets;
    clearElementChildren(el.processingPresetList);
    visiblePresets.forEach((preset) => {
      el.processingPresetList.append(createProcessingPresetCard(preset, preset.id === el.processingPresetSelect.value));
    });
    if (el.processingPresetEmpty) {
      el.processingPresetEmpty.hidden = visiblePresets.length > 0;
      el.processingPresetEmpty.textContent = query && presets.length
        ? "一致する保存設定はありません。"
        : "このモードの保存済み設定はありません。";
    }
  }

  function getSelectedProcessingPreset() {
    const id = el.processingPresetSelect?.value || "";
    return state.processingPresets.find((preset) => preset.id === id && preset.mode === state.mode) || null;
  }

  function saveCurrentProcessingPreset() {
    if (state.exporting) return false;
    const name = normalizeProcessingPresetName(el.processingPresetName?.value);
    if (!name) {
      setStatus("プリセット名を入力してください。", "error");
      el.processingPresetName?.focus();
      return false;
    }
    const settings = captureCurrentProcessingSettings(state.mode);
    if (!settings) {
      setStatus("このモードの設定を保存するには、画像を選択してください。", "error");
      return false;
    }
    const now = Date.now();
    const normalizedName = name.toLocaleLowerCase();
    const existing = state.processingPresets.find((preset) => (
      preset.mode === state.mode && preset.name.toLocaleLowerCase() === normalizedName
    ));
    if (!existing && state.processingPresets.length >= PROCESSING_PRESET_LIMIT) {
      setStatus(`加工設定は${PROCESSING_PRESET_LIMIT}件まで保存できます。不要な設定を削除してください。`, "error");
      return false;
    }
    const preset = sanitizeProcessingPreset({
      id: existing?.id || `preset-${createId()}`,
      name,
      mode: state.mode,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      settings,
    });
    if (!preset) return false;
    const next = sanitizeProcessingPresets([
      preset,
      ...state.processingPresets.filter((item) => item.id !== preset.id),
    ]);
    if (!writeProcessingPresets(next)) {
      setStatus("加工設定を保存できませんでした。ブラウザの保存領域を確認してください。", "error");
      return false;
    }
    state.processingPresets = next;
    if (el.processingPresetName) el.processingPresetName.value = name;
    if (el.processingPresetSearch) el.processingPresetSearch.value = "";
    renderProcessingPresetControls(preset.id);
    updateActionAvailability();
    const canvasImageWasExcluded = state.mode === "canvas" && state.canvas.backgroundMode === "image";
    setStatus(canvasImageWasExcluded
      ? `「${name}」を保存しました。背景画像は素材のため、透明背景として保存しています。`
      : `「${name}」へ現在の加工設定を保存しました。`, canvasImageWasExcluded ? "warning" : "success");
    return true;
  }

  function applySelectedProcessingPreset() {
    if (state.exporting) return false;
    const preset = getSelectedProcessingPreset();
    if (!preset) return false;
    if (processingPresetNeedsImage() && !getSelected()) {
      setStatus("この設定を適用する画像を選択してください。", "error");
      return false;
    }
    if (!applyProcessingPresetSettings(state.mode, preset.settings)) return false;
    setStatus(`「${preset.name}」の加工設定を適用しました。素材とレイヤーは変更していません。`, "success");
    return true;
  }

  function deleteSelectedProcessingPreset() {
    if (state.exporting) return false;
    const preset = getSelectedProcessingPreset();
    if (!preset) return false;
    const next = state.processingPresets.filter((item) => item.id !== preset.id);
    if (!writeProcessingPresets(next)) {
      setStatus("保存設定を削除できませんでした。ブラウザの保存領域を確認してください。", "error");
      return false;
    }
    state.processingPresets = next;
    renderProcessingPresetControls();
    updateActionAvailability();
    setStatus(`保存設定「${preset.name}」を削除しました。`, "success");
    return true;
  }

  function refreshAll() {
    if (state.selectedId && !state.images.some((record) => record.id === state.selectedId)) {
      state.selectedId = state.images[0]?.id || null;
    }
    pruneMarkedImageIds();
    renderImageList();
    syncEditControls();
    renderCanvasLayerList();
    syncCanvasControls();
    syncFilterControls();
    renderFinishLayerList();
    syncFinishControls();
    normalizeSplitControls();
    updateSplitSummary();
    renderProcessingPresetControls();
    updateConditionalControls();
    updateEmptyState();
    schedulePreview();
    if (state.mode === "canvas") renderCanvasComposition();
    updateActionAvailability();
  }

  function renderImageList() {
    el.imageList.textContent = "";
    if (el.imageCount) el.imageCount.textContent = `${state.images.length}枚`;

    for (const record of state.images) {
      const card = document.createElement("article");
      card.className = "image-card";
      card.dataset.id = record.id;
      card.draggable = true;
      card.tabIndex = 0;
      card.setAttribute("role", "listitem");
      card.setAttribute("aria-label", `${record.fileName}、${record.originalWidth}×${record.originalHeight}`);
      card.setAttribute("aria-keyshortcuts", "Alt+ArrowUp Alt+ArrowDown");
      card.title = "ドラッグ、または Alt＋↑ / Alt＋↓ で並び替え";
      if (record.id === state.selectedId) {
        card.classList.add("is-selected");
        card.setAttribute("aria-current", "true");
      }
      const isMarked = state.markedImageIds.has(record.id);
      card.classList.toggle("is-marked-for-removal", isMarked);

      const selectLabel = document.createElement("label");
      selectLabel.className = "image-card__select";
      selectLabel.title = "一括操作の対象に選択";
      const selectCheckbox = document.createElement("input");
      selectCheckbox.type = "checkbox";
      selectCheckbox.checked = isMarked;
      selectCheckbox.disabled = state.exporting;
      selectCheckbox.draggable = false;
      selectCheckbox.setAttribute("aria-label", `${record.fileName}を一括操作の対象に選択`);
      selectCheckbox.addEventListener("change", () => {
        setImageMarked(record.id, selectCheckbox.checked, card);
      });
      selectLabel.draggable = false;
      selectLabel.addEventListener("pointerdown", (event) => event.stopPropagation());
      selectLabel.addEventListener("click", (event) => event.stopPropagation());
      selectLabel.append(selectCheckbox);

      const thumb = document.createElement("img");
      thumb.className = "image-card__thumb";
      thumb.src = record.objectUrl;
      thumb.alt = "";
      thumb.draggable = false;

      const details = document.createElement("div");
      details.className = "image-card__details";
      const name = document.createElement("strong");
      name.className = "image-card__name";
      name.textContent = record.fileName;
      name.title = record.fileName;
      const size = document.createElement("span");
      size.className = "image-card__size";
      size.textContent = `${record.originalWidth} × ${record.originalHeight}`;
      details.append(name, size);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "image-card__remove";
      remove.setAttribute("aria-label", `${record.fileName}を削除`);
      remove.title = "一覧から削除";
      remove.textContent = "×";
      remove.addEventListener("click", (event) => {
        event.stopPropagation();
        removeImage(record.id);
      });

      card.append(selectLabel, thumb, details, remove);
      card.addEventListener("click", () => selectImage(record.id));
      card.addEventListener("keydown", (event) => {
        if (event.target !== card) return;
        if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
          event.preventDefault();
          const currentIndex = state.images.findIndex((item) => item.id === record.id);
          const targetIndex = event.key === "ArrowUp" ? currentIndex - 1 : currentIndex + 1;
          const target = state.images[targetIndex];
          if (target) reorderImage(record.id, target.id, event.key === "ArrowDown");
          requestAnimationFrame(() => el.imageList.querySelector(`[data-id="${CSS.escape(record.id)}"]`)?.focus());
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectImage(record.id);
          requestAnimationFrame(() => el.imageList.querySelector(`[data-id="${CSS.escape(record.id)}"]`)?.focus());
        }
      });
      card.addEventListener("dragstart", (event) => {
        state.draggedId = record.id;
        card.classList.add("is-dragging");
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", record.id);
        }
      });
      card.addEventListener("dragend", () => {
        state.draggedId = null;
        clearDropMarkers(true);
      });
      card.addEventListener("dragover", (event) => {
        if (!state.draggedId || state.draggedId === record.id) return;
        event.preventDefault();
        clearDropMarkers();
        const after = event.clientY > card.getBoundingClientRect().top + card.offsetHeight / 2;
        card.classList.add(after ? "drop-after" : "drop-before");
      });
      card.addEventListener("drop", (event) => {
        if (!state.draggedId || state.draggedId === record.id) return;
        event.preventDefault();
        event.stopPropagation();
        const after = event.clientY > card.getBoundingClientRect().top + card.offsetHeight / 2;
        reorderImage(state.draggedId, record.id, after);
      });

      el.imageList.append(card);
    }
    updateImageBulkActions();
  }

  function pruneMarkedImageIds() {
    if (!(state.markedImageIds instanceof Set)) state.markedImageIds = new Set();
    const liveIds = new Set(state.images.map((record) => record.id));
    for (const id of Array.from(state.markedImageIds)) {
      if (!liveIds.has(id)) state.markedImageIds.delete(id);
    }
  }

  function updateImageBulkActions() {
    pruneMarkedImageIds();
    const markedCount = state.markedImageIds.size;
    const imageCount = state.images.length;
    setElementHidden(el.imageBulkActions, imageCount === 0);
    if (el.imageSelectionCount) el.imageSelectionCount.textContent = `${markedCount}枚選択`;
    if (el.imageSelectAll) {
      el.imageSelectAll.checked = imageCount > 0 && markedCount === imageCount;
      el.imageSelectAll.indeterminate = markedCount > 0 && markedCount < imageCount;
      el.imageSelectAll.disabled = imageCount === 0 || state.exporting;
    }
    if (el.deleteSelectedImagesBtn) {
      el.deleteSelectedImagesBtn.disabled = markedCount === 0 || state.exporting;
      el.deleteSelectedImagesBtn.textContent = markedCount > 0
        ? `選択した素材を削除（${markedCount}枚）`
        : "選択した素材を削除";
    }
  }

  function setImageMarked(id, marked, card = null) {
    if (state.exporting) return false;
    if (!state.images.some((record) => record.id === id)) return false;
    if (marked) state.markedImageIds.add(id);
    else state.markedImageIds.delete(id);
    card?.classList.toggle("is-marked-for-removal", Boolean(marked));
    updateImageBulkActions();
    updateImprovementControls();
    return true;
  }

  function setAllImagesMarked(marked) {
    if (state.exporting) return false;
    state.markedImageIds.clear();
    if (marked) state.images.forEach((record) => state.markedImageIds.add(record.id));
    renderImageList();
    updateActionAvailability();
    return true;
  }

  function renderCanvasLayerList() {
    if (!el.canvasLayerList) return;
    el.canvasLayerList.textContent = "";
    if (el.canvasLayerCount) el.canvasLayerCount.textContent = `${state.canvas.layers.length}層`;
    el.canvasLayerPanel?.classList.toggle("is-empty", state.canvas.layers.length === 0);

    const frontToBack = [...state.canvas.layers].reverse();
    frontToBack.forEach((layer) => {
      const backgroundInactive = Boolean(layer.isBackground && state.canvas.backgroundMode !== "image");
      const effectivelyVisible = layer.visible && !backgroundInactive;
      const row = document.createElement("div");
      row.className = "canvas-layer-row";
      row.dataset.id = layer.id;
      row.draggable = !layer.isBackground;
      row.tabIndex = 0;
      row.setAttribute("role", "listitem");
      row.setAttribute("aria-label", `${layer.name}、${effectivelyVisible ? "表示" : "非表示"}、${layer.locked ? "ロック中" : "編集可能"}`);
      if (layer.id === state.canvas.selectedId) {
        row.classList.add("is-selected");
        row.setAttribute("aria-current", "true");
      }
      if (!effectivelyVisible) row.classList.add("is-hidden-layer");
      if (layer.locked) row.classList.add("is-locked");

      const visibility = document.createElement("button");
      visibility.type = "button";
      visibility.className = "canvas-layer-row__icon";
      visibility.textContent = effectivelyVisible ? "👁" : "○";
      visibility.disabled = backgroundInactive;
      visibility.setAttribute("aria-label", backgroundInactive
        ? `${layer.name}は背景画像モードで表示できます`
        : `${layer.name}を${layer.visible ? "非表示" : "表示"}にする`);
      visibility.addEventListener("click", (event) => {
        event.stopPropagation();
        selectCanvasLayer(layer.id);
        toggleCanvasLayerVisibility();
        focusCanvasLayerRow(layer.id, ".canvas-layer-row__icon:first-child");
      });

      const thumb = document.createElement("img");
      thumb.className = "canvas-layer-row__thumb";
      thumb.src = layer.objectUrl;
      thumb.alt = "";
      thumb.draggable = false;

      const name = document.createElement("span");
      name.className = "canvas-layer-row__name";
      name.textContent = layer.name;
      name.title = layer.name;

      const lock = document.createElement("button");
      lock.type = "button";
      lock.className = "canvas-layer-row__icon";
      lock.textContent = layer.locked ? "🔒" : "🔓";
      lock.setAttribute("aria-label", `${layer.name}を${layer.locked ? "ロック解除" : "ロック"}する`);
      lock.addEventListener("click", (event) => {
        event.stopPropagation();
        selectCanvasLayer(layer.id);
        toggleCanvasLayerLock();
        focusCanvasLayerRow(layer.id, ".canvas-layer-row__icon:last-child");
      });

      row.append(visibility, thumb, name, lock);
      row.addEventListener("click", () => selectCanvasLayer(layer.id));
      row.addEventListener("keydown", (event) => {
        if (event.target !== row) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectCanvasLayer(layer.id);
          focusCanvasLayerRow(layer.id);
        } else if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          selectCanvasLayer(layer.id);
          deleteSelectedCanvasLayer();
        } else if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
          event.preventDefault();
          selectCanvasLayer(layer.id);
          moveCanvasLayerOrder(event.key === "ArrowUp" ? "forward" : "backward");
          focusCanvasLayerRow(layer.id);
        }
      });
      row.addEventListener("dragstart", (event) => {
        state.canvas.draggedLayerId = layer.id;
        row.classList.add("is-dragging");
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", layer.id);
        }
      });
      row.addEventListener("dragend", () => {
        state.canvas.draggedLayerId = null;
        clearCanvasLayerDropMarkers(true);
      });
      row.addEventListener("dragover", (event) => {
        if (!state.canvas.draggedLayerId || state.canvas.draggedLayerId === layer.id) return;
        event.preventDefault();
        clearCanvasLayerDropMarkers();
        const after = event.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2;
        row.classList.add(after ? "drop-after" : "drop-before");
      });
      row.addEventListener("drop", (event) => {
        const sourceId = state.canvas.draggedLayerId;
        if (!sourceId || sourceId === layer.id) return;
        event.preventDefault();
        event.stopPropagation();
        const after = event.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2;
        const before = snapshotCanvasState();
        state.canvas.layers = reorderCanvasLayers(state.canvas.layers, sourceId, layer.id, after);
        state.canvas.draggedLayerId = null;
        syncCanvasZIndexes();
        pushCanvasHistory(before);
        refreshAll();
        setStatus("レイヤーの重なり順を変更しました。", "success");
      });

      el.canvasLayerList.append(row);
    });
  }

  function normalizeFinishSelection() {
    const layers = ensureFinishLayers(getSelected());
    if (!layers.some((layer) => layer.id === state.filter.selectedFinishLayerId)) {
      state.filter.selectedFinishLayerId = layers.at(-1)?.id || null;
    }
    return state.filter.selectedFinishLayerId;
  }

  function getSelectedFinishLayer(record = getSelected()) {
    return ensureFinishLayers(record).find((layer) => layer.id === state.filter.selectedFinishLayerId) || null;
  }

  function selectFinishLayer(id) {
    const layers = ensureFinishLayers(getSelected());
    state.filter.selectedFinishLayerId = layers.some((layer) => layer.id === id) ? id : null;
    renderFinishLayerList();
    syncFinishControls();
    schedulePreview();
    updateActionAvailability();
  }

  const FINISH_BASE_TOKEN = Object.freeze({ type: "processed-image" });

  function getFinishLayersByPlacement(layers, placement = "front") {
    const safePlacement = sanitizeFinishPlacement(placement);
    return Array.from(layers || []).filter((layer) => sanitizeFinishPlacement(layer.placement) === safePlacement);
  }

  function getFinishVisualOrder(layers) {
    return [
      ...getFinishLayersByPlacement(layers, "front").reverse(),
      FINISH_BASE_TOKEN,
      ...getFinishLayersByPlacement(layers, "behind").reverse(),
    ];
  }

  function finishLayersFromVisualOrder(items) {
    const visual = Array.from(items || []);
    const baseIndex = visual.indexOf(FINISH_BASE_TOKEN);
    const splitIndex = baseIndex >= 0 ? baseIndex : visual.length;
    const front = visual.slice(0, splitIndex).filter((item) => item !== FINISH_BASE_TOKEN);
    const behind = visual.slice(splitIndex + (baseIndex >= 0 ? 1 : 0)).filter((item) => item !== FINISH_BASE_TOKEN);
    front.forEach((layer) => { layer.placement = "front"; });
    behind.forEach((layer) => { layer.placement = "behind"; });
    return [...behind.reverse(), ...front.reverse()];
  }

  function moveFinishLayerAcrossBase(layers, sourceId, placement) {
    const visual = getFinishVisualOrder(layers);
    const sourceIndex = visual.findIndex((item) => item !== FINISH_BASE_TOKEN && item.id === sourceId);
    if (sourceIndex < 0) return Array.from(layers || []);
    const [moved] = visual.splice(sourceIndex, 1);
    const baseIndex = visual.indexOf(FINISH_BASE_TOKEN);
    const safePlacement = sanitizeFinishPlacement(placement);
    visual.splice(safePlacement === "front" ? baseIndex : baseIndex + 1, 0, moved);
    return finishLayersFromVisualOrder(visual);
  }

  function createFinishBaseRow(record) {
    const row = document.createElement("div");
    row.className = "filter-finish-base-row";
    row.dataset.finishBase = "true";
    row.setAttribute("role", "listitem");
    row.setAttribute("aria-label", "加工画像。ここより上は画像の前面、下は画像の背面です");

    const thumb = document.createElement("img");
    thumb.className = "filter-finish-base-row__thumb";
    thumb.src = record?.objectUrl || "";
    thumb.alt = "";
    thumb.draggable = false;

    const copy = document.createElement("span");
    copy.className = "filter-finish-base-row__copy";
    const name = document.createElement("span");
    name.className = "filter-finish-base-row__name";
    name.textContent = "加工画像（フィルター後）";
    const hint = document.createElement("span");
    hint.className = "filter-finish-base-row__hint";
    hint.textContent = "前面と背面の境界";
    copy.append(name, hint);

    const badge = document.createElement("span");
    badge.className = "filter-finish-base-row__badge";
    badge.textContent = "基準";
    row.append(thumb, copy, badge);

    row.addEventListener("dragover", (event) => {
      if (!state.filter.draggedFinishLayerId) return;
      event.preventDefault();
      clearFinishLayerDropMarkers();
      const front = event.clientY <= row.getBoundingClientRect().top + row.offsetHeight / 2;
      row.classList.add(front ? "drop-before" : "drop-after");
    });
    row.addEventListener("drop", (event) => {
      const sourceId = state.filter.draggedFinishLayerId;
      if (!sourceId) return;
      event.preventDefault();
      event.stopPropagation();
      const placement = event.clientY <= row.getBoundingClientRect().top + row.offsetHeight / 2 ? "front" : "behind";
      const selected = getSelected();
      if (!selected) return;
      selected.finishLayers = moveFinishLayerAcrossBase(selected.finishLayers, sourceId, placement);
      state.filter.draggedFinishLayerId = null;
      refreshAll();
      setStatus(`仕上げ素材を画像の${placement === "front" ? "前面" : "背面"}へ移動しました。`, "success");
    });
    return row;
  }

  function renderFinishLayerList() {
    if (!el.filterFinishLayerList) return;
    const record = getSelected();
    const layers = ensureFinishLayers(record);
    normalizeFinishSelection();
    el.filterFinishLayerList.textContent = "";
    if (el.filterFinishLayerCount) el.filterFinishLayerCount.textContent = `${layers.length}層`;
    setElementHidden(el.filterFinishEmpty, layers.length > 0);

    const appendLayerRow = (layer) => {
      const placement = sanitizeFinishPlacement(layer.placement);
      const row = document.createElement("div");
      row.className = "filter-finish-layer-row";
      row.dataset.id = layer.id;
      row.dataset.finishLayerId = layer.id;
      row.dataset.finishPlacement = placement;
      row.draggable = true;
      row.tabIndex = 0;
      row.setAttribute("role", "listitem");
      row.setAttribute("aria-label", `${layer.name}、画像の${placement === "front" ? "前面" : "背面"}、${layer.visible ? "表示" : "非表示"}`);
      row.setAttribute("aria-keyshortcuts", "Delete Alt+ArrowUp Alt+ArrowDown");
      if (layer.id === state.filter.selectedFinishLayerId) {
        row.classList.add("is-selected");
        row.setAttribute("aria-current", "true");
      }
      if (!layer.visible) row.classList.add("is-hidden-layer");

      const visibility = document.createElement("button");
      visibility.type = "button";
      visibility.className = "filter-finish-layer-row__visibility";
      visibility.textContent = layer.visible ? "👁" : "○";
      visibility.setAttribute("aria-pressed", String(layer.visible));
      visibility.setAttribute("aria-label", `${layer.name}を${layer.visible ? "非表示" : "表示"}にする`);
      visibility.addEventListener("click", (event) => {
        event.stopPropagation();
        selectFinishLayer(layer.id);
        toggleFinishLayerVisibility();
        focusFinishLayerRow(layer.id, ".filter-finish-layer-row__visibility");
      });

      const thumb = document.createElement("img");
      thumb.className = "filter-finish-layer-row__thumb";
      thumb.src = layer.objectUrl || "";
      thumb.alt = "";
      thumb.draggable = false;

      const name = document.createElement("span");
      name.className = "filter-finish-layer-row__name";
      name.textContent = layer.name;
      name.title = layer.name;

      const badge = document.createElement("span");
      badge.className = "filter-finish-layer-row__badge";
      badge.textContent = placement === "front" ? "前面" : "背面";

      const meta = document.createElement("span");
      meta.className = "filter-finish-layer-row__meta";
      meta.append(name, badge);

      const drag = document.createElement("span");
      drag.className = "filter-finish-layer-row__drag";
      drag.textContent = "⋮⋮";
      drag.setAttribute("aria-hidden", "true");

      row.append(visibility, thumb, meta, drag);
      row.addEventListener("click", () => selectFinishLayer(layer.id));
      row.addEventListener("keydown", (event) => {
        if (event.target !== row) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          selectFinishLayer(layer.id);
          focusFinishLayerRow(layer.id);
        } else if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          event.stopPropagation();
          selectFinishLayer(layer.id);
          deleteSelectedFinishLayer();
        } else if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
          event.preventDefault();
          event.stopPropagation();
          selectFinishLayer(layer.id);
          moveFinishLayerOrder(event.key === "ArrowUp" ? "forward" : "backward");
          focusFinishLayerRow(layer.id);
        }
      });
      row.addEventListener("dragstart", (event) => {
        state.filter.draggedFinishLayerId = layer.id;
        row.classList.add("is-dragging");
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", layer.id);
        }
      });
      row.addEventListener("dragend", () => {
        state.filter.draggedFinishLayerId = null;
        clearFinishLayerDropMarkers(true);
      });
      row.addEventListener("dragover", (event) => {
        if (!state.filter.draggedFinishLayerId || state.filter.draggedFinishLayerId === layer.id) return;
        event.preventDefault();
        clearFinishLayerDropMarkers();
        const after = event.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2;
        row.classList.add(after ? "drop-after" : "drop-before");
      });
      row.addEventListener("drop", (event) => {
        const sourceId = state.filter.draggedFinishLayerId;
        if (!sourceId || sourceId === layer.id) return;
        event.preventDefault();
        event.stopPropagation();
        const after = event.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2;
        const selected = getSelected();
        selected.finishLayers = reorderFinishLayers(selected.finishLayers, sourceId, layer.id, after);
        state.filter.draggedFinishLayerId = null;
        refreshAll();
        setStatus("仕上げレイヤーの重なり順を変更しました。", "success");
      });
      el.filterFinishLayerList.append(row);
    };

    getFinishLayersByPlacement(layers, "front").reverse().forEach(appendLayerRow);
    if (layers.length) el.filterFinishLayerList.append(createFinishBaseRow(record));
    getFinishLayersByPlacement(layers, "behind").reverse().forEach(appendLayerRow);
  }

  function reorderFinishLayers(layers, sourceId, targetId, after = false) {
    const visual = getFinishVisualOrder(layers);
    const sourceIndex = visual.findIndex((item) => item !== FINISH_BASE_TOKEN && item.id === sourceId);
    if (sourceIndex < 0) return Array.from(layers || []);
    const [moved] = visual.splice(sourceIndex, 1);
    let targetIndex = visual.findIndex((item) => item !== FINISH_BASE_TOKEN && item.id === targetId);
    if (targetIndex < 0) return Array.from(layers || []);
    if (after) targetIndex += 1;
    visual.splice(targetIndex, 0, moved);
    return finishLayersFromVisualOrder(visual);
  }

  function clearFinishLayerDropMarkers(includeDragging = false) {
    if (!el.filterFinishLayerList) return;
    const selector = includeDragging ? ".drop-before, .drop-after, .is-dragging" : ".drop-before, .drop-after";
    el.filterFinishLayerList.querySelectorAll(selector).forEach((row) => {
      row.classList.remove("drop-before", "drop-after");
      if (includeDragging) row.classList.remove("is-dragging");
    });
  }

  function focusFinishLayerRow(id, childSelector = null) {
    requestAnimationFrame(() => {
      const escapedId = globalThis.CSS?.escape ? CSS.escape(id) : String(id).replace(/["\\]/g, "\\$&");
      const row = el.filterFinishLayerList?.querySelector?.(`[data-id="${escapedId}"]`);
      (childSelector ? row?.querySelector?.(childSelector) : row)?.focus?.();
    });
  }

  function clearCanvasLayerDropMarkers(includeDragging = false) {
    if (!el.canvasLayerList) return;
    const selector = includeDragging ? ".drop-before, .drop-after, .is-dragging" : ".drop-before, .drop-after";
    el.canvasLayerList.querySelectorAll(selector).forEach((row) => {
      row.classList.remove("drop-before", "drop-after");
      if (includeDragging) row.classList.remove("is-dragging");
    });
  }

  function focusCanvasLayerRow(id, childSelector = null) {
    requestAnimationFrame(() => {
      const escapedId = globalThis.CSS?.escape ? CSS.escape(id) : String(id).replace(/["\\]/g, "\\$&");
      const row = el.canvasLayerList?.querySelector?.(`[data-id="${escapedId}"]`);
      (childSelector ? row?.querySelector?.(childSelector) : row)?.focus?.();
    });
  }

  function clearDropMarkers(includeDragging = false) {
    const selector = includeDragging ? ".drop-before, .drop-after, .is-dragging" : ".drop-before, .drop-after";
    el.imageList.querySelectorAll(selector).forEach((card) => {
      card.classList.remove("drop-before", "drop-after");
      if (includeDragging) card.classList.remove("is-dragging");
    });
  }

  function reorderImage(sourceId, targetId, after) {
    const sourceIndex = state.images.findIndex((record) => record.id === sourceId);
    if (sourceIndex < 0) return;
    const [moved] = state.images.splice(sourceIndex, 1);
    let targetIndex = state.images.findIndex((record) => record.id === targetId);
    if (targetIndex < 0) {
      state.images.push(moved);
    } else {
      if (after) targetIndex += 1;
      state.images.splice(targetIndex, 0, moved);
    }
    state.draggedId = null;
    refreshAll();
    setStatus("画像の順番を変更しました。", "success");
  }

  function selectImage(id) {
    state.selectedId = id;
    normalizeFinishSelection();
    renderImageList();
    syncEditControls();
    syncFilterControls();
    renderFinishLayerList();
    syncFinishControls();
    updateSplitSummary();
    schedulePreview();
    updateActionAvailability();
  }

  function removeImage(id) {
    const index = state.images.findIndex((record) => record.id === id);
    if (index < 0) return;
    const removedSelectedImage = state.selectedId === id;
    const result = removeImagesByIds([id], index);
    if (!result.removed.length) return;
    const adjacentId = state.images[Math.min(index, state.images.length - 1)]?.id || null;
    focusImageCardOrAdd(removedSelectedImage ? result.focusId : adjacentId || result.focusId);
    setStatus(`${result.removed[0].fileName}を一覧から削除しました。`, "success");
  }

  function removeImagesByIds(ids, preferredIndex = null) {
    recordImageHistory();
    const previousImages = [...state.images];
    const targetIds = new Set(Array.from(ids || []).filter((id) => (
      previousImages.some((record) => record.id === id)
    )));
    if (!targetIds.size) return { removed: [], focusId: null };
    const selectedWasRemoved = targetIds.has(state.selectedId);
    const selectedIndex = previousImages.findIndex((record) => record.id === state.selectedId);
    const fallbackIndex = preferredIndex == null
      ? Math.min(...Array.from(targetIds, (id) => previousImages.findIndex((record) => record.id === id)))
      : preferredIndex;
    const replacement = selectedWasRemoved
      ? previousImages.slice(selectedIndex + 1).find((record) => !targetIds.has(record.id))
        || previousImages.slice(0, selectedIndex).reverse().find((record) => !targetIds.has(record.id))
        || previousImages[fallbackIndex]
      : null;
    if (selectedWasRemoved) {
      cancelFinishGesture();
      state.filter.comparingOriginal = false;
    }
    targetIds.forEach((id) => cancelFinishLoads(id));
    const removed = previousImages.filter((record) => targetIds.has(record.id));
    state.images = previousImages.filter((record) => !targetIds.has(record.id));
    const mainUrls = new Set(removed.map((record) => record.objectUrl).filter(Boolean));
    mainUrls.forEach((url) => state.imageSourceUrls.add(url));
    targetIds.forEach((id) => state.markedImageIds.delete(id));
    if (targetIds.has(state.draggedId)) state.draggedId = null;
    if (selectedWasRemoved) {
      state.selectedId = replacement && !targetIds.has(replacement.id)
        ? replacement.id
        : state.images[Math.min(fallbackIndex, state.images.length - 1)]?.id || null;
      state.filter.selectedFinishLayerId = null;
    }
    normalizeFinishSelection();
    sweepFinishSourceUrls();
    refreshAll();
    showRemovalUndo();
    return { removed, focusId: state.selectedId || state.images[0]?.id || null };
  }

  function focusImageCardOrAdd(id) {
    requestAnimationFrame(() => {
      const escapedId = id && globalThis.CSS?.escape
        ? CSS.escape(id)
        : String(id || "").replace(/["\\]/g, "\\$&");
      const target = id
        ? el.imageList.querySelector(`[data-id="${escapedId}"]`)
        : el.addImagesBtn;
      target?.focus();
    });
  }

  function deleteMarkedImages() {
    const ids = Array.from(state.markedImageIds);
    if (!ids.length || state.exporting) return;
    const result = removeImagesByIds(ids);
    if (!result.removed.length) return;
    focusImageCardOrAdd(result.focusId);
    setStatus(`${result.removed.length}枚の素材を一覧から削除しました。元ファイルは変更されていません。`, "success");
  }

  function clearAll() {
    if (state.mode === "canvas") {
      clearCanvasComposition();
      return;
    }
    cancelPendingLoads();
    cancelFinishLoads();
    recordImageHistory();
    state.images.forEach((record) => state.imageSourceUrls.add(record.objectUrl));
    state.images = [];
    state.selectedId = null;
    state.markedImageIds.clear();
    state.filter.selectedFinishLayerId = null;
    state.filter.finishGesture = null;
    refreshAll();
    showRemovalUndo();
    setStatus("画像をすべて削除しました。元ファイルは変更されていません。", "success");
  }

  function getSelected() {
    return state.images.find((record) => record.id === state.selectedId) || null;
  }

  function getSelectedCanvasLayer() {
    return state.canvas.layers.find((layer) => layer.id === state.canvas.selectedId) || null;
  }

  function clearCanvasComposition() {
    cancelCanvasLoads();
    const before = snapshotCanvasState();
    state.canvas.layers = [];
    state.canvas.selectedId = null;
    state.canvas.clipboard = null;
    if (state.canvas.backgroundMode === "image") state.canvas.backgroundMode = "transparent";
    pushCanvasHistory(before);
    refreshAll();
    setStatus("キャンバス上の素材をすべて削除しました。元ファイルは変更されていません。", "success");
  }

  function updateEmptyState() {
    const isEmpty = state.images.length === 0;
    const isCanvas = state.mode === "canvas";
    const isFilter = state.mode === "filter";
    const isSplit = state.mode === "split";
    setElementHidden(el.previewPlaceholder, isCanvas || !isEmpty);
    setElementHidden(el.combinePreviewCanvas, isCanvas || isEmpty || state.mode !== "combine");
    setElementHidden(el.editViewport, isCanvas || isEmpty || state.mode !== "edit");
    setElementHidden(el.filterPreviewCanvas, isCanvas || isEmpty || !isFilter);
    setElementHidden(el.splitPreviewCanvas, isCanvas || isEmpty || !isSplit);
    if (!isFilter || isEmpty) setElementHidden(el.filterFinishSelectionBox, true);
    setElementHidden(el.canvasViewport, !isCanvas);
    if (isCanvas) {
      updatePreviewDimensions(state.canvas.width, state.canvas.height);
    } else if (isEmpty) {
      el.dropZone.tabIndex = 0;
      updatePreviewDimensions(null, null);
    }
  }

  function updateActionAvailability() {
    recordImageHistory();
    const hasImages = state.images.length > 0;
    const hasPendingLoads = state.queuedLoadCount > 0 || state.pendingLoads.size > 0;
    const hasCanvasLayers = state.canvas.layers.length > 0;
    const hasCanvasPending = state.canvas.queuedLoadCount > 0 || state.canvas.pendingLoads.size > 0;
    const hasFinishPending = state.filter.queuedFinishLoadCount > 0 || state.filter.pendingFinishLoads.size > 0;
    const selectedCanvasLayer = getSelectedCanvasLayer();
    const selectedFinishLayer = getSelectedFinishLayer();
    const isCanvas = state.mode === "canvas";
    const isFilter = state.mode === "filter";
    const isSplit = state.mode === "split";
    updateImageBulkActions();
    const modePresets = currentModeProcessingPresets();
    const selectedPreset = getSelectedProcessingPreset();
    const presetNeedsImage = processingPresetNeedsImage();
    const hasPresetTarget = !presetNeedsImage || Boolean(getSelected());
    const hasPresetName = Boolean(normalizeProcessingPresetName(el.processingPresetName?.value));
    if (el.processingPresetName) el.processingPresetName.disabled = state.exporting;
    if (el.processingPresetSelect) el.processingPresetSelect.disabled = modePresets.length === 0 || state.exporting;
    if (el.saveProcessingPresetBtn) {
      el.saveProcessingPresetBtn.disabled = state.exporting || !hasPresetTarget || !hasPresetName;
    }
    if (el.applyProcessingPresetBtn) {
      el.applyProcessingPresetBtn.disabled = state.exporting || !hasPresetTarget || !selectedPreset;
    }
    if (el.deleteProcessingPresetBtn) {
      el.deleteProcessingPresetBtn.disabled = state.exporting || !selectedPreset;
    }
    el.processingPresetList?.querySelectorAll?.('[data-preset-action="apply"]')?.forEach((button) => {
      button.disabled = state.exporting || !hasPresetTarget;
    });
    el.addImagesBtn && (el.addImagesBtn.disabled = state.exporting);
    el.fileInput && (el.fileInput.disabled = state.exporting);
    el.canvasAddBtn && (el.canvasAddBtn.disabled = state.exporting);
    el.canvasFileInput && (el.canvasFileInput.disabled = state.exporting);
    el.canvasBackgroundBtn && (el.canvasBackgroundBtn.disabled = state.exporting);
    el.canvasBackgroundInput && (el.canvasBackgroundInput.disabled = state.exporting);
    el.modeCombineBtn && (el.modeCombineBtn.disabled = state.exporting);
    el.modeEditBtn && (el.modeEditBtn.disabled = state.exporting);
    el.modeCanvasBtn && (el.modeCanvasBtn.disabled = state.exporting);
    el.modeFilterBtn && (el.modeFilterBtn.disabled = state.exporting);
    el.modeSplitBtn && (el.modeSplitBtn.disabled = state.exporting);
    el.splitColumns && (el.splitColumns.disabled = state.exporting);
    el.splitRows && (el.splitRows.disabled = state.exporting);
    el.clearAllBtn && (el.clearAllBtn.disabled = isCanvas
      ? (!hasCanvasLayers && !hasCanvasPending) || state.exporting
      : (!hasImages && !hasPendingLoads && !hasFinishPending) || state.exporting);
    el.resetAllBtn && (el.resetAllBtn.disabled = (isCanvas ? !hasCanvasLayers : !hasImages) || state.exporting);
    el.resetCurrentBtn && (el.resetCurrentBtn.disabled = (isCanvas ? !selectedCanvasLayer : !getSelected()) || state.exporting);
    const canvasCanExport = hasCanvasLayers || ["white", "black", "custom"].includes(state.canvas.backgroundMode);
    const splitCanExport = !isSplit || getSplitLayout(getSelected()).regions.length > 1;
    const currentModeHasNoOutput = state.mode === "combine"
      ? state.images.length < 2
      : state.mode === "edit" || isFilter
        ? !hasImages
        : isSplit
          ? !splitCanExport
          : !canvasCanExport;
    el.exportBtn.disabled = state.exporting
      || (isCanvas ? hasCanvasPending : hasPendingLoads || (isFilter && hasFinishPending))
      || currentModeHasNoOutput;
    if (el.applyCropAllBtn) el.applyCropAllBtn.disabled = state.images.length < 2 || state.exporting;
    if (el.applyResizeAllBtn) el.applyResizeAllBtn.disabled = state.images.length < 2 || state.exporting;
    [el.presetSquareAllBtn, el.preset169AllBtn, el.preset512AllBtn, el.preset1920WidthAllBtn]
      .filter(Boolean)
      .forEach((button) => {
        button.disabled = !hasImages || state.exporting;
      });
    if (el.canvasUndoBtn) el.canvasUndoBtn.disabled = state.canvas.history.length === 0 || state.exporting;
    if (el.canvasRedoBtn) el.canvasRedoBtn.disabled = state.canvas.redo.length === 0 || state.exporting;
    if (el.filterCompareBtn) el.filterCompareBtn.disabled = !getSelected() || state.exporting;
    if (el.filterApplyAllBtn) {
      el.filterApplyAllBtn.disabled = state.images.length < 2 || hasPendingLoads || hasFinishPending || state.exporting;
    }
    if (el.filterExportVariantsBtn) {
      el.filterExportVariantsBtn.disabled = !getSelected() || hasPendingLoads || hasFinishPending || state.exporting;
    }
    if (el.filterFinishAddBtn) el.filterFinishAddBtn.disabled = !getSelected() || hasFinishPending || state.exporting;
    if (el.filterFinishInput) el.filterFinishInput.disabled = !getSelected() || hasFinishPending || state.exporting;
    if (el.filterApplyFinishAllBtn) {
      el.filterApplyFinishAllBtn.disabled = state.images.length < 2 || !getSelected() || hasPendingLoads || hasFinishPending || state.exporting;
    }
    if (el.filterApplyFilterFinishAllBtn) {
      el.filterApplyFilterFinishAllBtn.disabled = state.images.length < 2 || !getSelected() || hasPendingLoads || hasFinishPending || state.exporting;
    }
    const finishControls = [
      el.filterFinishName,
      el.filterFinishX,
      el.filterFinishY,
      el.filterFinishWidth,
      el.filterFinishHeight,
      el.filterFinishKeepAspect,
      el.filterFinishRotation,
      el.filterFinishOpacity,
      el.filterFinishBlendMode,
      el.filterFinishPlacement,
      el.filterFinishFrameBtn,
      el.filterFinishFitMode,
      el.filterFinishVisibilityBtn,
      el.filterFinishDeleteBtn,
      el.filterFinishBringFrontBtn,
      el.filterFinishForwardBtn,
      el.filterFinishBackwardBtn,
      el.filterFinishSendBackBtn,
      el.filterFinishFitCanvasBtn,
      el.filterFinishFitWidthBtn,
      el.filterFinishFitHeightBtn,
      el.filterFinishPlaceCenterBtn,
      el.filterFinishPlaceTopLeftBtn,
      el.filterFinishPlaceTopRightBtn,
      el.filterFinishPlaceBottomLeftBtn,
      el.filterFinishPlaceBottomRightBtn,
    ].filter(Boolean);
    finishControls.forEach((control) => {
      control.disabled = !selectedFinishLayer || state.exporting;
    });
    if (selectedFinishLayer?.isFrame) {
      [
        el.filterFinishX,
        el.filterFinishY,
        el.filterFinishWidth,
        el.filterFinishHeight,
        el.filterFinishKeepAspect,
        el.filterFinishRotation,
      ]
        .filter(Boolean)
        .forEach((control) => { control.disabled = true; });
      [
        el.filterFinishFitWidthBtn,
        el.filterFinishFitHeightBtn,
        el.filterFinishPlaceCenterBtn,
        el.filterFinishPlaceTopLeftBtn,
        el.filterFinishPlaceTopRightBtn,
        el.filterFinishPlaceBottomLeftBtn,
        el.filterFinishPlaceBottomRightBtn,
      ].filter(Boolean).forEach((control) => { control.disabled = true; });
    } else if (el.filterFinishFitMode) {
      el.filterFinishFitMode.disabled = true;
    }
    const workspace = document.querySelector?.(".workspace");
    if (workspace) workspace.inert = state.exporting;
    updateImprovementControls();
  }

  function hasFilterPendingLoads() {
    return state.queuedLoadCount > 0
      || state.pendingLoads.size > 0
      || state.filter.queuedFinishLoadCount > 0
      || state.filter.pendingFinishLoads.size > 0;
  }

  function normalizeCombineControls({ commitGridColumns = false } = {}) {
    const columns = normalizeGridColumns(el.gridColumns);
    if (el.gridColumns && (commitGridColumns || document.activeElement !== el.gridColumns)) {
      el.gridColumns.value = String(columns);
    }
    clampInput(el.targetWidth, 1, MAX_EXPORT_DIMENSION, 1200);
    clampInput(el.targetHeight, 1, MAX_EXPORT_DIMENSION, 1200);
    clampInput(el.gapSize, 0, 5000, 0);
    clampInput(el.outerPadding, 0, 5000, 0);
    if (el.outputQuality) {
      const quality = clamp(numberValue(el.outputQuality, 90), 1, 100);
      if (el.qualityValue) el.qualityValue.textContent = `${Math.round(quality)}%`;
    }
  }

  function clampInput(input, min, max, fallback) {
    if (!input || input.value === "") return fallback;
    const value = clamp(numberValue(input, fallback), min, max);
    if (document.activeElement !== input) input.value = String(Math.round(value));
    return value;
  }

  function normalizeGridColumns(source, fallback = DEFAULT_GRID_COLUMNS) {
    const safeFallback = Math.round(clamp(
      numberValue(fallback, DEFAULT_GRID_COLUMNS),
      GRID_COLUMNS_MIN,
      GRID_COLUMNS_MAX,
    ));
    return Math.round(clamp(
      numberValue(source, safeFallback),
      GRID_COLUMNS_MIN,
      GRID_COLUMNS_MAX,
    ));
  }

  function normalizeSplitAxisCount(source, fallback = SPLIT_AXIS_MIN) {
    const safeFallback = Math.round(clamp(
      numberValue(fallback, SPLIT_AXIS_MIN),
      SPLIT_AXIS_MIN,
      SPLIT_AXIS_MAX,
    ));
    return Math.round(clamp(
      numberValue(source, safeFallback),
      SPLIT_AXIS_MIN,
      SPLIT_AXIS_MAX,
    ));
  }

  function normalizeSplitControls({ commit = false } = {}) {
    const columns = normalizeSplitAxisCount(el.splitColumns, DEFAULT_SPLIT_COLUMNS);
    const rows = normalizeSplitAxisCount(el.splitRows, DEFAULT_SPLIT_ROWS);
    if (el.splitColumns && (commit || document.activeElement !== el.splitColumns)) {
      el.splitColumns.value = String(columns);
    }
    if (el.splitRows && (commit || document.activeElement !== el.splitRows)) {
      el.splitRows.value = String(rows);
    }
    return { columns, rows };
  }

  function updateConditionalControls() {
    const direction = el.combineDirection?.value || "horizontal";
    const sizing = el.combineSizing?.value || "original";
    const background = el.backgroundMode?.value || "transparent";
    const canvasBackground = state.canvas.backgroundMode;
    const format = el.outputFormat?.value || "png";
    toggleControlGroup("grid", direction === "grid");
    toggleControlGroup("custom-size", sizing === "custom");
    toggleControlGroup("custom-background", background === "custom");
    toggleControlGroup("canvas-custom-background", canvasBackground === "custom");
    toggleControlGroup("canvas-background-image", canvasBackground === "image");
    toggleControlGroup("quality", format === "jpeg" || format === "webp");
    setElementHidden(
      el.transparencyFormatHint,
      !(
        (state.mode === "canvas" && canvasBackground === "transparent" && format !== "png")
        || (state.mode === "filter" && format === "jpeg")
        || (state.mode === "split" && format === "jpeg")
      ),
    );
  }

  function toggleControlGroup(name, visible) {
    document.querySelectorAll(`[data-control-group="${name}"]`).forEach((node) => {
      node.hidden = !visible;
      node.classList.toggle("is-hidden", !visible);
    });
  }

  function getCombineOptions() {
    return {
      direction: el.combineDirection?.value || "horizontal",
      columns: normalizeGridColumns(el.gridColumns),
      sizing: el.combineSizing?.value || "original",
      targetWidth: Math.round(clamp(numberValue(el.targetWidth, 1200), 1, MAX_EXPORT_DIMENSION)),
      targetHeight: Math.round(clamp(numberValue(el.targetHeight, 1200), 1, MAX_EXPORT_DIMENSION)),
      gap: Math.round(clamp(numberValue(el.gapSize, 0), 0, 5000)),
      padding: Math.round(clamp(numberValue(el.outerPadding, 0), 0, 5000)),
      background: el.backgroundMode?.value || "transparent",
      customBackground: el.customBackground?.value || "#ffffff",
      format: el.outputFormat?.value || "png",
      quality: clamp(numberValue(el.outputQuality, 90) / 100, 0.01, 1),
    };
  }

  function getSplitOptions() {
    return {
      columns: normalizeSplitAxisCount(el.splitColumns, DEFAULT_SPLIT_COLUMNS),
      rows: normalizeSplitAxisCount(el.splitRows, DEFAULT_SPLIT_ROWS),
      format: FORMAT_MIME[el.outputFormat?.value] ? el.outputFormat.value : "png",
      quality: clamp(numberValue(el.outputQuality, 90) / 100, 0.01, 1),
    };
  }

  function calculateSplitRegions(width, height, columns = DEFAULT_SPLIT_COLUMNS, rows = DEFAULT_SPLIT_ROWS) {
    const safeWidth = Math.round(numberValue(width, 0));
    const safeHeight = Math.round(numberValue(height, 0));
    if (safeWidth < 1 || safeHeight < 1) {
      return { width: 0, height: 0, columns: 0, rows: 0, total: 0, regions: [] };
    }
    const safeColumns = Math.min(
      safeWidth,
      normalizeSplitAxisCount(columns, DEFAULT_SPLIT_COLUMNS),
    );
    const safeRows = Math.min(
      safeHeight,
      normalizeSplitAxisCount(rows, DEFAULT_SPLIT_ROWS),
    );
    const regions = [];
    for (let row = 0; row < safeRows; row += 1) {
      const top = Math.floor((row * safeHeight) / safeRows);
      const bottom = Math.floor(((row + 1) * safeHeight) / safeRows);
      for (let column = 0; column < safeColumns; column += 1) {
        const left = Math.floor((column * safeWidth) / safeColumns);
        const right = Math.floor(((column + 1) * safeWidth) / safeColumns);
        regions.push({
          index: regions.length,
          row,
          column,
          x: left,
          y: top,
          width: right - left,
          height: bottom - top,
        });
      }
    }
    return {
      width: safeWidth,
      height: safeHeight,
      columns: safeColumns,
      rows: safeRows,
      total: regions.length,
      regions,
    };
  }

  function getSplitLayout(record = getSelected(), options = getSplitOptions()) {
    if (!record) return calculateSplitRegions(0, 0, options.columns, options.rows);
    const size = getProcessedDimensions(record);
    return calculateSplitRegions(size.width, size.height, options.columns, options.rows);
  }

  function splitDimensionRange(regions, key) {
    if (!regions.length) return "—";
    const values = regions.map((region) => region[key]);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    return minimum === maximum ? String(minimum) : `${minimum}〜${maximum}`;
  }

  function formatSplitSummary(layout) {
    if (!layout?.regions?.length) return "画像を選択すると分割結果を表示します";
    if (layout.total === 1) return `1枚（${layout.width} × ${layout.height} px・分割なし）`;
    return `${layout.total}枚（幅 ${splitDimensionRange(layout.regions, "width")} px × 高さ ${splitDimensionRange(layout.regions, "height")} px）`;
  }

  function updateSplitSummary() {
    if (!el.splitSummary) return;
    el.splitSummary.textContent = formatSplitSummary(getSplitLayout());
  }

  function schedulePreview() {
    recordImageHistory();
    cancelAnimationFrame(state.previewFrame);
    state.previewFrame = requestAnimationFrame(() => {
      state.previewFrame = 0;
      if (!state.images.length) return;
      if (state.mode === "combine") renderCombinePreview();
      else if (state.mode === "edit") renderEditPreview();
      else if (state.mode === "filter") renderFilterPreview();
      else if (state.mode === "split") renderSplitPreview();
      renderMobilePreview();
    });
  }

  function calculateCombineLayout(records, options) {
    if (!records.length) return { width: 0, height: 0, placements: [] };
    const base = records.map((record) => {
      const size = getProcessedDimensions(record);
      return { record, sourceWidth: size.width, sourceHeight: size.height };
    });
    let items;

    if (options.sizing === "width") {
      const width = Math.max(...base.map((item) => item.sourceWidth));
      items = base.map((item) => ({
        ...item,
        boxWidth: width,
        boxHeight: item.sourceHeight * (width / item.sourceWidth),
        drawWidth: width,
        drawHeight: item.sourceHeight * (width / item.sourceWidth),
      }));
    } else if (options.sizing === "height") {
      const height = Math.max(...base.map((item) => item.sourceHeight));
      items = base.map((item) => ({
        ...item,
        boxWidth: item.sourceWidth * (height / item.sourceHeight),
        boxHeight: height,
        drawWidth: item.sourceWidth * (height / item.sourceHeight),
        drawHeight: height,
      }));
    } else if (options.sizing === "custom") {
      items = base.map((item) => {
        const scale = Math.min(options.targetWidth / item.sourceWidth, options.targetHeight / item.sourceHeight);
        return {
          ...item,
          boxWidth: options.targetWidth,
          boxHeight: options.targetHeight,
          drawWidth: item.sourceWidth * scale,
          drawHeight: item.sourceHeight * scale,
        };
      });
    } else {
      items = base.map((item) => ({
        ...item,
        boxWidth: item.sourceWidth,
        boxHeight: item.sourceHeight,
        drawWidth: item.sourceWidth,
        drawHeight: item.sourceHeight,
      }));
    }

    const gap = options.gap;
    const padding = options.padding;
    const placements = [];
    let width;
    let height;

    if (options.direction === "vertical") {
      const contentWidth = Math.max(...items.map((item) => item.boxWidth));
      const contentHeight = items.reduce((sum, item) => sum + item.boxHeight, 0) + gap * Math.max(0, items.length - 1);
      width = contentWidth + padding * 2;
      height = contentHeight + padding * 2;
      let y = padding;
      items.forEach((item) => {
        const cellX = padding + (contentWidth - item.boxWidth) / 2;
        placements.push(makePlacement(item, cellX, y));
        y += item.boxHeight + gap;
      });
    } else if (options.direction === "grid") {
      const columns = Math.min(normalizeGridColumns(options.columns), items.length);
      const rows = Math.ceil(items.length / columns);
      const cellWidth = Math.max(...items.map((item) => item.boxWidth));
      const cellHeight = Math.max(...items.map((item) => item.boxHeight));
      width = cellWidth * columns + gap * Math.max(0, columns - 1) + padding * 2;
      height = cellHeight * rows + gap * Math.max(0, rows - 1) + padding * 2;
      items.forEach((item, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const cellX = padding + column * (cellWidth + gap) + (cellWidth - item.boxWidth) / 2;
        const cellY = padding + row * (cellHeight + gap) + (cellHeight - item.boxHeight) / 2;
        placements.push(makePlacement(item, cellX, cellY));
      });
    } else {
      const contentWidth = items.reduce((sum, item) => sum + item.boxWidth, 0) + gap * Math.max(0, items.length - 1);
      const contentHeight = Math.max(...items.map((item) => item.boxHeight));
      width = contentWidth + padding * 2;
      height = contentHeight + padding * 2;
      let x = padding;
      items.forEach((item) => {
        const cellY = padding + (contentHeight - item.boxHeight) / 2;
        placements.push(makePlacement(item, x, cellY));
        x += item.boxWidth + gap;
      });
    }

    return {
      width: Math.max(1, Math.ceil(width)),
      height: Math.max(1, Math.ceil(height)),
      placements,
    };
  }

  function makePlacement(item, cellX, cellY) {
    return {
      record: item.record,
      x: cellX + (item.boxWidth - item.drawWidth) / 2,
      y: cellY + (item.boxHeight - item.drawHeight) / 2,
      width: item.drawWidth,
      height: item.drawHeight,
    };
  }

  function renderCombinePreview() {
    if (!state.images.length || state.mode !== "combine") return;
    const options = getCombineOptions();
    const layout = calculateCombineLayout(state.images, options);
    const stage = el.combinePreviewCanvas.parentElement;
    const maxWidth = Math.max(1, (stage?.clientWidth || 960) - 36);
    const maxHeight = Math.max(1, (stage?.clientHeight || 680) - 36);
    const scale = Math.min(1, maxWidth / layout.width, maxHeight / layout.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssWidth = Math.max(1, Math.round(layout.width * scale));
    const cssHeight = Math.max(1, Math.round(layout.height * scale));
    const canvas = el.combinePreviewCanvas;
    canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    canvas.height = Math.max(1, Math.round(cssHeight * dpr));
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.dataset.outputSize = `${layout.width}×${layout.height}`;
    const context = canvas.getContext("2d", { alpha: true });
    context.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    drawCombined(context, layout, options);
    updatePreviewDimensions(layout.width, layout.height);
  }

  function drawCombined(context, layout, options) {
    context.save();
    context.clearRect(0, 0, layout.width, layout.height);
    const background = resolveBackground(options);
    if (background) {
      context.fillStyle = background;
      context.fillRect(0, 0, layout.width, layout.height);
    }
    for (const placement of layout.placements) {
      drawRecordInto(context, placement.record, placement.x, placement.y, placement.width, placement.height);
    }
    context.restore();
  }

  function renderSplitPreview() {
    const record = getSelected();
    if (!record || state.mode !== "split") return;
    const layout = getSplitLayout(record, getSplitOptions());
    if (!layout.regions.length) return;
    const canvas = el.splitPreviewCanvas;
    const stage = canvas.parentElement;
    const maxWidth = Math.max(1, (stage?.clientWidth || 960) - 36);
    const maxHeight = Math.max(1, (stage?.clientHeight || 680) - 36);
    const scale = Math.min(1, maxWidth / layout.width, maxHeight / layout.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssWidth = Math.max(1, Math.round(layout.width * scale));
    const cssHeight = Math.max(1, Math.round(layout.height * scale));
    canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    canvas.height = Math.max(1, Math.round(cssHeight * dpr));
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.dataset.outputSize = `${layout.width}×${layout.height}`;
    canvas.dataset.splitCount = String(layout.total);
    const context = requireCanvasContext(canvas);
    context.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    context.clearRect(0, 0, layout.width, layout.height);
    drawProcessedRecordInto(context, record, 0, 0, layout.width, layout.height);
    drawSplitGuides(context, layout, scale);
    updatePreviewDimensions(layout.width, layout.height);
    updateSplitSummary();
  }

  function drawSplitGuides(context, layout, displayScale = 1) {
    if (!layout?.regions?.length || layout.total <= 1) return;
    const scale = Math.max(0.0001, numberValue(displayScale, 1));
    const traceLines = () => {
      context.beginPath();
      for (let column = 1; column < layout.columns; column += 1) {
        const x = Math.floor((column * layout.width) / layout.columns);
        context.moveTo(x, 0);
        context.lineTo(x, layout.height);
      }
      for (let row = 1; row < layout.rows; row += 1) {
        const y = Math.floor((row * layout.height) / layout.rows);
        context.moveTo(0, y);
        context.lineTo(layout.width, y);
      }
    };

    context.save();
    context.lineCap = "butt";
    context.lineJoin = "miter";
    traceLines();
    context.strokeStyle = "rgba(255, 255, 255, 0.96)";
    context.lineWidth = 4 / scale;
    context.stroke();
    traceLines();
    context.strokeStyle = "#4f46e5";
    context.lineWidth = 2 / scale;
    context.stroke();

    if (layout.total <= 100) {
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = `800 ${12 / scale}px system-ui, sans-serif`;
      layout.regions.forEach((region) => {
        if (region.width * scale < 32 || region.height * scale < 26) return;
        const label = String(region.index + 1);
        const badgeWidth = (18 + label.length * 7) / scale;
        const badgeHeight = 20 / scale;
        const centerX = region.x + region.width / 2;
        const centerY = region.y + region.height / 2;
        context.fillStyle = "rgba(30, 41, 59, 0.78)";
        context.fillRect(centerX - badgeWidth / 2, centerY - badgeHeight / 2, badgeWidth, badgeHeight);
        context.fillStyle = "#ffffff";
        context.fillText(label, centerX, centerY);
      });
    }
    context.restore();
  }

  function resolveBackground(options) {
    if (options.format === "jpeg" && options.background === "transparent") return "#ffffff";
    if (options.background === "white") return "#ffffff";
    if (options.background === "black") return "#000000";
    if (options.background === "custom") return options.customBackground;
    return null;
  }

  function updatePreviewDimensions(width, height) {
    const target = document.getElementById("previewDimensions");
    if (!target) return;
    target.textContent = Number.isFinite(width) && Number.isFinite(height)
      ? `${Math.round(width)} × ${Math.round(height)} px`
      : "—";
  }

  function getProcessedDimensions(record) {
    const crop = normalizedCrop(record);
    return {
      width: Math.max(1, Math.round(record.resize.width || crop.width)),
      height: Math.max(1, Math.round(record.resize.height || crop.height)),
    };
  }

  function getOrientedDimensions(record) {
    const rotation = normalizeRotation(record.rotation);
    if (rotation === 90 || rotation === 270) {
      return { width: record.originalHeight, height: record.originalWidth };
    }
    return { width: record.originalWidth, height: record.originalHeight };
  }

  function normalizedCrop(record) {
    const bounds = getOrientedDimensions(record);
    const ratio = ratioNumber(record.cropRatio);
    if (ratio && cropMatchesRatio(record.crop, ratio)) {
      return fitCropToRatio({
        x: numberValue(record.crop.x, 0),
        y: numberValue(record.crop.y, 0),
        width: numberValue(record.crop.width, bounds.width),
        height: numberValue(record.crop.height, bounds.height),
      }, bounds, ratio);
    }
    const width = clamp(numberValue(record.crop.width, bounds.width), MIN_CROP_SIZE, bounds.width);
    const height = clamp(numberValue(record.crop.height, bounds.height), MIN_CROP_SIZE, bounds.height);
    const x = clamp(numberValue(record.crop.x, 0), 0, Math.max(0, bounds.width - width));
    const y = clamp(numberValue(record.crop.y, 0), 0, Math.max(0, bounds.height - height));
    return { x, y, width, height };
  }

  function drawRecordInto(context, record, dx, dy, dw, dh) {
    const crop = normalizedCrop(record);
    const oriented = getOrientedDimensions(record);
    context.save();
    context.beginPath();
    context.rect(dx, dy, dw, dh);
    context.clip();
    context.translate(dx, dy);
    context.scale(dw / crop.width, dh / crop.height);
    context.translate(-crop.x, -crop.y);
    context.translate(oriented.width / 2, oriented.height / 2);
    context.scale(record.flipX ? -1 : 1, record.flipY ? -1 : 1);
    context.translate(-oriented.width / 2, -oriented.height / 2);
    applyOrientationTransform(context, record);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(record.image, 0, 0, record.originalWidth, record.originalHeight);
    context.restore();
  }

  function isRecordGeometryNeutral(record) {
    if (!record || normalizeRotation(record.rotation) !== 0 || record.flipX || record.flipY) return false;
    const crop = normalizedCrop(record);
    const width = Math.max(1, numberValue(record.originalWidth, 1));
    const height = Math.max(1, numberValue(record.originalHeight, 1));
    const output = getProcessedDimensions(record);
    return Math.abs(crop.x) < 1e-9
      && Math.abs(crop.y) < 1e-9
      && Math.abs(crop.width - width) < 1e-9
      && Math.abs(crop.height - height) < 1e-9
      && output.width === Math.round(width)
      && output.height === Math.round(height);
  }

  function drawProcessedRecordInto(context, record, dx, dy, dw, dh) {
    if (isRecordGeometryNeutral(record)) {
      context.drawImage(record.image, 0, 0, record.originalWidth, record.originalHeight, dx, dy, dw, dh);
      return;
    }
    drawRecordInto(context, record, dx, dy, dw, dh);
  }

  function applyOrientationTransform(context, record) {
    const rotation = normalizeRotation(record.rotation);
    if (rotation === 90) {
      context.translate(record.originalHeight, 0);
      context.rotate(Math.PI / 2);
    } else if (rotation === 180) {
      context.translate(record.originalWidth, record.originalHeight);
      context.rotate(Math.PI);
    } else if (rotation === 270) {
      context.translate(0, record.originalWidth);
      context.rotate(-Math.PI / 2);
    }
  }

  function renderEditPreview() {
    recordImageHistory();
    requestAnimationFrame(renderMobilePreview);
    const record = getSelected();
    if (!record || state.mode !== "edit") return;
    record.crop = normalizedCrop(record);
    const oriented = getOrientedDimensions(record);
    const viewportWidth = Math.max(1, el.editViewport.clientWidth || 900);
    const viewportHeight = Math.max(1, el.editViewport.clientHeight || 640);
    const scale = Math.min(viewportWidth / oriented.width, viewportHeight / oriented.height, 1);
    const cssWidth = Math.max(1, Math.round(oriented.width * scale));
    const cssHeight = Math.max(1, Math.round(oriented.height * scale));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = el.editCanvas;
    canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    canvas.height = Math.max(1, Math.round(cssHeight * dpr));
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    const context = canvas.getContext("2d", { alpha: true });
    context.setTransform((cssWidth * dpr) / oriented.width, 0, 0, (cssHeight * dpr) / oriented.height, 0, 0);
    context.clearRect(0, 0, oriented.width, oriented.height);
    context.translate(oriented.width / 2, oriented.height / 2);
    context.scale(record.flipX ? -1 : 1, record.flipY ? -1 : 1);
    context.translate(-oriented.width / 2, -oriented.height / 2);
    applyOrientationTransform(context, record);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(record.image, 0, 0, record.originalWidth, record.originalHeight);

    const crop = record.crop;
    const renderedWidth = Math.max(1, canvas.clientWidth || cssWidth);
    const renderedHeight = Math.max(1, canvas.clientHeight || cssHeight);
    const canvasRect = {
      left: canvas.offsetLeft,
      top: canvas.offsetTop,
      width: renderedWidth,
      height: renderedHeight,
    };
    el.cropOverlay.style.left = `${canvasRect.left + (crop.x / oriented.width) * renderedWidth}px`;
    el.cropOverlay.style.top = `${canvasRect.top + (crop.y / oriented.height) * renderedHeight}px`;
    el.cropOverlay.style.width = `${(crop.width / oriented.width) * renderedWidth}px`;
    el.cropOverlay.style.height = `${(crop.height / oriented.height) * renderedHeight}px`;
    el.cropOverlay.dataset.scaleX = String(oriented.width / renderedWidth);
    el.cropOverlay.dataset.scaleY = String(oriented.height / renderedHeight);
    el.cropOverlay.setAttribute("aria-label", `切り抜き範囲 X ${Math.round(crop.x)}、Y ${Math.round(crop.y)}、幅 ${Math.round(crop.width)}、高さ ${Math.round(crop.height)}`);
    updatePreviewDimensions(getProcessedDimensions(record).width, getProcessedDimensions(record).height);
  }

  function syncEditControls() {
    const record = getSelected();
    const controls = [
      el.cropRatio,
      el.cropX,
      el.cropY,
      el.cropWidth,
      el.cropHeight,
      el.resizeWidth,
      el.resizeHeight,
      el.keepAspect,
      el.resetSizeBtn,
      el.preset512Btn,
      el.preset1024Btn,
      el.preset1920Btn,
      el.rotateLeftBtn,
      el.rotateRightBtn,
      el.flipXBtn,
      el.flipYBtn,
    ].filter(Boolean);
    controls.forEach((control) => (control.disabled = !record));
    if (!record) return;

    record.crop = normalizedCrop(record);
    if (el.cropRatio) el.cropRatio.value = record.cropRatio;
    if (el.cropX) el.cropX.value = String(Math.round(record.crop.x));
    if (el.cropY) el.cropY.value = String(Math.round(record.crop.y));
    if (el.cropWidth) el.cropWidth.value = String(Math.round(record.crop.width));
    if (el.cropHeight) el.cropHeight.value = String(Math.round(record.crop.height));
    const size = getProcessedDimensions(record);
    if (el.resizeWidth) el.resizeWidth.value = String(size.width);
    if (el.resizeHeight) el.resizeHeight.value = String(size.height);
    if (el.keepAspect) el.keepAspect.checked = record.resize.keepAspect;
    el.flipXBtn?.classList.toggle("is-active", record.flipX);
    el.flipYBtn?.classList.toggle("is-active", record.flipY);
  }

  const FILTER_TIME_PRESETS = Object.freeze({
    none: Object.freeze({}),
    morning: Object.freeze({
      brightness: 0.11,
      contrast: -0.08,
      saturation: 0.03,
      temperature: 0.16,
      tint: 0.02,
      highlights: 0.05,
      shadows: 0.14,
      red: 0.05,
      green: 0.03,
      blue: 0,
    }),
    day: Object.freeze({
      brightness: 0.09,
      contrast: 0.08,
      saturation: 0.07,
      temperature: 0.01,
      tint: 0,
      highlights: 0.1,
      shadows: 0.02,
      red: 0,
      green: 0,
      blue: 0,
    }),
    evening: Object.freeze({
      brightness: -0.03,
      contrast: 0.14,
      saturation: 0.13,
      temperature: 0.34,
      tint: 0.12,
      highlights: 0.12,
      shadows: -0.1,
      red: 0.12,
      green: 0.03,
      blue: -0.12,
    }),
    night: Object.freeze({
      brightness: -0.24,
      contrast: 0.1,
      saturation: -0.18,
      temperature: -0.38,
      tint: 0.02,
      highlights: -0.16,
      shadows: -0.2,
      red: -0.12,
      green: -0.05,
      blue: 0.17,
    }),
  });

  const FILTER_TIME_VALUES = new Set(Object.keys(FILTER_TIME_PRESETS));
  const FILTER_EFFECT_VALUES = new Set(["none", "oil", "poster", "monochrome", "sepia"]);

  function createDefaultFilterState() {
    return {
      timePreset: "none",
      effectPreset: "none",
      strength: 0.7,
      adjustments: {
        brightness: 0,
        contrast: 0,
        saturation: 0,
        temperature: 0,
        tint: 0,
        highlights: 0,
        shadows: 0,
      },
      oil: { color: 70, brush: 8, edge: 35 },
      poster: { levels: 6, edge: 40 },
    };
  }

  function sanitizeFilterState(value) {
    const defaults = createDefaultFilterState();
    const source = value && typeof value === "object" ? value : {};
    const timeCandidate = source.timePreset ?? source.time;
    const effectCandidate = source.effectPreset ?? source.effect;
    const rawStrength = source.strength ?? (
      Number.isFinite(Number(source.intensity)) ? Number(source.intensity) / 100 : defaults.strength
    );
    const adjustments = source.adjustments && typeof source.adjustments === "object"
      ? source.adjustments
      : {};
    const oil = source.oil && typeof source.oil === "object" ? source.oil : {};
    const poster = source.poster && typeof source.poster === "object" ? source.poster : {};
    const adjustment = (key) => clamp(numberValue(adjustments[key], defaults.adjustments[key]), -100, 100);
    return {
      timePreset: FILTER_TIME_VALUES.has(timeCandidate) ? timeCandidate : "none",
      effectPreset: FILTER_EFFECT_VALUES.has(effectCandidate) ? effectCandidate : "none",
      strength: clamp(numberValue(rawStrength, defaults.strength), 0, 1),
      adjustments: {
        brightness: adjustment("brightness"),
        contrast: adjustment("contrast"),
        saturation: adjustment("saturation"),
        temperature: adjustment("temperature"),
        tint: adjustment("tint"),
        highlights: adjustment("highlights"),
        shadows: adjustment("shadows"),
      },
      oil: {
        color: clamp(numberValue(oil.color ?? oil.colors, defaults.oil.color), 0, 100),
        brush: clamp(numberValue(oil.brush, defaults.oil.brush), 1, 20),
        edge: clamp(numberValue(oil.edge, defaults.oil.edge), 0, 100),
      },
      poster: {
        levels: Math.round(clamp(numberValue(poster.levels, defaults.poster.levels), 2, 16)),
        edge: clamp(numberValue(poster.edge, defaults.poster.edge), 0, 100),
      },
    };
  }

  function cloneFilterState(value) {
    return sanitizeFilterState(value);
  }

  function ensureFilterState(record) {
    if (!record) return createDefaultFilterState();
    record.filter = sanitizeFilterState(record.filter);
    return record.filter;
  }

  function syncFilterControls() {
    const record = getSelected();
    const filter = record ? ensureFilterState(record) : createDefaultFilterState();
    const disabled = !record || state.exporting;
    const timeButtons = [
      [el.filterTimeNoneBtn, "none"],
      [el.filterTimeMorningBtn, "morning"],
      [el.filterTimeNoonBtn, "day"],
      [el.filterTimeEveningBtn, "evening"],
      [el.filterTimeNightBtn, "night"],
    ];
    const effectButtons = [
      [el.filterEffectNoneBtn, "none"],
      [el.filterEffectOilBtn, "oil"],
      [el.filterEffectPosterBtn, "poster"],
      [el.filterEffectMonochromeBtn, "monochrome"],
      [el.filterEffectSepiaBtn, "sepia"],
    ];
    timeButtons.forEach(([button, value]) => {
      if (!button) return;
      const active = filter.timePreset === value;
      button.disabled = disabled;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    effectButtons.forEach(([button, value]) => {
      if (!button) return;
      const active = filter.effectPreset === value;
      button.disabled = disabled;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    const setRange = (input, output, value, formatter = String, effectEnabled = true) => {
      if (input) {
        input.value = String(value);
        input.disabled = disabled || !effectEnabled;
      }
      if (output) output.textContent = record ? formatter(value) : "—";
    };
    setRange(el.filterIntensity, el.filterIntensityValue, Math.round(filter.strength * 100), (value) => `${value}%`);
    setRange(el.filterBrightness, el.filterBrightnessValue, filter.adjustments.brightness, formatSignedFilterValue);
    setRange(el.filterContrast, el.filterContrastValue, filter.adjustments.contrast, formatSignedFilterValue);
    setRange(el.filterSaturation, el.filterSaturationValue, filter.adjustments.saturation, formatSignedFilterValue);
    setRange(el.filterTemperature, el.filterTemperatureValue, filter.adjustments.temperature, formatSignedFilterValue);
    setRange(el.filterTint, el.filterTintValue, filter.adjustments.tint, formatSignedFilterValue);
    setRange(el.filterHighlights, el.filterHighlightsValue, filter.adjustments.highlights, formatSignedFilterValue);
    setRange(el.filterShadows, el.filterShadowsValue, filter.adjustments.shadows, formatSignedFilterValue);
    const oilActive = filter.effectPreset === "oil";
    const posterActive = filter.effectPreset === "poster";
    setRange(el.filterOilColor, el.filterOilColorValue, filter.oil.color, (value) => `${Math.round(value)}%`, oilActive);
    setRange(el.filterOilBrush, el.filterOilBrushValue, filter.oil.brush, (value) => String(Math.round(value)), oilActive);
    setRange(el.filterOilEdge, el.filterOilEdgeValue, filter.oil.edge, (value) => `${Math.round(value)}%`, oilActive);
    setRange(el.filterPosterLevels, el.filterPosterLevelsValue, filter.poster.levels, (value) => `${Math.round(value)}段階`, posterActive);
    setRange(el.filterPosterEdge, el.filterPosterEdgeValue, filter.poster.edge, (value) => `${Math.round(value)}%`, posterActive);
    setElementHidden(el.filterOilSettings, !oilActive);
    setElementHidden(el.filterPosterSettings, !posterActive);
    if (el.filterAdvancedSettings) el.filterAdvancedSettings.inert = disabled;
    if (el.filterCompareBtn) {
      el.filterCompareBtn.disabled = disabled;
      el.filterCompareBtn.classList.toggle("is-comparing", state.filter.comparingOriginal);
      el.filterCompareBtn.setAttribute("aria-pressed", String(state.filter.comparingOriginal));
    }
  }

  function formatSignedFilterValue(value) {
    const rounded = Math.round(numberValue(value, 0));
    return rounded > 0 ? `+${rounded}` : String(rounded);
  }

  function updateSelectedFilter(mutator) {
    const record = getSelected();
    if (!record || state.exporting) return;
    const filter = ensureFilterState(record);
    mutator(filter);
    record.filter = sanitizeFilterState(filter);
    syncFilterControls();
    schedulePreview();
  }

  function updateFilterFromControls() {
    updateSelectedFilter((filter) => {
      filter.strength = clamp(numberValue(el.filterIntensity, 70) / 100, 0, 1);
      filter.adjustments = {
        brightness: clamp(numberValue(el.filterBrightness, 0), -100, 100),
        contrast: clamp(numberValue(el.filterContrast, 0), -100, 100),
        saturation: clamp(numberValue(el.filterSaturation, 0), -100, 100),
        temperature: clamp(numberValue(el.filterTemperature, 0), -100, 100),
        tint: clamp(numberValue(el.filterTint, 0), -100, 100),
        highlights: clamp(numberValue(el.filterHighlights, 0), -100, 100),
        shadows: clamp(numberValue(el.filterShadows, 0), -100, 100),
      };
      filter.oil = {
        color: clamp(numberValue(el.filterOilColor, 70), 0, 100),
        brush: clamp(numberValue(el.filterOilBrush, 8), 1, 20),
        edge: clamp(numberValue(el.filterOilEdge, 35), 0, 100),
      };
      filter.poster = {
        levels: Math.round(clamp(numberValue(el.filterPosterLevels, 6), 2, 16)),
        edge: clamp(numberValue(el.filterPosterEdge, 40), 0, 100),
      };
    });
  }

  function setFilterComparison(active) {
    const next = Boolean(active && state.mode === "filter" && getSelected() && !state.exporting);
    if (state.filter.comparingOriginal === next) return;
    state.filter.comparingOriginal = next;
    syncFilterControls();
    schedulePreview();
  }

  function setFilterCompareActive(active) {
    setFilterComparison(active);
  }

  function applySelectedFilterToAll() {
    const record = getSelected();
    if (!record || state.images.length < 2 || state.exporting || hasFilterPendingLoads()) return;
    const source = cloneFilterState(ensureFilterState(record));
    state.images.forEach((item) => {
      item.filter = cloneFilterState(source);
    });
    refreshAll();
    setStatus(`${record.fileName}のフィルター設定を全画像へ適用しました。`, "success");
  }

  function finishGeometryToPixels(layer, width, height) {
    const outputWidth = Math.max(1, numberValue(width, 1));
    const outputHeight = Math.max(1, numberValue(height, 1));
    return {
      ...layer,
      x: numberValue(layer?.xRatio, 0) * outputWidth,
      y: numberValue(layer?.yRatio, 0) * outputHeight,
      width: Math.max(0.01, numberValue(layer?.widthRatio, 1) * outputWidth),
      height: Math.max(0.01, numberValue(layer?.heightRatio, 1) * outputHeight),
      rotation: normalizeCanvasRotation(layer?.rotation),
    };
  }

  function finishGeometryFromPixels(layer, geometry, width, height) {
    const outputWidth = Math.max(1, numberValue(width, 1));
    const outputHeight = Math.max(1, numberValue(height, 1));
    return sanitizeFinishLayerState({
      ...layer,
      xRatio: numberValue(geometry?.x, 0) / outputWidth,
      yRatio: numberValue(geometry?.y, 0) / outputHeight,
      widthRatio: Math.max(0.01, numberValue(geometry?.width, 1)) / outputWidth,
      heightRatio: Math.max(0.01, numberValue(geometry?.height, 1)) / outputHeight,
      rotation: normalizeCanvasRotation(geometry?.rotation ?? layer?.rotation),
    });
  }

  function calculateFinishFrameRect(layer, width, height) {
    const outputWidth = Math.max(1, numberValue(width, 1));
    const outputHeight = Math.max(1, numberValue(height, 1));
    const naturalWidth = Math.max(1, numberValue(layer?.naturalWidth, 1));
    const naturalHeight = Math.max(1, numberValue(layer?.naturalHeight, 1));
    const fitMode = sanitizeFinishFitMode(layer?.fitMode);
    let drawWidth = outputWidth;
    let drawHeight = outputHeight;
    if (fitMode !== "stretch") {
      let scale;
      if (fitMode === "center") scale = Math.min(1, outputWidth / naturalWidth, outputHeight / naturalHeight);
      else if (fitMode === "cover") scale = Math.max(outputWidth / naturalWidth, outputHeight / naturalHeight);
      else scale = Math.min(outputWidth / naturalWidth, outputHeight / naturalHeight);
      drawWidth = naturalWidth * scale;
      drawHeight = naturalHeight * scale;
    }
    return {
      ...layer,
      x: (outputWidth - drawWidth) / 2,
      y: (outputHeight - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
      rotation: normalizeCanvasRotation(layer?.rotation),
    };
  }

  function resolveFinishLayerGeometry(layer, width, height) {
    return layer?.isFrame
      ? calculateFinishFrameRect(layer, width, height)
      : finishGeometryToPixels(layer, width, height);
  }

  function finishLayerLocalToOutput(layer, localX, localY, width, height) {
    return canvasLayerLocalToOutput(resolveFinishLayerGeometry(layer, width, height), localX, localY);
  }

  function outputToFinishLayerLocal(layer, point, width, height) {
    return outputToCanvasLayerLocal(resolveFinishLayerGeometry(layer, width, height), point);
  }

  function getFinishLayerCorners(layer, width, height) {
    return getCanvasLayerCorners(resolveFinishLayerGeometry(layer, width, height));
  }

  function getFinishLayerAabb(layer, width, height) {
    return getCanvasLayerAabb(resolveFinishLayerGeometry(layer, width, height));
  }

  function resizeFinishLayerFromHandle(layer, handle, point, width, height, minimumSize = 2) {
    if (layer?.isFrame) return cloneFinishLayerState(layer);
    const geometry = resolveFinishLayerGeometry(layer, width, height);
    const resized = resizeCanvasLayerFromHandle(geometry, handle, point, minimumSize);
    return finishGeometryFromPixels(layer, resized, width, height);
  }

  function calculateFinishLayerRotation(layer, startPoint, currentPoint, width, height, snapTo15 = false) {
    const geometry = resolveFinishLayerGeometry(layer, width, height);
    return calculateCanvasRotation(geometry, startPoint, currentPoint, snapTo15);
  }

  function hitTestFinishLayers(layers, point, width, height, options = {}) {
    const visible = Array.from(layers || []).filter((layer) => (
      layer.visible !== false && numberValue(layer.opacity, 1) > 0.001
    ));
    const groups = [visible.filter((layer) => !layer.isFrame)];
    if (options.includeFrames !== false) groups.push(visible.filter((layer) => layer.isFrame));
    for (const group of groups) {
      for (let index = group.length - 1; index >= 0; index -= 1) {
        const layer = group[index];
        const geometry = resolveFinishLayerGeometry(layer, width, height);
        const local = outputToCanvasLayerLocal(geometry, point);
        if (Math.abs(local.x) <= geometry.width / 2 && Math.abs(local.y) <= geometry.height / 2) return layer;
      }
    }
    return null;
  }

  function calculateFinishLayerFit(layer, outputSize, mode = "contain") {
    const width = Math.max(1, numberValue(outputSize?.width, 1));
    const height = Math.max(1, numberValue(outputSize?.height, 1));
    const naturalWidth = Math.max(1, numberValue(layer?.naturalWidth, 1));
    const naturalHeight = Math.max(1, numberValue(layer?.naturalHeight, 1));
    const ratio = naturalWidth / naturalHeight;
    let drawWidth;
    let drawHeight;
    if (mode === "stretch" || mode === "canvas") {
      drawWidth = width;
      drawHeight = height;
    } else if (mode === "width") {
      drawWidth = width;
      drawHeight = width / ratio;
    } else if (mode === "height") {
      drawHeight = height;
      drawWidth = height * ratio;
    } else {
      const scale = mode === "cover"
        ? Math.max(width / naturalWidth, height / naturalHeight)
        : Math.min(width / naturalWidth, height / naturalHeight);
      drawWidth = naturalWidth * scale;
      drawHeight = naturalHeight * scale;
    }
    return {
      x: (width - drawWidth) / 2,
      y: (height - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    };
  }

  function finishBlendOperation(value) {
    return FINISH_COMPOSITE_OPERATIONS[sanitizeFinishBlendMode(value)];
  }

  function getFinishDrawLayers(layers) {
    return Array.from(layers || []).filter((layer) => (
      layer.visible !== false
      && numberValue(layer.opacity, 1) > 0
      && layer.image
    ));
  }

  function hasDrawableFinishLayers(layers, placement) {
    return getFinishDrawLayers(getFinishLayersByPlacement(layers, placement)).length > 0;
  }

  function buildFinishDrawPlan(layers, width, height) {
    return getFinishDrawLayers(layers).map((layer) => ({
      layer,
      geometry: resolveFinishLayerGeometry(layer, width, height),
      compositeOperation: finishBlendOperation(layer.blendMode),
      opacity: clamp(numberValue(layer.opacity, 1), 0, 1),
    }));
  }

  function drawFinishLayers(context, layers, width, height, options = {}) {
    const scaleX = numberValue(options.scaleX, 1);
    const scaleY = numberValue(options.scaleY, scaleX);
    buildFinishDrawPlan(layers, width, height).forEach(({ layer, geometry, compositeOperation, opacity }) => {
      const centerX = (geometry.x + geometry.width / 2) * scaleX;
      const centerY = (geometry.y + geometry.height / 2) * scaleY;
      const drawWidth = geometry.width * scaleX;
      const drawHeight = geometry.height * scaleY;
      context.save();
      context.globalAlpha = opacity;
      context.globalCompositeOperation = compositeOperation;
      context.translate(centerX, centerY);
      context.rotate(normalizeCanvasRotation(geometry.rotation) * Math.PI / 180);
      context.drawImage(layer.image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      context.restore();
    });
    return context;
  }

  function drawCanvasSourceOver(context, sourceCanvas, x, y, width, height) {
    context.save();
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    context.drawImage(sourceCanvas, x, y, width, height);
    context.restore();
  }

  function mutateSelectedFinishLayer(mutator) {
    const record = getSelected();
    const layer = getSelectedFinishLayer(record);
    if (!record || !layer || state.exporting) return false;
    mutator(layer, record);
    const index = record.finishLayers.findIndex((item) => item.id === layer.id);
    record.finishLayers[index] = sanitizeFinishLayerState(layer);
    renderFinishLayerList();
    syncFinishControls();
    schedulePreview();
    updateActionAvailability();
    return true;
  }

  function updateFinishLayerFromControl(key) {
    mutateSelectedFinishLayer((layer, record) => {
      if (key === "name") {
        const name = String(el.filterFinishName?.value || "").trim();
        if (name) layer.name = name.slice(0, 120);
        return;
      }
      if (key === "rotation") {
        layer.rotation = normalizeCanvasRotation(numberValue(el.filterFinishRotation, layer.rotation));
        return;
      }
      if (layer.isFrame) return;
      const size = getProcessedDimensions(record);
      const previous = finishGeometryToPixels(layer, size.width, size.height);
      if (key === "xRatio") layer.xRatio = clamp(numberValue(el.filterFinishX, layer.xRatio * 100) / 100, -5, 5);
      else if (key === "yRatio") layer.yRatio = clamp(numberValue(el.filterFinishY, layer.yRatio * 100) / 100, -5, 5);
      else if (key === "widthRatio") {
        const widthRatio = clamp(numberValue(el.filterFinishWidth, layer.widthRatio * 100) / 100, 0.0001, 10);
        layer.widthRatio = widthRatio;
        if (layer.keepAspect) {
          const aspect = previous.width / previous.height;
          layer.heightRatio = (widthRatio * size.width / aspect) / size.height;
        }
      } else if (key === "heightRatio") {
        const heightRatio = clamp(numberValue(el.filterFinishHeight, layer.heightRatio * 100) / 100, 0.0001, 10);
        layer.heightRatio = heightRatio;
        if (layer.keepAspect) {
          const aspect = previous.width / previous.height;
          layer.widthRatio = (heightRatio * size.height * aspect) / size.width;
        }
      }
    });
  }

  function syncFinishControls() {
    const record = getSelected();
    normalizeFinishSelection();
    const layer = getSelectedFinishLayer(record);
    const outputSize = record ? getProcessedDimensions(record) : null;
    const displayGeometry = layer && outputSize
      ? resolveFinishLayerGeometry(layer, outputSize.width, outputSize.height)
      : null;
    const setValue = (control, value) => {
      if (control) control.value = value == null ? "" : String(value);
    };
    setValue(el.filterFinishName, layer?.name || "");
    setValue(el.filterFinishX, layer ? roundFinishPercent(displayGeometry.x / outputSize.width) : 0);
    setValue(el.filterFinishY, layer ? roundFinishPercent(displayGeometry.y / outputSize.height) : 0);
    setValue(el.filterFinishWidth, layer ? roundFinishPercent(displayGeometry.width / outputSize.width) : 100);
    setValue(el.filterFinishHeight, layer ? roundFinishPercent(displayGeometry.height / outputSize.height) : 100);
    setValue(el.filterFinishRotation, layer ? Math.round(normalizeCanvasRotation(layer.rotation) * 10) / 10 : 0);
    setValue(el.filterFinishOpacity, layer ? Math.round(layer.opacity * 100) : 100);
    setValue(el.filterFinishBlendMode, layer?.blendMode || "normal");
    setValue(el.filterFinishPlacement, layer?.placement || "front");
    setValue(el.filterFinishFitMode, layer?.fitMode || "stretch");
    if (el.filterFinishKeepAspect) el.filterFinishKeepAspect.checked = layer?.keepAspect !== false;
    if (el.filterFinishOpacityValue) {
      el.filterFinishOpacityValue.textContent = layer ? `${Math.round(layer.opacity * 100)}%` : "—";
    }
    if (el.filterFinishVisibilityBtn) {
      el.filterFinishVisibilityBtn.textContent = layer?.visible === false ? "非表示" : "表示中";
      el.filterFinishVisibilityBtn.setAttribute("aria-pressed", String(Boolean(layer?.visible)));
    }
    if (el.filterFinishFrameBtn) {
      el.filterFinishFrameBtn.classList.toggle("is-active", Boolean(layer?.isFrame));
      el.filterFinishFrameBtn.setAttribute("aria-pressed", String(Boolean(layer?.isFrame)));
    }
    updateActionAvailability();
  }

  function roundFinishPercent(value) {
    return Math.round(numberValue(value, 0) * 1000) / 10;
  }

  function toggleFinishLayerFrame() {
    mutateSelectedFinishLayer((layer) => {
      if (!layer.isFrame) {
        layer.manualGeometry = {
          xRatio: layer.xRatio,
          yRatio: layer.yRatio,
          widthRatio: layer.widthRatio,
          heightRatio: layer.heightRatio,
          keepAspect: layer.keepAspect,
          rotation: layer.rotation,
        };
        layer.isFrame = true;
        layer.rotation = 0;
        layer.fitMode = sanitizeFinishFitMode(layer.fitMode);
      } else {
        layer.isFrame = false;
        if (layer.manualGeometry) Object.assign(layer, layer.manualGeometry);
      }
    });
  }

  function toggleFinishLayerVisibility() {
    mutateSelectedFinishLayer((layer) => {
      layer.visible = !layer.visible;
    });
  }

  function deleteSelectedFinishLayer() {
    const record = getSelected();
    const layer = getSelectedFinishLayer(record);
    if (!record || !layer || state.exporting) return false;
    const index = record.finishLayers.findIndex((item) => item.id === layer.id);
    record.finishLayers.splice(index, 1);
    state.filter.selectedFinishLayerId = record.finishLayers[Math.min(index, record.finishLayers.length - 1)]?.id || null;
    sweepFinishSourceUrls();
    refreshAll();
    setStatus(`${layer.name}を仕上げから削除しました。`, "success");
    return true;
  }

  function setSelectedFinishLayerPlacement(value) {
    const record = getSelected();
    const layer = getSelectedFinishLayer(record);
    if (!record || !layer || state.exporting) return false;
    const placement = sanitizeFinishPlacement(value);
    if (placement === sanitizeFinishPlacement(layer.placement)) return false;
    record.finishLayers = moveFinishLayerAcrossBase(record.finishLayers, layer.id, placement);
    refreshAll();
    setStatus(`仕上げ素材を画像の${placement === "front" ? "前面" : "背面"}へ移動しました。`, "success");
    return true;
  }

  function moveFinishLayerOrder(direction) {
    const record = getSelected();
    const layer = getSelectedFinishLayer(record);
    if (!record || !layer || state.exporting) return false;
    const visual = getFinishVisualOrder(record.finishLayers);
    const index = visual.findIndex((item) => item !== FINISH_BASE_TOKEN && item.id === layer.id);
    let target = index;
    if (direction === "front") target = 0;
    else if (direction === "forward") target = Math.max(0, index - 1);
    else if (direction === "backward") target = Math.min(visual.length - 1, index + 1);
    else if (direction === "back") target = visual.length - 1;
    if (target === index) return false;
    const [moved] = visual.splice(index, 1);
    visual.splice(target, 0, moved);
    record.finishLayers = finishLayersFromVisualOrder(visual);
    refreshAll();
    setStatus("仕上げレイヤーの重なり順を変更しました。", "success");
    return true;
  }

  function placeFinishLayer(mode) {
    mutateSelectedFinishLayer((layer, record) => {
      if (layer.isFrame) {
        if (mode === "stretch") layer.fitMode = "stretch";
        return;
      }
      const size = getProcessedDimensions(record);
      let geometry = finishGeometryToPixels(layer, size.width, size.height);
      if (["stretch", "width", "height"].includes(mode)) {
        geometry = calculateFinishLayerFit(layer, size, mode);
        if (mode === "stretch") layer.keepAspect = false;
        else layer.keepAspect = true;
      } else if (mode === "center") {
        geometry.x = (size.width - geometry.width) / 2;
        geometry.y = (size.height - geometry.height) / 2;
      } else {
        if (mode.includes("left")) geometry.x = 0;
        if (mode.includes("right")) geometry.x = size.width - geometry.width;
        if (mode.includes("top")) geometry.y = 0;
        if (mode.includes("bottom")) geometry.y = size.height - geometry.height;
      }
      Object.assign(layer, finishGeometryFromPixels(layer, geometry, size.width, size.height));
    });
  }

  function cloneFinishLayersForTarget(layers) {
    return Array.from(layers || []).map((layer) => cloneFinishLayerState(layer, { newId: true }));
  }

  function applySelectedFinishToAll() {
    const sourceRecord = getSelected();
    if (!sourceRecord || state.images.length < 2 || state.exporting || hasFilterPendingLoads()) return false;
    const sourceLayers = snapshotFinishLayers(ensureFinishLayers(sourceRecord));
    state.images.forEach((record) => {
      if (record.id !== sourceRecord.id) record.finishLayers = cloneFinishLayersForTarget(sourceLayers);
    });
    sweepFinishSourceUrls();
    refreshAll();
    setStatus(`${sourceRecord.fileName}の仕上げを全画像へ適用しました。`, "success");
    return true;
  }

  function applySelectedFilterAndFinishToAll() {
    const sourceRecord = getSelected();
    if (!sourceRecord || state.images.length < 2 || state.exporting || hasFilterPendingLoads()) return false;
    const sourceFilter = cloneFilterState(ensureFilterState(sourceRecord));
    const sourceLayers = snapshotFinishLayers(ensureFinishLayers(sourceRecord));
    batchRecords().forEach((record) => {
      if (record.id === sourceRecord.id) return;
      record.filter = cloneFilterState(sourceFilter);
      record.finishLayers = cloneFinishLayersForTarget(sourceLayers);
    });
    sweepFinishSourceUrls();
    refreshAll();
    setStatus(`${sourceRecord.fileName}のフィルターと仕上げを全画像へ適用しました。`, "success");
    return true;
  }

  function finishPointFromClient(clientX, clientY, rect, width, height) {
    const bounds = rect || el.filterPreviewCanvas?.getBoundingClientRect?.();
    const selected = getSelected();
    const fallbackSize = selected ? getProcessedDimensions(selected) : { width: 1, height: 1 };
    const outputWidth = Math.max(1, numberValue(width, fallbackSize.width));
    const outputHeight = Math.max(1, numberValue(height, fallbackSize.height));
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return { x: outputWidth / 2, y: outputHeight / 2 };
    return {
      x: (numberValue(clientX, bounds.left) - bounds.left) * outputWidth / bounds.width,
      y: (numberValue(clientY, bounds.top) - bounds.top) * outputHeight / bounds.height,
    };
  }

  function beginFinishCanvasGesture(event) {
    if (state.mode !== "filter" || state.filter.comparingOriginal || state.exporting || event.button !== 0) return;
    const record = getSelected();
    if (!record) return;
    const size = getProcessedDimensions(record);
    const point = finishPointFromClient(event.clientX, event.clientY, null, size.width, size.height);
    const layer = hitTestFinishLayers(
      getFinishLayersByPlacement(ensureFinishLayers(record), "front"),
      point,
      size.width,
      size.height,
    );
    if (!layer) {
      state.filter.selectedFinishLayerId = null;
      renderFinishLayerList();
      syncFinishControls();
      schedulePreview();
      return;
    }
    selectFinishLayer(layer.id);
    if (layer.isFrame) return;
    event.preventDefault();
    state.filter.finishGesture = {
      type: "move",
      pointerId: event.pointerId,
      target: event.currentTarget,
      startPoint: point,
      startLayer: cloneFinishLayerState(layer),
      outputSize: size,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function beginFinishSelectionGesture(event) {
    if (state.mode !== "filter" || state.filter.comparingOriginal || state.exporting || event.button !== 0) return;
    const record = getSelected();
    const layer = getSelectedFinishLayer(record);
    if (!record || !layer || !layer.visible) return;
    const handleNode = event.target?.closest?.("[data-finish-handle]");
    const handle = handleNode?.dataset.finishHandle || "move";
    const type = handle === "rotate" ? "rotate" : handle === "move" ? "move" : "resize";
    if (layer.isFrame) return;
    event.preventDefault();
    event.stopPropagation();
    const size = getProcessedDimensions(record);
    state.filter.finishGesture = {
      type,
      handle,
      pointerId: event.pointerId,
      target: event.currentTarget,
      startPoint: finishPointFromClient(event.clientX, event.clientY, null, size.width, size.height),
      startLayer: cloneFinishLayerState(layer),
      outputSize: size,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveFinishGesture(event) {
    const gesture = state.filter.finishGesture;
    const record = getSelected();
    const layer = getSelectedFinishLayer(record);
    if (!gesture || !record || !layer || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    const size = gesture.outputSize;
    const point = finishPointFromClient(event.clientX, event.clientY, null, size.width, size.height);
    const startGeometry = resolveFinishLayerGeometry(gesture.startLayer, size.width, size.height);
    if (gesture.type === "rotate") {
      layer.rotation = calculateFinishLayerRotation(
        gesture.startLayer,
        gesture.startPoint,
        point,
        size.width,
        size.height,
        event.shiftKey,
      );
    } else if (!layer.isFrame && gesture.type === "move") {
      const geometry = {
        ...startGeometry,
        x: startGeometry.x + point.x - gesture.startPoint.x,
        y: startGeometry.y + point.y - gesture.startPoint.y,
      };
      Object.assign(layer, finishGeometryFromPixels(layer, geometry, size.width, size.height));
    } else if (!layer.isFrame && gesture.type === "resize") {
      Object.assign(layer, resizeFinishLayerFromHandle(
        gesture.startLayer,
        gesture.handle,
        point,
        size.width,
        size.height,
        2,
      ));
    }
    syncFinishControls();
    schedulePreview();
  }

  function releaseFinishPointerCapture(gesture) {
    try {
      if (!gesture?.target?.hasPointerCapture || gesture.target.hasPointerCapture(gesture.pointerId)) {
        gesture?.target?.releasePointerCapture?.(gesture.pointerId);
      }
    } catch {
      // Capture may already have been released by the browser.
    }
  }

  function endFinishGesture(event) {
    const gesture = state.filter.finishGesture;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    releaseFinishPointerCapture(gesture);
    state.filter.finishGesture = null;
    renderFinishLayerList();
    syncFinishControls();
    schedulePreview();
  }

  function cancelFinishGesture(event = null) {
    const gesture = state.filter.finishGesture;
    if (!gesture || (event?.pointerId != null && event.pointerId !== gesture.pointerId)) return;
    releaseFinishPointerCapture(gesture);
    const record = getSelected();
    const index = ensureFinishLayers(record).findIndex((layer) => layer.id === gesture.startLayer?.id);
    if (index >= 0) record.finishLayers[index] = cloneFinishLayerState(gesture.startLayer);
    state.filter.finishGesture = null;
    renderFinishLayerList();
    syncFinishControls();
    schedulePreview();
  }

  function syncFinishSelectionOverlay(record, outputSize) {
    const box = el.filterFinishSelectionBox;
    const canvas = el.filterPreviewCanvas;
    if (!box || !canvas) return;
    const layer = getSelectedFinishLayer(record);
    const show = Boolean(
      state.mode === "filter"
      && !state.filter.comparingOriginal
      && layer?.visible
      && numberValue(layer.opacity, 1) > 0
    );
    setElementHidden(box, !show);
    if (!show) return;
    const geometry = resolveFinishLayerGeometry(layer, outputSize.width, outputSize.height);
    const renderedWidth = Math.max(1, canvas.clientWidth || canvas.width);
    const renderedHeight = Math.max(1, canvas.clientHeight || canvas.height);
    const scaleX = renderedWidth / outputSize.width;
    const scaleY = renderedHeight / outputSize.height;
    box.style.left = `${canvas.offsetLeft + geometry.x * scaleX}px`;
    box.style.top = `${canvas.offsetTop + geometry.y * scaleY}px`;
    box.style.width = `${Math.max(1, geometry.width * scaleX)}px`;
    box.style.height = `${Math.max(1, geometry.height * scaleY)}px`;
    box.style.transformOrigin = "center";
    box.style.transform = `rotate(${normalizeCanvasRotation(layer.rotation)}deg)`;
    box.classList.toggle("is-frame", Boolean(layer.isFrame));
    box.setAttribute("aria-label", `${layer.name}。左端 ${Math.round(geometry.x)}、上端 ${Math.round(geometry.y)}、幅 ${Math.round(geometry.width)}、高さ ${Math.round(geometry.height)}、回転 ${Math.round(layer.rotation)}度`);
    const label = box.querySelector?.(".filter-finish-selection-label");
    if (label) label.textContent = layer.name;
  }

  function calculateFilterPreviewSize(width, height, maxWidth = 1200, maxHeight = maxWidth) {
    const sourceWidth = Math.max(1, numberValue(width, 1));
    const sourceHeight = Math.max(1, numberValue(height, 1));
    const safeMaxWidth = Math.max(1, numberValue(maxWidth, 1200));
    const safeMaxHeight = Math.max(1, numberValue(maxHeight, safeMaxWidth));
    const scale = Math.min(
      1,
      safeMaxWidth / sourceWidth,
      safeMaxHeight / sourceHeight,
      Math.sqrt(1_000_000 / (sourceWidth * sourceHeight)),
    );
    return {
      width: Math.max(1, Math.round(sourceWidth * scale)),
      height: Math.max(1, Math.round(sourceHeight * scale)),
      scale,
    };
  }

  function drawFilteredBaseInto(context, record, width, height, options = {}) {
    drawProcessedRecordInto(context, record, 0, 0, width, height);
    const filter = ensureFilterState(record);
    if (!isFilterStateNeutral(filter)) {
      const source = context.getImageData(0, 0, width, height);
      const filtered = applyFilterPipeline(source, filter, {
        spatialScale: numberValue(options.spatialScale, 1),
      });
      source.data.set(filtered.data);
      context.putImageData(source, 0, 0);
    }
    if (el.filterFinishPlacementHelp && state.mode === "filter" && hasDrawableFinishLayers(record.finishLayers, "behind")) {
      try {
        const pixels = context.getImageData(0, 0, width, height).data;
        let transparent = false;
        for (let index = 3; index < pixels.length; index += 4) if (pixels[index] < 255) { transparent = true; break; }
        el.filterFinishPlacementHelp.textContent = transparent
          ? "背面素材は、加工画像の透明部分から見えます。"
          : "現在のプレビューには透明部分がないため、背面素材が隠れます。前面へ移すか、透明部分のある画像を使ってください。";
      } catch { el.filterFinishPlacementHelp.textContent = "背面素材は、加工画像の透明部分から見えます。"; }
    }
    return context;
  }

  function renderFilterPreview() {
    const record = getSelected();
    if (!record || state.mode !== "filter") return;
    const canvas = el.filterPreviewCanvas;
    const stage = canvas.parentElement;
    const availableWidth = Math.min(1200, Math.max(1, (stage?.clientWidth || 960) - 36));
    const availableHeight = Math.min(1200, Math.max(1, (stage?.clientHeight || 680) - 36));
    const outputSize = getProcessedDimensions(record);
    const size = calculateFilterPreviewSize(
      outputSize.width,
      outputSize.height,
      availableWidth,
      availableHeight,
    );
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    canvas.dataset.outputSize = `${outputSize.width}×${outputSize.height}`;
    const context = canvas.getContext("2d", { alpha: true, willReadFrequently: true });
    if (!context) return;
    context.clearRect(0, 0, size.width, size.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    const finishLayers = ensureFinishLayers(record);
    if (el.filterFinishPlacementHelp && !hasDrawableFinishLayers(finishLayers, "behind")) {
      el.filterFinishPlacementHelp.textContent = "背面にすると、加工画像の透明部分から素材が見えます。";
    }
    const scaleOptions = {
      scaleX: size.width / outputSize.width,
      scaleY: size.height / outputSize.height,
    };
    if (state.filter.comparingOriginal) {
      drawProcessedRecordInto(context, record, 0, 0, size.width, size.height);
    } else if (hasDrawableFinishLayers(finishLayers, "behind")) {
      const baseCanvas = document.createElement("canvas");
      try {
        baseCanvas.width = size.width;
        baseCanvas.height = size.height;
        const baseContext = requireCanvasContext(baseCanvas, { willReadFrequently: true });
        baseContext.clearRect(0, 0, size.width, size.height);
        drawFilteredBaseInto(baseContext, record, size.width, size.height, { spatialScale: size.scale });
        drawFinishLayers(
          context,
          getFinishLayersByPlacement(finishLayers, "behind"),
          outputSize.width,
          outputSize.height,
          scaleOptions,
        );
        drawCanvasSourceOver(context, baseCanvas, 0, 0, size.width, size.height);
        drawFinishLayers(
          context,
          getFinishLayersByPlacement(finishLayers, "front"),
          outputSize.width,
          outputSize.height,
          scaleOptions,
        );
      } finally {
        baseCanvas.width = 1;
        baseCanvas.height = 1;
      }
    } else {
      drawFilteredBaseInto(context, record, size.width, size.height, { spatialScale: size.scale });
      drawFinishLayers(
        context,
        getFinishLayersByPlacement(finishLayers, "front"),
        outputSize.width,
        outputSize.height,
        scaleOptions,
      );
    }
    syncFinishSelectionOverlay(record, outputSize);
    updatePreviewDimensions(outputSize.width, outputSize.height);
    renderMobilePreview();
  }

  function validateFilterImageData(imageData) {
    const width = Math.max(1, Math.round(numberValue(imageData?.width, 1)));
    const height = Math.max(1, Math.round(numberValue(imageData?.height, 1)));
    if (!imageData?.data || imageData.data.length < width * height * 4) {
      throw new TypeError("RGBA画像データが必要です。");
    }
    return { width, height };
  }

  function cloneFilterImageData(imageData) {
    const { width, height } = validateFilterImageData(imageData);
    const data = new Uint8ClampedArray(width * height * 4);
    if (typeof imageData.data.subarray === "function") {
      data.set(imageData.data.subarray(0, data.length));
    } else {
      for (let index = 0; index < data.length; index += 1) data[index] = imageData.data[index];
    }
    return {
      width,
      height,
      data,
    };
  }

  function clampFilterByte(value) {
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    if (numeric >= 255) return 255;
    return Math.round(numeric);
  }

  function mixFilterPixel(source, effect, strength) {
    const amount = clamp(numberValue(strength, 0), 0, 1);
    return [
      clampFilterByte(source[0] + (effect[0] - source[0]) * amount),
      clampFilterByte(source[1] + (effect[1] - source[1]) * amount),
      clampFilterByte(source[2] + (effect[2] - source[2]) * amount),
      clampFilterByte(source[3]),
    ];
  }

  function applyTonePixel(pixel, tone = {}) {
    let red = numberValue(pixel?.[0], 0);
    let green = numberValue(pixel?.[1], 0);
    let blue = numberValue(pixel?.[2], 0);
    const alpha = clampFilterByte(pixel?.[3]);
    const brightness = clamp(numberValue(tone.brightness, 0), -1, 1);
    const contrast = clamp(numberValue(tone.contrast, 0), -1, 1);
    const saturation = clamp(numberValue(tone.saturation, 0), -1, 1);
    const temperature = clamp(numberValue(tone.temperature, 0), -1, 1);
    const tint = clamp(numberValue(tone.tint, 0), -1, 1);
    const highlights = clamp(numberValue(tone.highlights, 0), -1, 1);
    const shadows = clamp(numberValue(tone.shadows, 0), -1, 1);
    const brightnessOffset = brightness * 80;
    red += brightnessOffset;
    green += brightnessOffset;
    blue += brightnessOffset;
    const contrastFactor = 1 + contrast;
    red = (red - 127.5) * contrastFactor + 127.5;
    green = (green - 127.5) * contrastFactor + 127.5;
    blue = (blue - 127.5) * contrastFactor + 127.5;
    const luma = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    const saturationFactor = 1 + saturation;
    red = luma + (red - luma) * saturationFactor;
    green = luma + (green - luma) * saturationFactor;
    blue = luma + (blue - luma) * saturationFactor;
    red += temperature * 45 + tint * 15.75;
    green += temperature * 3.6 - tint * 35;
    blue -= temperature * 45 - tint * 15.75;
    const normalizedLuma = clamp(luma / 255, 0, 1);
    const tonalOffset = 70 * (
      highlights * normalizedLuma * normalizedLuma
      + shadows * (1 - normalizedLuma) * (1 - normalizedLuma)
    );
    red += tonalOffset + clamp(numberValue(tone.red, 0), -1, 1) * 80;
    green += tonalOffset + clamp(numberValue(tone.green, 0), -1, 1) * 80;
    blue += tonalOffset + clamp(numberValue(tone.blue, 0), -1, 1) * 80;
    return [clampFilterByte(red), clampFilterByte(green), clampFilterByte(blue), alpha];
  }

  function applyTimePresetPixel(pixel, preset = "none") {
    return applyTonePixel(pixel, FILTER_TIME_PRESETS[preset] || FILTER_TIME_PRESETS.none);
  }

  function applyToneDataInPlace(data, tone) {
    const brightness = clamp(numberValue(tone?.brightness, 0), -1, 1);
    const contrastFactor = 1 + clamp(numberValue(tone?.contrast, 0), -1, 1);
    const saturationFactor = 1 + clamp(numberValue(tone?.saturation, 0), -1, 1);
    const temperature = clamp(numberValue(tone?.temperature, 0), -1, 1);
    const tint = clamp(numberValue(tone?.tint, 0), -1, 1);
    const highlights = clamp(numberValue(tone?.highlights, 0), -1, 1);
    const shadows = clamp(numberValue(tone?.shadows, 0), -1, 1);
    const redOffset = clamp(numberValue(tone?.red, 0), -1, 1) * 80;
    const greenOffset = clamp(numberValue(tone?.green, 0), -1, 1) * 80;
    const blueOffset = clamp(numberValue(tone?.blue, 0), -1, 1) * 80;
    const brightnessOffset = brightness * 80;
    for (let index = 0; index < data.length; index += 4) {
      let red = (data[index] + brightnessOffset - 127.5) * contrastFactor + 127.5;
      let green = (data[index + 1] + brightnessOffset - 127.5) * contrastFactor + 127.5;
      let blue = (data[index + 2] + brightnessOffset - 127.5) * contrastFactor + 127.5;
      const luma = red * 0.2126 + green * 0.7152 + blue * 0.0722;
      red = luma + (red - luma) * saturationFactor;
      green = luma + (green - luma) * saturationFactor;
      blue = luma + (blue - luma) * saturationFactor;
      red += temperature * 45 + tint * 15.75;
      green += temperature * 3.6 - tint * 35;
      blue -= temperature * 45 - tint * 15.75;
      const normalizedLuma = clamp(luma / 255, 0, 1);
      const tonalOffset = 70 * (
        highlights * normalizedLuma * normalizedLuma
        + shadows * (1 - normalizedLuma) * (1 - normalizedLuma)
      );
      data[index] = clampFilterByte(red + tonalOffset + redOffset);
      data[index + 1] = clampFilterByte(green + tonalOffset + greenOffset);
      data[index + 2] = clampFilterByte(blue + tonalOffset + blueOffset);
    }
  }

  function normalizeFilterAdjustments(adjustments) {
    const source = adjustments && typeof adjustments === "object" ? adjustments : {};
    return {
      brightness: clamp(numberValue(source.brightness, 0) / 100, -1, 1),
      contrast: clamp(numberValue(source.contrast, 0) / 100, -1, 1),
      saturation: clamp(numberValue(source.saturation, 0) / 100, -1, 1),
      temperature: clamp(numberValue(source.temperature, 0) / 100, -1, 1),
      tint: clamp(numberValue(source.tint, 0) / 100, -1, 1),
      highlights: clamp(numberValue(source.highlights, 0) / 100, -1, 1),
      shadows: clamp(numberValue(source.shadows, 0) / 100, -1, 1),
    };
  }

  function quantizeChannel(value, levels) {
    const count = Math.round(clamp(numberValue(levels, 6), 2, 256));
    return quantizeChannelFast(value, count);
  }

  function quantizeChannelFast(value, count) {
    const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
    const bounded = numeric <= 0 ? 0 : numeric >= 255 ? 255 : numeric;
    return Math.round(Math.round((bounded * (count - 1)) / 255) * (255 / (count - 1)));
  }

  function createEdgeMap(imageData) {
    const { width, height } = validateFilterImageData(imageData);
    const data = imageData.data;
    const edges = new Uint8Array(width * height);
    if (width < 3 || height < 3) return edges;
    const rawLumaAt = (x, y) => {
      const offset = (y * width + x) * 4;
      return data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
    };
    const alphaAwareLumaAt = (x, y, fallbackLuma) => {
      const offset = (y * width + x) * 4;
      const alpha = data[offset + 3] / 255;
      return rawLumaAt(x, y) * alpha + fallbackLuma * (1 - alpha);
    };
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const centerLuma = rawLumaAt(x, y);
        const gradientX = alphaAwareLumaAt(x + 1, y, centerLuma)
          - alphaAwareLumaAt(x - 1, y, centerLuma);
        const gradientY = alphaAwareLumaAt(x, y + 1, centerLuma)
          - alphaAwareLumaAt(x, y - 1, centerLuma);
        edges[y * width + x] = clampFilterByte(Math.hypot(gradientX, gradientY) * 0.8);
      }
    }
    return edges;
  }

  function applyPosterizeInPlace(imageData, options = {}) {
    const { width, height } = validateFilterImageData(imageData);
    const data = imageData.data;
    const levels = Math.round(clamp(numberValue(options.levels, 6), 2, 16));
    const edgeAmount = clamp(numberValue(options.edge, 0) / 100, 0, 1);
    const edges = edgeAmount > 0 ? createEdgeMap(imageData) : null;
    for (let pixel = 0, index = 0; pixel < width * height; pixel += 1, index += 4) {
      const darken = edges ? edges[pixel] * edgeAmount * 0.45 : 0;
      data[index] = clampFilterByte(quantizeChannelFast(data[index], levels) - darken);
      data[index + 1] = clampFilterByte(quantizeChannelFast(data[index + 1], levels) - darken);
      data[index + 2] = clampFilterByte(quantizeChannelFast(data[index + 2], levels) - darken);
    }
  }

  function applyPosterize(imageData, options = {}) {
    const output = cloneFilterImageData(imageData);
    applyPosterizeInPlace(output, options);
    return output;
  }

  function applyOilPaintInPlace(imageData, options = {}) {
    const { width, height } = validateFilterImageData(imageData);
    const data = imageData.data;
    const brush = clamp(numberValue(options.brush, 8), 0, 20);
    const radius = Math.round(clamp(numberValue(options.radius, brush / 4), 0, 8));
    const richness = clamp(numberValue(options.color ?? options.richness, 70), 0, 100);
    const levels = options.colors == null
      ? 4 + Math.round(richness * 0.28)
      : Math.round(clamp(numberValue(options.colors, 8), 2, 32));
    const edgeAmount = clamp(numberValue(options.edge, 0) / 100, 0, 1);
    const edges = edgeAmount > 0 ? createEdgeMap(imageData) : null;
    const horizontal = new Uint8ClampedArray(width * height * 3);
    const horizontalWeights = new Uint16Array(width * height);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let red = 0;
        let green = 0;
        let blue = 0;
        let weight = 0;
        const start = Math.max(0, x - radius);
        const end = Math.min(width - 1, x + radius);
        for (let sampleX = start; sampleX <= end; sampleX += 1) {
          const source = (y * width + sampleX) * 4;
          const alphaWeight = data[source + 3];
          if (!alphaWeight) continue;
          red += data[source] * alphaWeight;
          green += data[source + 1] * alphaWeight;
          blue += data[source + 2] * alphaWeight;
          weight += alphaWeight;
        }
        const pixel = y * width + x;
        const target = pixel * 3;
        if (weight) {
          horizontal[target] = red / weight;
          horizontal[target + 1] = green / weight;
          horizontal[target + 2] = blue / weight;
          horizontalWeights[pixel] = weight;
        }
      }
    }

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let red = 0;
        let green = 0;
        let blue = 0;
        let weight = 0;
        const start = Math.max(0, y - radius);
        const end = Math.min(height - 1, y + radius);
        for (let sampleY = start; sampleY <= end; sampleY += 1) {
          const pixel = sampleY * width + x;
          const sampleWeight = horizontalWeights[pixel];
          if (!sampleWeight) continue;
          const source = pixel * 3;
          red += horizontal[source] * sampleWeight;
          green += horizontal[source + 1] * sampleWeight;
          blue += horizontal[source + 2] * sampleWeight;
          weight += sampleWeight;
        }
        const pixel = y * width + x;
        const target = pixel * 4;
        if (!weight || data[target + 3] === 0) continue;
        const darken = edges ? edges[pixel] * edgeAmount * 0.38 : 0;
        data[target] = clampFilterByte(quantizeChannelFast(red / weight, levels) - darken);
        data[target + 1] = clampFilterByte(quantizeChannelFast(green / weight, levels) - darken);
        data[target + 2] = clampFilterByte(quantizeChannelFast(blue / weight, levels) - darken);
      }
    }
  }

  function applyOilPaint(imageData, options = {}) {
    const output = cloneFilterImageData(imageData);
    applyOilPaintInPlace(output, options);
    return output;
  }

  function applyMonochromeInPlace(data) {
    for (let index = 0; index < data.length; index += 4) {
      const luma = clampFilterByte(data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722);
      data[index] = luma;
      data[index + 1] = luma;
      data[index + 2] = luma;
    }
  }

  function applySepiaInPlace(data) {
    for (let index = 0; index < data.length; index += 4) {
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      data[index] = clampFilterByte(red * 0.393 + green * 0.769 + blue * 0.189);
      data[index + 1] = clampFilterByte(red * 0.349 + green * 0.686 + blue * 0.168);
      data[index + 2] = clampFilterByte(red * 0.272 + green * 0.534 + blue * 0.131);
    }
  }

  function isFilterStateNeutral(filterValue) {
    const filter = sanitizeFilterState(filterValue);
    return filter.strength <= 0 || (
      filter.timePreset === "none"
      && filter.effectPreset === "none"
      && Object.values(filter.adjustments).every((value) => value === 0)
    );
  }

  function applyFilterPipeline(imageData, filterValue, renderOptions = {}) {
    validateFilterImageData(imageData);
    const filter = sanitizeFilterState(filterValue);
    if (filter.strength <= 0) return cloneFilterImageData(imageData);
    const source = imageData;
    const output = cloneFilterImageData(imageData);
    const timeTone = FILTER_TIME_PRESETS[filter.timePreset] || FILTER_TIME_PRESETS.none;
    if (filter.timePreset !== "none") applyToneDataInPlace(output.data, timeTone);
    if (Object.values(filter.adjustments).some((value) => value !== 0)) {
      applyToneDataInPlace(output.data, normalizeFilterAdjustments(filter.adjustments));
    }
    if (filter.effectPreset === "oil") {
      const fullRadius = Math.round(filter.oil.brush / 4);
      const spatialScale = clamp(numberValue(renderOptions.spatialScale, 1), 0.01, 1);
      const radius = fullRadius > 0 ? Math.max(1, Math.round(fullRadius * spatialScale)) : 0;
      applyOilPaintInPlace(output, { ...filter.oil, radius });
    }
    else if (filter.effectPreset === "poster") applyPosterizeInPlace(output, filter.poster);
    else if (filter.effectPreset === "monochrome") applyMonochromeInPlace(output.data);
    else if (filter.effectPreset === "sepia") applySepiaInPlace(output.data);
    if (filter.strength >= 1) return output;
    const amount = filter.strength;
    for (let index = 0; index < output.data.length; index += 4) {
      output.data[index] = clampFilterByte(
        source.data[index] + (output.data[index] - source.data[index]) * amount,
      );
      output.data[index + 1] = clampFilterByte(
        source.data[index + 1] + (output.data[index + 1] - source.data[index + 1]) * amount,
      );
      output.data[index + 2] = clampFilterByte(
        source.data[index + 2] + (output.data[index + 2] - source.data[index + 2]) * amount,
      );
      output.data[index + 3] = source.data[index + 3];
    }
    return output;
  }

  function syncCanvasControls() {
    const canvas = state.canvas;
    const layer = getSelectedCanvasLayer();
    if (el.canvasWidth) el.canvasWidth.value = String(Math.round(canvas.width));
    if (el.canvasHeight) el.canvasHeight.value = String(Math.round(canvas.height));
    if (el.canvasBackgroundMode) el.canvasBackgroundMode.value = canvas.backgroundMode;
    if (el.canvasBackgroundColor) el.canvasBackgroundColor.value = canvas.backgroundColor;
    if (el.canvasSnap) el.canvasSnap.checked = canvas.snap;
    if (el.canvasGridVisible) el.canvasGridVisible.checked = canvas.gridVisible;
    if (el.canvasGridSize) el.canvasGridSize.value = String(Math.round(canvas.gridSize));
    if (el.canvasZoomValue) el.canvasZoomValue.textContent = `${Math.round(canvas.zoom * 100)}%`;

    const selectedControls = [
      el.canvasLayerName,
      el.canvasLayerX,
      el.canvasLayerY,
      el.canvasLayerWidth,
      el.canvasLayerHeight,
      el.canvasLayerKeepAspect,
      el.canvasLayerRotation,
      el.canvasLayerOpacity,
      el.canvasRotateMinusBtn,
      el.canvasRotatePlusBtn,
      el.canvasRotateLeftBtn,
      el.canvasRotateRightBtn,
      el.canvasBringFrontBtn,
      el.canvasBringForwardBtn,
      el.canvasSendBackwardBtn,
      el.canvasSendBackBtn,
      el.canvasVisibilityBtn,
      el.canvasLockBtn,
      el.canvasDuplicateBtn,
      el.canvasDeleteBtn,
      el.canvasFlipXBtn,
      el.canvasFlipYBtn,
      el.canvasAlignHorizontalBtn,
      el.canvasAlignVerticalBtn,
      el.canvasAlignCenterBtn,
      el.canvasFitWidthBtn,
      el.canvasFitHeightBtn,
      el.canvasFitCanvasBtn,
    ].filter(Boolean);
    selectedControls.forEach((control) => {
      control.disabled = !layer;
    });
    if (!layer) {
      [el.canvasLayerName, el.canvasLayerX, el.canvasLayerY, el.canvasLayerWidth, el.canvasLayerHeight, el.canvasLayerRotation]
        .filter(Boolean)
        .forEach((control) => {
          control.value = "";
        });
      if (el.canvasLayerOpacity) el.canvasLayerOpacity.value = "100";
      if (el.canvasOpacityValue) el.canvasOpacityValue.textContent = "—";
      return;
    }

    if (el.canvasLayerName) el.canvasLayerName.value = layer.name;
    if (el.canvasLayerX) el.canvasLayerX.value = String(Math.round(layer.x));
    if (el.canvasLayerY) el.canvasLayerY.value = String(Math.round(layer.y));
    if (el.canvasLayerWidth) el.canvasLayerWidth.value = String(Math.round(layer.width));
    if (el.canvasLayerHeight) el.canvasLayerHeight.value = String(Math.round(layer.height));
    if (el.canvasLayerKeepAspect) el.canvasLayerKeepAspect.checked = layer.keepAspect;
    if (el.canvasLayerRotation) el.canvasLayerRotation.value = String(Math.round(layer.rotation * 10) / 10);
    if (el.canvasLayerOpacity) el.canvasLayerOpacity.value = String(Math.round(layer.opacity * 100));
    if (el.canvasOpacityValue) el.canvasOpacityValue.textContent = `${Math.round(layer.opacity * 100)}%`;
    if (el.canvasVisibilityBtn) {
      const backgroundInactive = layer.isBackground && canvas.backgroundMode !== "image";
      el.canvasVisibilityBtn.textContent = backgroundInactive
        ? "背景画像モードで表示"
        : layer.visible ? "非表示にする" : "表示する";
      el.canvasVisibilityBtn.disabled = backgroundInactive;
      el.canvasVisibilityBtn.classList.toggle("is-active", !layer.visible);
      el.canvasVisibilityBtn.setAttribute("aria-pressed", String(layer.visible));
    }
    if (el.canvasLockBtn) {
      el.canvasLockBtn.textContent = layer.locked ? "ロック解除" : "レイヤー固定";
      el.canvasLockBtn.classList.toggle("is-active", layer.locked);
      el.canvasLockBtn.setAttribute("aria-pressed", String(layer.locked));
    }
    el.canvasFlipXBtn?.classList.toggle("is-active", layer.flipX);
    el.canvasFlipYBtn?.classList.toggle("is-active", layer.flipY);
    el.canvasFlipXBtn?.setAttribute("aria-pressed", String(layer.flipX));
    el.canvasFlipYBtn?.setAttribute("aria-pressed", String(layer.flipY));
    const layerIndex = canvas.layers.findIndex((item) => item.id === layer.id);
    const firstNormalIndex = canvas.layers.filter((item) => item.isBackground).length;
    if (el.canvasBringFrontBtn) el.canvasBringFrontBtn.disabled = layer.isBackground || layerIndex === canvas.layers.length - 1;
    if (el.canvasBringForwardBtn) el.canvasBringForwardBtn.disabled = layer.isBackground || layerIndex === canvas.layers.length - 1;
    if (el.canvasSendBackwardBtn) el.canvasSendBackwardBtn.disabled = layer.isBackground || layerIndex <= firstNormalIndex;
    if (el.canvasSendBackBtn) el.canvasSendBackBtn.disabled = layer.isBackground || layerIndex <= firstNormalIndex;

    const transformControls = [
      el.canvasLayerX,
      el.canvasLayerY,
      el.canvasLayerWidth,
      el.canvasLayerHeight,
      el.canvasLayerKeepAspect,
      el.canvasLayerRotation,
      el.canvasRotateMinusBtn,
      el.canvasRotatePlusBtn,
      el.canvasRotateLeftBtn,
      el.canvasRotateRightBtn,
      el.canvasFlipXBtn,
      el.canvasFlipYBtn,
      el.canvasAlignHorizontalBtn,
      el.canvasAlignVerticalBtn,
      el.canvasAlignCenterBtn,
      el.canvasFitWidthBtn,
      el.canvasFitHeightBtn,
      el.canvasFitCanvasBtn,
    ].filter(Boolean);
    transformControls.forEach((control) => {
      control.disabled = layer.locked;
    });
  }

  function getCanvasDrawLayers(layers = state.canvas.layers, backgroundMode = state.canvas.backgroundMode) {
    return layers.filter((layer) => (
      layer.visible !== false
      && numberValue(layer.opacity, 1) > 0
      && (!layer.isBackground || backgroundMode === "image")
    ));
  }

  function resolveCanvasBackground(canvasState, format = "png") {
    const normalizedFormat = String(format).replace("image/", "").toLowerCase();
    if (canvasState.backgroundMode === "white") return "#ffffff";
    if (canvasState.backgroundMode === "black") return "#000000";
    if (canvasState.backgroundMode === "custom") return canvasState.backgroundColor || "#ffffff";
    return normalizedFormat === "jpeg" || normalizedFormat === "jpg" ? "#ffffff" : null;
  }

  function getCanvasGridLines(width, height, size) {
    const safeWidth = Math.max(1, numberValue(width, 1));
    const safeHeight = Math.max(1, numberValue(height, 1));
    const step = Math.max(1, numberValue(size, 20));
    const x = [];
    const y = [];
    for (let value = step; value < safeWidth; value += step) x.push(value);
    for (let value = step; value < safeHeight; value += step) y.push(value);
    return { x, y };
  }

  function drawCanvasScene(context, canvasState, options = {}) {
    const width = Math.max(1, numberValue(canvasState.width, 1));
    const height = Math.max(1, numberValue(canvasState.height, 1));
    context.clearRect(0, 0, width, height);
    const background = resolveCanvasBackground(canvasState, options.format);
    if (background) {
      context.save();
      context.globalAlpha = 1;
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);
      context.restore();
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    getCanvasDrawLayers(canvasState.layers || [], canvasState.backgroundMode).forEach((layer) => {
      if (!layer.image) return;
      const layerWidth = Math.max(1, numberValue(layer.width, 1));
      const layerHeight = Math.max(1, numberValue(layer.height, 1));
      const centerX = numberValue(layer.x, 0) + layerWidth / 2;
      const centerY = numberValue(layer.y, 0) + layerHeight / 2;
      context.save();
      context.globalAlpha = clamp(numberValue(layer.opacity, 1), 0, 1);
      context.translate(centerX, centerY);
      context.rotate(normalizeCanvasRotation(numberValue(layer.rotation, 0)) * Math.PI / 180);
      context.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
      context.drawImage(layer.image, -layerWidth / 2, -layerHeight / 2, layerWidth, layerHeight);
      context.restore();
    });
  }

  function renderCanvasComposition() {
    requestAnimationFrame(renderMobilePreview);
    if (!el.canvasDisplayCanvas || !el.canvasWorkspace || state.mode !== "canvas") return;
    const canvasState = state.canvas;
    const scrollArea = el.canvasWorkspace.parentElement;
    const viewportRect = scrollArea?.getBoundingClientRect?.() || el.canvasViewport?.getBoundingClientRect?.() || {};
    const availableWidth = Math.max(120, numberValue(scrollArea?.clientWidth || viewportRect.width, 760) - 68);
    const availableHeight = Math.max(120, numberValue(scrollArea?.clientHeight || viewportRect.height, 560) - 68);
    const fitScale = Math.min(1, availableWidth / canvasState.width, availableHeight / canvasState.height);
    const displayScale = Math.max(0.0001, fitScale * canvasState.zoom);
    const cssWidth = Math.max(1, canvasState.width * displayScale);
    const cssHeight = Math.max(1, canvasState.height * displayScale);
    canvasState.displayScale = displayScale;

    el.canvasWorkspace.style.width = `${cssWidth}px`;
    el.canvasWorkspace.style.height = `${cssHeight}px`;
    el.canvasWorkspace.style.aspectRatio = "auto";
    el.canvasDisplayCanvas.style.width = `${cssWidth}px`;
    el.canvasDisplayCanvas.style.height = `${cssHeight}px`;

    const desiredDpr = Math.min(numberValue(window.devicePixelRatio, 1), 2);
    const backingScale = Math.max(0.0001, Math.min(
      desiredDpr,
      4096 / cssWidth,
      4096 / cssHeight,
      Math.sqrt(12_000_000 / (cssWidth * cssHeight)),
    ));
    const backingWidth = Math.max(1, Math.round(cssWidth * backingScale));
    const backingHeight = Math.max(1, Math.round(cssHeight * backingScale));
    if (el.canvasDisplayCanvas.width !== backingWidth) el.canvasDisplayCanvas.width = backingWidth;
    if (el.canvasDisplayCanvas.height !== backingHeight) el.canvasDisplayCanvas.height = backingHeight;
    const context = el.canvasDisplayCanvas.getContext?.("2d", { alpha: true });
    if (context) {
      context.setTransform(backingWidth / canvasState.width, 0, 0, backingHeight / canvasState.height, 0, 0);
      drawCanvasScene(context, canvasState, { format: "png" });
    }

    if (el.canvasGridOverlay) {
      const rawGridPixels = Math.max(0.0001, canvasState.gridSize * displayScale);
      const gridStride = Math.max(1, Math.ceil(2 / rawGridPixels));
      const gridPixels = rawGridPixels * gridStride;
      el.canvasGridOverlay.style.backgroundSize = `${gridPixels}px ${gridPixels}px`;
      el.canvasGridOverlay.dataset.step = String(canvasState.gridSize * gridStride);
      el.canvasGridOverlay.classList.toggle("is-visible", canvasState.gridVisible);
      el.canvasGridOverlay.dataset.visible = String(canvasState.gridVisible);
    }

    const layer = getSelectedCanvasLayer();
    const showSelection = Boolean(layer?.visible && (!layer.isBackground || canvasState.backgroundMode === "image"));
    setElementHidden(el.canvasSelectionBox, !showSelection);
    if (showSelection) {
      el.canvasSelectionBox.style.left = `${layer.x * displayScale}px`;
      el.canvasSelectionBox.style.top = `${layer.y * displayScale}px`;
      el.canvasSelectionBox.style.width = `${Math.max(1, layer.width * displayScale)}px`;
      el.canvasSelectionBox.style.height = `${Math.max(1, layer.height * displayScale)}px`;
      el.canvasSelectionBox.style.transformOrigin = "center";
      el.canvasSelectionBox.style.transform = `rotate(${normalizeCanvasRotation(layer.rotation)}deg)`;
      el.canvasSelectionBox.classList.toggle("is-locked", Boolean(layer.locked));
      el.canvasSelectionBox.setAttribute("aria-label", `${layer.name}。位置 X ${Math.round(layer.x)}、Y ${Math.round(layer.y)}、幅 ${Math.round(layer.width)}、高さ ${Math.round(layer.height)}、回転 ${Math.round(layer.rotation)}度`);
      const label = el.canvasSelectionBox.querySelector?.(".canvas-selection-label");
      if (label) label.textContent = layer.name;
    } else {
      el.canvasSelectionBox.classList.remove("is-locked");
    }

    const showGuideX = canvasState.guideX != null;
    const showGuideY = canvasState.guideY != null;
    setElementHidden(el.canvasGuideX, !showGuideX);
    setElementHidden(el.canvasGuideY, !showGuideY);
    if (showGuideX) el.canvasGuideX.style.left = `${canvasState.guideX * displayScale}px`;
    if (showGuideY) el.canvasGuideY.style.top = `${canvasState.guideY * displayScale}px`;
    updatePreviewDimensions(canvasState.width, canvasState.height);
  }

  function snapshotCanvasState() {
    return {
      width: state.canvas.width,
      height: state.canvas.height,
      backgroundMode: state.canvas.backgroundMode,
      backgroundColor: state.canvas.backgroundColor,
      snap: state.canvas.snap,
      gridVisible: state.canvas.gridVisible,
      gridSize: state.canvas.gridSize,
      layers: state.canvas.layers.map((layer) => ({ ...layer })),
      selectedId: state.canvas.selectedId,
    };
  }

  function canvasStateSignature(snapshot) {
    return JSON.stringify({
      width: snapshot.width,
      height: snapshot.height,
      backgroundMode: snapshot.backgroundMode,
      backgroundColor: snapshot.backgroundColor,
      snap: snapshot.snap,
      gridVisible: snapshot.gridVisible,
      gridSize: snapshot.gridSize,
      selectedId: snapshot.selectedId,
      layers: snapshot.layers.map((layer) => ({
        id: layer.id,
        name: layer.name,
        x: layer.x,
        y: layer.y,
        width: layer.width,
        height: layer.height,
        rotation: layer.rotation,
        opacity: layer.opacity,
        visible: layer.visible,
        locked: layer.locked,
        flipX: layer.flipX,
        flipY: layer.flipY,
        keepAspect: layer.keepAspect,
        isBackground: layer.isBackground,
        zIndex: layer.zIndex,
      })),
    });
  }

  function restoreCanvasState(snapshot) {
    state.canvas.width = snapshot.width;
    state.canvas.height = snapshot.height;
    state.canvas.backgroundMode = snapshot.backgroundMode;
    state.canvas.backgroundColor = snapshot.backgroundColor;
    state.canvas.snap = snapshot.snap !== false;
    state.canvas.gridVisible = snapshot.gridVisible === true;
    state.canvas.gridSize = Math.round(clamp(numberValue(snapshot.gridSize, 20), 2, 500));
    state.canvas.layers = snapshot.layers.map((layer) => ({ ...layer }));
    state.canvas.selectedId = snapshot.selectedId;
    state.canvas.guideX = null;
    state.canvas.guideY = null;
    syncCanvasZIndexes();
  }

  function pushCanvasHistory(snapshot) {
    if (!snapshot || canvasStateSignature(snapshot) === canvasStateSignature(snapshotCanvasState())) return false;
    state.canvas.history.push(snapshot);
    if (state.canvas.history.length > 60) state.canvas.history.shift();
    state.canvas.redo = [];
    sweepCanvasSourceUrls();
    updateActionAvailability();
    return true;
  }

  function commitCanvasMutation(mutator) {
    const before = snapshotCanvasState();
    const changed = mutator();
    syncCanvasZIndexes();
    if (changed === false || !pushCanvasHistory(before)) return false;
    refreshAll();
    return true;
  }

  function undoCanvas() {
    const previous = state.canvas.history.pop();
    if (!previous) return;
    state.canvas.redo.push(snapshotCanvasState());
    restoreCanvasState(previous);
    sweepCanvasSourceUrls();
    refreshAll();
    setStatus("キャンバスの操作を元に戻しました。", "success");
  }

  function redoCanvas() {
    const next = state.canvas.redo.pop();
    if (!next) return;
    state.canvas.history.push(snapshotCanvasState());
    if (state.canvas.history.length > 60) state.canvas.history.shift();
    restoreCanvasState(next);
    sweepCanvasSourceUrls();
    refreshAll();
    setStatus("キャンバスの操作をやり直しました。", "success");
  }

  function constrainCanvasSize(width, height) {
    let nextWidth = clamp(numberValue(width, 1200), 1, MAX_EXPORT_DIMENSION);
    let nextHeight = clamp(numberValue(height, 800), 1, MAX_EXPORT_DIMENSION);
    const scale = Math.min(1, Math.sqrt(MAX_EXPORT_PIXELS / (nextWidth * nextHeight)));
    nextWidth = Math.max(1, Math.floor(nextWidth * scale));
    nextHeight = Math.max(1, Math.floor(nextHeight * scale));
    return { width: nextWidth, height: nextHeight };
  }

  function setCanvasSize(width, height) {
    const size = constrainCanvasSize(width, height);
    const adjusted = size.width !== Math.round(width) || size.height !== Math.round(height);
    const changed = commitCanvasMutation(() => {
      if (size.width === state.canvas.width && size.height === state.canvas.height) return false;
      state.canvas.width = size.width;
      state.canvas.height = size.height;
      return true;
    });
    if (changed) {
      setStatus(adjusted
        ? `安全に処理できる最大範囲へ${size.width}×${size.height}pxに調整しました。`
        : `キャンバスを${size.width}×${size.height}pxに変更しました。`, adjusted ? "warning" : "success");
    } else syncCanvasControls();
  }

  function selectCanvasLayer(id) {
    if (!state.canvas.layers.some((layer) => layer.id === id)) return;
    state.canvas.selectedId = id;
    renderCanvasLayerList();
    syncCanvasControls();
    renderCanvasComposition();
    updateActionAvailability();
  }

  function mutateSelectedCanvasLayer(mutator, options = {}) {
    const layer = getSelectedCanvasLayer();
    if (!layer) return false;
    if (layer.locked && !options.allowLocked) {
      setStatus("このレイヤーは固定されています。ロックを解除してから操作してください。", "warning");
      return false;
    }
    return commitCanvasMutation(() => mutator(layer));
  }

  function constrainCanvasLayerDimensions(width, height) {
    let nextWidth = Math.max(Number.EPSILON, numberValue(width, 1));
    let nextHeight = Math.max(Number.EPSILON, numberValue(height, 1));
    const minimumScale = Math.max(1, 1 / nextWidth, 1 / nextHeight);
    if (nextWidth * minimumScale <= MAX_EXPORT_DIMENSION && nextHeight * minimumScale <= MAX_EXPORT_DIMENSION) {
      nextWidth *= minimumScale;
      nextHeight *= minimumScale;
    }
    const maximumScale = Math.min(1, MAX_EXPORT_DIMENSION / nextWidth, MAX_EXPORT_DIMENSION / nextHeight);
    return {
      width: Math.max(1, nextWidth * maximumScale),
      height: Math.max(1, nextHeight * maximumScale),
    };
  }

  function updateCanvasLayerFromControl(key) {
    const layer = getSelectedCanvasLayer();
    if (!layer) return;
    if (key !== "name" && layer.locked) {
      syncCanvasControls();
      setStatus("このレイヤーは固定されています。", "warning");
      return;
    }
    const beforeRatio = Number.isFinite(layer.width / layer.height) && layer.width / layer.height > 0
      ? layer.width / layer.height
      : 1;
    const changed = commitCanvasMutation(() => {
      if (key === "name") {
        const nextName = String(el.canvasLayerName.value || "").trim();
        layer.name = nextName || layer.name;
      } else if (key === "x") {
        layer.x = clamp(numberValue(el.canvasLayerX, layer.x), -MAX_EXPORT_DIMENSION, MAX_EXPORT_DIMENSION);
      } else if (key === "y") {
        layer.y = clamp(numberValue(el.canvasLayerY, layer.y), -MAX_EXPORT_DIMENSION, MAX_EXPORT_DIMENSION);
      } else if (key === "width") {
        const width = clamp(numberValue(el.canvasLayerWidth, layer.width), 1, MAX_EXPORT_DIMENSION);
        if (layer.keepAspect) Object.assign(layer, constrainCanvasLayerDimensions(width, width / beforeRatio));
        else layer.width = width;
      } else if (key === "height") {
        const height = clamp(numberValue(el.canvasLayerHeight, layer.height), 1, MAX_EXPORT_DIMENSION);
        if (layer.keepAspect) Object.assign(layer, constrainCanvasLayerDimensions(height * beforeRatio, height));
        else layer.height = height;
      } else if (key === "rotation") {
        layer.rotation = normalizeCanvasRotation(numberValue(el.canvasLayerRotation, layer.rotation));
      }
    });
    if (!changed) syncCanvasControls();
  }

  function rotateCanvasLayer(delta) {
    mutateSelectedCanvasLayer((layer) => {
      layer.rotation = normalizeCanvasRotation(layer.rotation + delta);
    });
  }

  function moveCanvasLayerOrder(direction) {
    const layer = getSelectedCanvasLayer();
    if (!layer) return;
    commitCanvasMutation(() => {
      const layers = state.canvas.layers;
      const index = layers.findIndex((item) => item.id === layer.id);
      if (layer.isBackground) return false;
      const firstNormalIndex = layers.filter((item) => item.isBackground).length;
      let target = index;
      if (direction === "front") target = layers.length - 1;
      else if (direction === "forward") target = Math.min(layers.length - 1, index + 1);
      else if (direction === "backward") target = Math.max(firstNormalIndex, index - 1);
      else if (direction === "back") target = firstNormalIndex;
      if (target === index) return false;
      const [moved] = layers.splice(index, 1);
      layers.splice(target, 0, moved);
      return true;
    });
  }

  function toggleCanvasLayerVisibility() {
    mutateSelectedCanvasLayer((layer) => {
      layer.visible = !layer.visible;
    }, { allowLocked: true });
  }

  function toggleCanvasLayerLock() {
    mutateSelectedCanvasLayer((layer) => {
      layer.locked = !layer.locked;
    }, { allowLocked: true });
  }

  function duplicateCanvasLayer(offset = 20) {
    const layer = getSelectedCanvasLayer();
    if (!layer) return;
    commitCanvasMutation(() => {
      const duplicate = {
        ...layer,
        id: createId(),
        name: `${layer.name} のコピー`,
        x: layer.x + offset,
        y: layer.y + offset,
        locked: false,
        isBackground: false,
      };
      const index = state.canvas.layers.findIndex((item) => item.id === layer.id);
      state.canvas.layers.splice(index + 1, 0, duplicate);
      state.canvas.selectedId = duplicate.id;
    });
  }

  function deleteSelectedCanvasLayer() {
    const layer = getSelectedCanvasLayer();
    if (!layer) return;
    const deletedName = layer.name;
    commitCanvasMutation(() => {
      const index = state.canvas.layers.findIndex((item) => item.id === layer.id);
      state.canvas.layers.splice(index, 1);
      if (
        layer.isBackground
        && state.canvas.backgroundMode === "image"
        && !state.canvas.layers.some((item) => item.isBackground)
      ) {
        state.canvas.backgroundMode = "transparent";
      }
      state.canvas.selectedId = state.canvas.layers[Math.min(index, state.canvas.layers.length - 1)]?.id || null;
    });
    if (state.canvas.selectedId) focusCanvasLayerRow(state.canvas.selectedId);
    else requestAnimationFrame(() => el.canvasAddBtn?.focus());
    setStatus(`${deletedName}をキャンバスから削除しました。`, "success");
  }

  function flipCanvasLayer(axis) {
    mutateSelectedCanvasLayer((layer) => {
      layer[axis] = !layer[axis];
    });
  }

  function alignCanvasLayer(alignment) {
    mutateSelectedCanvasLayer((layer) => {
      if (alignment === "horizontal" || alignment === "center") {
        layer.x = (state.canvas.width - layer.width) / 2;
      }
      if (alignment === "vertical" || alignment === "center") {
        layer.y = (state.canvas.height - layer.height) / 2;
      }
    });
  }

  function calculateCanvasLayerFit(layer, canvasState, mode = "contain") {
    const naturalWidth = Math.max(1, numberValue(layer.naturalWidth, layer.width || 1));
    const naturalHeight = Math.max(1, numberValue(layer.naturalHeight, layer.height || 1));
    const ratio = naturalWidth / naturalHeight;
    let width;
    let height;
    if (mode === "width") {
      width = canvasState.width;
      height = width / ratio;
    } else if (mode === "height") {
      height = canvasState.height;
      width = height * ratio;
    } else {
      const scale = mode === "cover"
        ? Math.max(canvasState.width / naturalWidth, canvasState.height / naturalHeight)
        : Math.min(canvasState.width / naturalWidth, canvasState.height / naturalHeight);
      width = naturalWidth * scale;
      height = naturalHeight * scale;
    }
    const constrained = constrainCanvasLayerDimensions(width, height);
    return {
      x: (canvasState.width - constrained.width) / 2,
      y: (canvasState.height - constrained.height) / 2,
      width: constrained.width,
      height: constrained.height,
    };
  }

  function fitSelectedCanvasLayer(mode) {
    mutateSelectedCanvasLayer((layer) => {
      Object.assign(layer, calculateCanvasLayerFit(layer, state.canvas, mode));
    });
  }

  function reorderCanvasLayers(layers, sourceId, targetId, after = false) {
    const sourceLayer = layers.find((layer) => layer.id === sourceId);
    if (!sourceLayer || sourceLayer.isBackground) return [...layers];
    const frontToBack = [...layers].reverse();
    const sourceIndex = frontToBack.findIndex((layer) => layer.id === sourceId);
    if (sourceIndex < 0) return [...layers];
    const [moved] = frontToBack.splice(sourceIndex, 1);
    let targetIndex = frontToBack.findIndex((layer) => layer.id === targetId);
    if (targetIndex < 0) frontToBack.push(moved);
    else {
      if (after) targetIndex += 1;
      frontToBack.splice(targetIndex, 0, moved);
    }
    const reordered = frontToBack.reverse();
    return [
      ...reordered.filter((layer) => layer.isBackground),
      ...reordered.filter((layer) => !layer.isBackground),
    ];
  }

  function setCanvasZoom(value) {
    state.canvas.zoom = clamp(Math.round(numberValue(value, 1) * 100) / 100, 0.25, 4);
    syncCanvasControls();
    renderCanvasComposition();
  }

  function canvasPointFromClient(clientX, clientY, rect, canvasWidth = state.canvas.width, canvasHeight = state.canvas.height) {
    const bounds = rect || el.canvasDisplayCanvas?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return canvasCenterPoint();
    return {
      x: (numberValue(clientX, bounds.left) - bounds.left) * (canvasWidth / bounds.width),
      y: (numberValue(clientY, bounds.top) - bounds.top) * (canvasHeight / bounds.height),
    };
  }

  function canvasLayerLocalToOutput(layer, localX, localY) {
    const angle = normalizeCanvasRotation(layer.rotation) * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const centerX = layer.x + layer.width / 2;
    const centerY = layer.y + layer.height / 2;
    return {
      x: centerX + localX * cos - localY * sin,
      y: centerY + localX * sin + localY * cos,
    };
  }

  function outputToCanvasLayerLocal(layer, point) {
    const angle = normalizeCanvasRotation(layer.rotation) * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const centerX = layer.x + layer.width / 2;
    const centerY = layer.y + layer.height / 2;
    const dx = point.x - centerX;
    const dy = point.y - centerY;
    return {
      x: cos * dx + sin * dy,
      y: -sin * dx + cos * dy,
    };
  }

  function getCanvasLayerCorners(layer) {
    return [
      canvasLayerLocalToOutput(layer, -layer.width / 2, -layer.height / 2),
      canvasLayerLocalToOutput(layer, layer.width / 2, -layer.height / 2),
      canvasLayerLocalToOutput(layer, layer.width / 2, layer.height / 2),
      canvasLayerLocalToOutput(layer, -layer.width / 2, layer.height / 2),
    ];
  }

  function getCanvasLayerAabb(layer) {
    const corners = getCanvasLayerCorners(layer);
    const xs = corners.map((point) => point.x);
    const ys = corners.map((point) => point.y);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    return {
      left,
      right,
      top,
      bottom,
      width: right - left,
      height: bottom - top,
      centerX: (left + right) / 2,
      centerY: (top + bottom) / 2,
    };
  }

  function hitTestCanvasLayers(layers, point, options = {}) {
    for (let index = layers.length - 1; index >= 0; index -= 1) {
      const layer = layers[index];
      if (layer.visible === false || numberValue(layer.opacity, 1) <= 0.001 || (layer.locked && !options.includeLocked)) continue;
      const local = outputToCanvasLayerLocal(layer, point);
      if (Math.abs(local.x) <= layer.width / 2 && Math.abs(local.y) <= layer.height / 2) return layer;
    }
    return null;
  }

  function resizeCanvasLayerFromHandle(layer, handle, point, minimumSize = 4) {
    const west = handle.includes("w");
    const north = handle.includes("n");
    const signX = west ? -1 : 1;
    const signY = north ? -1 : 1;
    const anchor = canvasLayerLocalToOutput(layer, -signX * layer.width / 2, -signY * layer.height / 2);
    const angle = normalizeCanvasRotation(layer.rotation) * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = point.x - anchor.x;
    const dy = point.y - anchor.y;
    const localX = cos * dx + sin * dy;
    const localY = -sin * dx + cos * dy;
    const rawWidth = signX * localX;
    const rawHeight = signY * localY;
    let width = Math.max(minimumSize, rawWidth);
    let height = Math.max(minimumSize, rawHeight);
    if (layer.keepAspect) {
      const ratio = layer.width / layer.height;
      if (rawWidth <= 0 || rawHeight <= 0) {
        width = Math.max(minimumSize, minimumSize * ratio);
        height = width / ratio;
        if (height < minimumSize) {
          height = minimumSize;
          width = height * ratio;
        }
      } else if (width / layer.width >= height / layer.height) height = width / ratio;
      else width = height * ratio;
      if (width < minimumSize || height < minimumSize) {
        const scale = Math.max(minimumSize / width, minimumSize / height);
        width *= scale;
        height *= scale;
      }
      const maximumScale = Math.min(MAX_EXPORT_DIMENSION / width, MAX_EXPORT_DIMENSION / height, 1);
      width *= maximumScale;
      height *= maximumScale;
    } else {
      width = Math.min(width, MAX_EXPORT_DIMENSION);
      height = Math.min(height, MAX_EXPORT_DIMENSION);
    }
    const centerOffsetX = signX * width / 2;
    const centerOffsetY = signY * height / 2;
    const centerX = anchor.x + centerOffsetX * cos - centerOffsetY * sin;
    const centerY = anchor.y + centerOffsetX * sin + centerOffsetY * cos;
    return {
      ...layer,
      x: centerX - width / 2,
      y: centerY - height / 2,
      width,
      height,
    };
  }

  function calculateCanvasRotation(layer, startPoint, currentPoint, snapTo15 = false) {
    const centerX = layer.x + layer.width / 2;
    const centerY = layer.y + layer.height / 2;
    const startAngle = Math.atan2(startPoint.y - centerY, startPoint.x - centerX);
    const currentAngle = Math.atan2(currentPoint.y - centerY, currentPoint.x - centerX);
    let delta = currentAngle - startAngle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    let rotation = layer.rotation + delta * 180 / Math.PI;
    if (snapTo15) rotation = Math.round(rotation / 15) * 15;
    return normalizeCanvasRotation(rotation);
  }

  function snapCanvasLayer(layer, canvasState, threshold) {
    if (!canvasState.snap) return { layer: { ...layer }, guideX: null, guideY: null };
    const aabb = getCanvasLayerAabb(layer);
    const xCandidates = [
      { delta: -aabb.left, guide: 0 },
      { delta: canvasState.width / 2 - aabb.centerX, guide: canvasState.width / 2 },
      { delta: canvasState.width - aabb.right, guide: canvasState.width },
    ].filter((candidate) => Math.abs(candidate.delta) <= threshold);
    const yCandidates = [
      { delta: -aabb.top, guide: 0 },
      { delta: canvasState.height / 2 - aabb.centerY, guide: canvasState.height / 2 },
      { delta: canvasState.height - aabb.bottom, guide: canvasState.height },
    ].filter((candidate) => Math.abs(candidate.delta) <= threshold);
    xCandidates.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));
    yCandidates.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));
    const snapX = xCandidates[0] || null;
    const snapY = yCandidates[0] || null;
    return {
      layer: {
        ...layer,
        x: layer.x + (snapX?.delta || 0),
        y: layer.y + (snapY?.delta || 0),
      },
      guideX: snapX?.guide ?? null,
      guideY: snapY?.guide ?? null,
    };
  }

  function beginCanvasPointerGesture(event) {
    if (state.mode !== "canvas" || event.button !== 0) return;
    el.canvasWorkspace?.focus?.({ preventScroll: true });
    const point = canvasPointFromClient(event.clientX, event.clientY);
    const layer = hitTestCanvasLayers(
      getCanvasDrawLayers(state.canvas.layers, state.canvas.backgroundMode),
      point,
      { includeLocked: true },
    );
    if (!layer) {
      state.canvas.selectedId = null;
      syncCanvasControls();
      renderCanvasLayerList();
      renderCanvasComposition();
      return;
    }
    selectCanvasLayer(layer.id);
    if (layer.locked) return;
    event.preventDefault();
    state.canvas.gesture = {
      type: "move",
      pointerId: event.pointerId,
      target: event.currentTarget,
      startPoint: point,
      startLayer: { ...layer },
      before: snapshotCanvasState(),
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function beginCanvasSelectionGesture(event) {
    if (state.mode !== "canvas" || event.button !== 0) return;
    el.canvasWorkspace?.focus?.({ preventScroll: true });
    const layer = getSelectedCanvasLayer();
    if (!layer || layer.locked || !layer.visible) return;
    event.preventDefault();
    event.stopPropagation();
    const handleNode = event.target.closest?.("[data-canvas-handle], [data-handle]");
    const handle = handleNode?.dataset.canvasHandle || handleNode?.dataset.handle || "move";
    const type = handle === "rotate" ? "rotate" : handle === "move" ? "move" : "resize";
    state.canvas.gesture = {
      type,
      handle,
      pointerId: event.pointerId,
      target: event.currentTarget,
      startPoint: canvasPointFromClient(event.clientX, event.clientY),
      startLayer: { ...layer },
      before: snapshotCanvasState(),
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveCanvasPointerGesture(event) {
    const gesture = state.canvas.gesture;
    const layer = getSelectedCanvasLayer();
    if (!gesture || !layer || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    const point = canvasPointFromClient(event.clientX, event.clientY);
    if (gesture.type === "move") {
      const candidate = {
        ...gesture.startLayer,
        x: gesture.startLayer.x + point.x - gesture.startPoint.x,
        y: gesture.startLayer.y + point.y - gesture.startPoint.y,
      };
      const snapped = snapCanvasLayer(candidate, state.canvas, 8 / Math.max(0.0001, state.canvas.displayScale));
      Object.assign(layer, snapped.layer);
      state.canvas.guideX = snapped.guideX;
      state.canvas.guideY = snapped.guideY;
    } else if (gesture.type === "resize") {
      Object.assign(layer, resizeCanvasLayerFromHandle(gesture.startLayer, gesture.handle, point));
    } else if (gesture.type === "rotate") {
      layer.rotation = calculateCanvasRotation(gesture.startLayer, gesture.startPoint, point, event.shiftKey);
    }
    syncCanvasControls();
    renderCanvasComposition();
  }

  function endCanvasPointerGesture(event) {
    const gesture = state.canvas.gesture;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    releaseCanvasPointerCapture(gesture);
    state.canvas.gesture = null;
    state.canvas.guideX = null;
    state.canvas.guideY = null;
    pushCanvasHistory(gesture.before);
    renderCanvasLayerList();
    syncCanvasControls();
    renderCanvasComposition();
    updateActionAvailability();
  }

  function cancelCanvasGesture() {
    const gesture = state.canvas.gesture;
    if (!gesture) return;
    releaseCanvasPointerCapture(gesture);
    const layer = state.canvas.layers.find((item) => item.id === gesture.startLayer?.id);
    if (layer && gesture.startLayer) Object.assign(layer, gesture.startLayer);
    state.canvas.gesture = null;
    state.canvas.guideX = null;
    state.canvas.guideY = null;
    if (state.mode === "canvas") {
      syncCanvasControls();
      renderCanvasComposition();
    }
  }

  function releaseCanvasPointerCapture(gesture) {
    try {
      const target = gesture?.target;
      if (!target?.releasePointerCapture) return;
      if (target.hasPointerCapture && !target.hasPointerCapture(gesture.pointerId)) return;
      target.releasePointerCapture(gesture.pointerId);
    } catch {
      // Capture may already have been released by the browser during cancellation.
    }
  }

  function handleCanvasKeyboard(event) {
    if (state.mode !== "canvas" || state.exporting || event.defaultPrevented) return;
    if (document.querySelector?.("dialog[open]")) return;
    const command = event.ctrlKey || event.metaKey;
    if (state.canvas.gesture) {
      if (event.key === "Escape" || (command && event.key.toLowerCase() === "z")) {
        event.preventDefault();
        cancelCanvasGesture();
      }
      return;
    }
    const target = event.target;
    if (target?.matches?.("input, textarea, select, button, [contenteditable='true']")) return;
    if (command && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redoCanvas();
      else undoCanvas();
      return;
    }
    if (command && event.key.toLowerCase() === "c") {
      const layer = getSelectedCanvasLayer();
      if (layer) {
        event.preventDefault();
        state.canvas.clipboard = { ...layer };
        sweepCanvasSourceUrls();
      }
      return;
    }
    if (command && event.key.toLowerCase() === "v") {
      if (!state.canvas.clipboard) return;
      event.preventDefault();
      const before = snapshotCanvasState();
      const source = state.canvas.clipboard;
      const duplicate = {
        ...source,
        id: createId(),
        name: `${source.name} のコピー`,
        x: source.x + 20,
        y: source.y + 20,
        locked: false,
        isBackground: false,
      };
      state.canvas.layers.push(duplicate);
      state.canvas.selectedId = duplicate.id;
      syncCanvasZIndexes();
      pushCanvasHistory(before);
      refreshAll();
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteSelectedCanvasLayer();
      return;
    }
    if (event.key === "Escape") {
      state.canvas.selectedId = null;
      refreshAll();
      return;
    }
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      const layer = getSelectedCanvasLayer();
      if (!layer || layer.locked) return;
      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      mutateSelectedCanvasLayer((selected) => {
        if (event.key === "ArrowLeft") selected.x -= step;
        if (event.key === "ArrowRight") selected.x += step;
        if (event.key === "ArrowUp") selected.y -= step;
        if (event.key === "ArrowDown") selected.y += step;
      });
    }
  }

  function updateCropFromNumbers(changedId, live = false) {
    const record = getSelected();
    if (!record) return;
    const values = [el.cropX, el.cropY, el.cropWidth, el.cropHeight];
    if (live && values.some((input) => input && input.value === "")) return;
    const bounds = getOrientedDimensions(record);
    const positionOnly = changedId === "cropX" || changedId === "cropY";
    let crop = {
      x: numberValue(el.cropX, record.crop.x),
      y: numberValue(el.cropY, record.crop.y),
      width: positionOnly ? record.crop.width : numberValue(el.cropWidth, record.crop.width),
      height: positionOnly ? record.crop.height : numberValue(el.cropHeight, record.crop.height),
    };
    const ratio = ratioNumber(record.cropRatio);
    if (ratio && !positionOnly) {
      let size;
      if (changedId === "cropHeight") {
        size = ratioSizeFromHeight(crop.height, ratio, bounds.width, bounds.height);
      } else if (changedId === "cropWidth") {
        size = ratioSizeFromWidth(crop.width, ratio, bounds.width, bounds.height);
      } else {
        size = fitRatioSize(crop.width, crop.height, ratio, bounds.width, bounds.height);
      }
      crop.width = size.width;
      crop.height = size.height;
    } else if (!ratio) {
      crop.width = clamp(crop.width, Math.min(MIN_CROP_SIZE, bounds.width), bounds.width);
      crop.height = clamp(crop.height, Math.min(MIN_CROP_SIZE, bounds.height), bounds.height);
    }
    crop.x = clamp(crop.x, 0, bounds.width - crop.width);
    crop.y = clamp(crop.y, 0, bounds.height - crop.height);
    record.crop = crop;
    if (!positionOnly) reconcileResize(record, changedId === "cropHeight" ? "height" : "width");
    if (!live) syncEditControls();
    renderEditPreview();
  }

  function updateResizeFromNumbers(changed, live = false) {
    const record = getSelected();
    if (!record) return;
    if (live && (el.resizeWidth.value === "" || el.resizeHeight.value === "")) return;
    let width = Math.round(clamp(numberValue(el.resizeWidth, getProcessedDimensions(record).width), 1, MAX_EXPORT_DIMENSION));
    let height = Math.round(clamp(numberValue(el.resizeHeight, getProcessedDimensions(record).height), 1, MAX_EXPORT_DIMENSION));
    if (record.resize.keepAspect) {
      const crop = normalizedCrop(record);
      const fitted = fitLockedResize(width, height, crop.width / crop.height, changed);
      width = fitted.width;
      height = fitted.height;
    }
    record.resize.width = width;
    record.resize.height = height;
    record.resizeAnchor = changed;
    if (!live) syncEditControls();
    updatePreviewDimensions(width, height);
  }

  function setSelectedResize(width, height, keepAspect = true) {
    const record = getSelected();
    if (!record) return;
    record.resize.width = width;
    record.resize.height = height;
    record.resize.keepAspect = keepAspect;
    record.resizeAnchor = "width";
    if (keepAspect && width != null && height != null) reconcileResize(record);
    syncEditControls();
    schedulePreview();
  }

  function fitLockedResize(width, height, aspect, changed = "width") {
    const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
    let fittedWidth;
    let fittedHeight;
    if (changed === "height") {
      fittedHeight = clamp(numberValue(height, 1), 1, MAX_EXPORT_DIMENSION);
      fittedWidth = fittedHeight * safeAspect;
    } else {
      fittedWidth = clamp(numberValue(width, 1), 1, MAX_EXPORT_DIMENSION);
      fittedHeight = fittedWidth / safeAspect;
    }

    const downScale = Math.min(1, MAX_EXPORT_DIMENSION / fittedWidth, MAX_EXPORT_DIMENSION / fittedHeight);
    fittedWidth *= downScale;
    fittedHeight *= downScale;
    const upScale = Math.max(1, 1 / fittedWidth, 1 / fittedHeight);
    if (fittedWidth * upScale <= MAX_EXPORT_DIMENSION && fittedHeight * upScale <= MAX_EXPORT_DIMENSION) {
      fittedWidth *= upScale;
      fittedHeight *= upScale;
    }
    const pixelScale = Math.min(1, Math.sqrt(MAX_EXPORT_PIXELS / (fittedWidth * fittedHeight)));
    fittedWidth *= pixelScale;
    fittedHeight *= pixelScale;
    return { width: fittedWidth, height: fittedHeight };
  }

  function reconcileResize(record, anchor = "width") {
    if (!record?.resize?.keepAspect || record.resize.width == null || record.resize.height == null) return;
    const crop = normalizedCrop(record);
    const fitted = fitLockedResize(record.resize.width, record.resize.height, crop.width / crop.height, anchor);
    record.resize.width = fitted.width;
    record.resize.height = fitted.height;
  }

  function rotateSelected(delta) {
    const record = getSelected();
    if (!record) return;
    const oldBounds = getOrientedDimensions(record);
    const crop = normalizedCrop(record);
    const clockwise = delta > 0;
    const next = clockwise
      ? {
          x: oldBounds.height - (crop.y + crop.height),
          y: crop.x,
          width: crop.height,
          height: crop.width,
        }
      : {
          x: crop.y,
          y: oldBounds.width - (crop.x + crop.width),
          width: crop.height,
          height: crop.width,
        };

    record.rotation = normalizeRotation(record.rotation + (clockwise ? 90 : -90));
    // Rotating the visible result swaps the axes used by existing flips.
    [record.flipX, record.flipY] = [record.flipY, record.flipX];
    record.cropRatio = rotatedRatioLabel(record.cropRatio);
    const nextRatio = ratioNumber(record.cropRatio);
    record.crop = nextRatio && cropMatchesRatio(next, nextRatio)
      ? fitCropToRatio(next, getOrientedDimensions(record), nextRatio)
      : clampCrop(next, getOrientedDimensions(record));
    if (record.resize.width != null && record.resize.height != null) {
      [record.resize.width, record.resize.height] = [record.resize.height, record.resize.width];
      record.resizeAnchor = record.resizeAnchor === "height" ? "width" : "height";
      reconcileResize(record, record.resizeAnchor);
    }
    syncEditControls();
    renderEditPreview();
  }

  function toggleSelectedFlip(key) {
    const record = getSelected();
    if (!record) return;
    const bounds = getOrientedDimensions(record);
    const crop = normalizedCrop(record);
    record.crop = key === "flipX"
      ? { ...crop, x: bounds.width - (crop.x + crop.width) }
      : { ...crop, y: bounds.height - (crop.y + crop.height) };
    record[key] = !record[key];
    syncEditControls();
    renderEditPreview();
  }

  function beginCropGesture(event) {
    const record = getSelected();
    if (!record || event.button !== 0) return;
    event.preventDefault();
    const handle = event.target.closest("[data-handle]")?.dataset.handle || "move";
    state.cropGesture = {
      before: snapshotFilterRecord(record),
      pointerId: event.pointerId,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      startCrop: { ...normalizedCrop(record) },
      scaleX: numberValue(el.cropOverlay.dataset.scaleX, 1),
      scaleY: numberValue(el.cropOverlay.dataset.scaleY, 1),
    };
    el.cropOverlay.setPointerCapture(event.pointerId);
    el.cropOverlay.classList.add("is-adjusting");
  }

  function moveCropGesture(event) {
    const gesture = state.cropGesture;
    const record = getSelected();
    if (!gesture || !record || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    const dx = (event.clientX - gesture.startX) * gesture.scaleX;
    const dy = (event.clientY - gesture.startY) * gesture.scaleY;
    const bounds = getOrientedDimensions(record);
    const ratio = ratioNumber(record.cropRatio);
    record.crop = gesture.handle === "move"
      ? moveCrop(gesture.startCrop, dx, dy, bounds)
      : resizeCrop(gesture.startCrop, gesture.handle, dx, dy, bounds, ratio);
    if (gesture.handle !== "move") reconcileResize(record);
    syncEditControls();
    renderEditPreview();
  }

  function endCropGesture(event) {
    if (!state.cropGesture || state.cropGesture.pointerId !== event.pointerId) return;
    if (el.cropOverlay.hasPointerCapture(event.pointerId)) el.cropOverlay.releasePointerCapture(event.pointerId);
    if (event.type === "pointercancel") {
      const record = getSelected();
      if (record && state.cropGesture.before) Object.assign(record, snapshotFilterRecord(state.cropGesture.before));
    }
    state.cropGesture = null;
    el.cropOverlay.classList.remove("is-adjusting");
    schedulePreview();
    updateActionAvailability();
  }

  function moveCrop(crop, dx, dy, bounds) {
    return {
      ...crop,
      x: clamp(crop.x + dx, 0, bounds.width - crop.width),
      y: clamp(crop.y + dy, 0, bounds.height - crop.height),
    };
  }

  function resizeCrop(start, handle, dx, dy, bounds, ratio) {
    if (!ratio) {
      let left = start.x;
      let right = start.x + start.width;
      let top = start.y;
      let bottom = start.y + start.height;
      if (handle.includes("w")) left = clamp(left + dx, 0, right - MIN_CROP_SIZE);
      if (handle.includes("e")) right = clamp(right + dx, left + MIN_CROP_SIZE, bounds.width);
      if (handle.includes("n")) top = clamp(top + dy, 0, bottom - MIN_CROP_SIZE);
      if (handle.includes("s")) bottom = clamp(bottom + dy, top + MIN_CROP_SIZE, bounds.height);
      return { x: left, y: top, width: right - left, height: bottom - top };
    }

    const left = start.x;
    const right = start.x + start.width;
    const top = start.y;
    const bottom = start.y + start.height;
    const isCorner = handle.length === 2;
    let size;
    let x;
    let y;

    if (isCorner) {
      const west = handle.includes("w");
      const north = handle.includes("n");
      const anchorX = west ? right : left;
      const anchorY = north ? bottom : top;
      const pointerX = (west ? left : right) + dx;
      const pointerY = (north ? top : bottom) + dy;
      const requestedWidth = Math.max(0, west ? anchorX - pointerX : pointerX - anchorX);
      const requestedHeight = Math.max(0, north ? anchorY - pointerY : pointerY - anchorY);
      const dominantWidth = Math.max(requestedWidth, requestedHeight * ratio);
      const maxWidth = west ? anchorX : bounds.width - anchorX;
      const maxHeight = north ? anchorY : bounds.height - anchorY;
      size = ratioSizeFromWidth(dominantWidth, ratio, maxWidth, maxHeight);
      x = west ? anchorX - size.width : anchorX;
      y = north ? anchorY - size.height : anchorY;
    } else if (handle === "e" || handle === "w") {
      const west = handle === "w";
      const anchorX = west ? right : left;
      const pointerX = (west ? left : right) + dx;
      const requestedWidth = Math.max(0, west ? anchorX - pointerX : pointerX - anchorX);
      const centerY = top + start.height / 2;
      const maxWidth = west ? anchorX : bounds.width - anchorX;
      const maxHeight = 2 * Math.min(centerY, bounds.height - centerY);
      size = ratioSizeFromWidth(requestedWidth, ratio, maxWidth, maxHeight);
      x = west ? anchorX - size.width : anchorX;
      y = centerY - size.height / 2;
    } else {
      const north = handle === "n";
      const anchorY = north ? bottom : top;
      const pointerY = (north ? top : bottom) + dy;
      const requestedHeight = Math.max(0, north ? anchorY - pointerY : pointerY - anchorY);
      const centerX = left + start.width / 2;
      const maxHeight = north ? anchorY : bounds.height - anchorY;
      const maxWidth = 2 * Math.min(centerX, bounds.width - centerX);
      size = ratioSizeFromHeight(requestedHeight, ratio, maxWidth, maxHeight);
      x = centerX - size.width / 2;
      y = north ? anchorY - size.height : anchorY;
    }
    return { x, y, width: size.width, height: size.height };
  }

  function moveCropWithKeyboard(event) {
    const record = getSelected();
    if (!record || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    record.crop = moveCrop(normalizedCrop(record), dx, dy, getOrientedDimensions(record));
    syncEditControls();
    renderEditPreview();
  }

  function applySelectedCropToAll() {
    const source = getSelected();
    if (!source || state.images.length < 2) return;
    const sourceBounds = getOrientedDimensions(source);
    const crop = normalizedCrop(source);
    const centerXRatio = (crop.x + crop.width / 2) / sourceBounds.width;
    const centerYRatio = (crop.y + crop.height / 2) / sourceBounds.height;
    const widthRatio = crop.width / sourceBounds.width;
    const heightRatio = crop.height / sourceBounds.height;
    const fixedRatio = ratioNumber(source.cropRatio);

    for (const record of batchRecords()) {
      if (record.id === source.id) continue;
      const bounds = getOrientedDimensions(record);
      let width = widthRatio * bounds.width;
      let height = heightRatio * bounds.height;
      if (fixedRatio) {
        height = width / fixedRatio;
        if (height > bounds.height) {
          height = Math.min(heightRatio * bounds.height, bounds.height);
          width = height * fixedRatio;
        }
      }
      let next = {
        x: centerXRatio * bounds.width - width / 2,
        y: centerYRatio * bounds.height - height / 2,
        width,
        height,
      };
      record.crop = fixedRatio ? fitCropToRatio(next, bounds, fixedRatio) : clampCrop(next, bounds);
      record.cropRatio = source.cropRatio;
      reconcileResize(record);
    }
    refreshAll();
    setStatus(`切り抜き設定を${state.images.length}枚へ適用しました。個別に微調整できます。`, "success");
  }

  function applySelectedResizeToAll() {
    const source = getSelected();
    if (!source || state.images.length < 2) return;
    const size = getProcessedDimensions(source);
    batchRecords().forEach((record) => {
      record.resize.width = size.width;
      record.resize.height = size.height;
      record.resize.keepAspect = false;
      record.resizeAnchor = "width";
    });
    refreshAll();
    setStatus(`全画像の出力サイズを${size.width}×${size.height}pxに設定しました。`, "success");
  }

  function applyCenteredRatioToAll(ratioLabel) {
    const ratio = ratioNumber(ratioLabel);
    if (!ratio || !state.images.length) return;
    state.images.forEach((record) => {
      const bounds = getOrientedDimensions(record);
      record.crop = largestCenteredCrop(bounds, ratio);
      record.cropRatio = ratioLabel;
      reconcileResize(record);
    });
    refreshAll();
    setStatus(`全画像を中央から${ratioLabel.replace(":", "：")}で切り抜く設定にしました。`, "success");
  }

  function largestCenteredCrop(bounds, ratio) {
    let width = bounds.width;
    let height = width / ratio;
    if (height > bounds.height) {
      height = bounds.height;
      width = height * ratio;
    }
    return {
      x: (bounds.width - width) / 2,
      y: (bounds.height - height) / 2,
      width,
      height,
    };
  }

  function applyResizePresetToAll(width, height) {
    if (!state.images.length) return;
    state.images.forEach((record) => {
      record.resize.width = width;
      record.resize.height = height;
      record.resize.keepAspect = false;
      record.resizeAnchor = "width";
    });
    refreshAll();
    setStatus(`全画像の出力サイズを${width}×${height}pxに設定しました。`, "success");
  }

  function apply1920WidthToAll() {
    if (!state.images.length) return;
    state.images.forEach((record) => {
      record.resize.width = 1920;
      record.resize.height = 1920;
      record.resize.keepAspect = true;
      record.resizeAnchor = "width";
      reconcileResize(record);
    });
    refreshAll();
    setStatus("全画像を縦横比を保った1920px幅に設定しました。", "success");
  }

  function resetRecord(record) {
    record.rotation = 0;
    record.flipX = false;
    record.flipY = false;
    record.crop = { x: 0, y: 0, width: record.originalWidth, height: record.originalHeight };
    record.cropRatio = "free";
    record.resize = { width: null, height: null, keepAspect: true };
    record.resizeAnchor = "width";
  }

  function resetCanvasLayer(layer, offset = 0) {
    if (layer.isBackground) {
      Object.assign(layer, calculateCanvasLayerFit(layer, state.canvas, "cover"), {
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: true,
        flipX: false,
        flipY: false,
        keepAspect: true,
      });
      return;
    }
    const naturalWidth = Math.max(1, numberValue(layer.naturalWidth, layer.width || 1));
    const naturalHeight = Math.max(1, numberValue(layer.naturalHeight, layer.height || 1));
    const scale = Math.min(
      1,
      (state.canvas.width * 0.55) / naturalWidth,
      (state.canvas.height * 0.55) / naturalHeight,
    );
    const width = naturalWidth * scale;
    const height = naturalHeight * scale;
    Object.assign(layer, {
      x: (state.canvas.width - width) / 2 + offset,
      y: (state.canvas.height - height) / 2 + offset,
      width,
      height,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      flipX: false,
      flipY: false,
      keepAspect: true,
    });
  }

  function resetCurrent() {
    if (state.mode === "canvas") {
      const layer = getSelectedCanvasLayer();
      if (!layer) return;
      commitCanvasMutation(() => resetCanvasLayer(layer));
      setStatus(`${layer.name}の配置をリセットしました。`, "success");
      return;
    }
    if (state.mode === "split") {
      if (el.splitColumns) el.splitColumns.value = String(DEFAULT_SPLIT_COLUMNS);
      if (el.splitRows) el.splitRows.value = String(DEFAULT_SPLIT_ROWS);
      normalizeSplitControls({ commit: true });
      updateSplitSummary();
      schedulePreview();
      updateActionAvailability();
      setStatus("分割設定を2列×1行へ戻しました。", "success");
      return;
    }
    const record = getSelected();
    if (!record) return;
    if (state.mode === "filter") {
      cancelFinishLoads();
      record.filter = createDefaultFilterState();
      record.finishLayers = [];
      state.filter.selectedFinishLayerId = null;
      state.filter.comparingOriginal = false;
      sweepFinishSourceUrls();
      refreshAll();
      setStatus(`${record.fileName}のフィルターと仕上げを元に戻しました。`, "success");
      return;
    }
    resetRecord(record);
    refreshAll();
    setStatus(`${record.fileName}の編集設定を元に戻しました。`, "success");
  }

  function resetAllEdits() {
    if (state.mode === "canvas") {
      if (!state.canvas.layers.length) return;
      commitCanvasMutation(() => {
        let normalIndex = 0;
        state.canvas.layers.forEach((layer) => {
          resetCanvasLayer(layer, layer.isBackground ? 0 : normalIndex * 16);
          if (!layer.isBackground) normalIndex += 1;
        });
      });
      setStatus("すべての素材配置をリセットしました。", "success");
      return;
    }
    if (state.mode === "filter") {
      cancelFinishLoads();
      state.images.forEach((record) => {
        record.filter = createDefaultFilterState();
        record.finishLayers = [];
      });
      state.filter.selectedFinishLayerId = null;
      state.filter.comparingOriginal = false;
      sweepFinishSourceUrls();
      refreshAll();
      setStatus("すべてのフィルターと仕上げをリセットしました。", "success");
      return;
    }
    state.images.forEach(resetRecord);
    refreshAll();
    setStatus("すべての編集設定をリセットしました。", "success");
  }

  async function exportCurrentMode() {
    if (el.exportBtn.disabled || state.exporting) return;
    state.exporting = true;
    updateActionAvailability();
    try {
      if (state.mode === "combine") await exportCombined();
      else if (state.mode === "edit") await exportAllEdited();
      else if (state.mode === "canvas") await exportCanvasComposition();
      else if (state.mode === "filter") await exportAllFiltered();
      else if (state.mode === "split") await exportSplitImage();
      else throw new Error("保存モードを確認できませんでした。モードを選び直してください。");
    } catch (error) {
      console.error(error);
      setStatus(error.message || "保存中にエラーが発生しました。", "error");
    } finally {
      state.exporting = false;
      updateActionAvailability();
    }
  }

  async function exportCombined() {
    const options = getCombineOptions();
    const records = state.images.map(snapshotRecord);
    const layout = calculateCombineLayout(records, options);
    assertExportSize(layout.width, layout.height);
    setStatus("結合画像を作成しています…", "busy");
    const canvas = document.createElement("canvas");
    canvas.width = layout.width;
    canvas.height = layout.height;
    const context = requireCanvasContext(canvas);
    drawCombined(context, layout, options);
    const blob = await canvasToBlob(canvas, FORMAT_MIME[options.format], options.quality);
    const extension = options.format === "jpeg" ? "jpg" : options.format;
    triggerDownload(blob, `combined_${timestamp()}.${extension}`);
    canvas.width = 1;
    canvas.height = 1;
    setStatus(`結合画像（${layout.width}×${layout.height}px）を保存しました。`, "success");
  }

  function splitOutputFileName(fileName, region, layout, format = "png") {
    const safeFormat = FORMAT_MIME[format] ? format : "png";
    const extension = safeFormat === "jpeg" ? "jpg" : safeFormat;
    const rowDigits = Math.max(2, String(Math.max(1, layout?.rows || 1)).length);
    const columnDigits = Math.max(2, String(Math.max(1, layout?.columns || 1)).length);
    const row = String(Math.max(0, numberValue(region?.row, 0)) + 1).padStart(rowDigits, "0");
    const column = String(Math.max(0, numberValue(region?.column, 0)) + 1).padStart(columnDigits, "0");
    return `${fileStem(fileName)}_r${row}_c${column}.${extension}`;
  }

  async function exportSplitImage() {
    const selected = getSelected();
    if (!selected) throw new Error("分割する画像を選択してください。");
    const record = snapshotRecord(selected);
    const options = { ...getSplitOptions() };
    const layout = getSplitLayout(record, options);
    if (layout.total <= 1) throw new Error("列数または行数を2以上にしてください。");
    assertExportSize(layout.width, layout.height);
    setStatus(`${layout.total}枚の分割画像を作成しています…`, "busy");

    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = layout.width;
    sourceCanvas.height = layout.height;
    const downloads = [];

    try {
      const sourceContext = requireCanvasContext(sourceCanvas);
      sourceContext.clearRect(0, 0, layout.width, layout.height);
      drawProcessedRecordInto(sourceContext, record, 0, 0, layout.width, layout.height);
      for (let index = 0; index < layout.regions.length; index += 1) {
        const region = layout.regions[index];
        assertExportSize(region.width, region.height);
        const pieceCanvas = document.createElement("canvas");
        try {
          pieceCanvas.width = region.width;
          pieceCanvas.height = region.height;
          const context = requireCanvasContext(pieceCanvas);
          if (options.format === "jpeg") {
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, region.width, region.height);
          }
          context.drawImage(
            sourceCanvas,
            region.x,
            region.y,
            region.width,
            region.height,
            0,
            0,
            region.width,
            region.height,
          );
          const blob = await canvasToBlob(
            pieceCanvas,
            FORMAT_MIME[options.format],
            options.quality,
          );
          downloads.push({
            blob,
            fileName: splitOutputFileName(record.fileName, region, layout, options.format),
          });
        } finally {
          pieceCanvas.width = 1;
          pieceCanvas.height = 1;
        }
        setStatus(`${index + 1}/${layout.total}枚を作成しました…`, "busy");
        if ((index + 1) % 8 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } finally {
      sourceCanvas.width = 1;
      sourceCanvas.height = 1;
    }

    showDownloadList(downloads, "分割画像の保存");
    setStatus(`${downloads.length}枚の保存リンクを用意しました。ZIPまたは個別のリンクから保存できます。`, "success");
  }

  async function exportAllEdited(targets = state.images) {
    const options = getCombineOptions();
    const records = targets.map(snapshotRecord);
    const extension = options.format === "jpeg" ? "jpg" : options.format;
    setStatus(`${records.length}枚の画像を書き出しています…`, "busy");
    let completed = 0;
    const downloads = [];
    for (const record of records) {
      const size = getProcessedDimensions(record);
      assertExportSize(size.width, size.height);
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const context = requireCanvasContext(canvas);
      if (options.format === "jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, size.width, size.height);
      }
      drawRecordInto(context, record, 0, 0, size.width, size.height);
      const blob = await canvasToBlob(canvas, FORMAT_MIME[options.format], options.quality);
      downloads.push({ blob, fileName: `${fileStem(record.fileName)}_edited.${extension}` });
      canvas.width = 1;
      canvas.height = 1;
      completed += 1;
      setStatus(`${completed}/${records.length}枚を書き出しました…`, "busy");
      await nextTick();
    }
    if (downloads.length === 1) {
      triggerDownload(downloads[0].blob, downloads[0].fileName);
      setStatus("編集画像を保存しました。", "success");
    } else {
      showDownloadList(downloads);
      setStatus(`${completed}枚の保存リンクを用意しました。ZIPまたは個別のリンクから保存できます。`, "success");
    }
  }

  function snapshotFilterRecord(record) {
    const snapshot = snapshotRecord(record);
    return {
      ...snapshot,
      filter: cloneFilterState(record.filter),
      finishLayers: snapshotFinishLayers(record.finishLayers),
    };
  }

  function snapshotFilteredRecord(record) {
    return snapshotFilterRecord(record);
  }

  function snapshotFilterExport(records = state.images, options = getCombineOptions()) {
    return {
      records: Array.from(records || []).map(snapshotFilterRecord),
      format: FORMAT_MIME[options.format] ? options.format : "png",
      quality: clamp(numberValue(options.quality, 0.9), 0.01, 1),
    };
  }

  function filterOutputFileName(fileName, suffix = "filtered", format = "png") {
    const safeFormat = FORMAT_MIME[format] ? format : "png";
    const extension = safeFormat === "jpeg" ? "jpg" : safeFormat;
    const safeSuffix = String(suffix || "filtered").replace(/[^a-z0-9_-]+/gi, "_");
    return `${fileStem(fileName)}_${safeSuffix}.${extension}`;
  }

  function filterVariantFileName(fileName, preset, format = "png") {
    const suffix = preset === "day" || preset === "noon" ? "day" : preset;
    return filterOutputFileName(fileName, suffix, format);
  }

  function makeTimeVariantJobs(record, format = "png") {
    const snapshot = snapshotFilterRecord(record);
    return ["morning", "day", "evening", "night"].map((timePreset) => {
      const item = snapshotFilterRecord(snapshot);
      item.filter.timePreset = timePreset;
      return {
        timePreset,
        record: item,
        fileName: filterVariantFileName(snapshot.fileName, timePreset, format),
      };
    });
  }

  function flattenFilterImageDataToWhite(imageData) {
    const { width, height } = validateFilterImageData(imageData);
    const data = imageData.data;
    for (let pixel = 0, index = 0; pixel < width * height; pixel += 1, index += 4) {
      const alpha = data[index + 3] / 255;
      data[index] = clampFilterByte(data[index] * alpha + 255 * (1 - alpha));
      data[index + 1] = clampFilterByte(data[index + 1] * alpha + 255 * (1 - alpha));
      data[index + 2] = clampFilterByte(data[index + 2] * alpha + 255 * (1 - alpha));
      data[index + 3] = 255;
    }
    return imageData;
  }

  function flattenCanvasToWhite(context, width, height) {
    context.save();
    context.globalAlpha = 1;
    context.globalCompositeOperation = "destination-over";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.restore();
  }

  function renderFilteredRecordToCanvas(record, format = "png", targetCanvas = null) {
    const size = getProcessedDimensions(record);
    const width = size.width;
    const height = size.height;
    assertFilterExportSize(width, height, record.filter);
    const canvas = targetCanvas || document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = requireCanvasContext(canvas, { willReadFrequently: true });
    context.clearRect(0, 0, width, height);
    const finishLayers = Array.from(record.finishLayers || []);
    const behindLayers = getFinishLayersByPlacement(finishLayers, "behind");
    const frontLayers = getFinishLayersByPlacement(finishLayers, "front");
    const neutral = isFilterStateNeutral(record.filter);
    if (neutral) {
      drawFinishLayers(context, behindLayers, width, height);
      drawProcessedRecordInto(context, record, 0, 0, width, height);
    } else if (hasDrawableFinishLayers(finishLayers, "behind")) {
      const baseCanvas = document.createElement("canvas");
      try {
        baseCanvas.width = width;
        baseCanvas.height = height;
        const baseContext = requireCanvasContext(baseCanvas, { willReadFrequently: true });
        baseContext.clearRect(0, 0, width, height);
        drawFilteredBaseInto(baseContext, record, width, height);
        drawFinishLayers(context, behindLayers, width, height);
        drawCanvasSourceOver(context, baseCanvas, 0, 0, width, height);
      } finally {
        baseCanvas.width = 1;
        baseCanvas.height = 1;
      }
    } else {
      drawFilteredBaseInto(context, record, width, height);
    }
    drawFinishLayers(context, frontLayers, width, height);
    if (format === "jpeg") flattenCanvasToWhite(context, width, height);
    return canvas;
  }

  function assertFilterExportSize(width, height, filterValue) {
    assertExportSize(width, height);
    const limit = isFilterStateNeutral(filterValue) ? 60_000_000 : 40_000_000;
    if (width * height > limit) {
      throw new Error(`画像加工には画像が大きすぎます（上限 ${limit.toLocaleString("ja-JP")}画素）。画像編集で縮小してからお試しください。`);
    }
  }

  function filterProcessingHalo(filterValue) {
    const filter = sanitizeFilterState(filterValue);
    if (isFilterStateNeutral(filter)) return 0;
    if (filter.effectPreset === "oil") {
      return Math.max(Math.round(filter.oil.brush / 4), filter.oil.edge > 0 ? 1 : 0);
    }
    if (filter.effectPreset === "poster" && filter.poster.edge > 0) return 1;
    return 0;
  }

  async function renderFilteredRecordToCanvasTiled(record, format, canvas) {
    const size = getProcessedDimensions(record);
    const width = size.width;
    const height = size.height;
    assertFilterExportSize(width, height, record.filter);
    canvas.width = width;
    canvas.height = height;
    const outputContext = requireCanvasContext(canvas);
    outputContext.clearRect(0, 0, width, height);
    const finishLayers = Array.from(record.finishLayers || []);
    const behindLayers = getFinishLayersByPlacement(finishLayers, "behind");
    const frontLayers = getFinishLayersByPlacement(finishLayers, "front");
    if (isFilterStateNeutral(record.filter)) {
      drawFinishLayers(outputContext, behindLayers, width, height);
      drawProcessedRecordInto(outputContext, record, 0, 0, width, height);
      drawFinishLayers(outputContext, frontLayers, width, height);
      if (format === "jpeg") flattenCanvasToWhite(outputContext, width, height);
      return canvas;
    }

    const sourceCanvas = document.createElement("canvas");
    const compositeOverBehind = hasDrawableFinishLayers(finishLayers, "behind");
    const coreCanvas = compositeOverBehind ? document.createElement("canvas") : null;
    try {
      sourceCanvas.width = width;
      sourceCanvas.height = height;
      const sourceContext = requireCanvasContext(sourceCanvas, { willReadFrequently: true });
      sourceContext.clearRect(0, 0, width, height);
      drawProcessedRecordInto(sourceContext, record, 0, 0, width, height);
      const coreContext = coreCanvas ? requireCanvasContext(coreCanvas) : null;
      if (compositeOverBehind) drawFinishLayers(outputContext, behindLayers, width, height);
      const tileSize = 512;
      const halo = filterProcessingHalo(record.filter);
      for (let y = 0; y < height; y += tileSize) {
        const coreHeight = Math.min(tileSize, height - y);
        for (let x = 0; x < width; x += tileSize) {
          const coreWidth = Math.min(tileSize, width - x);
          const readX = Math.max(0, x - halo);
          const readY = Math.max(0, y - halo);
          const readRight = Math.min(width, x + coreWidth + halo);
          const readBottom = Math.min(height, y + coreHeight + halo);
          const tile = sourceContext.getImageData(readX, readY, readRight - readX, readBottom - readY);
          const filtered = applyFilterPipeline(tile, record.filter);
          tile.data.set(filtered.data);
          if (coreCanvas && coreContext) {
            coreCanvas.width = coreWidth;
            coreCanvas.height = coreHeight;
            coreContext.putImageData(
              tile,
              readX - x,
              readY - y,
              x - readX,
              y - readY,
              coreWidth,
              coreHeight,
            );
            drawCanvasSourceOver(outputContext, coreCanvas, x, y, coreWidth, coreHeight);
          } else {
            outputContext.putImageData(
              tile,
              readX,
              readY,
              x - readX,
              y - readY,
              coreWidth,
              coreHeight,
            );
          }
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      drawFinishLayers(outputContext, frontLayers, width, height);
      if (format === "jpeg") flattenCanvasToWhite(outputContext, width, height);
      return canvas;
    } finally {
      sourceCanvas.width = 1;
      sourceCanvas.height = 1;
      if (coreCanvas) {
        coreCanvas.width = 1;
        coreCanvas.height = 1;
      }
    }
  }

  async function encodeFilteredRecord(record, format, quality) {
    const canvas = document.createElement("canvas");
    try {
      const { width, height } = getProcessedDimensions(record);
      if (width * height <= 512 * 512) renderFilteredRecordToCanvas(record, format, canvas);
      else await renderFilteredRecordToCanvasTiled(record, format, canvas);
      return await canvasToBlob(canvas, FORMAT_MIME[format] || FORMAT_MIME.png, quality);
    } finally {
      canvas.width = 1;
      canvas.height = 1;
    }
  }

  async function exportAllFiltered(targets = state.images) {
    const snapshot = snapshotFilterExport(targets, getCombineOptions());
    const releaseFinishSources = retainFinishSources(snapshot.records);
    setStatus(`${snapshot.records.length}枚をフィルター＋仕上げ処理しています…`, "busy");
    const downloads = [];
    try {
      for (let index = 0; index < snapshot.records.length; index += 1) {
        const record = snapshot.records[index];
        const blob = await encodeFilteredRecord(record, snapshot.format, snapshot.quality);
        downloads.push({
          blob,
          fileName: filterOutputFileName(record.fileName, "filtered", snapshot.format),
        });
        setStatus(`${index + 1}/${snapshot.records.length}枚を処理しました…`, "busy");
        await nextTick();
      }
      if (downloads.length === 1) {
        triggerDownload(downloads[0].blob, downloads[0].fileName);
        setStatus("フィルター＋仕上げ画像を保存しました。", "success");
      } else {
        showDownloadList(downloads, "フィルター＋仕上げ画像の保存");
        setStatus(`${downloads.length}枚の保存リンクを用意しました。ZIPまたは個別のリンクから保存できます。`, "success");
      }
    } finally {
      releaseFinishSources();
    }
  }

  async function exportFilterVariants() {
    const selected = getSelected();
    if (!selected) return [];
    const options = getCombineOptions();
    const jobs = makeTimeVariantJobs(snapshotFilterRecord(selected), options.format);
    const releaseFinishSources = retainFinishSources(jobs.map((job) => job.record));
    const downloads = [];
    setStatus(`${selected.fileName}の朝・昼・夕・夜を作成しています…`, "busy");
    try {
      for (let index = 0; index < jobs.length; index += 1) {
        const job = jobs[index];
        const blob = await encodeFilteredRecord(job.record, options.format, options.quality);
        downloads.push({ blob, fileName: job.fileName });
        setStatus(`${index + 1}/4種類を処理しました…`, "busy");
        await nextTick();
      }
      showDownloadList(downloads, "朝・昼・夕・夜の保存");
      setStatus("4種類の保存リンクを用意しました。ZIPまたは個別のリンクから保存できます。", "success");
      return downloads;
    } finally {
      releaseFinishSources();
    }
  }

  async function exportFilterVariantsWorkflow() {
    if (state.exporting || state.mode !== "filter" || !getSelected()) return;
    if (hasFilterPendingLoads()) return;
    state.exporting = true;
    updateActionAvailability();
    try {
      await exportFilterVariants();
    } catch (error) {
      console.error(error);
      setStatus(error.message || "4種類の保存中にエラーが発生しました。", "error");
    } finally {
      state.exporting = false;
      updateActionAvailability();
    }
  }

  async function exportCanvasComposition() {
    const options = getCombineOptions();
    const snapshot = snapshotCanvasState();
    const width = Math.round(snapshot.width);
    const height = Math.round(snapshot.height);
    assertExportSize(width, height);
    setStatus("キャンバスを一枚の画像に書き出しています…", "busy");
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = requireCanvasContext(canvas);
    drawCanvasScene(context, snapshot, { format: options.format });
    const mime = FORMAT_MIME[options.format] || FORMAT_MIME.png;
    const blob = await canvasToBlob(canvas, mime, options.quality);
    const extension = options.format === "jpeg" ? "jpg" : options.format;
    triggerDownload(blob, `canvas_${timestamp()}.${extension}`);
    canvas.width = 1;
    canvas.height = 1;
    setStatus(`キャンバス（${width}×${height}px）を保存しました。`, "success");
  }

  function snapshotRecord(record) {
    return {
      ...record,
      crop: { ...normalizedCrop(record) },
      resize: { ...record.resize },
    };
  }

  function requireCanvasContext(canvas, options = {}) {
    const context = canvas.getContext("2d", { alpha: true, ...options });
    if (!context) throw new Error("Canvas 2Dを初期化できませんでした。ブラウザを再読み込みしてください。");
    return context;
  }

  function assertExportSize(width, height) {
    if (
      !Number.isFinite(width)
      || !Number.isFinite(height)
      || width <= 0
      || height <= 0
      || width > MAX_EXPORT_DIMENSION
      || height > MAX_EXPORT_DIMENSION
      || width * height > MAX_EXPORT_PIXELS
    ) {
      throw new Error(`出力サイズ（${width}×${height}px）が大きすぎます。リサイズしてから保存してください。`);
    }
  }

  function canvasToBlob(canvas, mime, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("このブラウザでは選択した形式へ変換できません。"));
          return;
        }
        if (blob.type && blob.type !== mime) {
          reject(new Error("このブラウザは選択した保存形式に対応していません。"));
          return;
        }
        resolve(blob);
      }, mime, quality);
    });
  }

  function triggerDownload(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function showDownloadList(downloads, dialogTitle = "編集画像の保存") {
    state.downloadCleanup?.();
    const dialog = document.createElement("dialog");
    dialog.className = "download-dialog";
    dialog.setAttribute("aria-labelledby", "downloadDialogTitle");

    const panel = document.createElement("div");
    panel.className = "download-dialog__panel";
    const title = document.createElement("h2");
    title.id = "downloadDialogTitle";
    title.textContent = dialogTitle;
    const description = document.createElement("p");
    description.textContent = `${downloads.length}枚をZIPにまとめるか、個別のリンクから保存できます。`;
    const zipButton = document.createElement("button");
    zipButton.type = "button";
    zipButton.className = "button button-primary";
    zipButton.textContent = "ZIPでまとめて保存";
    zipButton.addEventListener("click", async () => {
      zipButton.disabled = true;
      description.textContent = "ZIPを作成しています…";
      try {
        const blob = await createImageZip(downloads);
        if (cleaned) return;
        triggerDownload(blob, `images_${timestamp()}.zip`);
        description.textContent = "ZIPのダウンロードを開始しました。個別保存も利用できます。";
      } catch (error) {
        if (!cleaned) description.textContent = error.message || "ZIPを作成できませんでした。個別保存をご利用ください。";
      } finally { if (!cleaned) zipButton.disabled = false; }
    });
    const list = document.createElement("ul");
    list.className = "download-dialog__list";
    const urls = [];

    downloads.forEach(({ blob, fileName }) => {
      const url = URL.createObjectURL(blob);
      urls.push(url);
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.className = "download-dialog__link";
      link.href = url;
      link.download = fileName;
      link.textContent = fileName;
      link.addEventListener("click", () => link.classList.add("is-downloaded"));
      item.append(link);
      list.append(item);
    });

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "button button--primary download-dialog__close";
    closeButton.textContent = "閉じる";
    panel.append(title, description, zipButton, list, closeButton);
    dialog.append(panel);
    document.body.append(dialog);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
      dialog.remove();
      if (state.downloadCleanup === cleanup) state.downloadCleanup = null;
    };
    state.downloadCleanup = cleanup;
    dialog.addEventListener("close", cleanup, { once: true });
    closeButton.addEventListener("click", () => {
      if (typeof dialog.close === "function") dialog.close();
      else cleanup();
    });
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function fitCropToRatio(crop, bounds, ratio) {
    const cropWidth = numberValue(crop.width, bounds.width);
    const cropHeight = numberValue(crop.height, bounds.height);
    const centerX = clamp(numberValue(crop.x, 0) + cropWidth / 2, 0, bounds.width);
    const centerY = clamp(numberValue(crop.y, 0) + cropHeight / 2, 0, bounds.height);
    const size = fitRatioSize(cropWidth, cropHeight, ratio, bounds.width, bounds.height);
    return {
      x: clamp(centerX - size.width / 2, 0, bounds.width - size.width),
      y: clamp(centerY - size.height / 2, 0, bounds.height - size.height),
      width: size.width,
      height: size.height,
    };
  }

  function fitRatioSize(width, height, ratio, maxWidth, maxHeight) {
    const safeWidth = Math.max(0, numberValue(width, 0));
    const safeHeight = Math.max(0, numberValue(height, 0));
    if (!safeWidth && !safeHeight) return ratioSizeFromWidth(0, ratio, maxWidth, maxHeight);
    if (!safeWidth) return ratioSizeFromHeight(safeHeight, ratio, maxWidth, maxHeight);
    if (!safeHeight) return ratioSizeFromWidth(safeWidth, ratio, maxWidth, maxHeight);
    return safeWidth / safeHeight > ratio
      ? ratioSizeFromHeight(safeHeight, ratio, maxWidth, maxHeight)
      : ratioSizeFromWidth(safeWidth, ratio, maxWidth, maxHeight);
  }

  function ratioSizeFromWidth(width, ratio, maxWidth, maxHeight) {
    const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
    const requestedWidth = Math.max(0, numberValue(width, 0));
    const baseWidth = requestedWidth || safeRatio;
    return constrainRatioSize(baseWidth, baseWidth / safeRatio, maxWidth, maxHeight);
  }

  function ratioSizeFromHeight(height, ratio, maxWidth, maxHeight) {
    const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
    const requestedHeight = Math.max(0, numberValue(height, 0));
    const baseHeight = requestedHeight || 1;
    return constrainRatioSize(baseHeight * safeRatio, baseHeight, maxWidth, maxHeight);
  }

  function constrainRatioSize(width, height, maxWidth, maxHeight) {
    const safeMaxWidth = Math.max(0, numberValue(maxWidth, 0));
    const safeMaxHeight = Math.max(0, numberValue(maxHeight, 0));
    const maximumScale = Math.min(safeMaxWidth / width, safeMaxHeight / height);
    if (!Number.isFinite(maximumScale) || maximumScale <= 0) return { width: 0, height: 0 };
    const minimumScale = Math.max(MIN_CROP_SIZE / width, MIN_CROP_SIZE / height);
    const scale = minimumScale <= maximumScale
      ? clamp(1, minimumScale, maximumScale)
      : maximumScale;
    return { width: width * scale, height: height * scale };
  }

  function clampCrop(crop, bounds) {
    const width = clamp(numberValue(crop.width, bounds.width), MIN_CROP_SIZE, bounds.width);
    const height = clamp(numberValue(crop.height, bounds.height), MIN_CROP_SIZE, bounds.height);
    return {
      x: clamp(numberValue(crop.x, 0), 0, bounds.width - width),
      y: clamp(numberValue(crop.y, 0), 0, bounds.height - height),
      width,
      height,
    };
  }

  function ratioNumber(label) {
    if (!label || label === "free") return null;
    const [a, b] = String(label).split(":").map(Number);
    return a > 0 && b > 0 ? a / b : null;
  }

  function cropMatchesRatio(crop, ratio) {
    const width = numberValue(crop?.width, 0);
    const height = numberValue(crop?.height, 0);
    return width > 0 && height > 0 && Math.abs(width / height - ratio) <= Math.max(1, ratio) * 1e-9;
  }

  function rotatedRatioLabel(label) {
    const swaps = {
      "1:1": "1:1",
      "4:3": "3:4",
      "3:4": "4:3",
      "16:9": "9:16",
      "9:16": "16:9",
    };
    return swaps[label] || "free";
  }

  function normalizeRotation(value) {
    return ((Math.round(value) % 360) + 360) % 360;
  }

  function normalizeCanvasRotation(value) {
    const rotation = numberValue(value, 0);
    return ((rotation % 360) + 360) % 360;
  }

  function numberValue(source, fallback = 0) {
    const raw = source && typeof source === "object" && "value" in source ? source.value : source;
    if (raw == null || String(raw).trim() === "") return fallback;
    const number = Number(raw);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function timestamp() {
    const date = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  }

  function fileStem(fileName) {
    const stem = String(fileName).replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]/g, "_").trim();
    return stem || "image";
  }

  function setStatus(message, tone = "info") {
    if (!el.statusMessage) return;
    el.statusMessage.textContent = message;
    el.statusMessage.dataset.tone = tone;
    if (el.processingPresetDialogStatus && dialogIsOpen(el.processingPresetDialog)) {
      el.processingPresetDialogStatus.textContent = message;
      el.processingPresetDialogStatus.dataset.tone = tone;
    }
  }

  const PROJECT_BYTE_LIMIT = 100 * 1024 * 1024;
  const PROJECT_ASSET_LIMIT = 500;
  const PROJECT_LAYER_KEYS = [
    "id", "name", "x", "y", "width", "height", "rotation", "opacity", "visible", "locked",
    "flipX", "flipY", "keepAspect", "isBackground", "zIndex", "xRatio", "yRatio", "widthRatio",
    "heightRatio", "blendMode", "placement", "fitMode", "isFrame", "manualGeometry",
  ];

  function pickProjectProperties(source, keys) {
    return Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));
  }

  async function createProjectDocument() {
    const images = state.images.map(snapshotFilterRecord);
    const canvas = snapshotCanvasState();
    const assets = [];
    const sources = new Map();
    let bytes = 0;
    let pixels = 0;
    async function sourceId(source) {
      if (sources.has(source.objectUrl)) return sources.get(source.objectUrl);
      const file = source.file;
      if (!file?.arrayBuffer) throw new Error("保存できない素材があります。元の画像を追加し直してください。");
      bytes += file.size;
      pixels += (source.originalWidth || source.naturalWidth) * (source.originalHeight || source.naturalHeight);
      if (pixels > MAX_EXPORT_PIXELS) throw new Error("素材の総画素数が120MPを超えています。素材を減らして保存してください。");
      if (bytes > PROJECT_BYTE_LIMIT || assets.length >= PROJECT_ASSET_LIMIT) {
        throw new Error("作業ファイルは素材合計100MB・500素材までです。素材を減らして保存してください。");
      }
      const id = `asset-${assets.length + 1}`;
      const buffer = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let start = 0; start < buffer.length; start += 32768) binary += String.fromCharCode(...buffer.subarray(start, start + 32768));
      const type = file.type === "image/jpg" ? "image/jpeg" : file.type;
      const guessed = /\.webp$/i.test(file.name) ? "image/webp" : /\.jpe?g$/i.test(file.name) ? "image/jpeg" : "image/png";
      assets.push({ id, name: String(file.name || source.name || "image.png"), type: SUPPORTED_TYPES.has(type) ? type : guessed, data: btoa(binary) });
      sources.set(source.objectUrl, id);
      return id;
    }
    async function packLayer(layer) {
      return { ...pickProjectProperties(layer, PROJECT_LAYER_KEYS), asset: await sourceId(layer) };
    }
    const packedImages = [];
    for (const record of images) {
      const finishLayers = [];
      for (const layer of record.finishLayers) finishLayers.push(await packLayer(layer));
      packedImages.push({
        ...pickProjectProperties(record, ["id", "fileName", "crop", "cropRatio", "resize", "resizeAnchor", "rotation", "flipX", "flipY", "filter"]),
        asset: await sourceId(record), finishLayers,
      });
    }
    const layers = [];
    for (const layer of canvas.layers) layers.push(await packLayer(layer));
    return validateProjectDocument({
      schema: "image-tool-project", version: 1, savedAt: new Date().toISOString(),
      mode: state.mode, selectedId: state.selectedId, images: packedImages,
      canvas: { ...canvas, layers }, assets,
      combine: captureCurrentProcessingSettings("combine"), split: captureCurrentProcessingSettings("split"),
    });
  }

  function validateProjectDocument(value) {
    if (value?.schema !== "image-tool-project" || value.version !== 1 || !Array.isArray(value.assets)
      || !Array.isArray(value.images) || !Array.isArray(value.canvas?.layers)) throw new Error("対応する作業ファイルではありません。");
    if (value.assets.length > PROJECT_ASSET_LIMIT || value.images.length > 500 || value.canvas.layers.length > 500) throw new Error("素材数が上限を超えています。");
    const ids = new Set();
    let bytes = 0;
    value.assets.forEach((asset) => {
      if (!asset || typeof asset.id !== "string" || asset.id.length > 100 || ids.has(asset.id)
        || !SUPPORTED_TYPES.has(asset.type) || typeof asset.data !== "string"
        || !asset.data.length || asset.data.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(asset.data)
        || /=/.test(asset.data.slice(0, -2)) || (asset.data.at(-2) === "=" && asset.data.at(-1) !== "=")) {
        throw new Error("作業ファイルの画像データが不正です。");
      }
      ids.add(asset.id);
      bytes += asset.data.length * 3 / 4 - (asset.data.endsWith("==") ? 2 : asset.data.endsWith("=") ? 1 : 0);
    });
    if (bytes > PROJECT_BYTE_LIMIT) throw new Error("素材データが100MBを超えています。");
    let layers = value.canvas.layers.length;
    const imageIds = new Set();
    function checkRecord(record, used) {
      if (!record || !ids.has(record.asset) || typeof record.id !== "string" || record.id.length > 150 || used.has(record.id)) {
        throw new Error("作業ファイルの素材参照が不正です。");
      }
      used.add(record.id);
    }
    value.images.forEach((record) => {
      checkRecord(record, imageIds);
      if (!Array.isArray(record.finishLayers)) throw new Error("仕上げデータが不正です。");
      layers += record.finishLayers.length;
      const used = new Set();
      record.finishLayers.forEach((layer) => checkRecord(layer, used));
    });
    const used = new Set();
    value.canvas.layers.forEach((layer) => checkRecord(layer, used));
    if (layers > 1500) throw new Error("レイヤー数が上限を超えています。");
    return value;
  }

  function setProjectStatus(message, tone = "info") {
    if (el.projectStatus) { el.projectStatus.textContent = message; el.projectStatus.dataset.tone = tone; }
  }

  async function saveProjectFile() {
    if (state.exporting || hasFilterPendingLoads() || state.canvas.queuedLoadCount || state.canvas.pendingLoads.size) return false;
    state.exporting = true;
    updateActionAvailability();
    setProjectStatus("画像と配置をまとめています…");
    try {
      const project = await createProjectDocument();
      triggerDownload(new Blob([JSON.stringify(project)], { type: "application/json" }), `work_${timestamp()}.image-work.json`);
      setProjectStatus("画像・レイヤー・加工状態を含む作業ファイルのダウンロードを開始しました。", "success");
      return true;
    } catch (error) { setProjectStatus(error.message || "作業を保存できませんでした。", "error"); return false; }
    finally { state.exporting = false; updateActionAvailability(); }
  }

  async function prepareProjectImport(file) {
    if (state.exporting) return false;
    cancelProjectImport();
    if (file.size > PROJECT_BYTE_LIMIT * 1.4 + 2_000_000) {
      setProjectStatus("作業ファイルが大きすぎます。素材合計100MBまでのファイルを選んでください。", "error");
      return false;
    }
    state.exporting = true;
    updateActionAvailability();
    try {
      const project = validateProjectDocument(JSON.parse(await file.text()));
      state.pendingProject = project;
      el.projectImportSummary.textContent = `${file.name}：画像${project.images.length}枚・合成レイヤー${project.canvas.layers.length}枚。現在の作業を置き換えます。必要なら先に「作業ファイルを保存」を押してください。`;
      setElementHidden(el.projectImportSummary, false);
      setElementHidden(el.confirmProjectOpenBtn, false);
      setElementHidden(el.cancelProjectOpenBtn, false);
      setProjectStatus("内容を確認してから開いてください。");
      return true;
    } catch (error) { setProjectStatus(error instanceof SyntaxError ? "作業ファイルを読み取れませんでした。" : error.message, "error"); return false; }
    finally { state.exporting = false; updateActionAvailability(); }
  }

  function cancelProjectImport() {
    state.pendingProject = null;
    [el.projectImportSummary, el.confirmProjectOpenBtn, el.cancelProjectOpenBtn].forEach((item) => setElementHidden(item, true));
  }

  async function decodeProjectAssets(project) {
    const sources = new Map();
    const urls = [];
    let pixels = 0;
    try {
      for (const asset of project.assets) {
        const binary = atob(asset.data);
        const data = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        const file = new File([data], String(asset.name || "image.png").slice(0, 200), { type: asset.type });
        const objectUrl = URL.createObjectURL(file);
        urls.push(objectUrl);
        const image = await new Promise((resolve, reject) => {
          const image = new Image();
          const timeout = setTimeout(() => { image.onload = image.onerror = null; image.src = ""; reject(new Error("画像の読み込みがタイムアウトしました。")); }, 30000);
          image.onload = () => { clearTimeout(timeout); image.onload = image.onerror = null; resolve(image); };
          image.onerror = () => { clearTimeout(timeout); reject(new Error("読み込めない画像が含まれています。元の作業は変更していません。")); };
          image.src = objectUrl;
        });
        assertExportSize(image.naturalWidth, image.naturalHeight);
        pixels += image.naturalWidth * image.naturalHeight;
        if (pixels > MAX_EXPORT_PIXELS) throw new Error("素材の総画素数が上限を超えています。元の作業は変更していません。");
        sources.set(asset.id, { file, objectUrl, image, fileName: file.name, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight });
      }
      return { sources, urls };
    } catch (error) { urls.forEach((url) => URL.revokeObjectURL(url)); throw error; }
  }

  function unpackProject(project, sources) {
    const images = project.images.map((saved) => {
      const source = sources.get(saved.asset);
      const record = {
        ...source, id: saved.id, fileName: String(saved.fileName || source.fileName).slice(0, 200),
        originalWidth: source.naturalWidth, originalHeight: source.naturalHeight,
        rotation: normalizeRotation(saved.rotation), flipX: saved.flipX === true, flipY: saved.flipY === true,
        cropRatio: ["free", "1:1", "4:3", "3:4", "16:9", "9:16"].includes(saved.cropRatio) ? saved.cropRatio : "free",
        resize: { width: nullablePresetDimension(saved.resize?.width), height: nullablePresetDimension(saved.resize?.height), keepAspect: saved.resize?.keepAspect !== false },
        resizeAnchor: saved.resizeAnchor === "height" ? "height" : "width", filter: sanitizeFilterState(saved.filter),
        finishLayers: saved.finishLayers.map((layer) => sanitizeFinishLayerState({ ...pickProjectProperties(layer, PROJECT_LAYER_KEYS), ...sources.get(layer.asset) })),
      };
      const bounds = getOrientedDimensions(record);
      record.crop = clampCrop({ x: numberValue(saved.crop?.x, 0), y: numberValue(saved.crop?.y, 0), width: numberValue(saved.crop?.width, bounds.width), height: numberValue(saved.crop?.height, bounds.height) }, bounds);
      reconcileResize(record, record.resizeAnchor);
      return record;
    });
    const savedCanvas = project.canvas;
    const size = constrainCanvasSize(numberValue(savedCanvas.width, 1200), numberValue(savedCanvas.height, 800));
    const layers = savedCanvas.layers.map((saved, index) => {
      const source = sources.get(saved.asset);
      const dims = constrainCanvasLayerDimensions(numberValue(saved.width, source.naturalWidth), numberValue(saved.height, source.naturalHeight));
      return {
        ...source, ...dims, id: saved.id, name: String(saved.name || source.fileName).slice(0, 120),
        x: clamp(numberValue(saved.x, 0), -MAX_EXPORT_DIMENSION, MAX_EXPORT_DIMENSION),
        y: clamp(numberValue(saved.y, 0), -MAX_EXPORT_DIMENSION, MAX_EXPORT_DIMENSION),
        rotation: normalizeCanvasRotation(saved.rotation), opacity: clamp(numberValue(saved.opacity, 1), 0, 1),
        visible: saved.visible !== false, locked: saved.locked === true, flipX: saved.flipX === true, flipY: saved.flipY === true,
        keepAspect: saved.keepAspect !== false, isBackground: saved.isBackground === true, zIndex: index,
      };
    });
    return {
      images, selectedId: images.some((record) => record.id === project.selectedId) ? project.selectedId : images[0]?.id || null,
      canvas: { ...size, layers, selectedId: layers.some((layer) => layer.id === savedCanvas.selectedId) ? savedCanvas.selectedId : layers[0]?.id || null,
        backgroundMode: ["transparent", "white", "black", "custom", "image"].includes(savedCanvas.backgroundMode) ? savedCanvas.backgroundMode : "transparent",
        backgroundColor: sanitizeHexColor(savedCanvas.backgroundColor), snap: savedCanvas.snap !== false,
        gridVisible: savedCanvas.gridVisible === true, gridSize: Math.round(clamp(numberValue(savedCanvas.gridSize, 20), 2, 500)),
      },
    };
  }

  async function openPendingProject() {
    const project = state.pendingProject;
    if (!project || state.exporting || hasFilterPendingLoads() || state.canvas.queuedLoadCount || state.canvas.pendingLoads.size) return false;
    state.exporting = true;
    updateActionAvailability();
    setProjectStatus("作業ファイルの画像を読み込んでいます…");
    let decoded;
    let committed = false;
    let previous;
    try {
      decoded = await decodeProjectAssets(project);
      const workspace = unpackProject(project, decoded.sources);
      previous = {
        images: snapshotImageWorkspace(), canvas: snapshotCanvasState(), mode: state.mode,
        history: { ...state.imageHistory }, canvasHistory: state.canvas.history, canvasRedo: state.canvas.redo,
        clipboard: state.canvas.clipboard, zoom: state.canvas.zoom,
        imageUrls: state.imageSourceUrls, canvasUrls: state.canvas.sourceUrls, finishUrls: state.filter.finishSourceUrls,
      };
      const oldUrls = new Set([...state.imageSourceUrls, ...state.images.map((record) => record.objectUrl), ...state.canvas.sourceUrls, ...state.filter.finishSourceUrls]);
      state.imageHistory.restoring = true;
      state.images = workspace.images;
      state.selectedId = workspace.selectedId;
      state.markedImageIds.clear();
      state.filter.selectedFinishLayerId = null;
      state.filter.comparingOriginal = false;
      state.filter.finishSourceUrls = collectFinishSourceUrls(state.images);
      state.imageSourceUrls = new Set(state.images.map((record) => record.objectUrl));
      restoreCanvasState(workspace.canvas);
      state.canvas.sourceUrls = new Set(workspace.canvas.layers.map((layer) => layer.objectUrl));
      state.canvas.history = [];
      state.canvas.redo = [];
      state.canvas.clipboard = null;
      state.canvas.zoom = 1;
      state.mode = "combine";
      applyProcessingPresetSettings("combine", project.combine);
      const split = sanitizeProcessingPresetSettings("split", project.split);
      el.splitColumns.value = String(split.columns);
      el.splitRows.value = String(split.rows);
      state.imageHistory.past = [];
      state.imageHistory.future = [];
      setMode(PROCESSING_PRESET_MODES.has(project.mode) ? project.mode : "combine");
      state.imageHistory.current = snapshotImageWorkspace();
      state.imageHistory.group = null;
      state.downloadCleanup?.();
      committed = true;
      oldUrls.forEach((url) => URL.revokeObjectURL(url));
      const usedUrls = new Set([...state.imageSourceUrls, ...state.canvas.sourceUrls, ...state.filter.finishSourceUrls]);
      decoded.urls.filter((url) => !usedUrls.has(url)).forEach((url) => URL.revokeObjectURL(url));
      cancelProjectImport();
      setProjectStatus("作業を再開しました。画像・配置・加工状態を復元しました。", "success");
      setStatus("作業ファイルから画像・配置・加工状態を復元しました。", "success");
      setElementHidden(el.undoRemovalBtn, true);
      return true;
    } catch (error) {
      if (!committed) {
        if (previous) {
          state.imageHistory.restoring = true;
          restoreImageWorkspace(previous.images);
          restoreCanvasState(previous.canvas);
          state.imageHistory = { ...previous.history, restoring: true };
          state.canvas.history = previous.canvasHistory;
          state.canvas.redo = previous.canvasRedo;
          state.canvas.clipboard = previous.clipboard;
          state.canvas.zoom = previous.zoom;
          state.imageSourceUrls = previous.imageUrls;
          state.canvas.sourceUrls = previous.canvasUrls;
          state.filter.finishSourceUrls = previous.finishUrls;
          try { setMode(previous.mode); } catch { state.mode = previous.mode; }
        }
        if (decoded) decoded.urls.forEach((url) => URL.revokeObjectURL(url));
      }
      setProjectStatus(error.message || "作業ファイルを開けませんでした。", "error");
      return false;
    } finally { state.imageHistory.restoring = false; state.exporting = false; updateActionAvailability(); }
  }

  const ZIP_CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
    return value >>> 0;
  });

  function zipCrc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = (crc >>> 8) ^ ZIP_CRC_TABLE[(crc ^ byte) & 255];
    return (crc ^ 0xffffffff) >>> 0;
  }

  async function createImageZip(downloads) {
    if (!downloads.length || downloads.length > 65535) throw new Error("ZIPに保存する画像数を確認してください。");
    if (downloads.reduce((sum, item) => sum + item.blob.size, 0) > 512 * 1024 * 1024) throw new Error("ZIPは合計512MBまでです。画像を分けて保存してください。");
    const parts = [], directory = [], used = new Set();
    let offset = 0;
    for (const item of downloads) {
      const original = String(item.fileName || "image.png").replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").replace(/^\.+/, "_").slice(0, 200);
      let name = original, suffix = 2;
      while (used.has(name.toLocaleLowerCase())) {
        const dot = original.lastIndexOf(".");
        name = dot > 0 ? `${original.slice(0, dot)}_${suffix++}${original.slice(dot)}` : `${original}_${suffix++}`;
      }
      used.add(name.toLocaleLowerCase());
      const encoded = new TextEncoder().encode(name);
      const bytes = new Uint8Array(await item.blob.arrayBuffer());
      const crc = zipCrc32(bytes);
      const header = new Uint8Array(30 + encoded.length), view = new DataView(header.buffer);
      view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x800, true);
      view.setUint16(12, 0x21, true); view.setUint32(14, crc, true); view.setUint32(18, bytes.length, true);
      view.setUint32(22, bytes.length, true); view.setUint16(26, encoded.length, true); header.set(encoded, 30);
      const central = new Uint8Array(46 + encoded.length), cv = new DataView(central.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x800, true); cv.setUint16(14, 0x21, true); cv.setUint32(16, crc, true);
      cv.setUint32(20, bytes.length, true); cv.setUint32(24, bytes.length, true);
      cv.setUint16(28, encoded.length, true); cv.setUint32(42, offset, true); central.set(encoded, 46);
      parts.push(header, bytes); directory.push(central); offset += header.length + bytes.length;
    }
    const end = new Uint8Array(22), ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, downloads.length, true); ev.setUint16(10, downloads.length, true);
    ev.setUint32(12, directory.reduce((sum, entry) => sum + entry.length, 0), true); ev.setUint32(16, offset, true);
    return new Blob([...parts, ...directory, end], { type: "application/zip" });
  }

  // Image history shares immutable decoded sources; only editable values are copied.
  function snapshotImageWorkspace() {
    return {
      images: state.images.map(snapshotFilterRecord),
      selectedId: state.selectedId,
      markedIds: [...state.markedImageIds],
      finishId: state.filter.selectedFinishLayerId,
      controls: Object.fromEntries([
        "combineDirection", "gridColumns", "combineSizing", "targetWidth", "targetHeight",
        "gapSize", "outerPadding", "backgroundMode", "customBackground", "outputFormat",
        "outputQuality", "splitColumns", "splitRows",
      ].map((id) => [id, el[id]?.value || ""])),
    };
  }

  function imageWorkspaceSignature(snapshot) {
    return JSON.stringify({ images: snapshot.images, controls: snapshot.controls }, (key, value) => (
      key === "image" || key === "file" ? undefined : value
    ));
  }

  function imageHistorySnapshots() {
    const history = state.imageHistory;
    return [...history.past, ...history.future, ...(history.current ? [history.current] : [])];
  }

  function sweepImageSourceUrls() {
    const retained = collectWorkspaceUrls();
    state.imageSourceUrls.forEach((url) => {
      if (retained.has(url)) return;
      releaseWorkspaceUrl(url);
    });
  }

  function collectWorkspaceUrls() {
    const urls = new Set(state.filter.activeFinishSourceUrls);
    const collectLayers = (layers) => (layers || []).forEach((layer) => { if (layer.objectUrl) urls.add(layer.objectUrl); });
    const collectImages = (images) => {
      collectLayers(images);
      (images || []).forEach((record) => collectLayers(record.finishLayers));
    };
    collectImages(state.images);
    imageHistorySnapshots().forEach((snapshot) => collectImages(snapshot.images));
    collectLayers(state.canvas.layers);
    [...state.canvas.history, ...state.canvas.redo].forEach((snapshot) => collectLayers(snapshot.layers));
    if (state.canvas.clipboard) collectLayers([state.canvas.clipboard]);
    return urls;
  }

  function releaseWorkspaceUrl(url) {
    URL.revokeObjectURL(url);
    state.imageSourceUrls.delete(url);
    state.filter.finishSourceUrls.delete(url);
    state.canvas.sourceUrls.delete(url);
  }

  function recordImageHistory() {
    const history = state.imageHistory;
    if (history.restoring || !history.current || state.cropGesture || state.filter.finishGesture) return;
    const next = snapshotImageWorkspace();
    next.images.forEach((record) => { if (record.objectUrl) state.imageSourceUrls.add(record.objectUrl); });
    const changed = imageWorkspaceSignature(next) !== imageWorkspaceSignature(history.current);
    if (changed) {
      const focused = document.activeElement;
      const group = focused?.matches?.('input:not([type="checkbox"]):not([type="file"])') ? focused.id : null;
      if (!group || history.group !== group) history.past.push(history.current);
      if (history.past.length > 40) history.past.shift();
      history.future = [];
      history.group = group;
      setElementHidden(el.undoRemovalBtn, true);
    }
    history.current = next;
    if (changed) {
      sweepImageSourceUrls();
      sweepFinishSourceUrls();
    }
    updateImageHistoryControls();
  }

  function updateImageHistoryControls() {
    const unavailable = state.exporting || hasFilterPendingLoads();
    if (el.undoImagesBtn) el.undoImagesBtn.disabled = unavailable || !state.imageHistory.past.length;
    if (el.redoImagesBtn) el.redoImagesBtn.disabled = unavailable || !state.imageHistory.future.length;
    if (el.undoRemovalBtn) el.undoRemovalBtn.disabled = unavailable;
    setElementHidden(el.undoImagesBtn, state.mode === "canvas");
    setElementHidden(el.redoImagesBtn, state.mode === "canvas");
  }

  function restoreImageWorkspace(snapshot) {
    state.images = snapshot.images.map(snapshotFilterRecord);
    state.selectedId = snapshot.selectedId;
    state.markedImageIds = new Set(snapshot.markedIds);
    state.filter.selectedFinishLayerId = snapshot.finishId;
    state.filter.comparingOriginal = false;
    Object.entries(snapshot.controls).forEach(([id, value]) => { if (el[id]) el[id].value = value; });
  }

  function travelImageHistory(direction) {
    if (state.exporting || hasFilterPendingLoads()) return false;
    if (state.cropGesture || state.filter.finishGesture) return false;
    recordImageHistory();
    const history = state.imageHistory;
    const from = direction === "redo" ? history.future : history.past;
    const to = direction === "redo" ? history.past : history.future;
    const snapshot = from.pop();
    if (!snapshot) return false;
    to.push(history.current);
    history.restoring = true;
    try {
      restoreImageWorkspace(snapshot);
      refreshAll();
      history.current = snapshotImageWorkspace();
      history.group = null;
    } finally { history.restoring = false; }
    sweepImageSourceUrls();
    sweepFinishSourceUrls();
    updateImageHistoryControls();
    setElementHidden(el.undoRemovalBtn, true);
    setStatus(direction === "redo" ? "画像の操作をやり直しました。" : "画像の操作を1つ元に戻しました。", "success");
    return true;
  }

  function showRemovalUndo() {
    setElementHidden(el.undoRemovalBtn, false);
  }

  function bindWorkspaceImprovements() {
    el.undoImagesBtn?.addEventListener("click", () => travelImageHistory("undo"));
    el.redoImagesBtn?.addEventListener("click", () => travelImageHistory("redo"));
    el.undoRemovalBtn?.addEventListener("click", () => travelImageHistory("undo"));
    document.addEventListener("focusout", () => { state.imageHistory.group = null; });
    document.addEventListener("keydown", (event) => {
      if (state.mode === "canvas" || event.defaultPrevented || document.querySelector?.("dialog[open]")) return;
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      if (event.target?.matches?.('input, textarea, [contenteditable="true"]')) return;
      event.preventDefault();
      travelImageHistory(event.shiftKey ? "redo" : "undo");
    });
    el.applyMarkedCropBtn?.addEventListener("click", () => applyMarkedBatch("crop"));
    el.applyMarkedResizeBtn?.addEventListener("click", () => applyMarkedBatch("resize"));
    el.applyMarkedFilterBtn?.addEventListener("click", () => applyMarkedBatch("filter"));
    el.exportMarkedBtn?.addEventListener("click", exportMarkedImages);
    el.saveProjectBtn?.addEventListener("click", saveProjectFile);
    el.openProjectBtn?.addEventListener("click", () => el.projectFileInput.click());
    el.projectFileInput?.addEventListener("change", async () => {
      const file = el.projectFileInput.files?.[0];
      el.projectFileInput.value = "";
      if (file) await prepareProjectImport(file);
    });
    el.confirmProjectOpenBtn?.addEventListener("click", openPendingProject);
    el.cancelProjectOpenBtn?.addEventListener("click", cancelProjectImport);
    el.mobilePreviewToggle?.addEventListener("click", () => {
      const hidden = !el.mobilePreviewCanvas.hidden;
      el.mobilePreviewCanvas.hidden = hidden;
      el.mobilePreviewToggle.setAttribute("aria-expanded", String(!hidden));
      el.mobilePreviewToggle.textContent = hidden ? "表示" : "たたむ";
      if (!hidden) renderMobilePreview();
    });
    el.readableUiBtn?.addEventListener("click", () => {
      const active = document.body.classList.toggle("readable-ui");
      el.readableUiBtn.setAttribute("aria-pressed", String(active));
    });
    window.addEventListener("scroll", renderMobilePreview, { passive: true });
  }

  const MODE_PURPOSES = {
    combine: "複数画像を縦・横・格子状に並べて、1枚にまとめます。",
    split: "選択中の1枚を、列数×行数に分けて保存します。",
    edit: "切り抜き・サイズ変更・回転で、画像の形を整えます。",
    canvas: "画像をレイヤーとして自由に配置し、重ね合わせます。",
    filter: "色や質感を調整し、額縁などの仕上げ素材を重ねます。",
  };

  function updateImprovementControls() {
    const marked = state.images.filter((record) => state.markedImageIds.has(record.id));
    const busy = state.exporting || hasFilterPendingLoads();
    const source = getSelected();
    if (el.modePurpose) el.modePurpose.textContent = MODE_PURPOSES[state.mode];
    if (state.mode === "canvas") setElementHidden(el.undoRemovalBtn, true);
    if (el.batchSourceHint) el.batchSourceHint.textContent = source
      ? `設定元：${source.fileName} ／ チェックした${marked.length}枚が対象`
      : "一覧で設定元の画像を開き、処理する素材にチェックしてください。";
    [[el.applyMarkedCropBtn, "切り抜き"], [el.applyMarkedResizeBtn, "サイズ"], [el.applyMarkedFilterBtn, "加工＋仕上げ"]].forEach(([button, label]) => {
      if (!button) return;
      button.textContent = `${marked.length}枚に${label}を適用`;
      button.disabled = busy || !marked.length || !source;
    });
    if (el.exportMarkedBtn) {
      el.exportMarkedBtn.textContent = `チェックした${marked.length}枚を保存`;
      el.exportMarkedBtn.disabled = busy || !marked.length;
      setElementHidden(el.exportMarkedBtn, !["edit", "filter"].includes(state.mode));
    }
    setElementHidden(el.applyMarkedCropBtn, state.mode !== "edit");
    setElementHidden(el.applyMarkedResizeBtn, state.mode !== "edit");
    setElementHidden(el.applyMarkedFilterBtn, state.mode !== "filter");
    setElementHidden(el.batchSourceHint, !["edit", "filter"].includes(state.mode));
    const loading = busy || state.canvas.queuedLoadCount > 0 || state.canvas.pendingLoads.size > 0;
    [el.saveProjectBtn, el.openProjectBtn, el.confirmProjectOpenBtn, el.cancelProjectOpenBtn].filter(Boolean)
      .forEach((button) => { button.disabled = loading; });
    updateImageHistoryControls();
  }

  function batchRecords() {
    return state.batchTargetIds ? state.images.filter((record) => state.batchTargetIds.has(record.id)) : state.images;
  }

  function applyMarkedBatch(kind) {
    if (state.exporting || hasFilterPendingLoads() || !state.markedImageIds.size || !getSelected()) return false;
    recordImageHistory();
    state.batchTargetIds = new Set(state.markedImageIds);
    try {
      if (kind === "crop") applySelectedCropToAll();
      else if (kind === "resize") applySelectedResizeToAll();
      else if (kind === "filter") applySelectedFilterAndFinishToAll();
      else return false;
      setStatus(`チェックした${batchRecords().length}枚へ適用しました。「元に戻す」で取り消せます。`, "success");
    } finally { state.batchTargetIds = null; }
    return true;
  }

  async function exportMarkedImages() {
    if (state.exporting || hasFilterPendingLoads()) return;
    const records = state.images.filter((record) => state.markedImageIds.has(record.id));
    if (!records.length || !["edit", "filter"].includes(state.mode)) return;
    state.exporting = true;
    updateActionAvailability();
    try {
      if (state.mode === "filter") await exportAllFiltered(records);
      else await exportAllEdited(records);
    } catch (error) { setStatus(error.message || "保存できませんでした。", "error"); }
    finally { state.exporting = false; updateActionAvailability(); }
  }

  function renderMobilePreview() {
    if (!el.mobilePreview || !globalThis.matchMedia?.("(max-width: 960px)").matches) return;
    const source = state.mode === "canvas" ? el.canvasDisplayCanvas
      : state.mode === "combine" ? el.combinePreviewCanvas
        : state.mode === "edit" ? el.editCanvas : state.mode === "split" ? el.splitPreviewCanvas : el.filterPreviewCanvas;
    const panel = document.querySelector?.(".preview-panel");
    const headerHeight = document.querySelector?.(".app-header")?.getBoundingClientRect().height || 100;
    el.mobilePreview.style.top = `${headerHeight + 6}px`;
    const pastPreview = panel && panel.getBoundingClientRect().bottom < headerHeight;
    const hasImage = state.mode === "canvas" ? state.canvas.layers.length > 0 : state.images.length > 0;
    el.mobilePreview.hidden = !hasImage || !pastPreview;
    document.documentElement.style.setProperty("--mobile-header-height", `${headerHeight}px`);
    document.documentElement.style.setProperty("--mobile-preview-height", `${el.mobilePreview.hidden ? 0 : el.mobilePreview.getBoundingClientRect().height}px`);
    if (el.mobilePreview.hidden || el.mobilePreviewCanvas.hidden || !source?.width) return;
    const canvas = el.mobilePreviewCanvas;
    const record = state.mode === "edit" ? getSelected() : null;
    const size = record ? getProcessedDimensions(record) : source;
    const scale = Math.min(1, 280 / size.width, 140 / size.height);
    canvas.width = Math.max(1, Math.round(size.width * scale));
    canvas.height = Math.max(1, Math.round(size.height * scale));
    const context = canvas.getContext("2d");
    if (context) {
      if (record) drawProcessedRecordInto(context, record, 0, 0, canvas.width, canvas.height);
      else context.drawImage(source, 0, 0, canvas.width, canvas.height);
    }
    document.documentElement.style.setProperty("--mobile-preview-height", `${el.mobilePreview.getBoundingClientRect().height}px`);
    el.mobilePreviewLabel.textContent = `${PROCESSING_PRESET_MODE_LABELS[state.mode]}・確認用プレビュー`;
  }

  function debounce(callback, delay) {
    let timer = 0;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => callback(...args), delay);
    };
  }

  function nextTick() {
    return new Promise((resolve) => setTimeout(resolve, 80));
  }

  // Pure helpers are exposed only to make the local build easy to verify.
  globalThis.__IMAGE_TOOL_TEST__ = {
    snapshotImageWorkspace, recordImageHistory, travelImageHistory, sweepImageSourceUrls, collectWorkspaceUrls,
    applyMarkedBatch, exportMarkedImages, createImageZip, zipCrc32,
    createProjectDocument, validateProjectDocument, unpackProject, decodeProjectAssets,
    prepareProjectImport, openPendingProject, saveProjectFile, cancelProjectImport,
    PROCESSING_PRESET_STORAGE_KEY,
    dialogIsOpen,
    openAppDialog,
    closeAppDialog,
    setHelpTab,
    normalizeProcessingPresetName,
    sanitizeOutputPresetSettings,
    sanitizeProcessingPresetSettings,
    sanitizeProcessingPreset,
    sanitizeProcessingPresets,
    loadProcessingPresets,
    writeProcessingPresets,
    captureCurrentProcessingSettings,
    applyProcessingPresetSettings,
    renderProcessingPresetControls,
    saveCurrentProcessingPreset,
    applySelectedProcessingPreset,
    deleteSelectedProcessingPreset,
    updateImageBulkActions,
    setImageMarked,
    setAllImagesMarked,
    removeImagesByIds,
    deleteMarkedImages,
    calculateCombineLayout,
    normalizeGridColumns,
    normalizeSplitAxisCount,
    normalizeSplitControls,
    calculateSplitRegions,
    getSplitOptions,
    getSplitLayout,
    formatSplitSummary,
    splitOutputFileName,
    drawSplitGuides,
    renderSplitPreview,
    exportSplitImage,
    largestCenteredCrop,
    ratioNumber,
    normalizeRotation,
    clampCrop,
    normalizeCanvasPoint,
    createCanvasLayerState,
    canvasPointFromClient,
    canvasLayerLocalToOutput,
    outputToCanvasLayerLocal,
    getCanvasLayerCorners,
    getCanvasLayerAabb,
    hitTestCanvasLayers,
    resizeCanvasLayerFromHandle,
    calculateCanvasRotation,
    normalizeCanvasRotation,
    constrainCanvasLayerDimensions,
    snapCanvasLayer,
    calculateCanvasLayerFit,
    reorderCanvasLayers,
    getCanvasDrawLayers,
    resolveCanvasBackground,
    getCanvasGridLines,
    drawCanvasScene,
    snapshotCanvasState,
    pushCanvasHistory,
    undoCanvas,
    redoCanvas,
    constrainCanvasSize,
    addCanvasFiles,
    cancelCanvasLoads,
    sweepCanvasSourceUrls,
    setCanvasSize,
    selectCanvasLayer,
    updateCanvasLayerFromControl,
    moveCanvasLayerOrder,
    toggleCanvasLayerVisibility,
    toggleCanvasLayerLock,
    duplicateCanvasLayer,
    deleteSelectedCanvasLayer,
    flipCanvasLayer,
    alignCanvasLayer,
    fitSelectedCanvasLayer,
    setCanvasZoom,
    exportCanvasComposition,
    clearCanvasComposition,
    renderCanvasComposition,
    FILTER_TIME_PRESETS,
    createDefaultFilterState,
    sanitizeFilterState,
    normalizeFilterState: sanitizeFilterState,
    cloneFilterState,
    clampFilterByte,
    mixFilterPixel,
    applyTonePixel,
    applyTimePresetPixel,
    quantizeChannel,
    createEdgeMap,
    applyPosterize,
    applyPosterFilterImageData: applyPosterize,
    applyOilPaint,
    applyOilFilterImageData: applyOilPaint,
    applyFilterPipeline,
    isFilterStateNeutral,
    calculateFilterPreviewSize,
    snapshotFilterRecord,
    snapshotFilteredRecord,
    snapshotFilterExport,
    filterOutputFileName,
    filterVariantFileName,
    makeTimeVariantJobs,
    buildFilterVariantJobs: makeTimeVariantJobs,
    flattenFilterImageDataToWhite,
    flattenCanvasToWhite,
    assertFilterExportSize,
    filterProcessingHalo,
    renderFilteredRecordToCanvas,
    renderFilteredRecordToCanvasTiled,
    encodeFilteredRecord,
    applySelectedFilterToAll,
    setFilterComparison,
    setFilterCompareActive,
    exportAllFiltered,
    exportFilteredImages: exportAllFiltered,
    exportFilterVariants,
    exportFilterVariantsWorkflow,
    renderFilterPreview,
    FINISH_COMPOSITE_OPERATIONS,
    sanitizeFinishBlendMode,
    sanitizeFinishFitMode,
    sanitizeFinishPlacement,
    ensureFinishLayers,
    createFinishLayerState,
    sanitizeFinishLayerState,
    sanitizeFinishLayer: sanitizeFinishLayerState,
    cloneFinishLayerState,
    snapshotFinishLayers,
    finishGeometryToPixels,
    finishGeometryFromPixels,
    calculateFinishFrameRect,
    resolveFinishLayerGeometry,
    finishLayerLocalToOutput,
    outputToFinishLayerLocal,
    getFinishLayerCorners,
    getFinishLayerAabb,
    hitTestFinishLayers,
    resizeFinishLayerFromHandle,
    calculateFinishLayerRotation,
    calculateFinishLayerFit,
    getFinishLayersByPlacement,
    getFinishVisualOrder,
    finishLayersFromVisualOrder,
    moveFinishLayerAcrossBase,
    reorderFinishLayers,
    finishBlendOperation,
    getFinishDrawLayers,
    buildFinishDrawPlan,
    drawFinishLayers,
    addFinishFiles,
    cancelFinishLoads,
    sweepFinishSourceUrls,
    releaseUnusedFinishSources: sweepFinishSourceUrls,
    collectFinishSourceUrls,
    retainFinishSources,
    selectFinishLayer,
    setSelectedFinishLayerPlacement,
    updateFinishLayerFromControl,
    moveFinishLayerOrder,
    toggleFinishLayerVisibility,
    toggleFinishLayerFrame,
    deleteSelectedFinishLayer,
    placeFinishLayer,
    applySelectedFinishToAll,
    applySelectedFilterAndFinishToAll,
    finishPointFromClient,
    beginFinishCanvasGesture,
    beginFinishSelectionGesture,
    moveFinishGesture,
    endFinishGesture,
    cancelFinishGesture,
    syncFinishControls,
    renderFinishLayerList,
    isRecordGeometryNeutral,
    drawProcessedRecordInto,
    get state() {
      return state;
    },
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
