import {
  CONSTANTS,
  Enums,
  getRenderingEngine,
  RenderingEngine,
  setVolumesForViewports,
  Types,
  volumeLoader,
} from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import {
  addButtonToToolbar,
  addDropdownToToolbar,
  addManipulationBindings,
  createImageIdsAndCacheMetaData,
  initDemo,
  setTitleAndDescription,
} from '../../../../utils/demo/helpers';

const { ToolGroupManager, Enums: csToolsEnums } = cornerstoneTools;
const { ViewportType } = Enums;

let renderingEngine;
const volumeName = 'CT_VOLUME_ID';
const volumeLoaderScheme = 'cornerstoneStreamingImageVolume';
const volumeId = `${volumeLoaderScheme}:${volumeName}`;
const renderingEngineId = 'myRenderingEngine';
const viewportId = '3D_VIEWPORT';

setTitleAndDescription(
  '3D Volume Rendering with Circle Overlay',
  'The circle will pan and rotate along with the 3D volume.'
);

const size = '500px';
const content = document.getElementById('content');
const viewportGrid = document.createElement('div');

viewportGrid.style.display = 'flex';
viewportGrid.style.flexDirection = 'row';

const element1 = document.createElement('div');
element1.oncontextmenu = () => false;
element1.style.width = size;
element1.style.height = size;
element1.style.position = 'relative';

const canvasOverlay = document.createElement('canvas');
canvasOverlay.width = 500;
canvasOverlay.height = 500;
canvasOverlay.style.position = 'absolute';
canvasOverlay.style.left = '0';
canvasOverlay.style.top = '0';
canvasOverlay.style.zIndex = '10';

element1.appendChild(canvasOverlay);
viewportGrid.appendChild(element1);
content.appendChild(viewportGrid);

const instructions = document.createElement('p');
instructions.innerText = 'Click the image to rotate it.';
content.append(instructions);

let viewport;

function drawCircle(x, y, radius) {
  const context = canvasOverlay.getContext('2d');
  context.clearRect(0, 0, canvasOverlay.width, canvasOverlay.height);
  context.beginPath();
  context.arc(x, y, radius, 0, 2 * Math.PI);
  context.strokeStyle = 'red';
  context.lineWidth = 2;
  context.stroke();
}

function determineMovement(view) {
  const { viewUp, viewPlaneNormal, position, focalPoint } = view;
  const horizontalThreshold = 0.4;
  const verticalThreshold = 0.7;
  if (
    Math.abs(viewUp[0]) > horizontalThreshold ||
    Math.abs(viewUp[1]) > horizontalThreshold
  ) {
    if (viewUp[0] > 0 || viewUp[1] > 0) {
      return 'horizontal left';
    } else {
      return 'horizontal right';
    }
  } else if (Math.abs(viewUp[2]) > verticalThreshold) {
    if (viewUp[2] > 0) {
      return 'vertical up';
    } else {
      return 'vertical down';
    }
  }
  console.log('Unknown movement');
  return 'unknown';
}

function updateOverlayTransform() {
  if (!viewport) {
    return;
  }

  const camera = viewport.getCamera();
  if (!camera || !camera.position || !camera.focalPoint || !camera.viewUp) {
    return;
  }
  let centerX = 250;
  let centerY = 250;
  const viewUpY = camera.viewUp[1];
  const viewUpX = camera.viewUp[0];
  const panX = camera.position[0] - camera.focalPoint[0];
  const panY = camera.position[1] - camera.focalPoint[1];
  const scalingFactor = centerX / camera.parallelScale;

  if (determineMovement(camera) == 'horizontal left') {
    centerX += panX * (scalingFactor / 100);
    centerY -= panY * viewUpY * (scalingFactor / 40);
  } else if (determineMovement(camera) == 'horizontal right') {
    centerX += panX * (scalingFactor / 100);
    centerY -= panY * viewUpY * (scalingFactor / 40);
  } else if (determineMovement(camera) == 'vertical down') {
    centerX += panX * (scalingFactor / 40);
    centerY += panY * viewUpY * (scalingFactor / 40);
  } else if (determineMovement(camera) == 'vertical up') {
    centerX -= panX * (scalingFactor / 40);
    centerY -= panY * viewUpY * (scalingFactor / 40);
  }
  console.log(`Calculated circle position: (${centerX}, ${centerY})`);

  const clampedCenterX = Math.max(0, Math.min(500, centerX));
  const clampedCenterY = Math.max(0, Math.min(500, centerY));

  if (
    clampedCenterX >= 0 &&
    clampedCenterX <= 500 &&
    clampedCenterY >= 0 &&
    clampedCenterY <= 500
  ) {
    drawCircle(clampedCenterX, clampedCenterY, 50);
  } else {
    console.warn('Circle is out of canvas bounds:', {
      clampedCenterX,
      clampedCenterY,
    });
  }
}

async function run() {
  await initDemo();

  const toolGroupId = 'TOOL_GROUP_ID';
  const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);

  addManipulationBindings(toolGroup, {
    is3DViewport: true,
  });

  const imageIds = await createImageIdsAndCacheMetaData({
    StudyInstanceUID:
      '1.3.6.1.4.1.14519.5.2.1.7009.2403.871108593056125491804754960339',
    SeriesInstanceUID:
      '1.3.6.1.4.1.14519.5.2.1.7009.2403.367700692008930469189923116409',
    wadoRsRoot: 'https://domvja9iplmyu.cloudfront.net/dicomweb',
  });

  renderingEngine = new RenderingEngine(renderingEngineId);

  const viewportInputArray = [
    {
      viewportId: viewportId,
      type: ViewportType.VOLUME_3D,
      element: element1,
      defaultOptions: {
        orientation: Enums.OrientationAxis.CORONAL,
        background: CONSTANTS.BACKGROUND_COLORS.slicer3D,
      },
    },
  ];

  renderingEngine.setViewports(viewportInputArray);
  toolGroup.addViewport(viewportId, renderingEngineId);

  const volume = await volumeLoader.createAndCacheVolume(volumeId, {
    imageIds,
  });

  volume.load();
  viewport = renderingEngine.getViewport(viewportId);

  setVolumesForViewports(renderingEngine, [{ volumeId }], [viewportId]).then(
    () => {
      viewport.setProperties({
        preset: 'CT-Bone',
      });
      viewport.render();
      updateOverlayTransform();
    }
  );

  element1.addEventListener(Enums.Events.CAMERA_MODIFIED, () => {
    updateOverlayTransform();
  });

  const originalRender = viewport.render.bind(viewport);
  viewport.render = () => {
    originalRender();
    updateOverlayTransform();
  };

  // Add buttons for interactivity
  addButtonToToolbar({
    title: 'Apply random rotation',
    onClick: () => {
      viewport.setProperties({ rotation: Math.random() * 360 });
      viewport.render();
    },
  });

  addDropdownToToolbar({
    options: {
      values: CONSTANTS.VIEWPORT_PRESETS.map((preset) => preset.name),
      defaultValue: 'CT-Bone',
    },
    onSelectedValueChange: (presetName) => {
      viewport.setProperties({ preset: presetName });
      viewport.render();
    },
  });
}

run();
