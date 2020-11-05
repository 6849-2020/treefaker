diskPacking = null; // Map from tree point ids to locations on [0, 1] X [0, 1].

function showDiskPacking() {
  JXG.JSXGraph.freeBoard(packingBoard);
  packingBoard = JXG.JSXGraph.initBoard('packingViewBox', {
    boundingbox: [-.05, 1.05, 1.05, -.05],
    showCopyright: false,
    showNavigation: false
  });
  packingBoard.create('grid', []);
  for (vertexId of Object.keys(diskPacking)) {
    packingBoard.create('point', diskPacking[vertexId], {name: vertexId, fixed: true});
    // TODO Maybe we can color-code the points to match with the treeView?
  }
}

function computeDiskPacking() {
  // TODO(Parker) Replace with more advanced disk packing algorithm, probably move this function to another file.
  var adjacencyMatrix = {};
  for (var point of treePointsSet) {
    adjacencyMatrix[point.name] = {};
  }
  for (var point of treePointsSet) {
    for (var incidentLine of treePoints.get(point)) {
      var point1 = incidentLine.point1;
      var point2 = incidentLine.point2;
      adjacencyMatrix[point1.name][point2.name] = adjacencyMatrix[point2.name][point1.name] = point1.Dist(point2).toFixed(5);
      // Round to 5 decimal places in case user typed in exact number for edge length.
    }
  }
  var diskPacking = {};
  for (var vertexId of Object.keys(adjacencyMatrix)) {
    diskPacking[vertexId] = [Math.random(), Math.random()];
  }
  return diskPacking;
}

function computeAndShowDiskPacking(alsoComputeCreases) {
  diskPacking = computeDiskPacking();
  showDiskPacking();
  if (alsoComputeCreases) {
    computeAndShowCreases();
  }
}
